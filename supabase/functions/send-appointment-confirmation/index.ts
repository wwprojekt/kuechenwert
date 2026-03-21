import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { buildEmailLayout, infoBox, detailRow, list, paragraph } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AppointmentEmailRequest {
  email: string;
  name: string;
  appointmentDate: string;
  stationName: string;
  stationAddress: string;
  motorhomeModel: string;
  appointmentId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  // Auth check: must be service_role (internal) or any authenticated user
  const authHeader = req.headers.get('authorization') ?? '';
  const isServiceRole = authHeader.includes(SUPABASE_SERVICE_ROLE_KEY);

  if (!isServiceRole) {
    // Use service role client to validate user token
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }
    // Any authenticated user can trigger their own appointment confirmation
  }

  try {
    const { email, name, appointmentDate, stationName, stationAddress, motorhomeModel, appointmentId }: AppointmentEmailRequest = await req.json();

    console.log("Sending appointment confirmation to:", email);

    // Fetch site settings
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .single();

    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'kontakt@caravanwert.de',
      support_phone: '0800 123 456 78',
    };

    // Build email content
    const content = `
      ${paragraph(`Hallo ${name},`)}
      ${paragraph('Ihr Termin für die Wohnmobil-Übergabe wurde erfolgreich gebucht. Wir freuen uns auf Ihren Besuch!')}
      
      ${infoBox('Termindetails', `
        ${detailRow('Fahrzeug', motorhomeModel)}
        ${detailRow('Datum & Uhrzeit', appointmentDate)}
        ${detailRow('Ankaufstation', stationName)}
        ${detailRow('Adresse', stationAddress)}
        ${detailRow('Termin-ID', appointmentId)}
      `, 'info', settingsData)}
      
      ${infoBox('Bitte mitbringen', `
        ${list([
          'Fahrzeugschein (Zulassungsbescheinigung Teil I)',
          'Fahrzeugbrief (Zulassungsbescheinigung Teil II)',
          'Personalausweis oder Reisepass',
          'Alle Fahrzeugschlüssel',
          'Serviceheft (falls vorhanden)',
          'HU/AU-Nachweise',
          'Rechnungen für Umbauten/Zubehör (falls vorhanden)'
        ])}
      `, 'default', settingsData)}
      
      ${paragraph('Bei Fragen oder falls Sie den Termin verschieben müssen, kontaktieren Sie uns bitte rechtzeitig.')}
    `;

    const html = buildEmailLayout(settingsData, 'Terminbestätigung', content);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <info@caravanwert.de>`,
        to: [email],
        subject: 'Terminbestätigung - Wohnmobil-Übergabe',
        html,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const result = await emailResponse.json();
    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  } catch (error: any) {
    console.error("Error sending appointment confirmation:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
};

serve(handler);
