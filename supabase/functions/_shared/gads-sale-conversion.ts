/**
 * Shared helper: uploadSaleConversionToGoogleAds
 *
 * Uploads a confirmed sale to the Google Ads API as an offline click conversion.
 * Used by `close-auction`, `instant-buy`, and `accept-kaufchance-offer` so that
 * every sale path reports identically to Google Ads.
 *
 * Behaviour:
 * - Requires a confirmed sale (caller decides; we only run when invoked).
 * - Skips silently if no GCLID/GBRAID/WBRAID is present on the kitchen
 *   (we have no way to attribute the sale to a Google Ads click).
 * - Skips silently if any of the required Edge Function secrets is missing.
 * - Uploads to action ID `GADS_SALE_CONVERSION_ACTION_ID` ("Fahrzeug Verkauft").
 * - Conversion value defaults to the calculated commission (fallback 5 %),
 *   currency EUR. Order ID is `sale_<auctionId>_<timestamp>` for dedup.
 * - Adds the seller's hashed email as a User Identifier for Enhanced
 *   Conversions for Leads.
 *
 * Returns a small structured result so callers can append errors to their
 * existing admin-summary.
 */

interface KitchenClickIds {
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  /**
   * Microsoft Click ID (Bing Ads). Heute hier nur als akzeptiertes Feld
   * deklariert, damit TS-Excess-Property-Checks in den Aufrufern nicht
   * fehlschlagen. Die tatsächliche Bing-Sale-Conversion-Upload-Logik
   * wird in Phase 2 ergänzt (Bing Conversions API mit `msclkid`).
   * Das Feld wird heute aus den Aufrufer-Payloads transparent durchgereicht
   * und in der Google-Ads-Logik unten ignoriert (kein Effekt).
   */
  msclkid?: string | null;
}

export interface UploadSaleConversionParams {
  /** Supabase client with service-role / admin scope (for RPC + profile lookup). */
  supabase: any;
  /** Source for log prefix, e.g. "close-auction", "instant-buy". */
  source: string;
  auctionId: string;
  kitchenId: string;
  sellerId: string | null | undefined;
  /** Dealer (buyer) ID — used for commission calculation. */
  dealerId: string;
  /** Final sale price in EUR. */
  saleAmount: number;
  /** Click IDs that were stored on the kitchen at sale time. */
  clickIds: KitchenClickIds;
}

export interface UploadSaleConversionResult {
  attempted: boolean;
  success: boolean;
  skipped?: 'no_click_id' | 'missing_secrets';
  status?: number;
  error?: string;
  commissionAmount?: number;
  conversionValue?: number;
  orderId?: string;
}

const LOGIN_CUSTOMER_ID_FALLBACK = '9746508145';

