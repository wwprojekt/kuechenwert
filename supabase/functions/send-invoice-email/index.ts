import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph, infoBox, detailRow, amountDisplay, button, customerBadge } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

/**
 * Edge Function: send-invoice-email
 * 
 * Sends a professional invoice email to the dealer with:
 * - Invoice details (number, amount, due date)
 * - Payment information (bank details from site_settings)
 * - PDF attachment (downloaded from storage and attached as base64)
 * 
 * Called by: close-auction, instant-buy (after invoice + PDF creation)
 * Auth: service_role or admin
 */

interface InvoiceEmailRequest {
  invoiceId: string;
  pdfBase64?: string; // Optional: PDF as base64 from generate-invoice-pdf
}

const PENALTY_REASON_LABELS: Record<string,string> = {
  anderweitiger_verkauf: 'Anderweitiger Verkauf während Auktion',
  vorzeitige_ruecknahme: 'Vorzeitige Rücknahme des Fahrzeugs',
  falsche_angaben: 'Falsche/irreführende Angaben',
};

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

    const { invoiceId, pdfBase64: providedPdfBase64 }: InvoiceEmailRequest = await req.json();

    if (!invoiceId) {
      throw new Error('Invoice ID is required');
    }

    // ─── Fetch invoice with all related data ───────────────────────
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select(`
        *,
        dealer:profiles(first_name, last_name, company_name, email, customer_number),
        auction:auctions(
          motorhome:motorhomes(manufacturer, model)
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Invoice not found: ${invoiceError?.message || 'Unknown'}`);
    }

    if (!invoice.dealer?.email) {
      throw new Error('Dealer email not found');
    }

    // ─── Get site settings ─────────────────────────────────────────
    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const siteName = settings?.site_name || 'CaravanWert';
    const bankIban = settings?.bank_iban || '';
    const bankBic = settings?.bank_bic || '';

    const settingsData = {
      site_name: siteName,
      site_description: settings?.site_description || 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: settings?.contact_email || 'info@caravanwert.de',
      support_phone: settings?.support_phone || '',
    };

    // ─── Prepare display values ────────────────────────────────────
    const isPenalty = invoice.invoice_type === 'seller_penalty';
    const penaltyReasonLabel = isPenalty
      ? (PENALTY_REASON_LABELS[invoice.penalty_reason] || invoice.penalty_reason || 'Vertragsstrafe')
      : '';

    const dealerName = invoice.dealer.company_name || 
      `${invoice.dealer.first_name || ''} ${invoice.dealer.last_name || ''}`.trim();
    
    const motorhomeName = invoice.auction?.motorhome 
      ? `${invoice.auction.motorhome.manufacturer} ${invoice.auction.motorhome.model}` 
      : 'Vermittlungsprovision';

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
    const introText = isPenalty
      ? 'hiermit erhalten Sie Ihre Rechnung &uuml;ber eine Vertragsstrafe gem&auml;&szlig; &sect; 8 Abs. 4 unserer AGB.'
      : 'Ihre Rechnung f&uuml;r den erfolgreichen Kauf bei CaravanWert ist bereit.';

    const detailLabel = isPenalty ? 'Grund' : 'Fahrzeug';
    const detailValue = isPenalty ? penaltyReasonLabel : motorhomeName;

    const content = `
      ${paragraph(`Sehr geehrte/r ${dealerName},`)}
      ${customerBadge(invoice.dealer.customer_number || invoice.customer_number)}
      ${paragraph(introText)}
      
      ${infoBox('Rechnungsdetails', `
        ${detailRow('Rechnungsnummer', invoice.invoice_number)}
        ${detailRow(detailLabel, detailValue)}
        ${detailRow('Rechnungsdatum', invoiceDateFormatted)}
        ${detailRow('F&auml;lligkeitsdatum', dueDateFormatted)}
        ${detailRow('Zahlungsziel', `${payDays} Tage`)}
      `, 'info')}

      ${amountDisplay('Rechnungsbetrag', `&euro;${grossFormatted}`)}

      ${infoBox('Zahlungsinformationen', `
        ${bankIban ? detailRow('IBAN', bankIban) : ''}
        ${bankBic ? detailRow('BIC', bankBic) : ''}
        ${detailRow('Verwendungszweck', invoice.invoice_number)}
      `)}

      ${invoice.pdf_url ? button('Rechnung herunterladen', invoice.pdf_url) : ''}

      ${paragraph('Bei Fragen zu Ihrer Rechnung stehen wir Ihnen gerne zur Verf&uuml;gung.')}
    `;

    const emailTitle = isPenalty ? 'Vertragsstrafe' : 'Neue Rechnung';
    const emailSubject = isPenalty
      ? `Vertragsstrafe – Rechnung ${invoice.invoice_number} - ${siteName}`
      : `Rechnung ${invoice.invoice_number} - ${siteName}`;
    const emailHtml = buildEmailLayout(settingsData, emailTitle, content);

    // ─── Download PDF for attachment (if available) ────────────────
    let attachments: any[] | undefined = undefined;

    // Priority 1: Use provided pdfBase64 from generate-invoice-pdf
    if (providedPdfBase64) {
      console.log('Using provided pdfBase64 for attachment');
      attachments = [{
        filename: `Rechnung_${invoice.invoice_number}.pdf`,
        content: providedPdfBase64,
        type: 'application/pdf',
      }];
    }
    // Priority 2: Download PDF from storage URL
    else if (invoice.pdf_url) {
      try {
        const pdfResponse = await fetch(invoice.pdf_url);
        if (pdfResponse.ok) {
          const pdfArrayBuffer = await pdfResponse.arrayBuffer();
          const pdfBase64 = btoa(
            String.fromCharCode(...new Uint8Array(pdfArrayBuffer))
          );
          
          const fileExtension = invoice.pdf_url.includes('.pdf') ? 'pdf' : 'html';
          const mimeType = fileExtension === 'pdf' ? 'application/pdf' : 'text/html';
          
          attachments = [{
            filename: `Rechnung_${invoice.invoice_number}.${fileExtension}`,
            content: pdfBase64,
            type: mimeType,
          }];
        }
      } catch (attachError) {
        console.error('Error downloading PDF for attachment:', attachError);
        // Continue without attachment - the download link is still in the email
      }
    }

    // ─── Send email via Resend ─────────────────────────────────────
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const emailPayload: any = {
      from: `${siteName} <info@caravanwert.de>`,
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
        sender_email: 'info@caravanwert.de',
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

    // ─── Update invoice: mark as sent ──────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from('invoices')
      .update({ 
        sent_at: new Date().toISOString(),
        status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    if (updateError) {
      console.error('Error updating invoice sent_at:', updateError);
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

  } catch (error: any) {
    console.error('Error in send-invoice-email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
