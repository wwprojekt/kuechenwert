import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { buildEmailLayout, paragraph, infoBox, detailRow, amountDisplay, button } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Auth check: must be service_role (internal) or authenticated admin
  const authHeader = req.headers.get('authorization') ?? '';
  const isServiceRole = authHeader.includes(SUPABASE_SERVICE_ROLE_KEY);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (!isServiceRole) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }
    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some((r: any) => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const { invoiceId }: InvoiceEmailRequest = await req.json();

    if (!invoiceId) {
      throw new Error('Invoice ID is required');
    }

    // ─── Fetch invoice with all related data ───────────────────────
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select(`
        *,
        dealer:profiles(first_name, last_name, company_name, email),
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
      contact_email: settings?.contact_email || 'kontakt@caravanwert.de',
      support_phone: settings?.support_phone || '',
    };

    // ─── Prepare display values ────────────────────────────────────
    const dealerName = invoice.dealer.company_name || 
      `${invoice.dealer.first_name || ''} ${invoice.dealer.last_name || ''}`.trim();
    
    const motorhomeName = invoice.auction?.motorhome 
      ? `${invoice.auction.motorhome.manufacturer} ${invoice.auction.motorhome.model}` 
      : 'Vermittlungsprovision';

    // Use invoice_date (new column), fallback to created_at
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

    // ─── Build email content ───────────────────────────────────────
    const content = `
      ${paragraph(`Sehr geehrte/r ${dealerName},`)}
      ${paragraph('Ihre Rechnung f&uuml;r den erfolgreichen Kauf bei CaravanWert ist bereit.')}
      
      ${infoBox('Rechnungsdetails', `
        ${detailRow('Rechnungsnummer', invoice.invoice_number)}
        ${detailRow('Fahrzeug', motorhomeName)}
        ${detailRow('Rechnungsdatum', invoiceDateFormatted)}
        ${detailRow('F&auml;lligkeitsdatum', dueDateFormatted)}
        ${detailRow('Zahlungsziel', '14 Tage')}
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

    const emailSubject = `Rechnung ${invoice.invoice_number} - ${siteName}`;
    const emailHtml = buildEmailLayout(settingsData, 'Neue Rechnung', content);

    // ─── Download PDF for attachment (if available) ────────────────
    let attachments: any[] | undefined = undefined;

    if (invoice.pdf_url) {
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
