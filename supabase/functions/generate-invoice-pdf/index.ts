import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
// @deno-types="https://esm.sh/jspdf@2.5.2"
import { jsPDF } from 'https://esm.sh/jspdf@2.5.2';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

interface InvoicePdfRequest { invoiceId: string; }

const BRAND = { r: 15, g: 79, b: 92 };
const ACCENT = { r: 31, g: 138, b: 162 };
const TEXT_DARK = { r: 31, g: 41, b: 55 };
const TEXT_MED = { r: 75, g: 85, b: 99 };
const TEXT_LIGHT = { r: 107, g: 114, b: 128 };
const GREEN_BG = { r: 240, g: 253, b: 250 };
const GREEN_BORDER = { r: 153, g: 246, b: 228 };
const GREEN_TEXT = { r: 15, g: 118, b: 110 };
const RED_BG = { r: 254, g: 242, b: 242 };
const RED_BORDER = { r: 252, g: 165, b: 165 };
const RED_TEXT = { r: 185, g: 28, b: 28 };
const AMBER_BG = { r: 255, g: 251, b: 235 };
const AMBER_BORDER = { r: 245, g: 158, b: 11 };
const AMBER_TEXT = { r: 146, g: 64, b: 14 };
const BLUE_BG = { r: 239, g: 246, b: 255 };
const BLUE_BORDER = { r: 147, g: 197, b: 253 };
const BLUE_TEXT = { r: 30, g: 64, b: 175 };

const PENALTY_REASON_LABELS: Record<string,string> = {
  anderweitiger_verkauf: 'Anderweitiger Verkauf während Auktion',
  vorzeitige_ruecknahme: 'Vorzeitige Rücknahme des Fahrzeugs',
  falsche_angaben: 'Falsche/irreführende Angaben',
};

