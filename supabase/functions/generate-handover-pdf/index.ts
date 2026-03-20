import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
        motorhomes(*),
        purchase_stations(*),
        profiles!appointments_seller_id_fkey(*)
      `)
      .eq('id', appointment_id)
      .single();

    if (fetchError) throw fetchError;

    // Generate HTML for PDF
    const html = generateProtocolHTML(appointment);

    // Generate PDF using jsPDF (simple HTML-based approach)
    // For production, consider using a proper PDF generation service
    const pdfData = {
      appointment_id,
      generated_at: new Date().toISOString(),
      html_content: html,
    };

    // Upload to storage
    const fileName = `handover_${appointment_id}_${Date.now()}.json`;
    
    const { error: uploadError } = await supabaseClient.storage
      .from('motorhome-photos')
      .upload(`protocols/${fileName}`, JSON.stringify(pdfData, null, 2), {
        contentType: 'application/json',
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseClient.storage
      .from('motorhome-photos')
      .getPublicUrl(`protocols/${fileName}`);

    return new Response(
      JSON.stringify({
        success: true,
        protocol_url: publicUrl,
        html_preview: html,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

function generateProtocolHTML(appointment: any): string {
  const date = new Date(appointment.appointment_date).toLocaleString('de-DE');
  
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Übergabeprotokoll</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
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
  <div class="header">
    <div class="logo">CaravanWert</div>
    <h2>Übergabeprotokoll</h2>
  </div>

  <div class="section">
    <h1>Fahrzeugdaten</h1>
    <div class="info-row">
      <span class="label">Hersteller:</span>
      <span class="value">${appointment.motorhomes.manufacturer}</span>
    </div>
    <div class="info-row">
      <span class="label">Modell:</span>
      <span class="value">${appointment.motorhomes.model}</span>
    </div>
    <div class="info-row">
      <span class="label">Baujahr:</span>
      <span class="value">${appointment.motorhomes.year}</span>
    </div>
    <div class="info-row">
      <span class="label">Kilometerstand:</span>
      <span class="value">${appointment.motorhomes.mileage.toLocaleString('de-DE')} km</span>
    </div>
    ${appointment.motorhomes.vehicle_identification_number ? `
    <div class="info-row">
      <span class="label">Fahrzeug-Identifikationsnummer:</span>
      <span class="value">${appointment.motorhomes.vehicle_identification_number}</span>
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
      <span class="value">${appointment.purchase_stations.name}</span>
    </div>
    <div class="info-row">
      <span class="label">Adresse:</span>
      <span class="value">${appointment.purchase_stations.address}, ${appointment.purchase_stations.city}</span>
    </div>
    ${appointment.payment_amount ? `
    <div class="info-row">
      <span class="label">Kaufpreis:</span>
      <span class="value">${appointment.payment_amount.toLocaleString('de-DE')} €</span>
    </div>
    ` : ''}
    ${appointment.payment_method ? `
    <div class="info-row">
      <span class="label">Zahlungsmethode:</span>
      <span class="value">${appointment.payment_method === 'cash' ? 'Barzahlung' : 'SEPA Instant'}</span>
    </div>
    ` : ''}
  </div>

  ${appointment.profiles ? `
  <div class="section">
    <h1>Verkäuferdaten</h1>
    <div class="info-row">
      <span class="label">Name:</span>
      <span class="value">${appointment.profiles.first_name || ''} ${appointment.profiles.last_name || ''}</span>
    </div>
    <div class="info-row">
      <span class="label">E-Mail:</span>
      <span class="value">${appointment.profiles.email}</span>
    </div>
  </div>
  ` : ''}

  ${appointment.notes ? `
  <div class="section">
    <h1>Anmerkungen</h1>
    <p>${appointment.notes}</p>
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
    <p>CaravanWert GmbH | Musterstraße 123, 80331 München</p>
    <p>Tel: +49 800 123 4567 | E-Mail: info@caravanwert.de</p>
    <p>Erstellt am: ${new Date().toLocaleString('de-DE')}</p>
  </div>
</body>
</html>
  `;
}
