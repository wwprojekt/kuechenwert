/**
 * Shared helper: sendBlankHandoverProtocol
 *
 * Generates a BLANK handover-protocol PDF (via the
 * `generate-blank-handover-protocol` Edge Function) and sends it in TWO
 * SEPARATE e-mails (one to the seller, one to the buyer) — distinct from
 * the Kaufvertrag mail so that a failure here NEVER breaks the contract
 * flow (Option B: graceful degradation by isolation).
 *
 * Idempotency: the function logs to `admin_emails` with
 *   email_type = 'handover_protocol_blank'
 * so duplicate sends are detectable / dedupable downstream.
 *
 * The function ALWAYS returns `{ ok, info, error }` — it never throws.
 * Callers MUST treat any error as non-fatal and only log it (so the
 * Kaufvertrag flow remains the source of truth for the user-facing
 * response).
 */

import { buildEmailLayout, paragraph, infoBox, detailRow } from './email-builder.ts';
import { logEdgeError } from './edgeLogger.ts';

interface SettingsLike {
  site_name?: string;
  contact_email?: string | null;
  // index signature so we can pass full site_settings rows without type errors
  [key: string]: unknown;
}

interface ProfileLike {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
}

export interface SendBlankHandoverProtocolArgs {
  /** Supabase client created with service-role key (so we can invoke functions + write to admin_emails). */
  supabase: any;
  /** Resend API key (read by caller from env). */
  resendApiKey: string;
  /** Resolved site_settings row (or sensible fallback). */
  settingsData: SettingsLike;

  motorhomeId: string;
  buyerId: string;
  sellerId: string;
  contractNumber: string;
  salePrice: number;

  vehicleName: string;
  sellerProfile?: ProfileLike | null;
  buyerProfile?: ProfileLike | null;

  /** Source label for logging (e.g. 'close-auction', 'instant-buy'). */
  source: string;

  /**
   * Optional recipient filter.
   *  - 'both' (default): send to seller AND buyer
   *  - 'buyer': send only to the buyer (used for retry after partial failure)
   *  - 'seller': send only to the seller
   */
  recipients?: 'both' | 'buyer' | 'seller';
}

export interface SendBlankHandoverProtocolResult {
  ok: boolean;
  /** Non-throwing diagnostic message (sent / partial / skipped / failed). */
  info: string;
  /** Truthy only if the protocol generation OR both mails failed completely. */
  error?: string;
}

/**
 * Best-effort: generate blank handover protocol + send 2 separate mails.
 * Never throws.
 */
export async function sendBlankHandoverProtocol(
  args: SendBlankHandoverProtocolArgs,
): Promise<SendBlankHandoverProtocolResult> {
  const result = await sendBlankHandoverProtocolInner(args);

  // ─── Persist visible failure into error_logs ──────────────────────────
  // ANY non-ok result (or partial failure) is logged so admins can see it
  // in the dashboard without combing edge function logs.
  if (!result.ok || result.info?.startsWith('partial')) {
    try {
      await logEdgeError(args.supabase, {
        component: 'sendBlankHandoverProtocol',
        message: `Blank handover protocol delivery problem (${args.source}): ${result.info}`,
        severity: result.ok ? 'medium' : 'high',
        category: 'contract',
        errorCode: 'BLANK_HANDOVER_PROTOCOL_FAILED',
        metadata: {
          source: args.source,
          contractNumber: args.contractNumber,
          motorhomeId: args.motorhomeId,
          buyerId: args.buyerId,
          sellerId: args.sellerId,
          info: result.info,
          error: result.error || null,
          sellerEmail: args.sellerProfile?.email || null,
          buyerEmail: args.buyerProfile?.email || null,
        },
      });
    } catch (e) {
      console.warn(`[${args.source}] failed to log blank-protocol failure to error_logs:`, e);
    }
  }

  return result;
}

