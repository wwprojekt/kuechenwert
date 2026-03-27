import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
// @deno-types="https://esm.sh/jspdf@2.5.2"
import { jsPDF } from 'https://esm.sh/jspdf@2.5.2';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

/**
 * Edge Function: generate-invoice-pdf
 * 
 * Generates a professional, German tax-compliant invoice PDF using jsPDF.
 * Single-page A4 layout in CaravanWert brand design.
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

// ─── Color constants ────────────────────────────────────────────────────────
const BRAND = { r: 15, g: 79, b: 92 };       // #0f4f5c - dark teal
const ACCENT = { r: 31, g: 138, b: 162 };     // #1f8aa2 - medium teal
const TEXT_DARK = { r: 31, g: 41, b: 55 };     // #1f2937
const TEXT_MED = { r: 75, g: 85, b: 99 };      // #4b5563
const TEXT_LIGHT = { r: 107, g: 114, b: 128 }; // #6b7280
const GREEN_BG = { r: 240, g: 253, b: 250 };   // #f0fdfa
const GREEN_BORDER = { r: 153, g: 246, b: 228 };// #99f6e4
const GREEN_TEXT = { r: 15, g: 118, b: 110 };   // #0f766e
const AMBER_BG = { r: 255, g: 251, b: 235 };    // #fffbeb
const AMBER_BORDER = { r: 245, g: 158, b: 11 }; // #f59e0b
const AMBER_TEXT = { r: 146, g: 64, b: 14 };     // #92400e

function formatCurrency(amount: number | string): string {
  return Number(amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
    const { invoiceId }: InvoicePdfRequest = await req.json();

    if (!invoiceId) {
      throw new Error('Invoice ID is required');
    }

    // ─── Fetch all required data ───────────────────────────────────
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        dealer:profiles(first_name, last_name, company_name, email, company_street, company_city, company_zip, company_country, customer_number),
        auction:auctions(
          motorhome:motorhomes(manufacturer, model)
        ),
        items:invoice_items(*)
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Invoice not found: ${invoiceError?.message || 'Unknown'}`);
    }

    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    // ─── Prepare data ──────────────────────────────────────────────
    const siteName = settings?.site_name || 'CaravanWert';
    const siteDesc = settings?.site_description || 'Deutschlands führende Wohnmobil-Handelsplattform';
    const address = settings?.address || 'Hannoversche Straße 106';
    const city = settings?.city || 'Hannover';
    const zip = settings?.zip_code || '30627';
    const country = settings?.country || 'Deutschland';
    const contactEmail = settings?.contact_email || 'kontakt@caravanwert.de';
    const phone = settings?.support_phone || '';
    const website = 'www.caravanwert.de';
    const bankIban = settings?.bank_iban || '';
    const bankBic = settings?.bank_bic || '';
    const bankName = settings?.bank_name || '';
    const ustId = settings?.ust_id || '';
    const taxNumber = settings?.tax_number || '';
    const managingDirector = settings?.managing_director || '';
    const hrbNumber = settings?.hrb_number || '';

    const dealerName = invoice.dealer?.company_name ||
      `${invoice.dealer?.first_name || ''} ${invoice.dealer?.last_name || ''}`.trim() || 'Händler';
    const dealerEmail = invoice.dealer?.email || '';
    const customerNumber = invoice.customer_number || invoice.dealer?.customer_number || '';

    const motorhomeName = invoice.auction?.motorhome
      ? `${invoice.auction.motorhome.manufacturer} ${invoice.auction.motorhome.model}`
      : 'Vermittlungsprovision';

    const invoiceDate = formatDate(invoice.invoice_date || invoice.created_at);
    const dueDate = formatDate(invoice.due_date);
    const paymentDays = invoice.payment_terms_days || 14;
    const netAmount = Number(invoice.net_amount);
    const taxRate = Number(invoice.tax_rate || 19);
    const taxAmount = Number(invoice.tax_amount);
    const grossAmount = Number(invoice.gross_amount);

    // ─── Generate PDF with jsPDF ───────────────────────────────────
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = 210; // page width
    const ml = 20;  // margin left
    const mr = 20;  // margin right
    const cw = pw - ml - mr; // content width
    let y = 0;

    // ── Header ─────────────────────────────────────────────────────
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.rect(0, 0, pw, 22, 'F');
    // Gradient line
    doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.rect(0, 22, pw, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(siteName, ml, 12);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(siteDesc, ml, 18);

    // Right side header
    doc.setFontSize(8);
    doc.text(address, pw - mr, 9, { align: 'right' });
    doc.text(`${zip} ${city}`, pw - mr, 13.5, { align: 'right' });
    doc.text(country, pw - mr, 18, { align: 'right' });

    y = 30;

    // ── Sender line ────────────────────────────────────────────────
    doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
    doc.setFontSize(6);
    doc.text(`${siteName} • ${address} • ${zip} ${city}`, ml, y);
    doc.setDrawColor(229, 231, 235);
    doc.line(ml, y + 1, ml + 90, y + 1);
    y += 5;

    // ── Recipient + Invoice meta ───────────────────────────────────
    // Left: Recipient
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(dealerName, ml, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    if (customerNumber) {
      doc.text(`Kd.-Nr.: ${customerNumber}`, ml, y + 9);
      doc.text(dealerEmail, ml, y + 13);
    } else {
      doc.text(dealerEmail, ml, y + 9);
    }

    // Right: RECHNUNG title + meta
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('RECHNUNG', pw - mr, y + 3, { align: 'right' });

    const metaX = pw - mr - 40;
    const metaVX = pw - mr;
    let metaY = y + 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
    doc.text('Rechnungsnr.:', metaX, metaY, { align: 'right' });
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.invoice_number, metaVX, metaY, { align: 'right' });

    metaY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
    doc.text('Rechnungsdatum:', metaX, metaY, { align: 'right' });
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceDate, metaVX, metaY, { align: 'right' });

    metaY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
    doc.text('Fälligkeitsdatum:', metaX, metaY, { align: 'right' });
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.setFont('helvetica', 'bold');
    doc.text(dueDate, metaVX, metaY, { align: 'right' });

    metaY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
    doc.text('Zahlungsziel:', metaX, metaY, { align: 'right' });
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.setFont('helvetica', 'bold');
    doc.text(`${paymentDays} Tage`, metaVX, metaY, { align: 'right' });

    if (customerNumber) {
      metaY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
      doc.text('Kundennr.:', metaX, metaY, { align: 'right' });
      doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
      doc.setFont('helvetica', 'bold');
      doc.text(customerNumber, metaVX, metaY, { align: 'right' });
    }

    y += 32;

    // ── Vehicle reference box ──────────────────────────────────────
    doc.setFillColor(GREEN_BG.r, GREEN_BG.g, GREEN_BG.b);
    doc.setDrawColor(GREEN_BORDER.r, GREEN_BORDER.g, GREEN_BORDER.b);
    doc.roundedRect(ml, y, cw, 14, 2, 2, 'FD');
    doc.setTextColor(GREEN_TEXT.r, GREEN_TEXT.g, GREEN_TEXT.b);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('FAHRZEUGREFERENZ', ml + 6, y + 5);
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.setFontSize(10);
    doc.text(motorhomeName, ml + 6, y + 11);
    y += 18;

    // ── Intro text ─────────────────────────────────────────────────
    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Sehr geehrte Damen und Herren,', ml, y);
    y += 4;
    doc.text('hiermit stellen wir Ihnen folgende Leistungen in Rechnung:', ml, y);
    y += 8;

    // ── Table header ───────────────────────────────────────────────
    doc.setFillColor(248, 250, 252);
    doc.rect(ml, y, cw, 7, 'F');
    doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.setLineWidth(0.5);
    doc.line(ml, y + 7, ml + cw, y + 7);

    doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('POS.', ml + 4, y + 4.5);
    doc.text('BESCHREIBUNG', ml + 20, y + 4.5);
    doc.text('MENGE', ml + 100, y + 4.5, { align: 'center' });
    doc.text('EINZELPREIS', ml + 130, y + 4.5, { align: 'right' });
    doc.text('NETTO', ml + cw - 4, y + 4.5, { align: 'right' });
    y += 10;

    // ── Table rows ─────────────────────────────────────────────────
    const items = invoice.items || [];
    if (items.length === 0) {
      // Fallback: single item from invoice data
      items.push({
        description: `Vermittlungsprovision: ${motorhomeName}`,
        quantity: 1,
        unit_price: netAmount,
        total_price: netAmount,
      });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const desc1 = `Vermittlungsprovision: ${motorhomeName}`;
      const desc2 = `(Verkaufspreis: ${formatCurrency(invoice.sale_price || grossAmount / 0.02)})`;

      doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(String(i + 1), ml + 4, y + 4);
      doc.text(desc1, ml + 20, y + 4);
      doc.setFontSize(7.5);
      doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
      doc.text(desc2, ml + 20, y + 8.5);
      doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
      doc.setFontSize(8.5);
      doc.text(String(item.quantity || 1), ml + 100, y + 5.5, { align: 'center' });
      doc.text(formatCurrency(item.unit_price || netAmount), ml + 130, y + 5.5, { align: 'right' });
      doc.text(formatCurrency(item.total_price || netAmount), ml + cw - 4, y + 5.5, { align: 'right' });

      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.2);
      doc.line(ml, y + 11, ml + cw, y + 11);
      y += 13;
    }

    // ── Totals ─────────────────────────────────────────────────────
    y += 2;
    const totX = ml + 100;
    const totVX = ml + cw - 4;

    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Nettobetrag', totX, y + 4);
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(netAmount), totVX, y + 4, { align: 'right' });

    y += 7;
    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    doc.setFont('helvetica', 'normal');
    doc.text(`zzgl. ${taxRate}% MwSt.`, totX, y + 4);
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.text(formatCurrency(taxAmount), totVX, y + 4, { align: 'right' });

    y += 6;
    doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.setLineWidth(0.5);
    doc.line(totX, y, totVX + 4, y);

    y += 2;
    doc.setFillColor(GREEN_BG.r, GREEN_BG.g, GREEN_BG.b);
    doc.rect(totX - 4, y, cw - totX + ml + 8, 9, 'F');
    doc.setTextColor(GREEN_TEXT.r, GREEN_TEXT.g, GREEN_TEXT.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Gesamtbetrag', totX, y + 6.5);
    doc.text(formatCurrency(grossAmount), totVX, y + 6.5, { align: 'right' });

    y += 15;

    // ── Payment info box ───────────────────────────────────────────
    const payBoxH = 30;
    doc.setFillColor(AMBER_BG.r, AMBER_BG.g, AMBER_BG.b);
    doc.setDrawColor(253, 230, 138);
    doc.roundedRect(ml + 1.5, y, cw - 1.5, payBoxH, 0, 2, 'FD');
    // Left accent border
    doc.setFillColor(AMBER_BORDER.r, AMBER_BORDER.g, AMBER_BORDER.b);
    doc.rect(ml, y, 1.5, payBoxH, 'F');

    doc.setTextColor(AMBER_TEXT.r, AMBER_TEXT.g, AMBER_TEXT.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Zahlungsinformationen', ml + 8, y + 6);

    const payLabelX = ml + 8;
    const payValX = ml + 42;
    let payY = y + 12;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 113, 108);
    if (bankIban) {
      doc.text('IBAN:', payLabelX, payY);
      doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
      doc.setFont('helvetica', 'bold');
      doc.text(bankIban, payValX, payY);
      payY += 4.5;
    }
    if (bankBic) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 113, 108);
      doc.text('BIC:', payLabelX, payY);
      doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
      doc.setFont('helvetica', 'bold');
      doc.text(bankBic, payValX, payY);
      payY += 4.5;
    }
    if (bankName) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 113, 108);
      doc.text('Bank:', payLabelX, payY);
      doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
      doc.setFont('helvetica', 'bold');
      doc.text(bankName, payValX, payY);
      payY += 4.5;
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 113, 108);
    doc.text('Verwendungszweck:', payLabelX, payY);
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.invoice_number, payValX + 10, payY);

    y += payBoxH + 6;

    // ── Closing text ───────────────────────────────────────────────
    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Vielen Dank für Ihr Vertrauen und die Zusammenarbeit!', ml, y);
    y += 4.5;
    doc.text('Mit freundlichen Grüßen', ml, y);
    y += 5;
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.setFont('helvetica', 'bold');
    doc.text(`Ihr ${siteName} Team`, ml, y);

    // ── Footer ─────────────────────────────────────────────────────
    const footerY = 283;
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.rect(0, footerY, pw, 14, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    const footerLeft = [];
    footerLeft.push(siteName);
    if (managingDirector) footerLeft.push(`GF: ${managingDirector}`);
    if (hrbNumber) footerLeft.push(`HRB ${hrbNumber}`);
    doc.text(footerLeft.join(' • '), ml, footerY + 5);

    doc.setFont('helvetica', 'normal');
    const footerRight = [];
    if (taxNumber) footerRight.push(`StNr: ${taxNumber}`);
    if (ustId) footerRight.push(`USt-ID: ${ustId}`);
    if (footerRight.length > 0) {
      doc.text(footerRight.join(' • '), pw - mr, footerY + 5, { align: 'right' });
    }

    // Contact line
    doc.setFontSize(6);
    const contactLine = [contactEmail, phone, website].filter(Boolean).join(' • ');
    doc.text(contactLine, pw / 2, footerY + 10, { align: 'center' });

    // ─── Output PDF ────────────────────────────────────────────────
    const pdfOutput = doc.output('arraybuffer');
    const pdfBytes = new Uint8Array(pdfOutput);

    // Upload to storage
    const fileName = `${invoice.dealer_id}/${invoice.invoice_number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
    
    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(fileName, pdfBytes, {
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

    // Also return the PDF as base64 for the email attachment
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    console.log(`Invoice PDF generated: ${invoice.invoice_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl: signedData.signedUrl,
        pdfBase64,
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
