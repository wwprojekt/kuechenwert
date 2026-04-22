/**
 * Shared helper: uploadSaleConversionToBingAds
 *
 * Phase 2 (server-side) Pendant zu `uploadSaleConversionToGoogleAds`.
 * Lädt einen bestätigten Verkauf via Microsoft Advertising
 * `ApplyOfflineConversions` REST-API v13 hoch:
 *
 *   POST https://campaign.api.bingads.microsoft.com
 *        /CampaignManagement/v13/OfflineConversions/Apply
 *
 * Quelle: https://learn.microsoft.com/en-us/advertising/campaign-management-service/applyofflineconversions?view=bingads-13
 *
 * Architektur (genau wie Google heute):
 * - Wird von den 4 Sale-Edge-Functions parallel zu Google aufgerufen.
 * - Skipt sauber, wenn Voraussetzungen fehlen — wirft NIE in den Sale-Flow.
 * - Trennt UI-Pixel-Goals (Phase 1, Lead-Tracking) von Server-API-Goals
 *   (Phase 2, Sale-Tracking) → kein Doppel-Counting möglich.
 *
 * Bug-Schutz (siehe Diskussion mit User):
 *  1. Doppel-Upload bei Retry → DB-Tabelle `bing_offline_conversions_log`
 *     mit UNIQUE(motorhome_id, conversion_name); Pre-Flight Lookup.
 *  2. Doppel-Zählung mit Phase-1-Pixel → MS-Ads-seitig getrenntes Goal
 *     (Pixel-Goals = "Wizard abgeschlossen" etc., Server-Goal = "Sale_..."
 *     wird vom Admin als „Offline" Goal-Typ angelegt).
 *  3. Sale-Flow crasht bei Bing-Down → ganzer Helper in try/catch, Fehler
 *     nur in Result-Objekt, der Aufrufer pusht in `errors[]` für Admin-Mail.
 *  4. OAuth-Token expired → Standard-Refresh-Pattern (identisch zu Google).
 *  5. MSCLKID > 90 Tage alt → Pre-Flight Check via `motorhomes.created_at`
 *     als Proxy (echte Klick-Zeit haben wir nicht); Skip mit Reason.
 *  6. Wrong currency → hardcoded 'EUR' (DE-only Markt).
 *  7. Sandbox vs. Production → hardcoded Production-URL.
 *  8. Credentials in Logs → wir loggen nur Status-Strings, niemals Werte.
 *  9. Wrong ConversionTime-Format → ISO-8601 mit 'Z' (UTC) wie in MS-Doku
 *     dokumentiert: "2020-04-30T17:02:35.6853793Z".
 * 10. Race Pixel ↔ API → verschiedene Goals, kein gemeinsamer Counter.
 * 11. TS-Excess-Property-Check → Interface explizit getypt.
 *
 * Returns ein strukturiertes Ergebnis, damit Aufrufer Fehler an die
 * Admin-Summary anhängen können — gleiches Muster wie Google.
 */

interface BingClickIds {
  msclkid?: string | null;
  /**
   * Optional: hashed email/phone für Bing Enhanced Conversions.
   * Falls msclkid fehlt, kann Microsoft trotzdem matchen.
   * Wir hashen unten selbst aus seller.email — Aufrufer muss nichts liefern.
   */
}

export interface UploadBingSaleConversionParams {
  /** Supabase client mit service-role Scope (für RPC + Idempotenz-Lookup). */
  supabase: any;
  /** Source für log prefix, z. B. "close-auction", "instant-buy". */
  source: 'close-auction' | 'instant-buy' | 'accept-kaufchance-offer' | 'admin-sell-to-dealer';
  auctionId: string | null;
  motorhomeId: string;
  /** Wann das motorhome ursprünglich erstellt wurde (Proxy für Click-Zeit). */
  motorhomeCreatedAt?: string | null;
  sellerId: string | null | undefined;
  /** Dealer (buyer) ID — für commission calculation. */
  dealerId: string;
  /** Final sale price in EUR. */
  saleAmount: number;
  /** Click ID(s), die auf dem motorhome bei Sale-Zeit standen. */
  clickIds: BingClickIds;
}

export interface UploadBingSaleConversionResult {
  attempted: boolean;
  success: boolean;
  skipped?:
    | 'no_msclkid'
    | 'missing_secrets'
    | 'click_too_old'
    | 'already_uploaded'
    | 'commission_zero';
  status?: number;
  error?: string;
  commissionAmount?: number;
  conversionValue?: number;
  conversionName?: string;
}

