import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
// @deno-types="https://esm.sh/jspdf@2.5.2"
import { jsPDF } from 'https://esm.sh/jspdf@2.5.2';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

/**
 * Edge Function: generate-blank-handover-protocol
 *
 * Generates a pre-filled BLANK handover protocol PDF (Übergabeprotokoll
 * zum Ausdrucken) that is sent in a SEPARATE e-mail alongside the
 * Kaufvertrag. The PDF pre-fills static contract/vehicle/party data
 * and leaves all fields that are only known on the handover day BLANK
 * (mileage, tank, keys, visible damage, given documents/accessories,
 * payment method, signatures).
 *
 * Storage bucket: `handover-protocols`
 * DB columns:     `purchase_contracts.blank_protocol_url` + `_storage_path`
 *
 * IMPORTANT — distinct from `generate-handover-pdf`:
 *   `generate-handover-pdf`            → completed protocol AFTER handover (HTML, requires appointment)
 *   `generate-blank-handover-protocol` → blank protocol BEFORE handover (PDF, this function)
 *
 * Called by: close-auction, instant-buy, accept-kaufchance-offer,
 *            admin-correct-sale, admin-sell-to-dealer (via shared helper)
 * Auth: service_role or admin
 */

interface HandoverProtocolRequest {
  motorhomeId: string;
  buyerId: string;
  sellerId: string;
  contractNumber: string;
  salePrice: number;
}

const BRAND = { r: 15, g: 79, b: 92 };
const ACCENT = { r: 31, g: 138, b: 162 };
const TEXT_DARK = { r: 31, g: 41, b: 55 };
const TEXT_MED = { r: 75, g: 85, b: 99 };
const TEXT_LIGHT = { r: 107, g: 114, b: 128 };
const LIGHT_BG = { r: 249, g: 250, b: 251 };
const LINE_GREY = { r: 209, g: 213, b: 219 };

const DASH = '-';

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(Number(amount))) return DASH;
  return Number(amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';
}