export async function uploadSaleConversionToGoogleAds(
  params: UploadSaleConversionParams,
): Promise<UploadSaleConversionResult> {
  const { supabase, source, auctionId, kitchenId, sellerId, dealerId, saleAmount, clickIds } = params;
  const log = (msg: string, ...rest: unknown[]) => console.log(`[gads-sale][${source}] ${msg}`, ...rest);
  const errLog = (msg: string, ...rest: unknown[]) => console.error(`[gads-sale][${source}] ${msg}`, ...rest);

  if (!clickIds.gclid && !clickIds.gbraid && !clickIds.wbraid) {
    log('No GCLID/GBRAID/WBRAID on kitchen, skipping Google Ads sale upload.');
    return { attempted: false, success: false, skipped: 'no_click_id' };
  }

  const GADS_CUSTOMER_ID = Deno.env.get('GADS_CUSTOMER_ID');
  const GADS_DEVELOPER_TOKEN = Deno.env.get('GADS_DEVELOPER_TOKEN');
  const GADS_OAUTH_REFRESH_TOKEN = Deno.env.get('GADS_OAUTH_REFRESH_TOKEN');
  const GADS_OAUTH_CLIENT_ID = Deno.env.get('GADS_OAUTH_CLIENT_ID');
  const GADS_OAUTH_CLIENT_SECRET = Deno.env.get('GADS_OAUTH_CLIENT_SECRET');
  const SALE_CONVERSION_ACTION_ID = Deno.env.get('GADS_SALE_CONVERSION_ACTION_ID');
  const GADS_LOGIN_CUSTOMER_ID = Deno.env.get('GADS_LOGIN_CUSTOMER_ID') || LOGIN_CUSTOMER_ID_FALLBACK;

  if (
    !GADS_CUSTOMER_ID ||
    !GADS_DEVELOPER_TOKEN ||
    !GADS_OAUTH_REFRESH_TOKEN ||
    !GADS_OAUTH_CLIENT_ID ||
    !GADS_OAUTH_CLIENT_SECRET ||
    !SALE_CONVERSION_ACTION_ID
  ) {
    log('Google Ads API credentials incomplete, skipping sale conversion.');
    return { attempted: false, success: false, skipped: 'missing_secrets' };
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: GADS_OAUTH_CLIENT_ID,
        client_secret: GADS_OAUTH_CLIENT_SECRET,
        refresh_token: GADS_OAUTH_REFRESH_TOKEN,
      }),
    });

    if (!tokenResponse.ok) {
      const txt = await tokenResponse.text();
      throw new Error(`OAuth token error: ${tokenResponse.status} ${txt}`);
    }

    const { access_token: accessToken } = await tokenResponse.json();
    const customerId = GADS_CUSTOMER_ID.replace(/-/g, '');

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

    const conversionDateTime = new Date().toISOString().replace('T', ' ').replace('Z', '+00:00');
    const orderId = `sale_${auctionId}_${Date.now()}`;

    const conversion: Record<string, unknown> = {
      conversionAction: `customers/${customerId}/conversionActions/${SALE_CONVERSION_ACTION_ID}`,
      conversionDateTime,
      conversionValue: commissionAmount,
      currencyCode: 'EUR',
      orderId,
      userIdentifiers: [],
    };

    if (clickIds.gclid) conversion.gclid = clickIds.gclid;
    if (clickIds.gbraid) conversion.gbraid = clickIds.gbraid;
    if (clickIds.wbraid) conversion.wbraid = clickIds.wbraid;

    if (sellerId) {
      try {
        const { data: sellerForHash } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', sellerId)
          .single();

        if (sellerForHash?.email) {
          const encoder = new TextEncoder();
          const data = encoder.encode(sellerForHash.email.trim().toLowerCase());
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashedEmail = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
          (conversion.userIdentifiers as Array<Record<string, unknown>>).push({ hashedEmail });
        }
      } catch (hashErr) {
        errLog('Failed to add hashed email for Enhanced Conversions:', hashErr);
      }
    }

    const gadsResponse = await fetch(
      `https://googleads.googleapis.com/v23/customers/${customerId}:uploadClickConversions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'developer-token': GADS_DEVELOPER_TOKEN,
          'login-customer-id': GADS_LOGIN_CUSTOMER_ID,
        },
        body: JSON.stringify({ conversions: [conversion], partialFailure: true }),
      },
    );

    const gadsResult = await gadsResponse.json().catch(() => null);
    log(
      `Google Ads sale upload: HTTP ${gadsResponse.status} ` +
        `(commission €${commissionAmount.toFixed(2)} of sale €${saleAmount}, kitchen ${kitchenId})`,
    );

    if (!gadsResponse.ok) {
      errLog('Google Ads API error:', JSON.stringify(gadsResult));
      return {
        attempted: true,
        success: false,
        status: gadsResponse.status,
        error: `Google Ads API HTTP ${gadsResponse.status}`,
        commissionAmount,
        conversionValue: commissionAmount,
        orderId,
      };
    }

    const partialErrors = (gadsResult as Record<string, unknown> | null)?.partialFailureError;
    if (partialErrors) {
      errLog('Google Ads partialFailureError:', JSON.stringify(partialErrors));
      return {
        attempted: true,
        success: false,
        status: gadsResponse.status,
        error: 'Google Ads partial failure (see logs)',
        commissionAmount,
        conversionValue: commissionAmount,
        orderId,
      };
    }

    return {
      attempted: true,
      success: true,
      status: gadsResponse.status,
      commissionAmount,
      conversionValue: commissionAmount,
      orderId,
    };
  } catch (gadsErr: any) {
    errLog('Google Ads sale conversion error:', gadsErr);
    return {
      attempted: true,
      success: false,
      error: gadsErr?.message ?? String(gadsErr),
    };
  }
}