async function sendBlankHandoverProtocolInner(
  args: SendBlankHandoverProtocolArgs,
): Promise<SendBlankHandoverProtocolResult> {
  const {
    supabase, resendApiKey, settingsData,
    motorhomeId, buyerId, sellerId, contractNumber, salePrice,
    vehicleName, sellerProfile, buyerProfile, source,
    recipients: recipientFilter = 'both',
  } = args;

  if (!resendApiKey) {
    return { ok: false, info: 'skipped: RESEND_API_KEY missing' };
  }
  if (!motorhomeId || !buyerId || !sellerId || !contractNumber) {
    return { ok: false, info: 'skipped: missing required ids' };
  }

  // ─── 1. Generate the blank protocol PDF ───────────────────────────────
  // IMPORTANT: We use direct fetch() (NOT supabase.functions.invoke()) because
  // when this helper runs inside an Edge Function, the Supabase JS SDK can
  // pass through the original caller's user JWT instead of the service-role
  // key in the Authorization header — which makes generate-blank-handover-
  // protocol reject with 401. Direct fetch with an explicit service-role
  // Bearer token works from every caller (close-auction, instant-buy,
  // accept-kaufchance-offer, admin-correct-sale, admin-sell-to-dealer,
  // resend-blank-handover-protocol).
  let pdfBase64 = '';
  let protocolUrl = '';
  let storagePath = '';
  try {
    const supabaseUrl = (Deno as any)?.env?.get?.('SUPABASE_URL') ?? '';
    const serviceRoleKey = (Deno as any)?.env?.get?.('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return {
        ok: false,
        info: 'generate failed',
        error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing',
      };
    }
    const res = await fetch(
      `${supabaseUrl}/functions/v1/generate-blank-handover-protocol`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
        body: JSON.stringify({ motorhomeId, buyerId, sellerId, contractNumber, salePrice }),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error(`[${source}] generate-blank-handover-protocol HTTP ${res.status}:`, txt);
      return {
        ok: false,
        info: 'generate failed',
        error: `HTTP ${res.status}: ${txt.slice(0, 300)}`,
      };
    }
    const data = await res.json().catch(() => null) as any;
    if (!data?.success || !data?.pdfBase64) {
      console.error(`[${source}] generate-blank-handover-protocol: unexpected response`, data);
      return { ok: false, info: 'generate: unexpected response', error: 'no pdfBase64' };
    }
    pdfBase64 = data.pdfBase64;
    protocolUrl = data.protocolUrl || '';
    storagePath = data.storagePath || '';
  } catch (e: any) {
    console.error(`[${source}] generate-blank-handover-protocol threw:`, e);
    return { ok: false, info: 'generate threw', error: e?.message || String(e) };
  }

  // ─── 2. Persist URL on the purchase_contracts row (best-effort) ───────
  if (protocolUrl || storagePath) {
    try {
      await supabase
        .from('purchase_contracts')
        .update({
          blank_protocol_url: protocolUrl || null,
          blank_protocol_storage_path: storagePath || null,
        })
        .eq('contract_number', contractNumber);
    } catch (e) {
      console.warn(`[${source}] could not persist blank_protocol_url (non-fatal):`, e);
    }
  }

  // ─── 3. Send to seller + buyer (in sequence, isolated) ────────────────
  const subject = `Übergabeprotokoll zum Kaufvertrag ${contractNumber} – ${vehicleName}`;
  const filename = `${contractNumber}_uebergabeprotokoll.pdf`;
  const fromAddr = `${settingsData.site_name || 'CaravanWert'} <info@caravanwert.de>`;

  const allRecipients: { profile: ProfileLike | null | undefined; party: 'seller' | 'buyer'; salutation: string; intro: string; instructions: string }[] = [
    {
      profile: sellerProfile,
      party: 'seller',
      salutation: 'Hallo',
      intro: 'anbei finden Sie das Übergabeprotokoll zu Ihrem Kaufvertrag. Sie können es ausdrucken und am Übergabetag gemeinsam mit dem Käufer ausfüllen und unterschreiben.',
      instructions: 'Bitte protokollieren Sie KM-Stand, Tankfüllung, übergebene Schlüssel/Dokumente und alle sichtbaren Mängel direkt vor Ort. Beide Parteien sollten je ein unterschriebenes Exemplar erhalten.',
    },
    {
      profile: buyerProfile,
      party: 'buyer',
      salutation: 'Hallo',
      intro: 'anbei finden Sie das Übergabeprotokoll zu Ihrem Kaufvertrag. Wir empfehlen, es vor dem Übergabetermin auszudrucken und gemeinsam mit dem Verkäufer vor Ort auszufüllen.',
      instructions: 'Prüfen Sie KM-Stand, Tankfüllung, übergebene Schlüssel/Dokumente und alle sichtbaren Mängel sorgfältig. Lassen Sie sich die Übergabe von beiden Parteien unterschreiben — das schützt Käufer und Verkäufer gleichermaßen.',
    },
  ];

  // Apply optional recipient filter ('buyer' | 'seller' | 'both')
  const recipients = allRecipients.filter((r) =>
    recipientFilter === 'both' ? true : r.party === recipientFilter
  );

  let sentCount = 0;
  const sendErrors: string[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    // Resend free plan limit is 5 req/sec. Two mails ~simultaneously is fine,
    // but if multiple sales close in parallel we can hit 429. Insert a 250ms
    // delay between recipients of the SAME contract — cheap insurance.
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const email = r.profile?.email;
    if (!email) {
      console.warn(`[${source}] blank protocol mail to ${r.party} skipped: no email`);
      continue;
    }
    const recipientName = r.profile?.company_name
      || `${r.profile?.first_name || ''} ${r.profile?.last_name || ''}`.trim()
      || (r.party === 'buyer' ? 'Käufer' : 'Verkäufer');

    const html = buildEmailLayout(
      settingsData as any,
      'Übergabeprotokoll zum Kaufvertrag',
      `
        ${paragraph(`${r.salutation} ${recipientName},`)}
        ${paragraph(r.intro)}
        ${infoBox('Vertragsdetails', `
          ${detailRow('Vertragsnr.', contractNumber)}
          ${detailRow('Fahrzeug', vehicleName)}
          ${detailRow('Kaufpreis', `€${Number(salePrice).toLocaleString('de-DE')}`)}
        `, 'info')}
        ${paragraph('<strong>Hinweis zur Verwendung:</strong>')}
        ${paragraph(r.instructions)}
        ${paragraph('Das Protokoll ist <strong>kein Ersatz für den Kaufvertrag</strong>, sondern dokumentiert ergänzend den tatsächlichen Zustand und Umfang bei der Schlüsselübergabe.')}
        ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${settingsData.site_name || 'CaravanWert'} Team`)}
      `,
    );

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [email],
          subject,
          html,
          attachments: [{ filename, content: pdfBase64 }],
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Resend ${res.status}: ${txt}`);
      }
      const resJson = await res.json().catch(() => ({}));
      sentCount++;
      console.log(`[${source}] blank protocol mailed to ${r.party} <${email}>`);

      try {
        await supabase.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: settingsData.site_name || 'CaravanWert',
          recipient_email: email,
          recipient_name: recipientName,
          subject,
          body_html: html,
          body_text: '',
          email_type: 'handover_protocol_blank',
          direction: 'outbound',
          status: 'sent',
          resend_id: (resJson as any)?.id || null,
          is_read: false,
        });
      } catch (logErr) {
        console.warn(`[${source}] failed to log blank protocol mail to admin_emails:`, logErr);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error(`[${source}] blank protocol mail to ${r.party} failed:`, msg);
      sendErrors.push(`${r.party}: ${msg}`);
    }
  }

  if (sentCount === 0) {
    return {
      ok: false,
      info: `no mail delivered (${sendErrors.length} attempt(s) failed)`,
      error: sendErrors.join(' | '),
    };
  }
  if (sendErrors.length > 0) {
    return {
      ok: true,
      info: `partial: ${sentCount} sent, ${sendErrors.length} failed (${sendErrors.join(' | ')})`,
    };
  }
  return { ok: true, info: `${sentCount} mail(s) sent` };
}