function fmtCur(a: number|string): string {
  return Number(a).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const COUNTRY_NAMES: Record<string,string> = {
  AT:'Österreich',NL:'Niederlande',BE:'Belgien',FR:'Frankreich',IT:'Italien',
  ES:'Spanien',PL:'Polen',PT:'Portugal',LU:'Luxemburg',CH:'Schweiz',DK:'Dänemark',
  SE:'Schweden',CZ:'Tschechien',HU:'Ungarn',HR:'Kroatien',SI:'Slowenien',SK:'Slowakei',
  RO:'Rumänien',BG:'Bulgarien',GR:'Griechenland',IE:'Irland',FI:'Finnland',
  EE:'Estland',LV:'Lettland',LT:'Litauen',MT:'Malta',CY:'Zypern'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightRequest(req);

  const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authResult = await checkServiceRoleOrAdmin(req, getCorsHeaders(req));
  if (!authResult.authorized) return authResult.response;

  try {
    const supabase = createClient(SB_URL, SB_KEY);
    const { invoiceId }: InvoicePdfRequest = await req.json();
    if (!invoiceId) throw new Error('Invoice ID is required');

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`*, dealer:profiles(first_name, last_name, company_name, email, company_street, company_city, company_zip, company_country, customer_number, vat_id), auction:auctions(motorhome:motorhomes(manufacturer, model)), items:invoice_items(*)`)
      .eq('id', invoiceId).single();
    if (invoiceError || !invoice) throw new Error(`Invoice not found: ${invoiceError?.message}`);

    const { data: settings } = await supabase.from('site_settings').select('*').limit(1).maybeSingle();

    const siteName = settings?.site_name || 'CaravanWert';
    const siteDesc = settings?.site_description || 'Deutschlands führende Wohnmobil-Handelsplattform';
    const addr = settings?.address || 'Hannoversche Straße 106';
    const cityS = settings?.city || 'Hannover';
    const zipS = settings?.zip_code || '30627';
    const countryS = settings?.country || 'Deutschland';
    const contactEmail = settings?.contact_email || 'kontakt@caravanwert.de';
    const phoneS = settings?.support_phone || '';
    const website = 'www.caravanwert.de';
    const bankIban = settings?.bank_iban || '';
    const bankBic = settings?.bank_bic || '';
    const bankName = settings?.bank_name || '';
    const ustId = settings?.ust_id || '';
    const taxNumber = settings?.tax_number || '';
    const md = settings?.managing_director || '';
    const hrb = settings?.hrb_number || '';

    const dlrName = invoice.dealer?.company_name || `${invoice.dealer?.first_name||''} ${invoice.dealer?.last_name||''}`.trim() || 'Händler';
    const dlrEmail = invoice.dealer?.email || '';
    const dlrStreet = invoice.dealer?.company_street || '';
    const dlrZip = invoice.dealer?.company_zip || '';
    const dlrCity = invoice.dealer?.company_city || '';
    const dlrCountry = invoice.dealer?.company_country || invoice.dealer_country || 'DE';
    const dlrVatId = invoice.dealer?.vat_id || '';
    const custNum = invoice.customer_number || invoice.dealer?.customer_number || '';
    const isRC = invoice.reverse_charge === true;

    const isPenalty = invoice.invoice_type === 'seller_penalty';
    const penaltyReasonLabel = isPenalty
      ? (PENALTY_REASON_LABELS[invoice.penalty_reason] || invoice.penalty_reason || 'Vertragsstrafe')
      : '';
    const mhName = isPenalty
      ? 'Vertragsstrafe'
      : (invoice.auction?.motorhome
        ? `${invoice.auction.motorhome.manufacturer} ${invoice.auction.motorhome.model}` : 'Vermittlungsprovision');

    const invDate = fmtDate(invoice.invoice_date || invoice.created_at);
    const dueDateStr = fmtDate(invoice.due_date);
    const payDays = invoice.payment_terms_days || 14;
    const net = Number(invoice.net_amount);
    const taxR = Number(invoice.tax_rate || 19);
    const taxAmt = Number(invoice.tax_amount);
    const gross = Number(invoice.gross_amount);

    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const pw=210, ml=20, mr=20, cw=pw-ml-mr;
    let y=0;

    // Header bar
    doc.setFillColor(BRAND.r,BRAND.g,BRAND.b); doc.rect(0,0,pw,22,'F');
    doc.setFillColor(ACCENT.r,ACCENT.g,ACCENT.b); doc.rect(0,22,pw,1.5,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text(siteName,ml,12);
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.text(siteDesc,ml,18);
    doc.setFontSize(8);
    doc.text(addr,pw-mr,9,{align:'right'});
    doc.text(`${zipS} ${cityS}`,pw-mr,13.5,{align:'right'});
    doc.text(countryS,pw-mr,18,{align:'right'});
    y=30;

    // Sender line
    doc.setTextColor(TEXT_LIGHT.r,TEXT_LIGHT.g,TEXT_LIGHT.b); doc.setFontSize(6);
    doc.text(`${siteName} • ${addr} • ${zipS} ${cityS}`,ml,y);
    doc.setDrawColor(229,231,235); doc.line(ml,y+1,ml+90,y+1);
    y+=5;

    // Recipient with full address
    doc.setTextColor(TEXT_DARK.r,TEXT_DARK.g,TEXT_DARK.b); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(dlrName,ml,y+4);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.setTextColor(TEXT_MED.r,TEXT_MED.g,TEXT_MED.b);
    let ry=y+9;
    if(dlrStreet){doc.text(dlrStreet,ml,ry);ry+=4;}
    if(dlrZip||dlrCity){doc.text(`${dlrZip} ${dlrCity}`.trim(),ml,ry);ry+=4;}
    if(dlrCountry&&dlrCountry!=='DE'){doc.text(COUNTRY_NAMES[dlrCountry]||dlrCountry,ml,ry);ry+=4;}
    if(custNum){doc.setFontSize(8);doc.text(`Kd.-Nr.: ${custNum}`,ml,ry);ry+=4;}
    if(dlrVatId){doc.setFontSize(8);doc.text(`USt-IdNr.: ${dlrVatId}`,ml,ry);ry+=4;}

    // Right: RECHNUNG + meta
    doc.setTextColor(ACCENT.r,ACCENT.g,ACCENT.b); doc.setFontSize(20); doc.setFont('helvetica','bold');
    doc.text('RECHNUNG',pw-mr,y+3,{align:'right'});
    const mx=pw-mr-40, mv=pw-mr;
    let my=y+10;
    const metaLine = (label:string,val:string) => {
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      doc.setTextColor(TEXT_LIGHT.r,TEXT_LIGHT.g,TEXT_LIGHT.b);
      doc.text(label,mx,my,{align:'right'});
      doc.setTextColor(TEXT_DARK.r,TEXT_DARK.g,TEXT_DARK.b); doc.setFont('helvetica','bold');
      doc.text(val,mv,my,{align:'right'});
      my+=5;
    };
    metaLine('Rechnungsnr.:',invoice.invoice_number);
    metaLine('Rechnungsdatum:',invDate);
    metaLine('Fälligkeitsdatum:',dueDateStr);
    metaLine('Zahlungsziel:',`${payDays} Tage`);
    if(custNum) metaLine('Kundennr.:',custNum);

    y=Math.max(ry,my)+2;

    // Reference box (vehicle or penalty)
    const refBg = isPenalty ? RED_BG : GREEN_BG;
    const refBorder = isPenalty ? RED_BORDER : GREEN_BORDER;
    const refText = isPenalty ? RED_TEXT : GREEN_TEXT;
    const refTitle = isPenalty ? 'VERTRAGSSTRAFE' : 'FAHRZEUGREFERENZ';
    const refDetail = isPenalty ? penaltyReasonLabel : mhName;
    doc.setFillColor(refBg.r,refBg.g,refBg.b);
    doc.setDrawColor(refBorder.r,refBorder.g,refBorder.b);
    doc.roundedRect(ml,y,cw,14,2,2,'FD');
    doc.setTextColor(refText.r,refText.g,refText.b); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.text(refTitle,ml+6,y+5);
    doc.setTextColor(TEXT_DARK.r,TEXT_DARK.g,TEXT_DARK.b); doc.setFontSize(10);
    doc.text(refDetail,ml+6,y+11);
    y+=18;

    // Intro
    doc.setTextColor(TEXT_MED.r,TEXT_MED.g,TEXT_MED.b); doc.setFontSize(8.5); doc.setFont('helvetica','normal');
    doc.text('Sehr geehrte Damen und Herren,',ml,y); y+=4;
    const introLine = isPenalty
      ? 'hiermit stellen wir Ihnen folgende Vertragsstrafe gemäß § 8 Abs. 4 unserer AGB in Rechnung:'
      : 'hiermit stellen wir Ihnen folgende Leistungen in Rechnung:';
    doc.text(introLine,ml,y); y+=8;

    // Table header
    doc.setFillColor(248,250,252); doc.rect(ml,y,cw,7,'F');
    doc.setDrawColor(ACCENT.r,ACCENT.g,ACCENT.b); doc.setLineWidth(0.5); doc.line(ml,y+7,ml+cw,y+7);
    doc.setTextColor(TEXT_LIGHT.r,TEXT_LIGHT.g,TEXT_LIGHT.b); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.text('POS.',ml+4,y+4.5); doc.text('BESCHREIBUNG',ml+20,y+4.5);
    doc.text('MENGE',ml+100,y+4.5,{align:'center'});
    doc.text('EINZELPREIS',ml+130,y+4.5,{align:'right'});
    doc.text('NETTO',ml+cw-4,y+4.5,{align:'right'});
    y+=10;

    // Rows
    const fallbackDesc = isPenalty
      ? `Vertragsstrafe: ${penaltyReasonLabel}`
      : `Vermittlungsprovision: ${mhName}`;
    const items = invoice.items?.length ? invoice.items : [{description:fallbackDesc,quantity:1,unit_price:net,total_price:net}];
    for(let i=0;i<items.length;i++){
      const it=items[i];
      const rowDesc = isPenalty
        ? (it.description || fallbackDesc)
        : `Vermittlungsprovision: ${mhName}`;
      doc.setTextColor(TEXT_DARK.r,TEXT_DARK.g,TEXT_DARK.b); doc.setFontSize(8.5); doc.setFont('helvetica','normal');
      doc.text(String(i+1),ml+4,y+4);
      doc.text(rowDesc,ml+20,y+4);
      doc.text(String(it.quantity||1),ml+100,y+5.5,{align:'center'});
      doc.text(fmtCur(it.unit_price||net),ml+130,y+5.5,{align:'right'});
      doc.text(fmtCur(it.total_price||net),ml+cw-4,y+5.5,{align:'right'});
      doc.setDrawColor(229,231,235); doc.setLineWidth(0.2); doc.line(ml,y+8,ml+cw,y+8);
      y+=10;
    }

    // Totals
    y+=2; const tx=ml+100, tv=ml+cw-4;
    doc.setTextColor(TEXT_MED.r,TEXT_MED.g,TEXT_MED.b); doc.setFontSize(8.5); doc.setFont('helvetica','normal');
    doc.text('Nettobetrag',tx,y+4);
    doc.setTextColor(TEXT_DARK.r,TEXT_DARK.g,TEXT_DARK.b); doc.setFont('helvetica','bold');
    doc.text(fmtCur(net),tv,y+4,{align:'right'});
    y+=7;
    doc.setTextColor(TEXT_MED.r,TEXT_MED.g,TEXT_MED.b); doc.setFont('helvetica','normal');
    doc.text(isRC ? 'MwSt. 0% (Reverse Charge)' : `zzgl. ${taxR}% MwSt.`,tx,y+4);
    doc.setTextColor(TEXT_DARK.r,TEXT_DARK.g,TEXT_DARK.b);
    doc.text(fmtCur(taxAmt),tv,y+4,{align:'right'});
    y+=6;
    doc.setDrawColor(ACCENT.r,ACCENT.g,ACCENT.b); doc.setLineWidth(0.5); doc.line(tx,y,tv+4,y);
    y+=2;
    const totalBg = isPenalty ? RED_BG : GREEN_BG;
    const totalText = isPenalty ? RED_TEXT : GREEN_TEXT;
    doc.setFillColor(totalBg.r,totalBg.g,totalBg.b);
    doc.rect(tx-4,y,cw-tx+ml+8,9,'F');
    doc.setTextColor(totalText.r,totalText.g,totalText.b); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text('Gesamtbetrag',tx,y+6.5);
    doc.text(fmtCur(gross),tv,y+6.5,{align:'right'});
    y+=15;

    // Reverse Charge notice
    if(isRC){
      doc.setFillColor(BLUE_BG.r,BLUE_BG.g,BLUE_BG.b);
      doc.setDrawColor(BLUE_BORDER.r,BLUE_BORDER.g,BLUE_BORDER.b);
      doc.roundedRect(ml,y,cw,14,2,2,'FD');
      doc.setTextColor(BLUE_TEXT.r,BLUE_TEXT.g,BLUE_TEXT.b); doc.setFontSize(7.5); doc.setFont('helvetica','bold');
      doc.text('Hinweis: Reverse Charge – Steuerschuldnerschaft des Leistungsempfängers',ml+6,y+5.5);
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5);
      doc.text('Gemäß §13b UStG / Art. 196 MwStSystRL schuldet der Empfänger die Umsatzsteuer.',ml+6,y+10.5);
      y+=18;
    }

    // Payment box
    const pbH=30;
    doc.setFillColor(AMBER_BG.r,AMBER_BG.g,AMBER_BG.b);
    doc.setDrawColor(253,230,138); doc.roundedRect(ml+1.5,y,cw-1.5,pbH,0,2,'FD');
    doc.setFillColor(AMBER_BORDER.r,AMBER_BORDER.g,AMBER_BORDER.b); doc.rect(ml,y,1.5,pbH,'F');
    doc.setTextColor(AMBER_TEXT.r,AMBER_TEXT.g,AMBER_TEXT.b); doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text('Zahlungsinformationen',ml+8,y+6);
    let py=y+12;
    const payRow = (lbl:string,val:string) => {
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(120,113,108);
      doc.text(lbl,ml+8,py);
      doc.setTextColor(TEXT_DARK.r,TEXT_DARK.g,TEXT_DARK.b); doc.setFont('helvetica','bold');
      doc.text(val,ml+42,py); py+=4.5;
    };
    if(bankIban) payRow('IBAN:',bankIban);
    if(bankBic) payRow('BIC:',bankBic);
    if(bankName) payRow('Bank:',bankName);
    payRow('Verwendungszweck:',invoice.invoice_number);
    y+=pbH+6;

    // Closing
    doc.setTextColor(TEXT_MED.r,TEXT_MED.g,TEXT_MED.b); doc.setFontSize(8.5); doc.setFont('helvetica','normal');
    const closingLine = isPenalty
      ? 'Bitte begleichen Sie den Betrag fristgerecht.'
      : 'Vielen Dank für Ihr Vertrauen und die Zusammenarbeit!';
    doc.text(closingLine,ml,y); y+=4.5;
    doc.text('Mit freundlichen Grüßen',ml,y); y+=5;
    doc.setTextColor(ACCENT.r,ACCENT.g,ACCENT.b); doc.setFont('helvetica','bold');
    doc.text(`Ihr ${siteName} Team`,ml,y);

    // Footer
    const fy=283;
    doc.setFillColor(BRAND.r,BRAND.g,BRAND.b); doc.rect(0,fy,pw,14,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    const fl=[siteName]; if(md) fl.push(`GF: ${md}`); if(hrb) fl.push(`HRB ${hrb}`);
    doc.text(fl.join(' • '),ml,fy+5);
    doc.setFont('helvetica','normal');
    const fr=[]; if(taxNumber) fr.push(`StNr: ${taxNumber}`); if(ustId) fr.push(`USt-ID: ${ustId}`);
    if(fr.length) doc.text(fr.join(' • '),pw-mr,fy+5,{align:'right'});
    doc.setFontSize(6);
    doc.text([contactEmail,phoneS,website].filter(Boolean).join(' • '),pw/2,fy+10,{align:'center'});

    // Upload
    const pdfBytes = new Uint8Array(doc.output('arraybuffer'));
    const fileName = `${invoice.dealer_id}/${invoice.invoice_number.replace(/[^a-zA-Z0-9-]/g,'_')}.pdf`;
    const { error: upErr } = await supabase.storage.from('invoices').upload(fileName,pdfBytes,{contentType:'application/pdf',upsert:true});
    if(upErr) throw new Error(`Upload failed: ${upErr.message}`);
    const { data: signed, error: sErr } = await supabase.storage.from('invoices').createSignedUrl(fileName,365*24*60*60);
    if(sErr) throw new Error(`Signed URL failed: ${sErr.message}`);
    await supabase.from('invoices').update({pdf_url:signed.signedUrl,updated_at:new Date().toISOString()}).eq('id',invoiceId);

    console.log(`Invoice PDF: ${invoice.invoice_number}${isRC?' (RC)':''}`);
    return new Response(JSON.stringify({success:true,pdfUrl:signed.signedUrl,pdfBase64:btoa(String.fromCharCode(...pdfBytes)),invoiceNumber:invoice.invoice_number}),
      {headers:{...getCorsHeaders(req),'Content-Type':'application/json'}});
  } catch(e: any) {
    console.error('generate-invoice-pdf error:',e);
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{...getCorsHeaders(req),'Content-Type':'application/json'}});
  }
});
