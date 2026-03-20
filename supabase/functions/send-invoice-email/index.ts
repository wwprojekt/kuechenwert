import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoiceEmailRequest {
  invoiceId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Auth check: must be service_role (internal) or authenticated admin
  const authHeader = req.headers.get('authorization') ?? '';
  const isServiceRole = authHeader.includes(SUPABASE_SERVICE_ROLE_KEY);

  if (!isServiceRole) {
    const supabaseUser = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const supabaseCheck = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roles } = await supabaseCheck.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const { invoiceId }: InvoiceEmailRequest = await req.json();

    if (!invoiceId) {
      throw new Error('Invoice ID is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch invoice with dealer info
    const { data: invoice, error: invoiceError } = await supabase
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
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .single();

    const dealerName = invoice.dealer.company_name || 
      `${invoice.dealer.first_name} ${invoice.dealer.last_name}`;
    
    const motorhomeName = invoice.auction ? 
      `${invoice.auction.motorhome.manufacturer} ${invoice.auction.motorhome.model}` : 
      'Provision';

    // Prepare email content
    const emailSubject = `Rechnung ${invoice.invoice_number} - CaravanWert`;
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .invoice-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
    .amount { font-size: 24px; font-weight: bold; color: #2563eb; margin: 20px 0; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📄 Neue Rechnung</h1>
    </div>
    <div class="content">
      <p>Sehr geehrte/r ${dealerName},</p>
      <p>Ihre Rechnung für den erfolgreichen Kauf bei CaravanWert ist bereit.</p>
      
      <div class="invoice-info">
        <h3>Rechnungsdetails</h3>
        <p><strong>Rechnungsnummer:</strong> ${invoice.invoice_number}</p>
        <p><strong>Fahrzeug:</strong> ${motorhomeName}</p>
        <p><strong>Rechnungsdatum:</strong> ${new Date(invoice.invoice_date).toLocaleDateString('de-DE')}</p>
        <p><strong>Fälligkeitsdatum:</strong> ${new Date(invoice.due_date).toLocaleDateString('de-DE')}</p>
      </div>
      
      <div class="amount">
        Rechnungsbetrag: €${invoice.gross_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
      </div>
      
      <p><strong>Zahlungsinformationen:</strong></p>
      <p>
        IBAN: DE89 3704 0044 0532 0130 00<br>
        BIC: COBADEFFXXX<br>
        Verwendungszweck: ${invoice.invoice_number}
      </p>
      
      ${invoice.pdf_url ? `
        <a href="${invoice.pdf_url}" class="button">
          📄 Rechnung als PDF herunterladen
        </a>
      ` : ''}
      
      <p>Bei Fragen zu Ihrer Rechnung stehen wir Ihnen gerne zur Verfügung.</p>
      
      <div class="footer">
        <p>Mit freundlichen Grüßen<br>
        Ihr CaravanWert Team</p>
        <p style="font-size: 12px; margin-top: 20px;">
          ${settings?.site_name || 'CaravanWert'}<br>
          ${settings?.contact_email || 'kontakt@caravanwert.de'}<br>
          ${settings?.support_phone || '+49 123 456789'}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

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
        from: `${settings?.site_name || 'CaravanWert'} <invoices@caravanwert.de>`,
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
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('Error in send-invoice-email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
