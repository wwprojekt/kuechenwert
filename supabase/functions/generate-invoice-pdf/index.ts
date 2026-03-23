import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

/**
 * Edge Function: generate-invoice-pdf
 * 
 * Generates a professional, German tax-compliant invoice PDF in the CaravanWert
 * brand layout. Uses HTML-to-PDF conversion via a headless browser service.
 * 
 * The PDF is uploaded to Supabase Storage (invoices bucket) and the invoice
 * record is updated with the signed URL.
 * 
 * Called by: close-auction, instant-buy (after invoice creation)
 * Auth: service_role or admin
 */

interface InvoicePdfRequest {
  invoiceId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Auth check: service_role or admin
  const authHeader = req.headers.get('authorization') ?? '';
  const isServiceRole = authHeader.includes(SUPABASE_SERVICE_ROLE_KEY);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (!isServiceRole) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some((r: any) => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const { invoiceId }: InvoicePdfRequest = await req.json();

    if (!invoiceId) {
      throw new Error('Invoice ID is required');
    }

    // ─── Fetch all required data ───────────────────────────────────
    
    // 1. Invoice with dealer, auction, motorhome, and line items
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        dealer:profiles(first_name, last_name, company_name, email, phone, company_street, company_zip, company_city, company_country, company_address, company_postal_code, tax_id, ust_id_verified),
        auction:auctions(
          id,
          current_bid,
          motorhome:motorhomes(manufacturer, model, year, vin)
        ),
        items:invoice_items(*)
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Invoice not found: ${invoiceError?.message || 'Unknown error'}`);
    }

    // 2. Site settings for company info
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    // ─── Build professional invoice HTML ───────────────────────────

    const siteName = settings?.site_name || 'CaravanWert';
    const companyAddress = settings?.company_address || '';
    const companyCity = settings?.company_city || '';
    const companyPostalCode = settings?.company_postal_code || '';
    const companyCountry = settings?.company_country || 'Deutschland';
    const contactEmail = settings?.contact_email || 'kontakt@caravanwert.de';
    const supportPhone = settings?.support_phone || '';
    const bankIban = settings?.bank_iban || '';
    const bankBic = settings?.bank_bic || '';
    const bankName = settings?.bank_name || '';
    const ustId = settings?.ust_id || '';
    const taxNumber = settings?.tax_number || '';
    const managingDirector = settings?.managing_director || '';
    const logoUrl = settings?.logo_url || 'https://zcrwqxsyptjwkuxfacvq.supabase.co/storage/v1/object/public/branding/logo-email.png';

    // Dealer info
    const dealerName = invoice.dealer?.company_name || 
      `${invoice.dealer?.first_name || ''} ${invoice.dealer?.last_name || ''}`.trim();
    const dealerStreet = invoice.dealer?.company_street || invoice.dealer?.company_address || '';
    const dealerZip = invoice.dealer?.company_zip || invoice.dealer?.company_postal_code || '';
    const dealerCity = invoice.dealer?.company_city || '';
    const dealerCountry = invoice.dealer?.company_country || '';
    const dealerTaxId = invoice.dealer?.tax_id || '';

    // Motorhome info
    const motorhomeName = invoice.auction?.motorhome 
      ? `${invoice.auction.motorhome.manufacturer} ${invoice.auction.motorhome.model}` 
      : '';
    const motorhomeYear = invoice.auction?.motorhome?.year || '';
    const motorhomeVin = invoice.auction?.motorhome?.vin || '';

    // Date formatting
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Currency formatting
    const formatCurrency = (amount: number) => {
      return amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Build items rows
    const itemRows = (invoice.items || []).map((item: any, index: number) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">${index + 1}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151;">${escapeHtml(item.description)}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151; text-align: right;">${formatCurrency(item.unit_price)} &euro;</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151; text-align: right;">${formatCurrency(item.net_amount)} &euro;</td>
      </tr>
    `).join('');

