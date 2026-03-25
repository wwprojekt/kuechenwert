import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
// @deno-types="https://esm.sh/jspdf@2.5.2"
import { jsPDF } from 'https://esm.sh/jspdf@2.5.2';

/**
 * Edge Function: generate-purchase-contract
 * 
 * Generates a professional, German-language purchase contract (Kaufvertrag)
 * between the seller (private) and the buyer (dealer) after a successful auction.
 * 
 * The PDF is uploaded to Supabase Storage (purchase-contracts bucket) and
 * the motorhome record is updated with the contract URL.
 * 
 * Called by: close-auction (after invoice flow, when status = sold)
 * Auth: service_role or admin
 */

interface ContractRequest {
  auctionId: string;
  motorhomeId: string;
  buyerId: string;   // dealer
  sellerId: string;  // private seller
  salePrice: number; // winning bid amount
}

// ─── Color constants (matching CaravanWert brand) ──────────────────────────
const BRAND = { r: 15, g: 79, b: 92 };       // #0f4f5c
const ACCENT = { r: 31, g: 138, b: 162 };     // #1f8aa2
const TEXT_DARK = { r: 31, g: 41, b: 55 };
const TEXT_MED = { r: 75, g: 85, b: 99 };
const TEXT_LIGHT = { r: 107, g: 114, b: 128 };
const LIGHT_BG = { r: 249, g: 250, b: 251 };  // #f9fafb