function formatMonthYear(dateStr?: string | null): string {
  if (!dateStr) return DASH;
  const m = /^(\d{4})-(\d{2})/.exec(dateStr);
  if (m) return `${m[2]}.${m[1]}`;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${mm}.${d.getUTCFullYear()}`;
  } catch {
    return String(dateStr);
  }
}

function todayFormatted(): string {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function safe(value: unknown, fallback = DASH): string {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s.length > 0 ? s : fallback;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const authCheck = await checkServiceRoleOrAdmin(req, corsHeaders);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const body = await req.json() as HandoverProtocolRequest;
    const { motorhomeId, buyerId, sellerId, contractNumber, salePrice } = body;

    if (!motorhomeId || !buyerId || !sellerId || !contractNumber) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: motorhomeId, buyerId, sellerId, contractNumber' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: motorhome, error: motorhomeError } = await supabase
      .from('motorhomes')
      .select(`
        id, manufacturer, model, base_vehicle, power_kw, engine_power_hp,
        first_registration, vehicle_identification_number, weight_kg, mileage,
        fuel_type, engine_displacement_ccm, year, license_plate
      `)
      .eq('id', motorhomeId)
      .maybeSingle();

    if (motorhomeError || !motorhome) {
      console.error('Motorhome fetch failed:', motorhomeError);
      return new Response(
        JSON.stringify({ error: `Motorhome not found: ${motorhomeError?.message || 'unknown'}` }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const { data: seller } = await supabase
      .from('profiles')
      .select(`
        id, first_name, last_name, email, phone,
        street, house_number, postal_code, city, country, company_name
      `)
      .eq('id', sellerId)
      .maybeSingle();

    const { data: buyer } = await supabase
      .from('profiles')
      .select(`
        id, first_name, last_name, email, phone,
        street, house_number, postal_code, city, country, company_name
      `)
      .eq('id', buyerId)
      .maybeSingle();

    const { data: settings } = await supabase
      .from('site_settings')
      .select('site_name, contact_email, contact_phone')
      .limit(1)
      .maybeSingle();

    const siteName = settings?.site_name || 'CaravanWert';
    const contactEmail = settings?.contact_email || 'info@caravanwert.de';
    const contactPhone = settings?.contact_phone || '';

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = 210;
    const pageH = 297;
    const margin = 12;
    const contentW = pageW - 2 * margin;

    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.rect(0, 0, pageW, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('CaravanWert', margin, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Wohnmobile & Wohnwagen', margin, 19);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('UEBERGABEPROTOKOLL', pageW - margin, 16, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Vertrag: ${contractNumber}`, pageW - margin, 22, { align: 'right' });
    doc.text(`Ausgestellt am: ${todayFormatted()}`, pageW - margin, 27, { align: 'right' });

    let y = 42;

    const sectionHeader = (title: string) => {
      doc.setFillColor(LIGHT_BG.r, LIGHT_BG.g, LIGHT_BG.b);
      doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.setLineWidth(0.4);
      doc.rect(margin, y, contentW, 7, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
      doc.text(title, margin + 2, y + 4.8);
      // Box ends at y+7. We advance by 12mm so that the next baseline (y+12)
      // leaves ~1.8mm clearance for capital-letter ascenders (≈2.3mm at 9pt)
      // and ~2mm clearance for checkbox rects (drawn at y-3) — without this
      // the first row of content visibly bleeds into the section header
      // border. Was 9 (caused 0.5–1mm overlap into the bottom border line).
      y += 12;
      doc.setLineWidth(0.2);
    };

    const labelValueRow = (label: string, value: string, opts?: { col2Label?: string; col2Value?: string }) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
      doc.text(label, margin + 2, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
      const valueX = margin + 38;
      const valueMaxW = opts?.col2Label ? (contentW / 2 - 40) : (contentW - 40);
      const valueLines = doc.splitTextToSize(value, valueMaxW);
      doc.text(valueLines, valueX, y);

      if (opts?.col2Label && opts?.col2Value !== undefined) {
        const col2X = margin + contentW / 2 + 2;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
        doc.text(opts.col2Label, col2X, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
        const v2Lines = doc.splitTextToSize(opts.col2Value || DASH, contentW / 2 - 40);
        doc.text(v2Lines, col2X + 38, y);
      }

      y += Math.max(5.5, (Array.isArray(valueLines) ? valueLines.length : 1) * 4.5);
    };

    const blankLine = (label: string, lineWidthMm = 60, suffix?: string) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
      doc.text(label, margin + 2, y);
      doc.setDrawColor(LINE_GREY.r, LINE_GREY.g, LINE_GREY.b);
      const lineX = margin + 2 + doc.getTextWidth(label) + 2;
      doc.setLineWidth(0.3);
      doc.line(lineX, y + 0.8, lineX + lineWidthMm, y + 0.8);
      if (suffix) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
        doc.text(suffix, lineX + lineWidthMm + 2, y);
      }
      y += 6.5;
    };

    const emptyLine = () => {
      doc.setDrawColor(LINE_GREY.r, LINE_GREY.g, LINE_GREY.b);
      doc.setLineWidth(0.3);
      doc.line(margin + 2, y + 0.8, margin + contentW - 2, y + 0.8);
      y += 6.5;
    };

    const checkboxGrid = (items: string[], cols = 2) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
      doc.setDrawColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
      doc.setLineWidth(0.3);
      const colWidth = contentW / cols;
      const rowHeight = 5.5;
      const rowsPerCol = Math.ceil(items.length / cols);
      items.forEach((item, idx) => {
        const col = Math.floor(idx / rowsPerCol);
        const row = idx % rowsPerCol;
        const x = margin + 2 + col * colWidth;
        const yy = y + row * rowHeight;
        doc.rect(x, yy - 3, 3.5, 3.5, 'S');
        doc.text(item, x + 5, yy);
      });
      y += rowsPerCol * rowHeight + 1;
    };

    sectionHeader('1. Fahrzeugdaten');
    const brandModel = `${safe(motorhome.manufacturer, '')} ${safe(motorhome.model, '')}`.trim() || DASH;
    labelValueRow('Marke / Modell:', brandModel);
    labelValueRow(
      'FIN (VIN):', safe(motorhome.vehicle_identification_number),
      { col2Label: 'Erstzulassung:', col2Value: formatMonthYear(motorhome.first_registration) },
    );
    labelValueRow(
      'Basisfahrzeug:', safe(motorhome.base_vehicle),
      { col2Label: 'Modelljahr:', col2Value: motorhome.year ? String(motorhome.year) : DASH },
    );
    const psStr = motorhome.engine_power_hp
      ? `${motorhome.engine_power_hp} PS${motorhome.power_kw ? ` (${motorhome.power_kw} kW)` : ''}`
      : (motorhome.power_kw ? `${motorhome.power_kw} kW` : DASH);
    labelValueRow(
      'Leistung:', psStr,
      { col2Label: 'Hubraum:', col2Value: motorhome.engine_displacement_ccm ? `${motorhome.engine_displacement_ccm} ccm` : DASH },
    );
    labelValueRow(
      'Kraftstoff:', safe(motorhome.fuel_type),
      { col2Label: 'Zul. Gesamtmasse:', col2Value: motorhome.weight_kg ? `${Number(motorhome.weight_kg).toLocaleString('de-DE')} kg` : DASH },
    );
    labelValueRow(
      'Kennzeichen:', safe(motorhome.license_plate),
      { col2Label: 'KM-Stand (Inserat):', col2Value: motorhome.mileage ? `${Number(motorhome.mileage).toLocaleString('de-DE')} km` : DASH },
    );
    y += 2;

    sectionHeader('2. Verkaeufer');
    const sellerName = seller?.company_name
      || `${safe(seller?.first_name, '')} ${safe(seller?.last_name, '')}`.trim()
      || DASH;
    const sellerAddress = [
      `${safe(seller?.street, '')} ${safe(seller?.house_number, '')}`.trim(),
      `${safe(seller?.postal_code, '')} ${safe(seller?.city, '')}`.trim(),
      safe(seller?.country, ''),
    ].filter((p) => p && p !== DASH).join(', ') || DASH;
    labelValueRow('Name:', sellerName);
    labelValueRow('Anschrift:', sellerAddress);
    labelValueRow(
      'E-Mail:', safe(seller?.email),
      { col2Label: 'Telefon:', col2Value: safe(seller?.phone) },
    );
    y += 2;

    sectionHeader('3. Kaeufer');
    const buyerName = buyer?.company_name
      || `${safe(buyer?.first_name, '')} ${safe(buyer?.last_name, '')}`.trim()
      || DASH;
    const buyerAddress = [
      `${safe(buyer?.street, '')} ${safe(buyer?.house_number, '')}`.trim(),
      `${safe(buyer?.postal_code, '')} ${safe(buyer?.city, '')}`.trim(),
      safe(buyer?.country, ''),
    ].filter((p) => p && p !== DASH).join(', ') || DASH;
    labelValueRow('Name / Firma:', buyerName);
    labelValueRow('Anschrift:', buyerAddress);
    labelValueRow(
      'E-Mail:', safe(buyer?.email),
      { col2Label: 'Telefon:', col2Value: safe(buyer?.phone) },
    );
    labelValueRow('Vereinbarter Kaufpreis:', formatCurrency(salePrice));
    y += 2;

    sectionHeader('4. Zustand bei Uebergabe (am Uebergabetag auszufuellen)');
    blankLine('Uebergabedatum:', 50);
    blankLine('Uebergabeort:', 110);
    blankLine('KM-Stand bei Uebergabe:', 50, 'km');
    blankLine('Anzahl Schluessel:', 30, 'Stueck');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    doc.text('Tankfuellung:', margin + 2, y);
    const tankItems = ['leer', '1/4', '1/2', '3/4', 'voll'];
    doc.setDrawColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.setLineWidth(0.3);
    let tankX = margin + 2 + 28;
    tankItems.forEach((label) => {
      doc.rect(tankX, y - 3, 3.5, 3.5, 'S');
      doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
      doc.text(label, tankX + 5, y);
      tankX += 22;
    });
    y += 6.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    doc.text('Allgemeiner Zustand:', margin + 2, y);
    const condItems = ['sehr gut', 'gut', 'akzeptabel', 'mit Maengeln'];
    doc.setLineWidth(0.3);
    let condX = margin + 2 + 42;
    doc.setDrawColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    condItems.forEach((label) => {
      doc.rect(condX, y - 3, 3.5, 3.5, 'S');
      doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
      doc.text(label, condX + 5, y);
      condX += 32;
    });
    y += 7;

    sectionHeader('5. Sichtbare Maengel / Schaeden bei Uebergabe');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
    doc.text('Bitte gemeinsam alle sichtbaren Schaeden, Maengel oder Beanstandungen vor Uebergabe protokollieren:', margin + 2, y);
    y += 5;
    for (let i = 0; i < 4; i++) {
      emptyLine();
    }

    doc.addPage();
    y = margin + 5;

    doc.setFillColor(LIGHT_BG.r, LIGHT_BG.g, LIGHT_BG.b);
    doc.rect(0, 0, pageW, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text('UEBERGABEPROTOKOLL', margin, 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    doc.text(`${contractNumber} . Seite 2 von 2`, pageW - margin, 9, { align: 'right' });
    y = 22;

    sectionHeader('6. Mitgegebene Dokumente');
    checkboxGrid([
      'Zulassungsbescheinigung Teil I (Fahrzeugschein)',
      'Zulassungsbescheinigung Teil II (Fahrzeugbrief)',
      'Serviceheft / Wartungsnachweise',
      'Bedienungsanleitung Wohnmobil',
      'Bedienungsanleitung Basisfahrzeug',
      'COC-Papier / EG-Uebereinstimmungsbescheinigung',
      'Letzter HU/AU-Bericht (TUEV)',
      'Gaspruefungs-Bescheinigung (G607)',
      'Sonstige: ____________________',
      'Sonstige: ____________________',
    ], 2);
    y += 1;

    sectionHeader('7. Mitgegebenes Zubehoer');
    checkboxGrid([
      'Reserveschluessel',
      'Zweitschluessel Aufbau',
      'Vorzelt / Markise',
      'Fahrradtraeger',
      'Auffahrkeile / Stuetzen',
      'Gasflaschen (gefuellt)',
      'Frischwasserschlauch',
      'Abwasserschlauch',
      'Stromkabel CEE',
      'Adapter Sat-Anlage',
      'Sonstiges: ____________________',
      'Sonstiges: ____________________',
    ], 2);
    y += 1;

    sectionHeader('8. Zahlung des Kaufpreises');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.text('Vereinbarter Kaufpreis:', margin + 2, y);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(salePrice), margin + 50, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    doc.text('Zahlungsweise:', margin + 2, y);
    const payItems = ['Ueberweisung', 'Bar', 'EC-Karte', 'Sonstiges'];
    doc.setDrawColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.setLineWidth(0.3);
    let payX = margin + 30;
    payItems.forEach((label) => {
      doc.rect(payX, y - 3, 3.5, 3.5, 'S');
      doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
      doc.text(label, payX + 5, y);
      payX += 38;
    });
    y += 6.5;
    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    blankLine('Tatsaechlich erhaltener Betrag am Uebergabetag:', 50, 'EUR');
    blankLine('Datum/Verwendungszweck Ueberweisung:', 90);
    y += 1;

    sectionHeader('9. Erklaerungen der Vertragsparteien');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    const declarationText = [
      'Mit Unterschrift bestaetigen beide Parteien:',
      '- Das Fahrzeug wurde gemeinsam in Augenschein genommen.',
      '- Alle oben aufgefuehrten Maengel und Zustandsangaben sind zutreffend protokolliert.',
      '- Die unter Punkt 6 und 7 angekreuzten Dokumente und Zubehoerteile wurden vollstaendig uebergeben.',
      '- Schluessel, Fahrzeug und alle vereinbarten Gegenstaende wurden ordnungsgemaess uebergeben bzw. uebernommen.',
      '- Der vereinbarte Kaufpreis wurde wie unter Punkt 8 angegeben gezahlt bzw. der Zahlungseingang ist sichergestellt.',
      '- Mit Uebergabe gehen Besitz, Nutzen und Lasten sowie die Gefahr des zufaelligen Untergangs auf den Kaeufer ueber.',
    ];
    declarationText.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, contentW - 4);
      doc.text(wrapped, margin + 2, y);
      y += wrapped.length * 4 + 0.5;
    });
    y += 2;

    sectionHeader('10. Unterschriften');
    y += 4;

    const sigW = (contentW - 8) / 2;
    const sigY = y + 14;

    doc.setDrawColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    doc.setLineWidth(0.4);
    doc.line(margin + 2, sigY, margin + 2 + sigW, sigY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    doc.text('Ort, Datum  .  Unterschrift Verkaeufer', margin + 2, sigY + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    // Skip rendering when name is missing — DASH (`-`) under the signature
    // label looks like a stray mark / overlapping artifact with the sig line.
    if (sellerName && sellerName !== DASH) {
      doc.text(sellerName, margin + 2, sigY + 9);
    }

    const buyerSigX = margin + 6 + sigW;
    doc.line(buyerSigX, sigY, buyerSigX + sigW, sigY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(TEXT_MED.r, TEXT_MED.g, TEXT_MED.b);
    doc.text('Ort, Datum  .  Unterschrift Kaeufer', buyerSigX, sigY + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b);
    if (buyerName && buyerName !== DASH) {
      doc.text(buyerName, buyerSigX, sigY + 9);
    }

    const footerY = pageH - 14;
    doc.setDrawColor(LINE_GREY.r, LINE_GREY.g, LINE_GREY.b);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY, pageW - margin, footerY);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(TEXT_LIGHT.r, TEXT_LIGHT.g, TEXT_LIGHT.b);
    doc.text(
      `Bereitgestellt durch ${siteName} - Vermittlungsplattform fuer Wohnmobile & Wohnwagen`,
      pageW / 2, footerY + 4, { align: 'center' },
    );
    doc.text(
      `${contactEmail}${contactPhone ? '  .  ' + contactPhone : ''}  .  Vertrag ${contractNumber}`,
      pageW / 2, footerY + 8, { align: 'center' },
    );

    const pdfBytes = doc.output('arraybuffer');
    const u8 = new Uint8Array(pdfBytes);

    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < u8.length; i += chunkSize) {
      const chunk = u8.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    const pdfBase64 = btoa(binaryString);

    const storagePath = `${sellerId}/${contractNumber}_uebergabeprotokoll.pdf`;
    let publicUrl = '';
    try {
      const { error: uploadErr } = await supabase.storage
        .from('handover-protocols')
        .upload(storagePath, u8, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: true,
        });
      if (uploadErr) {
        console.warn('Upload failed (continuing with base64 anyway):', uploadErr);
      } else {
        const { data: signed } = await supabase.storage
          .from('handover-protocols')
          .createSignedUrl(storagePath, 60 * 60 * 24 * 90);
        publicUrl = signed?.signedUrl || '';
      }
    } catch (e) {
      console.warn('Storage exception (non-fatal):', e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        contractNumber,
        pdfBase64,
        protocolUrl: publicUrl,
        storagePath,
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('generate-blank-handover-protocol error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }
});