    const invoiceHtml = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #1f2937;
      line-height: 1.5;
      background: #ffffff;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 0;
      position: relative;
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- ═══ Header with brand gradient ═══ -->
    <div style="background: linear-gradient(135deg, #0f4f5c 0%, #1f8aa2 50%, #239cb8 100%); padding: 32px 48px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <img src="${logoUrl}" alt="${escapeHtml(siteName)}" style="height: 48px; max-width: 240px;" />
      </div>
      <div style="text-align: right; color: rgba(255,255,255,0.9); font-size: 12px; line-height: 1.6;">
        <div style="font-size: 11px; opacity: 0.8;">${escapeHtml(companyAddress)}</div>
        <div style="font-size: 11px; opacity: 0.8;">${escapeHtml(companyPostalCode)} ${escapeHtml(companyCity)}</div>
        <div style="font-size: 11px; opacity: 0.8;">${escapeHtml(companyCountry)}</div>
      </div>
    </div>

    <!-- ═══ Accent line ═══ -->
    <div style="height: 4px; background: linear-gradient(90deg, #239cb8 0%, #1f8aa2 50%, #1a7489 100%);"></div>

    <!-- ═══ Content area ═══ -->
    <div style="padding: 40px 48px 24px;">

      <!-- Sender line (small, above address window) -->
      <div style="font-size: 8px; color: #9ca3af; margin-bottom: 4px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; width: 280px;">
        ${escapeHtml(siteName)} &bull; ${escapeHtml(companyAddress)} &bull; ${escapeHtml(companyPostalCode)} ${escapeHtml(companyCity)}
      </div>

