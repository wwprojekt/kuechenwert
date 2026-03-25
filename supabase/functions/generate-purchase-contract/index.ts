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

// ─── White logo for dark header (Base64 PNG, 185x50px) ─────────────────────
const LOGO_WHITE_BASE64 = 'data:image/png;base64,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';

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

function isoTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Convert a number to German words for legal contracts.
 * Supports amounts up to 999.999,99 €.
 */
function numberToWords(n: number): string {
  const ones = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
    'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
  const tens = ['', 'zehn', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

  function twoDigits(num: number): string {
    if (num < 20) return ones[num];
    const t = Math.floor(num / 10);
    const o = num % 10;
    if (o === 0) return tens[t];
    if (o === 1) return 'ein' + 'und' + tens[t];
    return ones[o] + 'und' + tens[t];
  }

  function threeDigits(num: number): string {
    if (num === 0) return '';
    if (num < 100) return twoDigits(num);
    const h = Math.floor(num / 100);
    const rest = num % 100;
    const hStr = ones[h] + 'hundert';
    if (rest === 0) return hStr;
    return hStr + twoDigits(rest);
  }

  const euros = Math.floor(n);
  const cents = Math.round((n - euros) * 100);

  let result = '';

  if (euros === 0) {
    result = 'null';
  } else if (euros === 1) {
    result = 'ein';
  } else {
    const thousands = Math.floor(euros / 1000);
    const remainder = euros % 1000;

    if (thousands > 0) {
      if (thousands === 1) {
        result += 'eintausend';
      } else {
        result += threeDigits(thousands) + 'tausend';
      }
    }
    if (remainder > 0) {
      result += threeDigits(remainder);
    }
  }

  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1);

  if (cents > 0) {
    result += ' Euro und ' + twoDigits(cents) + ' Cent';
  } else {
    result += ' Euro';
  }

  return result;
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
    const timestamp = isoTimestamp();
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
      // Dark brand header bar
      doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
      doc.rect(0, 0, pw, 22, 'F');
      doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.rect(0, 22, pw, 1.2, 'F');

      // White logo in header (185x50px = ~35x9.5mm)
      try {
        doc.addImage(LOGO_WHITE_BASE64, 'PNG', ml, 3, 35, 9.5);
      } catch (_e) {
        // Fallback: text if image fails
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(siteName, ml, 11);
      }

      // Contract info on the right
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`Vertragsnr.: ${contractNumber}`, pw - mr, 10, { align: 'right' });
      doc.text(`Datum: ${today}`, pw - mr, 15, { align: 'right' });
      doc.text('Kaufvertrag', pw - mr, 20, { align: 'right' });
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
        y = 30;
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
        y = 30;
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
        y = 30;
      }
      doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(text, cw - indent * 2);
      for (const line of lines) {
        if (y > 275) {
          doc.addPage();
          addHeader();
          y = 30;
        }
        doc.text(line, ml + indent, y);
        y += 4;
      }
      y += 1;
    };

    // ── PAGE 1 ─────────────────────────────────────────────────────
    addHeader();
    y = 30;

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
    doc.text('Verkäufer (nachfolgend „Verkäufer"):', ml + 3, y);
    y += 5;
    detailRow('Name', sellerName);
    detailRow('Anschrift', sellerAddress);
    if (sellerPhone) detailRow('Telefon', sellerPhone);
    detailRow('E-Mail', sellerEmail);
    y += 3;

    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Käufer (nachfolgend „Käufer"):', ml + 3, y);
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

    // ── §3 Kaufpreis und Zahlung ──────────────────────────────────
    sectionTitle('§ 3 Kaufpreis und Zahlung');

    paragraphText(`Der Kaufpreis beträgt ${formatCurrency(salePrice)} (in Worten: ${numberToWords(salePrice)}).`);
    paragraphText('Der Kaufpreis wurde im Rahmen einer Online-Auktion über die Plattform ' + siteName + ' ermittelt und ist von beiden Parteien als verbindlich anerkannt.');
    paragraphText('Da der Verkäufer als Privatperson handelt, wird keine Mehrwertsteuer ausgewiesen. Der Kaufpreis versteht sich als Bruttobetrag. Dem Käufer steht es frei, die Differenzbesteuerung gemäß §25a UStG anzuwenden.');
    paragraphText('Die Zahlung des Kaufpreises ist innerhalb von 7 Werktagen nach Zuschlag auf das von ' + siteName + ' benannte Treuhandkonto zu leisten. Die genauen Zahlungsdaten werden dem Käufer separat per E-Mail mitgeteilt. Die Auszahlung an den Verkäufer erfolgt nach erfolgreicher Fahrzeugübergabe.');
    y += 1;

    // ── §4 Übergabe ───────────────────────────────────────────────
    sectionTitle('§ 4 Übergabe und Eigentumsübergang');

    paragraphText('Die Übergabe des Fahrzeugs erfolgt nach vollständiger Zahlung des Kaufpreises. Der Eigentumsübergang erfolgt mit der Übergabe des Fahrzeugs und aller zugehörigen Dokumente (Fahrzeugbrief, Fahrzeugschein, Serviceheft, sämtliche Schlüssel).');
    paragraphText('Der Verkäufer verpflichtet sich, das Fahrzeug im vereinbarten Zustand zu übergeben. Der Käufer hat das Recht, das Fahrzeug vor der Übergabe zu besichtigen.');
    paragraphText('Die Übergabe wird in einem separaten Übergabeprotokoll dokumentiert, das von beiden Parteien zu unterzeichnen ist und als Anlage zu diesem Vertrag gilt. Das Übergabeprotokoll wird über die Plattform ' + siteName + ' bereitgestellt.');
    y += 1;

    // ── §5 Gewährleistung ──────────────────────────────────────────
    sectionTitle('§ 5 Gewährleistung und Haftung');

    paragraphText('Das Fahrzeug wird unter Ausschluss jeglicher Sachmängelhaftung verkauft. Dieser Ausschluss gilt nicht für Schadensersatzansprüche aus Verletzung des Lebens, des Körpers oder der Gesundheit und bei vorsätzlich oder grob fahrlässig verursachten Schäden des Verkäufers.');
    paragraphText('Der Verkäufer versichert, dass ihm keine verdeckten Mängel bekannt sind, die er dem Käufer nicht mitgeteilt hat. Bekannte Mängel und Schäden sind im Inserat auf ' + siteName + ' dokumentiert.');
    if (motorhome.has_damage && motorhome.damage_summary) {
      paragraphText(`Bekannte Schäden/Mängel: ${motorhome.damage_summary}`);
    }
    y += 1;

    // ── §6 Sonstige Vereinbarungen ─────────────────────────────────
    sectionTitle('§ 6 Sonstige Vereinbarungen');

    paragraphText('Der Verkäufer versichert, dass das Fahrzeug sein alleiniges Eigentum ist und frei von Rechten Dritter (z.B. Pfandrechte, Sicherungsübereignungen, Leasingverträge, Finanzierungen) ist.');
    paragraphText(`${motorhome.accident_free ? 'Der Verkäufer versichert, dass das Fahrzeug unfallfrei ist.' : 'Der Verkäufer hat angegeben, dass das Fahrzeug nicht unfallfrei ist. Details sind im Inserat dokumentiert.'}`);
    paragraphText(`Anzahl der Vorbesitzer: ${motorhome.previous_owners !== null && motorhome.previous_owners !== undefined ? motorhome.previous_owners : 'Nicht angegeben'}.`);
    paragraphText('Der Verkäufer verpflichtet sich, das Fahrzeug bis zur Übergabe ordnungsgemäß zu versichern und keine wesentlichen Veränderungen am Fahrzeug vorzunehmen.');
    y += 1;

    // ── §7 Vermittlung ─────────────────────────────────────────────
    sectionTitle('§ 7 Vermittlung durch ' + siteName);

    paragraphText(`Dieser Kaufvertrag wurde über die Online-Plattform ${siteName} (${siteAddress}, ${siteZip} ${siteCity}) vermittelt. ${siteName} tritt ausschließlich als Vermittler auf und ist nicht Vertragspartei dieses Kaufvertrags.`);
    paragraphText(`Die Vermittlungsprovision wird separat zwischen ${siteName} und dem Käufer abgerechnet und ist nicht Bestandteil des in §3 genannten Kaufpreises.`);
    y += 1;

    // ── §8 Schlussbestimmungen ─────────────────────────────────────
    sectionTitle('§ 8 Schlussbestimmungen');

    paragraphText('Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform. Mündliche Nebenabreden bestehen nicht. Sollte eine Bestimmung dieses Vertrages unwirksam sein oder werden, so wird die Wirksamkeit der übrigen Bestimmungen davon nicht berührt. An die Stelle der unwirksamen Bestimmung tritt eine wirksame Regelung, die dem wirtschaftlichen Zweck der unwirksamen Bestimmung am nächsten kommt.');
    paragraphText('Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit gesetzlich zulässig, der Sitz des Vermittlers.');
    paragraphText(`Dieser Vertrag wurde in zwei gleichlautenden Ausfertigungen erstellt – je eine für den Verkäufer und den Käufer. Eine digitale Kopie wird über ${siteName} bereitgestellt.`);
    y += 3;

    // ── Unterschriften ─────────────────────────────────────────────
    if (y > 220) {
      doc.addPage();
      addHeader();
      y = 30;
    }

    sectionTitle('Unterschriften');

    paragraphText(`Dieser Vertrag wurde elektronisch über die Plattform ${siteName} erstellt und gilt mit Zuschlag der Auktion als von beiden Parteien angenommen.`);
    y += 5;

    // Signature boxes
    const sigBoxWidth = (cw - 10) / 2;

    // Seller signature
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(ml, y, sigBoxWidth, 35);
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
    doc.text(`Datum: ${today}`, ml + 3, y + 19);
    doc.text(`Zeitstempel: ${timestamp}`, ml + 3, y + 24);
    doc.text('Elektronisch bestätigt via ' + siteName, ml + 3, y + 29);

    // Buyer signature
    const buyerSigX = ml + sigBoxWidth + 10;
    doc.setDrawColor(200, 200, 200);
    doc.rect(buyerSigX, y, sigBoxWidth, 35);
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
    doc.text(`Datum: ${today}`, buyerSigX + 3, y + 19);
    doc.text(`Zeitstempel: ${timestamp}`, buyerSigX + 3, y + 24);
    doc.text('Elektronisch bestätigt via ' + siteName, buyerSigX + 3, y + 29);

    y += 42;

    // ── Hinweis-Box am Ende ────────────────────────────────────────
    if (y < 260) {
      doc.setFillColor(LIGHT_BG.r, LIGHT_BG.g, LIGHT_BG.b);
      doc.rect(ml, y, cw, 16, 'F');
      doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.setLineWidth(0.4);
      doc.line(ml, y, ml, y + 16);
      doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.text('Hinweis: Dieser Kaufvertrag wurde automatisch über die Plattform ' + siteName + ' generiert.', ml + 3, y + 4);
      doc.text('Bei Fragen wenden Sie sich bitte an ' + contactEmail + '. Dieses Dokument dient als rechtsverbindlicher', ml + 3, y + 8);
      doc.text('Kaufvertrag zwischen den oben genannten Parteien. Vertragsnummer: ' + contractNumber, ml + 3, y + 12);
    }

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

    // Create signed URL (valid for 10 years for legal documents)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('purchase-contracts')
      .createSignedUrl(fileName, 10 * 365 * 24 * 60 * 60);

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

    // Update motorhome record with contract URL
    await supabase
      .from('motorhomes')
      .update({ contract_url: contractUrl })
      .eq('id', motorhomeId);

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
