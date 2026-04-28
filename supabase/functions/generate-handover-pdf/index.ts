import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

function escapeHtml(unsafe: unknown): string {
  const str = String(unsafe ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const auth = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!auth.authorized) return auth.response;

  try {
    const { appointment_id } = await req.json();

    if (!appointment_id) {
      throw new Error('appointment_id is required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch appointment with all related data
    const { data: appointment, error: fetchError } = await supabaseClient
      .from('appointments')
      .select(`
        *,
        kitchens(*),
        purchase_stations(*),
        profiles!appointments_seller_id_fkey(*)
      `)
      .eq('id', appointment_id)
      .single();

    if (fetchError) throw fetchError;

    const { data: settings } = await supabaseClient
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const companyInfo = {
      siteName: settings?.site_name || 'CaravanWert',
      legalName: 'WohnWert GmbH',
      address: settings?.address || settings?.company_address || 'Hannoversche Str. 106',
      zip: settings?.zip_code || settings?.company_postal_code || '30627',
      city: settings?.city || settings?.company_city || 'Hannover',
      phone: settings?.support_phone || '0511 / 51532476',
      email: settings?.contact_email || 'info@caravanwert.de',
      managingDirector: settings?.managing_director || 'Mona Kareem-Ameen',
      hrbNumber: settings?.hrb_number || '210321',
      court: 'Amtsgericht Hildesheim',
    };

    const html = generateProtocolHTML(appointment, companyInfo);

    // Upload as a proper HTML file that can be viewed and printed in the browser
    // HTML files render correctly in the browser and can be printed to PDF via Ctrl+P
    const fileName = `handover_${appointment_id}_${Date.now()}.html`;
    
    // Convert HTML string to Uint8Array for upload
    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(html);

    const { error: uploadError } = await supabaseClient.storage
      .from('kitchen-photos')
      .upload(`protocols/${fileName}`, htmlBytes, {
        contentType: 'text/html; charset=utf-8',
        cacheControl: '3600',
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseClient.storage
      .from('kitchen-photos')
      .getPublicUrl(`protocols/${fileName}`);

    return new Response(
      JSON.stringify({
        success: true,
        protocol_url: publicUrl,
        html_preview: html,
      }),
      {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

interface CompanyInfo {
  siteName: string;
  legalName: string;
  address: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  managingDirector: string;
  hrbNumber: string;
  court: string;
}

function generateProtocolHTML(appointment: any, company: CompanyInfo): string {
  const kitchen = appointment.kitchens || {};
  const station = appointment.purchase_stations || {};
  const profile = appointment.profiles || {};

  const date = escapeHtml(new Date(appointment.appointment_date).toLocaleString('de-DE'));
  const mileage = kitchen.mileage != null
    ? escapeHtml(Number(kitchen.mileage).toLocaleString('de-DE'))
    : '—';
  
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Übergabeprotokoll – ${escapeHtml(kitchen.manufacturer)} ${escapeHtml(kitchen.model)}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none !important; }
      @page { margin: 1.5cm; }
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #fff;
    }
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #19753e;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 1000;
    }
    .print-button:hover {
      background: #145f32;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #19753e;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #19753e;
      margin-bottom: 10px;
    }
    h1 {
      color: #19753e;
      font-size: 24px;
      margin: 30px 0 20px 0;
    }
    .section {
      margin-bottom: 30px;
      padding: 20px;
      background: #f9f9f9;
      border-radius: 8px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      padding: 8px 0;
      border-bottom: 1px solid #ddd;
    }
    .label {
      font-weight: bold;
      color: #666;
    }
    .value {
      color: #333;
    }
    .signature-section {
      margin-top: 50px;
      display: flex;
      justify-content: space-between;
    }
    .signature-box {
      width: 45%;
      border-top: 2px solid #333;
      padding-top: 10px;
      text-align: center;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">Als PDF drucken / speichern</button>

  <div class="header">
    <div class="logo">CaravanWert</div>
    <h2>Übergabeprotokoll</h2>
  </div>

  <div class="section">
    <h1>Fahrzeugdaten</h1>
    <div class="info-row">
      <span class="label">Hersteller:</span>
      <span class="value">${escapeHtml(kitchen.manufacturer) || '—'}</span>
    </div>
    <div class="info-row">
      <span class="label">Modell:</span>
      <span class="value">${escapeHtml(kitchen.model) || '—'}</span>
    </div>
    <div class="info-row">
      <span class="label">Baujahr:</span>
      <span class="value">${escapeHtml(kitchen.year) || '—'}</span>
    </div>
    <div class="info-row">
      <span class="label">Kilometerstand:</span>
      <span class="value">${mileage} km</span>
    </div>
    ${kitchen.vehicle_identification_number ? `
    <div class="info-row">
      <span class="label">Fahrzeug-Identifikationsnummer:</span>
      <span class="value">${escapeHtml(kitchen.vehicle_identification_number)}</span>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h1>Übergabedetails</h1>
    <div class="info-row">
      <span class="label">Datum & Uhrzeit:</span>
      <span class="value">${date}</span>
    </div>
    <div class="info-row">
      <span class="label">Ankaufstation:</span>
      <span class="value">${escapeHtml(station.name) || '—'}</span>
    </div>
    <div class="info-row">
      <span class="label">Adresse:</span>
      <span class="value">${escapeHtml(station.address)}, ${escapeHtml(station.city)}</span>
    </div>
    ${appointment.payment_amount ? `
    <div class="info-row">
      <span class="label">Kaufpreis:</span>
      <span class="value">${escapeHtml(Number(appointment.payment_amount).toLocaleString('de-DE'))} €</span>
    </div>
    ` : ''}
    ${appointment.payment_method ? `
    <div class="info-row">
      <span class="label">Zahlungsmethode:</span>
      <span class="value">${appointment.payment_method === 'cash' ? 'Barzahlung' : 'SEPA Instant'}</span>
    </div>
    ` : ''}
  </div>

  ${profile.email ? `
  <div class="section">
    <h1>Verkäuferdaten</h1>
    <div class="info-row">
      <span class="label">Name:</span>
      <span class="value">${escapeHtml(profile.first_name)} ${escapeHtml(profile.last_name)}</span>
    </div>
    <div class="info-row">
      <span class="label">E-Mail:</span>
      <span class="value">${escapeHtml(profile.email)}</span>
    </div>
  </div>
  ` : ''}

  ${appointment.notes ? `
  <div class="section">
    <h1>Anmerkungen</h1>
    <p>${escapeHtml(appointment.notes)}</p>
  </div>
  ` : ''}

  <div class="signature-section">
    <div class="signature-box">
      <p>Unterschrift Verkäufer</p>
      <p style="margin-top: 40px;">_______________________</p>
    </div>
    <div class="signature-box">
      <p>Unterschrift Käufer/Station</p>
      <p style="margin-top: 40px;">_______________________</p>
    </div>
  </div>

  <div class="footer">
    <p>${escapeHtml(company.siteName)} – Marke/Plattform der ${escapeHtml(company.legalName)} | ${escapeHtml(company.address)}, ${escapeHtml(company.zip)} ${escapeHtml(company.city)}</p>
    <p>Tel: ${escapeHtml(company.phone)} | E-Mail: ${escapeHtml(company.email)} | GF: ${escapeHtml(company.managingDirector)}</p>
    <p>${escapeHtml(company.court)}, HRB ${escapeHtml(company.hrbNumber)} | Erstellt am: ${escapeHtml(new Date().toLocaleString('de-DE'))}</p>
  </div>
</body>
</html>
  `;
}