      <!-- Two-column: Recipient + Invoice meta -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
        <!-- Recipient -->
        <div style="width: 280px;">
          <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">${escapeHtml(dealerName)}</div>
          ${dealerStreet ? `<div style="font-size: 13px; color: #4b5563;">${escapeHtml(dealerStreet)}</div>` : ''}
          ${dealerZip || dealerCity ? `<div style="font-size: 13px; color: #4b5563;">${escapeHtml(dealerZip)} ${escapeHtml(dealerCity)}</div>` : ''}
          ${dealerCountry ? `<div style="font-size: 13px; color: #4b5563;">${escapeHtml(dealerCountry)}</div>` : ''}
          ${dealerTaxId ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Steuer-Nr.: ${escapeHtml(dealerTaxId)}</div>` : ''}
        </div>

        <!-- Invoice metadata -->
        <div style="text-align: right;">
          <div style="font-size: 28px; font-weight: 800; color: #1f8aa2; letter-spacing: -0.5px; margin-bottom: 12px;">RECHNUNG</div>
          <table style="margin-left: auto; border-collapse: collapse;">
            <tr>
              <td style="font-size: 12px; color: #6b7280; padding: 3px 16px 3px 0; text-align: right;">Rechnungsnr.:</td>
              <td style="font-size: 13px; font-weight: 700; color: #1f2937; padding: 3px 0; font-family: 'Courier New', monospace;">${escapeHtml(invoice.invoice_number)}</td>
            </tr>
            <tr>
              <td style="font-size: 12px; color: #6b7280; padding: 3px 16px 3px 0; text-align: right;">Rechnungsdatum:</td>
              <td style="font-size: 13px; font-weight: 600; color: #1f2937; padding: 3px 0;">${formatDate(invoice.invoice_date || invoice.created_at)}</td>
            </tr>
            <tr>
              <td style="font-size: 12px; color: #6b7280; padding: 3px 16px 3px 0; text-align: right;">F&auml;lligkeitsdatum:</td>
              <td style="font-size: 13px; font-weight: 600; color: #1f2937; padding: 3px 0;">${formatDate(invoice.due_date)}</td>
            </tr>
            <tr>
              <td style="font-size: 12px; color: #6b7280; padding: 3px 16px 3px 0; text-align: right;">Zahlungsziel:</td>
              <td style="font-size: 13px; font-weight: 600; color: #1f2937; padding: 3px 0;">14 Tage</td>
            </tr>
          </table>
        </div>
      </div>

      ${motorhomeName ? `
      <!-- Vehicle reference -->
      <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 14px 20px; margin-bottom: 28px;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #0f766e; font-weight: 700; margin-bottom: 6px;">Fahrzeugreferenz</div>
        <div style="font-size: 14px; font-weight: 600; color: #1f2937;">${escapeHtml(motorhomeName)}${motorhomeYear ? ` (${motorhomeYear})` : ''}</div>
        ${motorhomeVin ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">FIN: ${escapeHtml(motorhomeVin)}</div>` : ''}
      </div>
      ` : ''}

      <!-- Intro text -->
      <p style="font-size: 13px; color: #4b5563; margin-bottom: 24px;">
        Sehr geehrte Damen und Herren,<br>
        hiermit stellen wir Ihnen folgende Leistungen in Rechnung:
      </p>

      <!-- ═══ Invoice items table ═══ -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; border-bottom: 2px solid #1f8aa2; width: 40px;">Pos.</th>
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; border-bottom: 2px solid #1f8aa2;">Beschreibung</th>
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; border-bottom: 2px solid #1f8aa2; width: 60px;">Menge</th>
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; border-bottom: 2px solid #1f8aa2; width: 120px;">Einzelpreis</th>
            <th style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; border-bottom: 2px solid #1f8aa2; width: 120px;">Netto</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- ═══ Totals ═══ -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 32px;">
        <table style="border-collapse: collapse; min-width: 300px;">
          <tr>
            <td style="padding: 8px 24px 8px 16px; font-size: 13px; color: #4b5563;">Nettobetrag</td>
            <td style="padding: 8px 16px; font-size: 13px; color: #1f2937; text-align: right; font-weight: 600;">${formatCurrency(invoice.net_amount)} &euro;</td>
          </tr>
          <tr>
            <td style="padding: 8px 24px 8px 16px; font-size: 13px; color: #4b5563;">zzgl. ${invoice.tax_rate}% MwSt.</td>
            <td style="padding: 8px 16px; font-size: 13px; color: #1f2937; text-align: right;">${formatCurrency(invoice.tax_amount)} &euro;</td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 0;"><div style="height: 2px; background: #1f8aa2; margin: 4px 0;"></div></td>
          </tr>
          <tr style="background: #f0fdfa;">
            <td style="padding: 12px 24px 12px 16px; font-size: 16px; font-weight: 800; color: #0f766e;">Gesamtbetrag</td>
            <td style="padding: 12px 16px; font-size: 16px; font-weight: 800; color: #0f766e; text-align: right;">${formatCurrency(invoice.gross_amount)} &euro;</td>
          </tr>
        </table>
      </div>

      <!-- ═══ Payment info box ═══ -->
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 20px 24px; margin-bottom: 28px;">
        <div style="font-size: 14px; font-weight: 700; color: #92400e; margin-bottom: 12px;">Zahlungsinformationen</div>
        <table style="border-collapse: collapse;">
          ${bankIban ? `<tr>
            <td style="font-size: 13px; color: #78716c; padding: 4px 20px 4px 0; font-weight: 500;">IBAN:</td>
            <td style="font-size: 13px; color: #1f2937; padding: 4px 0; font-weight: 600; font-family: 'Courier New', monospace; letter-spacing: 1px;">${escapeHtml(bankIban)}</td>
          </tr>` : ''}
          ${bankBic ? `<tr>
            <td style="font-size: 13px; color: #78716c; padding: 4px 20px 4px 0; font-weight: 500;">BIC:</td>
            <td style="font-size: 13px; color: #1f2937; padding: 4px 0; font-weight: 600;">${escapeHtml(bankBic)}</td>
          </tr>` : ''}
          ${bankName ? `<tr>
            <td style="font-size: 13px; color: #78716c; padding: 4px 20px 4px 0; font-weight: 500;">Bank:</td>
            <td style="font-size: 13px; color: #1f2937; padding: 4px 0; font-weight: 600;">${escapeHtml(bankName)}</td>
          </tr>` : ''}
          <tr>
            <td style="font-size: 13px; color: #78716c; padding: 4px 20px 4px 0; font-weight: 500;">Verwendungszweck:</td>
            <td style="font-size: 13px; color: #1f2937; padding: 4px 0; font-weight: 700;">${escapeHtml(invoice.invoice_number)}</td>
          </tr>
        </table>
      </div>

      <!-- Thank you -->
      <p style="font-size: 13px; color: #4b5563; margin-bottom: 8px;">
        Vielen Dank f&uuml;r Ihr Vertrauen und die Zusammenarbeit!
      </p>
      <p style="font-size: 13px; color: #4b5563; margin-bottom: 4px;">
        Mit freundlichen Gr&uuml;&szlig;en
      </p>
      <p style="font-size: 14px; font-weight: 700; color: #1f8aa2;">
        Ihr ${escapeHtml(siteName)} Team
      </p>
    </div>

    <!-- ═══ Footer ═══ -->
    <div style="position: absolute; bottom: 0; left: 0; right: 0; background: #0f4f5c; padding: 20px 48px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 10px; color: rgba(255,255,255,0.7); line-height: 1.6;">
          <span style="font-weight: 600; color: #67e8f9;">${escapeHtml(siteName)}</span>
          ${managingDirector ? ` &bull; Gesch&auml;ftsf&uuml;hrer: ${escapeHtml(managingDirector)}` : ''}
        </div>
        <div style="font-size: 10px; color: rgba(255,255,255,0.7); line-height: 1.6; text-align: right;">
          ${taxNumber ? `Steuernummer: ${escapeHtml(taxNumber)}` : ''}
          ${ustId ? ` &bull; USt-ID: ${escapeHtml(ustId)}` : ''}
        </div>
      </div>
      <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.15); text-align: center;">
        <span style="font-size: 10px; color: rgba(255,255,255,0.5);">
          ${escapeHtml(contactEmail)}${supportPhone ? ` &bull; ${escapeHtml(supportPhone)}` : ''} &bull; www.caravanwert.de
        </span>
      </div>
    </div>
  </div>
</body>
</html>`;

    // ─── Convert HTML to PDF ─────────────────────────────────────────
    // Use a free HTML-to-PDF API service
    
    let pdfBuffer: ArrayBuffer;
    
    // Try multiple PDF generation approaches
    try {
      // Approach 1: Use pdf.co or similar service if API key available
      // Approach 2: Generate PDF from HTML using Deno's built-in capabilities
      // For reliability, we store the HTML as a well-formatted document that
      // can be printed to PDF from the browser, and use a conversion service
      
      const pdfApiUrl = 'https://html2pdf.app/api/render';
      const pdfResponse = await fetch(pdfApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: invoiceHtml,
          format: 'A4',
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        }),
      });

