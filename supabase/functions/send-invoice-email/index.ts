import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { buildEmailLayout, paragraph, infoBox, detailRow, amountDisplay, button } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

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
    const isAdmin = roles?.some(r => r.role === 'admin');
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

    // Fetch invoice with dealer info
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
      throw new Error('Invoice not found');
    }

    // Get site settings
    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('*')
      .single();

    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Ihr Wohnmobil-Marktplatz',
      contact_email: 'kontakt@caravanwert.de',
      support_phone: '',
    };

    const dealerName = invoice.dealer.company_name || 
      `${invoice.dealer.first_name} ${invoice.dealer.last_name}`;
    
    const motorhomeName = invoice.auction ? 
      `${invoice.auction.motorhome.manufacturer} ${invoice.auction.motorhome.model}` : 
      'Provision';

    // Build email content with email-builder
    const content = `
      ${paragraph(`Sehr geehrte/r ${dealerName},`)}
      ${paragraph('Ihre Rechnung f&uuml;r den erfolgreichen Kauf bei CaravanWert ist bereit.')}
      
      ${infoBox('Rechnungsdetails', `
        ${detailRow('Rechnungsnummer', invoice.invoice_number)}
        ${detailRow('Fahrzeug', motorhomeName)}
        ${detailRow('Rechnungsdatum', new Date(invoice.invoice_date).toLocaleDateString('de-DE'))}
        ${detailRow('F&auml;lligkeitsdatum', new Date(invoice.due_date).toLocaleDateString('de-DE'))}
      `, 'info')}

      ${amountDisplay('Rechnungsbetrag', `&euro;${invoice.gross_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`)}

      ${infoBox('Zahlungsinformationen', `
        ${detailRow('IBAN', 'DE89 3704 0044 0532 0130 00')}
        ${detailRow('BIC', 'COBADEFFXXX')}
        ${detailRow('Verwendungszweck', invoice.invoice_number)}
      `)}

      ${invoice.pdf_url ? button('Rechnung als PDF herunterladen', invoice.pdf_url) : ''}

      ${paragraph('Bei Fragen zu Ihrer Rechnung stehen wir Ihnen gerne zur Verf&uuml;gung.')}
      ${paragraph('Mit freundlichen Gr&uuml;&szlig;en<br>Ihr CaravanWert Team')}
    `;

    const emailSubject = `Rechnung ${invoice.invoice_number} - CaravanWert`;
    const emailHtml = buildEmailLayout(settingsData, 'Neue Rechnung', content);

    // Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name || 'CaravanWert'} <info@caravanwert.de>`,
        to: [invoice.dealer.email],
        subject: emailSubject,
        html: emailHtml,
        attachments: invoice.pdf_url ? [{
          filename: `Rechnung_${invoice.invoice_number}.pdf`,
          content: invoice.pdf_url,
        }] : undefined,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error('Resend API error:', errorData);
      throw new Error('Failed to send invoice email');
    }

    console.log('Invoice email sent successfully to:', invoice.dealer.email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invoice email sent successfully',
        invoiceNumber: invoice.invoice_number 
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
