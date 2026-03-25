import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { buildEmailLayout, infoBox, detailRow, paragraph, list, customerBadge } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface PaymentEmailRequest {
  email: string;
  name: string;
  motorhomeModel: string;
  amount: string;
  paymentMethod: "cash" | "sepa_instant";
  handoverProtocolUrl?: string;
  appointmentId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  try {
    const { email, name, motorhomeModel, amount, paymentMethod, handoverProtocolUrl, appointmentId }: PaymentEmailRequest = await req.json();

    console.log("Sending payment confirmation to:", email);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch customer number
    const { data: profile } = await supabase
      .from('profiles')
      .select('customer_number')
      .eq('email', email)
      .maybeSingle();
    const custNum = profile?.customer_number || '';

    // Fetch site settings
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

    const paymentMethodText = paymentMethod === "cash" ? "Barzahlung" : "SEPA Instant";

    // Build email content
    const content = `
      ${paragraph(`Hallo ${name},`)}
      ${customerBadge(custNum)}
      ${paragraph('Vielen Dank für Ihr Vertrauen! Die Übergabe Ihres Wohnmobils wurde erfolgreich abgeschlossen.')}
      
      ${infoBox('Zahlungsdetails', `
        ${detailRow('Fahrzeug', motorhomeModel)}
        ${detailRow('Betrag', amount)}
        ${detailRow('Zahlungsmethode', paymentMethodText)}
        ${detailRow('Termin-ID', appointmentId)}
      `, 'success', settingsData)}
      
      ${handoverProtocolUrl ? infoBox('Übergabeprotokoll', `
        ${paragraph('Ihr Übergabeprotokoll wurde erstellt und ist als PDF verfügbar:')}
        ${paragraph(`<a href="${handoverProtocolUrl}" style="color: #195d3e; text-decoration: underline; font-weight: bold;">Übergabeprotokoll herunterladen (PDF)</a>`)}
      `, 'info', settingsData) : ''}
      
      ${infoBox('Was passiert jetzt?', `
        ${list([
          'Ihre Zahlung wurde verarbeitet',
          'Das Übergabeprotokoll wurde dokumentiert',
          'Sie erhalten eine Kopie aller Dokumente',
          'Die Eigentumsübertragung wird eingeleitet'
        ])}
      `, 'default', settingsData)}
      
      ${paragraph('Wir bedanken uns für die angenehme Zusammenarbeit und wünschen Ihnen alles Gute!')}
      ${paragraph('Bei Fragen zu Ihrer Transaktion stehen wir Ihnen jederzeit gerne zur Verfügung.')}
    `;

    const html = buildEmailLayout(settingsData, 'Zahlungsbestätigung', content);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <info@caravanwert.de>`,
        to: [email],
        subject: 'Zahlungsbestätigung - Wohnmobil-Verkauf',
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
        subject: 'Zahlungsbestätigung - Wohnmobil-Verkauf',
        body_html: html,
        body_text: '',
        email_type: 'payment_confirmation',
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
    console.error("Error sending payment confirmation:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
};

serve(handler);