      if (pdfResponse.ok && pdfResponse.headers.get('content-type')?.includes('pdf')) {
        pdfBuffer = await pdfResponse.arrayBuffer();
      } else {
        throw new Error('PDF API not available');
      }
    } catch (_pdfApiError) {
      // Fallback: Store as HTML file (browsers can print to PDF)
      // This is a reliable fallback that always works
      console.log('PDF API not available, storing as HTML invoice');
      
      const htmlBytes = new TextEncoder().encode(invoiceHtml);
      const fileName = `${invoice.dealer_id}/${invoice.invoice_number.replace(/[^a-zA-Z0-9-]/g, '_')}.html`;
      
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, htmlBytes, {
          contentType: 'text/html',
          upsert: true,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Failed to upload invoice: ${uploadError.message}`);
      }

      // Create a signed URL (valid for 1 year)
      const { data: signedData, error: signedError } = await supabase.storage
        .from('invoices')
        .createSignedUrl(fileName, 365 * 24 * 60 * 60); // 1 year

      if (signedError) {
        throw new Error(`Failed to create signed URL: ${signedError.message}`);
      }

      // Update invoice with PDF URL
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ 
          pdf_url: signedData.signedUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (updateError) {
        console.error('Error updating invoice pdf_url:', updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          pdfUrl: signedData.signedUrl,
          format: 'html',
          invoiceNumber: invoice.invoice_number,
        }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Upload PDF to storage
    const fileName = `${invoice.dealer_id}/${invoice.invoice_number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
    
    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    // Create signed URL (valid for 1 year)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('invoices')
      .createSignedUrl(fileName, 365 * 24 * 60 * 60);

    if (signedError) {
      throw new Error(`Failed to create signed URL: ${signedError.message}`);
    }

    // Update invoice with PDF URL
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ 
        pdf_url: signedData.signedUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    if (updateError) {
      console.error('Error updating invoice pdf_url:', updateError);
    }

    console.log(`Invoice PDF generated: ${invoice.invoice_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl: signedData.signedUrl,
        format: 'pdf',
        invoiceNumber: invoice.invoice_number,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-invoice-pdf:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});

// ─── Helper: Escape HTML ─────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