function formatCurrency(amount: number): string {
  return Number(amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '–';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function todayFormatted(): string {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function numberToWords(n: number): string {
  // Simple German number-to-words for common amounts (fallback to numeric)
  const formatted = formatCurrency(n);
  return formatted; // For legal contracts, numeric is standard in Germany
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
    const { auctionId, motorhomeId, buyerId, sellerId, salePrice }: ContractRequest = await req.json();

    if (!auctionId || !motorhomeId || !buyerId || !sellerId || !salePrice) {
      throw new Error('All fields are required: auctionId, motorhomeId, buyerId, sellerId, salePrice');
    }

    console.log('Generating purchase contract for auction:', auctionId);

    // ─── Fetch all required data ───────────────────────────────────
    const { data: motorhome, error: mhError } = await supabase
      .from('motorhomes')
      .select('*')
      .eq('id', motorhomeId)
      .single();

    if (mhError || !motorhome) throw new Error(`Motorhome not found: ${mhError?.message}`);

    const { data: seller, error: sellerError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sellerId)
      .single();

    if (sellerError || !seller) throw new Error(`Seller not found: ${sellerError?.message}`);

    const { data: buyer, error: buyerError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', buyerId)
      .single();

    if (buyerError || !buyer) throw new Error(`Buyer not found: ${buyerError?.message}`);

    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    // ─── Prepare data ──────────────────────────────────────────────
    const siteName = settings?.site_name || 'CaravanWert';
    const siteAddress = settings?.company_address || 'Hannoversche Straße 106';
    const siteCity = settings?.company_city || 'Hannover';
    const siteZip = settings?.company_postal_code || '30627';
    const managingDirector = settings?.managing_director || '';
    const hrbNumber = settings?.hrb_number || '';
    const contactEmail = settings?.contact_email || 'kontakt@caravanwert.de';

    const sellerName = `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || 'Verkäufer';
    const sellerAddress = [seller.address_street, `${seller.address_zip || ''} ${seller.address_city || ''}`.trim()].filter(Boolean).join(', ') || 'Adresse nicht hinterlegt';
    const sellerEmail = seller.email || '';
    const sellerPhone = seller.phone || '';

    const buyerName = buyer.company_name || `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || 'Käufer';
    const buyerAddress = [buyer.company_street, `${buyer.company_zip || ''} ${buyer.company_city || ''}`.trim()].filter(Boolean).join(', ') || 'Adresse nicht hinterlegt';
    const buyerEmail = buyer.email || '';
    const buyerPhone = buyer.phone || '';
    const buyerTaxId = buyer.tax_id || '';

    const vehicleName = `${motorhome.manufacturer} ${motorhome.model}`;
    const vin = motorhome.vehicle_identification_number || 'Nicht angegeben';
    const licensePlate = motorhome.license_plate || 'Nicht angegeben';
    const firstReg = formatDate(motorhome.first_registration);
    const mileage = motorhome.mileage ? `${motorhome.mileage.toLocaleString('de-DE')} km` : 'Nicht angegeben';
    const bodyType = motorhome.body_type || 'Nicht angegeben';
    const year = motorhome.year ? String(motorhome.year) : 'Nicht angegeben';
    const fuelType = motorhome.fuel_type || 'Nicht angegeben';
    const weight = motorhome.weight_kg ? `${motorhome.weight_kg.toLocaleString('de-DE')} kg` : 'Nicht angegeben';

    const today = todayFormatted();
    const contractNumber = `KV-${new Date().getFullYear()}-${auctionId.substring(0, 8).toUpperCase()}`;

    // ─── Generate PDF ──────────────────────────────────────────────
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = 210;
    const ml = 20;
    const mr = 20;
    const cw = pw - ml - mr;
    let y = 0;

    // ── Helper functions ───────────────────────────────────────────
    const addHeader = () => {
      doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
      doc.rect(0, 0, pw, 20, 'F');
      doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.rect(0, 20, pw, 1.2, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(siteName, ml, 10);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Kaufvertrag', ml, 16);

      doc.setFontSize(7);
      doc.text(`Vertragsnr.: ${contractNumber}`, pw - mr, 10, { align: 'right' });
      doc.text(`Datum: ${today}`, pw - mr, 16, { align: 'right' });
    };

    const addFooter = (pageNum: number, totalPages: number) => {
      const footerY = 283;
      doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
      doc.rect(0, footerY, pw, 14, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      const footerLeft = [siteName];
      if (managingDirector) footerLeft.push(`GF: ${managingDirector}`);
      if (hrbNumber) footerLeft.push(`HRB ${hrbNumber}`);
      doc.text(footerLeft.join(' · '), ml, footerY + 5);
      doc.text(`Seite ${pageNum} von ${totalPages}`, pw - mr, footerY + 5, { align: 'right' });
      doc.text(`Vermittelt über ${siteName} · ${contactEmail}`, pw / 2, footerY + 10, { align: 'center' });
    };

    const sectionTitle = (title: string) => {
      if (y > 255) {
        doc.addPage();
        addHeader();
        y = 28;
      }
      y += 3;
      doc.setFillColor(LIGHT_BG.r, LIGHT_BG.g, LIGHT_BG.b);
      doc.rect(ml, y - 4, cw, 7, 'F');
      doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.line(ml, y - 4, ml + cw, y - 4);
      doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(title, ml + 3, y);
      y += 6;
    };

    const detailRow = (label: string, value: string) => {
      if (y > 270) {
        doc.addPage();
        addHeader();
        y = 28;
      }
      doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(label, ml + 3, y);
      doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
      doc.setFont('helvetica', 'bold');
      doc.text(value, ml + 55, y);
      y += 5;
    };

    const paragraphText = (text: string, indent = 3) => {
      if (y > 265) {
        doc.addPage();
        addHeader();
        y = 28;
      }
      doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(text, cw - indent * 2);
      for (const line of lines) {
        if (y > 275) {
          doc.addPage();
          addHeader();
          y = 28;
        }
        doc.text(line, ml + indent, y);
        y += 4;
      }
      y += 1;
    };

    // ── PAGE 1 ─────────────────────────────────────────────────────
    addHeader();
    y = 28;

    // Title
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Kaufvertrag', pw / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(10);
    doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.text('über ein gebrauchtes Wohnmobil / Wohnwagen', pw / 2, y, { align: 'center' });
    y += 4;
    doc.setFontSize(7);
    doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
    doc.text(`Vermittelt über ${siteName} · ${siteAddress}, ${siteZip} ${siteCity}`, pw / 2, y, { align: 'center' });
    y += 8;

    // ── §1 Vertragsparteien ────────────────────────────────────────
    sectionTitle('§ 1 Vertragsparteien');

    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Verkäufer:', ml + 3, y);
    y += 5;
    detailRow('Name', sellerName);
    detailRow('Anschrift', sellerAddress);
    if (sellerPhone) detailRow('Telefon', sellerPhone);
    detailRow('E-Mail', sellerEmail);
    y += 3;

    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Käufer:', ml + 3, y);
    y += 5;
    detailRow('Firma / Name', buyerName);
    detailRow('Anschrift', buyerAddress);
    if (buyerPhone) detailRow('Telefon', buyerPhone);
    detailRow('E-Mail', buyerEmail);
    if (buyerTaxId) detailRow('USt-IdNr.', buyerTaxId);
    y += 2;

    // ── §2 Vertragsgegenstand ──────────────────────────────────────
    sectionTitle('§ 2 Vertragsgegenstand');

    paragraphText('Der Verkäufer verkauft dem Käufer das nachstehend beschriebene Fahrzeug:');
    y += 1;
    detailRow('Hersteller / Modell', vehicleName);
    detailRow('Baujahr', year);
    detailRow('Aufbauart', bodyType);
    detailRow('Erstzulassung', firstReg);
    detailRow('Kilometerstand', mileage);
    detailRow('Fahrgestellnr. (VIN)', vin);
    detailRow('Kennzeichen', licensePlate);
    detailRow('Kraftstoff', fuelType);
    detailRow('Zul. Gesamtgewicht', weight);
    y += 2;

    // ── §3 Kaufpreis ───────────────────────────────────────────────
    sectionTitle('§ 3 Kaufpreis');

    paragraphText(`Der Kaufpreis beträgt ${formatCurrency(salePrice)} (in Worten: ${formatCurrency(salePrice)}).`);
    paragraphText('Der Kaufpreis wurde im Rahmen einer Online-Auktion über die Plattform ' + siteName + ' ermittelt und ist von beiden Parteien als verbindlich anerkannt.');
    paragraphText('Die Zahlung erfolgt gemäß der zwischen den Parteien und ' + siteName + ' vereinbarten Zahlungsmodalitäten.');
    y += 1;

    // ── §4 Übergabe ───────────────────────────────────────────────
    sectionTitle('§ 4 Übergabe und Eigentumsübergang');

    paragraphText('Die Übergabe des Fahrzeugs erfolgt nach vollständiger Zahlung des Kaufpreises. Der Eigentumsübergang erfolgt mit der Übergabe des Fahrzeugs und aller zugehörigen Dokumente (Fahrzeugbrief, Fahrzeugschein, Serviceheft, Schlüssel).');
    paragraphText('Der Verkäufer verpflichtet sich, das Fahrzeug im vereinbarten Zustand zu übergeben. Der Käufer hat das Recht, das Fahrzeug vor der Übergabe zu besichtigen.');
    y += 1;

    // ── §5 Gewährleistung ──────────────────────────────────────────
    sectionTitle('§ 5 Gewährleistung und Haftung');

    paragraphText('Das Fahrzeug wird unter Ausschluss jeglicher Sachmängelhaftung verkauft. Dieser Ausschluss gilt nicht für Schadensersatzansprüche aus Verletzung des Lebens, des Körpers oder der Gesundheit und bei vorsätzlich oder grob fahrlässig verursachten Schäden.');
    paragraphText('Der Verkäufer versichert, dass ihm keine verdeckten Mängel bekannt sind, die er dem Käufer nicht mitgeteilt hat. Bekannte Mängel und Schäden sind im Inserat auf ' + siteName + ' dokumentiert.');
    if (motorhome.has_damage && motorhome.damage_summary) {
      paragraphText(`Bekannte Schäden/Mängel: ${motorhome.damage_summary}`);
    }
    y += 1;

    // ── §6 Sonstige Vereinbarungen ─────────────────────────────────
    sectionTitle('§ 6 Sonstige Vereinbarungen');

    paragraphText('Der Verkäufer versichert, dass das Fahrzeug sein Eigentum ist und frei von Rechten Dritter (z.B. Pfandrechte, Sicherungsübereignungen, Leasingverträge) ist.');
    paragraphText(`${motorhome.accident_free ? 'Der Verkäufer versichert, dass das Fahrzeug unfallfrei ist.' : 'Der Verkäufer hat angegeben, dass das Fahrzeug nicht unfallfrei ist. Details sind im Inserat dokumentiert.'}`);
    paragraphText(`Anzahl der Vorbesitzer: ${motorhome.previous_owners !== null ? motorhome.previous_owners : 'Nicht angegeben'}.`);
    y += 1;

    // ── §7 Vermittlung ─────────────────────────────────────────────
    sectionTitle('§ 7 Vermittlung durch ' + siteName);

    paragraphText(`Dieser Kaufvertrag wurde über die Online-Plattform ${siteName} (${siteAddress}, ${siteZip} ${siteCity}) vermittelt. ${siteName} tritt als Vermittler auf und ist nicht Vertragspartei dieses Kaufvertrags.`);
    paragraphText(`Die Vermittlungsprovision wird separat zwischen ${siteName} und dem Käufer abgerechnet und ist nicht Bestandteil dieses Kaufvertrags.`);
    y += 1;

    // ── §8 Schlussbestimmungen ─────────────────────────────────────
    sectionTitle('§ 8 Schlussbestimmungen');

    paragraphText('Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform. Sollte eine Bestimmung dieses Vertrages unwirksam sein, so wird die Wirksamkeit der übrigen Bestimmungen davon nicht berührt.');
    paragraphText('Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit gesetzlich zulässig, der Sitz des Vermittlers.');
    y += 3;

    // ── Unterschriften ─────────────────────────────────────────────
    if (y > 230) {
      doc.addPage();
      addHeader();
      y = 28;
    }

    sectionTitle('Unterschriften');

    paragraphText(`Dieser Vertrag wurde elektronisch über die Plattform ${siteName} erstellt und gilt mit Zuschlag der Auktion als von beiden Parteien angenommen.`);
    y += 5;

    // Signature boxes
    const sigBoxWidth = (cw - 10) / 2;

    // Seller signature
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(ml, y, sigBoxWidth, 30);
    doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Verkäufer', ml + 3, y + 5);
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(sellerName, ml + 3, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    doc.text(`Datum: ${today}`, ml + 3, y + 18);
    doc.text('Elektronisch bestätigt via ' + siteName, ml + 3, y + 24);

    // Buyer signature
    const buyerSigX = ml + sigBoxWidth + 10;
    doc.setDrawColor(200, 200, 200);
    doc.rect(buyerSigX, y, sigBoxWidth, 30);
    doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Käufer', buyerSigX + 3, y + 5);
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(buyerName, buyerSigX + 3, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    doc.text(`Datum: ${today}`, buyerSigX + 3, y + 18);
    doc.text('Elektronisch bestätigt via ' + siteName, buyerSigX + 3, y + 24);

    // ── Add footers to all pages ───────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(i, totalPages);
    }

    // ─── Output PDF ────────────────────────────────────────────────
    const pdfOutput = doc.output('arraybuffer');
    const pdfBytes = new Uint8Array(pdfOutput);

    // Upload to storage
    const fileName = `${sellerId}/${contractNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('purchase-contracts')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload contract PDF: ${uploadError.message}`);
    }

    // Create signed URL (valid for 1 year)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('purchase-contracts')
      .createSignedUrl(fileName, 365 * 24 * 60 * 60);

    if (signedError) {
      throw new Error(`Failed to create signed URL: ${signedError.message}`);
    }

    // Also create a buyer-accessible copy
    const buyerFileName = `${buyerId}/${contractNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
    await supabase.storage
      .from('purchase-contracts')
      .upload(buyerFileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    const contractUrl = signedData.signedUrl;

    // Return PDF as base64 for email attachment
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    console.log(`Purchase contract generated: ${contractNumber}`);

    return new Response(
      JSON.stringify({
        success: true,
        contractNumber,
        contractUrl,
        pdfBase64,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in generate-purchase-contract:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