const BING_PRODUCTION_URL =
  'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13/OfflineConversions/Apply';
const OAUTH_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const OAUTH_SCOPE = 'https://ads.microsoft.com/msads.manage offline_access';
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Email-Normalisierung gemäß Microsoft-Spec für Enhanced Conversions:
 * trim, lowercase, "+alias" entfernen, alle Punkte im local-part entfernen.
 * (Identisch zu Bing UET enhanced conversions in src/lib/uetService.ts.)
 */
function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0) return trimmed;
  let local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx);
  const plusIdx = local.indexOf('+');
  if (plusIdx >= 0) local = local.slice(0, plusIdx);
  local = local.replace(/\./g, '');
  return `${local}${domain}`;
}

/**
 * Phone-Normalisierung gemäß E.164: nur Ziffern, ggf. +49 als DE-Fallback.
 */
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let p = raw.replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  if (!p.startsWith('+')) {
    if (p.startsWith('0')) p = `+49${p.slice(1)}`;
    else p = `+${p}`;
  }
  if (!/^\+\d{8,15}$/.test(p)) return null;
  return p;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function uploadSaleConversionToBingAds(
  params: UploadBingSaleConversionParams,
): Promise<UploadBingSaleConversionResult> {
  const {
    supabase,
    source,
    auctionId,
    motorhomeId,
    motorhomeCreatedAt,
    sellerId,
    dealerId,
    saleAmount,
    clickIds,
  } = params;

  const log = (msg: string, ...rest: unknown[]) =>
    console.log(`[bing-sale][${source}] ${msg}`, ...rest);
  const errLog = (msg: string, ...rest: unknown[]) =>
    console.error(`[bing-sale][${source}] ${msg}`, ...rest);

  // --- Bug-Schutz #5: Click zu alt? ---
  // Microsoft verwirft serverseitig Conversions, deren Click-Zeit > 90 Tage
  // vor der Conversion-Zeit liegt. Wir haben keine echte Click-Zeit, aber
  // motorhome.created_at ist ein konservativer Proxy (Klick muss VOR oder
  // GLEICHZEITIG mit der Wizard-Submission gewesen sein). Wenn motorhome
  // älter als 90 Tage ist, war auch der Klick > 90 Tage alt → kein Sinn.
  if (motorhomeCreatedAt) {
    const ageMs = Date.now() - new Date(motorhomeCreatedAt).getTime();
    if (Number.isFinite(ageMs) && ageMs > NINETY_DAYS_MS) {
      log(`Motorhome älter als 90 Tage (age=${Math.round(ageMs / 86400000)}d), Click zu alt — skip.`);
      return { attempted: false, success: false, skipped: 'click_too_old' };
    }
  }

  // --- Bug-Schutz #1 (no_msclkid) ---
  // Bing erlaubt zwar Conversion ohne msclkid wenn man hashedEmail liefert,
  // aber dann ist die Attribution nur über Enhanced-Conversion-Match möglich
  // — viel ungenauer. Für CaravanWert lohnt sich das nicht: ohne msclkid
  // schicken wir nichts. Das ist die saubere, klare Regel.
  if (!clickIds.msclkid) {
    log('No MSCLKID auf motorhome, skipping Bing sale upload.');
    return { attempted: false, success: false, skipped: 'no_msclkid' };
  }

  // --- Bug-Schutz #4: Credentials komplett? ---
  const BING_DEVELOPER_TOKEN = Deno.env.get('BING_DEVELOPER_TOKEN');
  const BING_CUSTOMER_ID = Deno.env.get('BING_CUSTOMER_ID');
  const BING_CUSTOMER_ACCOUNT_ID = Deno.env.get('BING_CUSTOMER_ACCOUNT_ID');
  const BING_OAUTH_CLIENT_ID = Deno.env.get('BING_OAUTH_CLIENT_ID');
  const BING_OAUTH_CLIENT_SECRET = Deno.env.get('BING_OAUTH_CLIENT_SECRET');
  const BING_OAUTH_REFRESH_TOKEN = Deno.env.get('BING_OAUTH_REFRESH_TOKEN');
  const BING_OFFLINE_CONVERSION_GOAL_NAME = Deno.env.get('BING_OFFLINE_CONVERSION_GOAL_NAME');

  if (
    !BING_DEVELOPER_TOKEN ||
    !BING_CUSTOMER_ID ||
    !BING_CUSTOMER_ACCOUNT_ID ||
    !BING_OAUTH_CLIENT_ID ||
    !BING_OAUTH_CLIENT_SECRET ||
    !BING_OAUTH_REFRESH_TOKEN ||
    !BING_OFFLINE_CONVERSION_GOAL_NAME
  ) {
    // Genau das Pattern, das wir bei Google haben: ohne Secrets sauber raus.
    // Solange Setup nicht durch ist, passiert effektiv nichts. Kein Crash.
    log('Bing Ads API credentials incomplete, skipping sale conversion.');
    return { attempted: false, success: false, skipped: 'missing_secrets' };
  }

  const conversionName = BING_OFFLINE_CONVERSION_GOAL_NAME;

  // --- Bug-Schutz #1: Idempotenz-Pre-Flight ---
  // Falls schon ein Eintrag mit (motorhome_id, conversion_name) existiert →
  // wir haben Bing diesen Verkauf schon einmal gemeldet. Nichts mehr machen,
  // sonst doppelt gezählte Conversion in MS Ads.
  try {
    const { data: existing, error: lookupErr } = await supabase
      .from('bing_offline_conversions_log')
      .select('id, status, uploaded_at')
      .eq('motorhome_id', motorhomeId)
      .eq('conversion_name', conversionName)
      .maybeSingle();

    if (lookupErr) {
      // Defensiv: wenn Lookup fehlschlägt, lieber NICHT uploaden — wir wissen
      // nicht, ob ein vorheriger Upload schon erfolgte.
      errLog('Idempotency lookup failed — abort upload to be safe:', lookupErr);
      return {
        attempted: false,
        success: false,
        error: `idempotency lookup failed: ${lookupErr.message}`,
      };
    }

    if (existing && existing.status === 'success') {
      log(
        `Sale already uploaded to Bing on ${existing.uploaded_at} (id=${existing.id}), skipping.`,
      );
      return {
        attempted: false,
        success: true,
        skipped: 'already_uploaded',
        conversionName,
      };
    }
    // Wenn vorheriger Eintrag mit status != 'success' existiert (z. B. http_error),
    // ist Retry erlaubt — UNIQUE-Constraint heißt wir machen UPSERT bei der
    // Insert-Phase weiter unten.
  } catch (lookupCatch) {
    errLog('Idempotency lookup threw — abort upload to be safe:', lookupCatch);
    return {
      attempted: false,
      success: false,
      error: `idempotency lookup threw: ${(lookupCatch as Error)?.message ?? String(lookupCatch)}`,
    };
  }

  // --- Commission ---
  // Identisches Vorgehen wie Google: 5 % Fallback, sonst echte Berechnung.
  // (Wir senden den Commission-Wert, nicht den Sale-Preis, weil Google heute
  // auf den Commission-Wert optimiert. Bing soll auf dieselbe Größe optimieren,
  // damit Smart Bidding zwischen den Plattformen vergleichbar bleibt.)
  let commissionAmount = saleAmount * 0.05;
  try {
    const { data: commRows } = await supabase.rpc('calculate_commission', {
      sale_amount: saleAmount,
      dealer_id_param: dealerId,
    });
    const commResult = Array.isArray(commRows) ? commRows[0] : commRows;
    if (commResult?.commission_amount) {
      commissionAmount = Number(commResult.commission_amount);
    }
  } catch (commErr) {
    errLog('Commission calc failed, using 5 % fallback:', commErr);
  }

  if (!Number.isFinite(commissionAmount) || commissionAmount <= 0) {
    log(`Commission ${commissionAmount} ist 0/ungültig — skip Bing upload.`);
    return { attempted: false, success: false, skipped: 'commission_zero' };
  }

  // --- Bug-Schutz #9: ConversionTime-Format ---
  // MS Doku: "2020-04-30T17:02:35.6853793Z" — toISOString() liefert genau
  // dieses Format (ms-präzision reicht).
  const conversionTime = new Date().toISOString();

  // --- Optional: Enhanced Conversions (hashed email/phone) ---
  let hashedEmail: string | null = null;
  let hashedPhone: string | null = null;
  if (sellerId) {
    try {
      const { data: sellerRow } = await supabase
        .from('profiles')
        .select('email, phone')
        .eq('id', sellerId)
        .single();
      if (sellerRow?.email) {
        hashedEmail = await sha256Hex(normalizeEmail(sellerRow.email));
      }
      if (sellerRow?.phone) {
        const norm = normalizePhone(sellerRow.phone);
        if (norm) hashedPhone = await sha256Hex(norm);
      }
    } catch (hashErr) {
      // Enhanced Conversions sind optional — Fehler hier blockiert nicht.
      errLog('Failed to add hashed email/phone for Enhanced Conversions:', hashErr);
    }
  }

  // --- OAuth Refresh ---
  // Microsoft Entra (Azure AD) Common Endpoint mit dem msads.manage scope.
  // Refresh-Token-Flow ist identisch zu Google.
  let accessToken: string;
  try {
    const tokenResponse = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: BING_OAUTH_CLIENT_ID,
        client_secret: BING_OAUTH_CLIENT_SECRET,
        refresh_token: BING_OAUTH_REFRESH_TOKEN,
        scope: OAUTH_SCOPE,
      }),
    });

    if (!tokenResponse.ok) {
      const txt = await tokenResponse.text();
      throw new Error(`OAuth token error: ${tokenResponse.status} ${txt}`);
    }

    const tokenJson = await tokenResponse.json();
    accessToken = tokenJson.access_token;
    if (!accessToken) {
      throw new Error('OAuth response missing access_token');
    }
  } catch (oauthErr: any) {
    errLog('OAuth refresh failed:', oauthErr);
    // Log-Eintrag fürs Monitoring schreiben, dann Skip.
    await safeLog(supabase, {
      motorhome_id: motorhomeId,
      auction_id: auctionId,
      source,
      conversion_name: conversionName,
      msclkid: clickIds.msclkid,
      conversion_time: conversionTime,
      conversion_value: commissionAmount,
      conversion_currency: 'EUR',
      status: 'exception',
      http_status: null,
      error_message: `oauth_refresh: ${oauthErr?.message ?? String(oauthErr)}`,
    });
    return {
      attempted: true,
      success: false,
      error: `OAuth refresh failed: ${oauthErr?.message ?? String(oauthErr)}`,
      conversionName,
      commissionAmount,
      conversionValue: commissionAmount,
    };
  }

  // --- Bing API Call ---
  // OfflineConversion-Schema laut MS Learn:
  //   ConversionName, ConversionTime, ConversionValue, MicrosoftClickId,
  //   ConversionCurrencyCode, HashedEmailAddress?, HashedPhoneNumber?
  // partialFailure ist KEIN Bing-Konzept (Google-spezifisch); Bing gibt
  // PartialErrors[] in der Response zurück, die wir auswerten müssen.
  const offlineConversion: Record<string, unknown> = {
    ConversionName: conversionName,
    ConversionTime: conversionTime,
    ConversionValue: Number(commissionAmount.toFixed(2)),
    ConversionCurrencyCode: 'EUR',
    MicrosoftClickId: clickIds.msclkid,
  };
  if (hashedEmail) offlineConversion.HashedEmailAddress = hashedEmail;
  if (hashedPhone) offlineConversion.HashedPhoneNumber = hashedPhone;

  let bingResponse: Response;
  let bingResultJson: any = null;
  try {
    bingResponse = await fetch(BING_PRODUCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        DeveloperToken: BING_DEVELOPER_TOKEN,
        CustomerId: BING_CUSTOMER_ID,
        CustomerAccountId: BING_CUSTOMER_ACCOUNT_ID,
      },
      body: JSON.stringify({
        OfflineConversions: [offlineConversion],
      }),
    });
    bingResultJson = await bingResponse.json().catch(() => null);
  } catch (fetchErr: any) {
    errLog('Bing fetch failed:', fetchErr);
    await safeLog(supabase, {
      motorhome_id: motorhomeId,
      auction_id: auctionId,
      source,
      conversion_name: conversionName,
      msclkid: clickIds.msclkid,
      conversion_time: conversionTime,
      conversion_value: commissionAmount,
      conversion_currency: 'EUR',
      status: 'exception',
      http_status: null,
      error_message: `fetch: ${fetchErr?.message ?? String(fetchErr)}`,
    });
    return {
      attempted: true,
      success: false,
      error: `Bing fetch failed: ${fetchErr?.message ?? String(fetchErr)}`,
      conversionName,
      commissionAmount,
      conversionValue: commissionAmount,
    };
  }

  log(
    `Bing sale upload: HTTP ${bingResponse.status} ` +
      `(commission €${commissionAmount.toFixed(2)} of sale €${saleAmount}, motorhome ${motorhomeId})`,
  );

  if (!bingResponse.ok) {
    errLog('Bing API HTTP error:', JSON.stringify(bingResultJson));
    await safeLog(supabase, {
      motorhome_id: motorhomeId,
      auction_id: auctionId,
      source,
      conversion_name: conversionName,
      msclkid: clickIds.msclkid,
      conversion_time: conversionTime,
      conversion_value: commissionAmount,
      conversion_currency: 'EUR',
      status: 'http_error',
      http_status: bingResponse.status,
      error_message: `Bing API HTTP ${bingResponse.status}: ${truncate(JSON.stringify(bingResultJson), 500)}`,
    });
    return {
      attempted: true,
      success: false,
      status: bingResponse.status,
      error: `Bing API HTTP ${bingResponse.status}`,
      conversionName,
      commissionAmount,
      conversionValue: commissionAmount,
    };
  }

  // PartialErrors auswerten. Bing returnt 200 OK auch wenn einzelne
  // Conversions versemmelt wurden (z. B. msclkid unbekannt, goal nicht
  // gefunden). Wir senden nur 1 Conversion → wenn 1 Fehler drin: total fail.
  const partialErrors = bingResultJson?.PartialErrors;
  if (Array.isArray(partialErrors) && partialErrors.length > 0) {
    errLog('Bing PartialErrors:', JSON.stringify(partialErrors));
    const firstErr = partialErrors[0];
    const errMsg =
      firstErr?.ErrorCode || firstErr?.Message || 'Bing partial failure (see logs)';
    await safeLog(supabase, {
      motorhome_id: motorhomeId,
      auction_id: auctionId,
      source,
      conversion_name: conversionName,
      msclkid: clickIds.msclkid,
      conversion_time: conversionTime,
      conversion_value: commissionAmount,
      conversion_currency: 'EUR',
      status: 'partial_failure',
      http_status: bingResponse.status,
      error_message: `partial: ${truncate(JSON.stringify(partialErrors), 500)}`,
    });
    return {
      attempted: true,
      success: false,
      status: bingResponse.status,
      error: `Bing partial failure: ${errMsg}`,
      conversionName,
      commissionAmount,
      conversionValue: commissionAmount,
    };
  }

  // Erfolg → in Idempotenz-Tabelle merken.
  await safeLog(supabase, {
    motorhome_id: motorhomeId,
    auction_id: auctionId,
    source,
    conversion_name: conversionName,
    msclkid: clickIds.msclkid,
    conversion_time: conversionTime,
    conversion_value: commissionAmount,
    conversion_currency: 'EUR',
    status: 'success',
    http_status: bingResponse.status,
    error_message: null,
  });

  return {
    attempted: true,
    success: true,
    status: bingResponse.status,
    conversionName,
    commissionAmount,
    conversionValue: commissionAmount,
  };
}

