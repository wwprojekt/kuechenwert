// deno-lint-ignore-file no-explicit-any
import {
  buildEmailLayout,
  paragraph,
  infoBox,
  detailRow,
  button,
  warningBox,
} from './email-builder.ts';

/**
 * Sends a SHORT, ATTACHMENT-FREE follow-up email to confirm that the
 * purchase contract PDF was sent. Acts as a deliverability safety net:
 * many B2B mail servers (Hornetsecurity / NoSpamProxy / Outlook Junk)
 * silently quarantine the original email because of the PDF attachment +
 * "Kaufvertrag" wording. A plain HTML mail with a download button passes
 * those filters far more reliably and gives the recipient a fallback
 * download path even if the attachment mail never reaches the inbox.
 *
 * Failures are logged but never thrown — this must NEVER break the main
 * sale flow.
 */
export async function sendContractSentNotification(opts: {
  resendApiKey: string;
  supabase: any;
  settingsData: { site_name?: string; [k: string]: any };
  recipientEmail: string;
  recipientName: string;
  contractNumber: string;
  vehicleName: string;
  salePrice: number;
  downloadUrl: string;
  party: 'seller' | 'buyer';
}): Promise<{ success: boolean; error?: string; resendId?: string }> {
  const siteName = opts.settingsData?.site_name || 'KuechenWert';
  const subject = `Bestätigung: Kaufvertrag ${opts.contractNumber} versendet`;
  const intro =
    opts.party === 'buyer'
      ? `Sehr geehrte/r ${opts.recipientName},`
      : `Hallo ${opts.recipientName},`;

  const html = buildEmailLayout(opts.settingsData as any, 'Kaufvertrag versendet', `
    ${paragraph(intro)}
    ${paragraph('soeben haben wir Ihnen den <strong>Kaufvertrag mit PDF-Anhang</strong> per E-Mail zugesendet.')}
    ${infoBox('Vertragsdetails', `
      ${detailRow('Vertragsnr.', opts.contractNumber)}
      ${detailRow('Fahrzeug', opts.vehicleName)}
      ${detailRow('Kaufpreis', `€${Number(opts.salePrice).toLocaleString('de-DE')}`)}
    `, 'success')}
    ${warningBox('Falls die separate E-Mail mit dem PDF-Anhang nicht in Ihrem Posteingang erscheint, prüfen Sie bitte Ihren Spam- bzw. Quarantäne-Ordner. Anhänge werden bei vielen Firmen-Mailservern strenger gefiltert.')}
    ${paragraph('Alternativ können Sie den vollständigen Kaufvertrag jederzeit direkt herunterladen:')}
    ${button('Kaufvertrag herunterladen (PDF)', opts.downloadUrl)}
    ${paragraph('Sollte der Link nicht funktionieren, antworten Sie bitte einfach auf diese E-Mail — wir senden Ihnen den Vertrag dann erneut.')}
    ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${siteName} Team`)}
  `);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${siteName} <info@kuechenwert24.de>`,
        to: [opts.recipientEmail],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[contract-notification] Resend rejected ${opts.party} notification:`, errText);
      return { success: false, error: errText };
    }

    const result = await res.json();
    console.log(`[contract-notification] Sent ${opts.party} notification to ${opts.recipientEmail} (${result?.id})`);

    try {
      await opts.supabase.from('admin_emails').insert({
        sender_email: 'info@kuechenwert24.de',
        sender_name: siteName,
        recipient_email: opts.recipientEmail,
        recipient_name: opts.recipientName,
        subject,
        body_html: html,
        body_text: '',
        email_type: 'purchase_contract_notification',
        direction: 'outbound',
        status: 'sent',
        resend_id: result?.id || null,
        is_read: false,
      });
    } catch (logErr) {
      console.error(`[contract-notification] Failed to log ${opts.party} notification:`, logErr);
    }

    return { success: true, resendId: result?.id };
  } catch (e: any) {
    console.error(`[contract-notification] Exception sending ${opts.party} notification:`, e);
    return { success: false, error: e?.message || String(e) };
  }
}
