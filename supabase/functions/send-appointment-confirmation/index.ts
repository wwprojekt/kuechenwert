import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, infoBox, detailRow, list, paragraph } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AppointmentEmailRequest {
  email: string;
  name: string;
  appointmentDate: string;
  stationName: string;
  stationAddress: string;
  kitchenModel: string;
  appointmentId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  // ─── Auth check: must be service_role (cron/internal) or authenticated admin ───
  const authResult = await checkServiceRoleOrAdmin(req, getCorsHeaders(req));
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const { email, name, appointmentDate, stationName, stationAddress, kitchenModel, appointmentId }: AppointmentEmailRequest = await req.json();

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
      contact_email: 'info@caravanwert.de',
      support_phone: '0511 / 51532476',
    };

    // Build email content
    const content = `
      ${paragraph(`Hallo ${name},`)}
      ${paragraph('Ihr Termin für die Wohnmobil-Übergabe wurde erfolgreich gebucht. Wir freuen uns auf Ihren Besuch!')}
      
      ${infoBox('Termindetails', `
        ${detailRow('Fahrzeug', kitchenModel)}
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

    // Log in admin_emails for System tab
    try {
      await supabase.from('admin_emails').insert({
        sender_email: 'info@caravanwert.de',
        sender_name: settingsData.site_name,
        recipient_email: email,
        recipient_name: name || null,
        subject: 'Terminbestätigung - Wohnmobil-Übergabe',
        body_html: html,
        body_text: '',
        email_type: 'appointment_confirmation',
        direction: 'outbound',
        status: 'sent',
        resend_id: result?.id || null,
        is_read: true,
      });
    } catch (logErr) {
      console.error('Failed to log email in admin_emails:', logErr);
    }

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
