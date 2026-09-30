import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph, infoBox, detailRow, amountDisplay, button, customerBadge } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import { BRAND } from '../_shared/brand-config.ts';
import { describeInvoice } from '../_shared/invoice-labels.ts';
import { formatIban, issuerProfile, missingIssuerFields } from '../_shared/issuer-profile.ts';

/**
 * Edge Function: send-invoice-email
 *
 * Versendet eine Rechnung (Kontaktfreischaltung, Provision) mit PDF-Anhang an
 * das Küchenstudio. Der erste Versand stellt die Rechnung aus
 * (draft → sent); erneutes Senden verschickt nur eine Kopie und lässt Status
 * und Zahlungsstand unverändert.
 *
 * Aufrufer: kw-market-worker (invoice_issue), Admin-Finanzen
 * Auth: service_role oder Admin
 */

interface InvoiceEmailRequest {
  invoiceId: string;
  pdfBase64?: string; // Optional: PDF as base64 from generate-invoice-pdf
}

class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly code: string) {
    super(message);
  }
}

/** Base64 in Blöcken: String.fromCharCode(...bytes) sprengt bei größeren PDFs den Stack. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // ─── Auth check: must be service_role (cron/internal) or authenticated admin ───
  const authResult = await checkServiceRoleOrAdmin(req, getCorsHeaders(req));
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    // ─── Initialize Supabase admin client ────────────────────────
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { invoiceId, pdfBase64: providedPdfBase64 }: InvoiceEmailRequest = await req.json().catch(() => ({ invoiceId: '' }));

    if (!invoiceId) {
      throw new HttpError(400, 'Rechnungs-ID fehlt.', 'invoice_id');
    }

    // ─── Fetch invoice with all related data ───────────────────────
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select(`
        *,
        dealer:profiles(first_name, last_name, company_name, email, customer_number),
        lead:leads(postal_code, city),
        items:invoice_items(description)
      `)
      .eq('id', invoiceId)
      .maybeSingle();

    if (invoiceError) throw invoiceError;
    if (!invoice) {
      throw new HttpError(404, 'Rechnung nicht gefunden.', 'not_found');
    }
    if (invoice.status === 'cancelled') {
      throw new HttpError(409, 'Stornierte Rechnungen werden nicht versendet.', 'cancelled');
    }
    if (!invoice.dealer?.email) {
      throw new HttpError(422, 'Für dieses Küchenstudio ist keine E-Mail-Adresse hinterlegt.', 'recipient_email');
    }

    // ─── Get site settings ─────────────────────────────────────────
    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const issuer = issuerProfile(settings);
    const missing = missingIssuerFields(issuer);
    if (missing.length > 0) {
      throw new HttpError(
        422,
        `Rechnung nicht versendet: In Admin → Einstellungen → Rechnungen fehlt ${missing.join(' und ')}.`,
        'issuer_incomplete',
      );
    }

    const siteName = settings?.site_name || BRAND.name;

    const settingsData = {
      site_name: siteName,
      site_description: settings?.site_description || BRAND.tagline,
      contact_email: settings?.contact_email || BRAND.supportEmail,
      support_phone: settings?.support_phone || '',
    };

    // ─── Prepare display values ────────────────────────────────────
    const labels = describeInvoice(invoice);

    const personName = `${invoice.dealer.first_name || ''} ${invoice.dealer.last_name || ''}`.trim();
    const dealerName = invoice.dealer.company_name || personName;
    const salutation = invoice.dealer.company_name || !personName
      ? 'Sehr geehrte Damen und Herren,'
      : `Guten Tag ${personName},`;
    const itemDescription = invoice.items?.find((it: { description?: string | null }) => it.description)?.description
      || labels.fallbackItemDescription;

    const invoiceDate = invoice.invoice_date || invoice.created_at;
    const invoiceDateFormatted = new Date(invoiceDate).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const dueDateFormatted = new Date(invoice.due_date).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const grossFormatted = Number(invoice.gross_amount).toLocaleString('de-DE', { 
      minimumFractionDigits: 2, maximumFractionDigits: 2 
    });
    const payDays = invoice.payment_terms_days || 14;

    // ─── Build email content ───────────────────────────────────────
    const content = `
      ${paragraph(salutation)}
      ${customerBadge(invoice.dealer.customer_number || invoice.customer_number)}
      ${paragraph(labels.intro)}
      
      ${infoBox('Rechnungsdetails', `
        ${detailRow('Rechnungsnummer', invoice.invoice_number)}
        ${detailRow('Leistung', itemDescription)}
        ${detailRow(labels.referenceTitle, labels.referenceValue)}
        ${detailRow('Rechnungsdatum', invoiceDateFormatted)}
        ${detailRow('F&auml;lligkeitsdatum', dueDateFormatted)}
        ${detailRow('Zahlungsziel', `${payDays} Tage`)}
      `, 'info')}

      ${amountDisplay('Rechnungsbetrag', `&euro;${grossFormatted}`)}

      ${infoBox('Zahlungsinformationen', `
        ${detailRow('Empf&auml;nger', issuer.accountHolder)}
        ${detailRow('IBAN', formatIban(issuer.iban))}
        ${issuer.bic ? detailRow('BIC', issuer.bic) : ''}
        ${issuer.bankName ? detailRow('Bank', issuer.bankName) : ''}
        ${detailRow('Verwendungszweck', invoice.invoice_number)}
      `)}

      ${invoice.pdf_url ? button('Rechnung herunterladen', invoice.pdf_url) : ''}

      ${paragraph('Bei Fragen zu Ihrer Rechnung stehen wir Ihnen gerne zur Verf&uuml;gung.')}
    `;

    const emailSubject = `Rechnung ${invoice.invoice_number} - ${siteName}`;
    const emailHtml = buildEmailLayout(settingsData, 'Neue Rechnung', content);

    // ─── PDF-Anhang: Die Rechnung ist das PDF, ohne Anhang kein Versand ──
    let pdfBase64 = providedPdfBase64;
    if (!pdfBase64) {
      // Pfadregel identisch zu generate-invoice-pdf und src/lib/invoiceStorage.ts
      const storagePath = `${invoice.dealer_id}/${invoice.invoice_number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
      const { data: stored } = await supabaseAdmin.storage.from('invoices').download(storagePath);
      if (stored) pdfBase64 = toBase64(new Uint8Array(await stored.arrayBuffer()));
    }
    if (!pdfBase64) {
      throw new HttpError(409, 'Das Rechnungs-PDF fehlt. Bitte das PDF erzeugen und erneut senden.', 'pdf_missing');
    }
    const attachments = [{
      filename: `Rechnung_${invoice.invoice_number}.pdf`,
      content: pdfBase64,
      type: 'application/pdf',
    }];

    // ─── Send email via Resend ─────────────────────────────────────
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const emailPayload: any = {
      from: `${siteName} <${BRAND.supportEmail}>`,
      to: [invoice.dealer.email],
      subject: emailSubject,
      html: emailHtml,
    };

    if (attachments && attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error('Resend API error:', errorData);
      throw new Error(`Failed to send invoice email: ${errorData}`);
    }

    const resendResult = await resendResponse.json();

    // ─── Log in admin_emails for System tab ─────────────────────────
    try {
      await supabaseAdmin.from('admin_emails').insert({
        sender_email: BRAND.supportEmail,
        sender_name: siteName,
        recipient_email: invoice.dealer.email,
        recipient_name: dealerName || null,
        subject: emailSubject,
        body_html: emailHtml,
        body_text: '',
        email_type: 'invoice',
        direction: 'outbound',
        status: 'sent',
        resend_id: resendResult?.id || null,
        is_read: true,
      });
    } catch (logErr) {
      console.error('Failed to log email in admin_emails:', logErr);
    }

    // ─── Erster Versand stellt die Rechnung aus; Kopien ändern nichts ──
    if (invoice.status === 'draft') {
      const now = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from('invoices')
        .update({ sent_at: now, status: 'sent', updated_at: now })
        .eq('id', invoiceId)
        .eq('status', 'draft');

      if (updateError) {
        console.error('Error updating invoice sent_at:', updateError);
      }
    }

    console.log(`Invoice email sent successfully: ${invoice.invoice_number} → ${invoice.dealer.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invoice email sent successfully',
        invoiceNumber: invoice.invoice_number,
        sentTo: invoice.dealer.email,
        hasAttachment: !!attachments,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-invoice-email:', error);
    const known = error instanceof HttpError;
    return new Response(
      JSON.stringify({
        error: known ? error.message : 'Die Rechnung konnte nicht versendet werden.',
        code: known ? error.code : 'send_failed',
      }),
      {
        status: known ? error.status : 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