/**
 * Best-effort Insert in `bing_offline_conversions_log`.
 * Verwendet UPSERT, damit ein vorheriger Failure-Eintrag mit demselben
 * (motorhome_id, conversion_name) bei einem späteren erfolgreichen Retry
 * überschrieben werden kann.
 */
async function safeLog(
  supabase: any,
  row: {
    motorhome_id: string;
    auction_id: string | null;
    source: string;
    conversion_name: string;
    msclkid: string | null | undefined;
    conversion_time: string;
    conversion_value: number;
    conversion_currency: string;
    status: 'success' | 'partial_failure' | 'http_error' | 'exception' | 'skipped';
    http_status: number | null;
    error_message: string | null;
  },
): Promise<void> {
  try {
    const { error } = await supabase
      .from('bing_offline_conversions_log')
      .upsert(
        {
          motorhome_id: row.motorhome_id,
          auction_id: row.auction_id,
          source: row.source,
          conversion_name: row.conversion_name,
          msclkid: row.msclkid ?? null,
          conversion_time: row.conversion_time,
          conversion_value: row.conversion_value,
          conversion_currency: row.conversion_currency,
          status: row.status,
          http_status: row.http_status,
          error_message: row.error_message,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'motorhome_id,conversion_name' },
      );
    if (error) {
      console.error('[bing-sale] failed to write log row:', error);
    }
  } catch (logErr) {
    // Log-Failure soll niemals den Sale-Flow blockieren.
    console.error('[bing-sale] safeLog threw:', logErr);
  }
}

function truncate(s: string, max: number): string {
  if (!s) return s;
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}
