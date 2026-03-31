/**
 * Edge Function: send-expert-valuation
 *
 * Sends a professional email to the customer with the corrected expert valuation
 * of their motorhome/caravan, including CTA buttons to proceed with the auction.
 *
 * Expects JSON body:
 * - lead_id: UUID of the value_assessment_leads entry
 * - recipient_email: (optional override) defaults to lead's email
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  buildEmailLayout,
  paragraph,
  greeting,
  button,
  infoBox,
  detailRow,
  amountDisplay,
  divider,
} from "../_shared/email-builder.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Inline CORS
const ALLOWED_ORIGINS = [
  "https://caravanwert.de",
  "https://www.caravanwert.de",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const body = await req.json();
    const { lead_id, recipient_email: overrideEmail } = body;

    if (!lead_id) {
      return new Response(
        JSON.stringify({ error: "lead_id ist erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the lead
    const { data: lead, error: leadError } = await supabase
      .from("value_assessment_leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipientEmail = overrideEmail || lead.email;
    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "Keine E-Mail-Adresse vorhanden" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lead.admin_estimated_value) {
      return new Response(
        JSON.stringify({ error: "Kein Expertenwert eingetragen. Bitte zuerst bewerten." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch site settings
    const { data: settings } = await supabase
      .from("site_settings")
      .select("*")
      .single();

    const settingsData = settings || {
      site_name: "CaravanWert",
      site_description: "Deutschlands f\u00fchrende Wohnmobil-Handelsplattform",
      contact_email: "kontakt@caravanwert.de",
      support_phone: "+49 511 51532476",
    };

    // Build vehicle description
    const vehicleParts = [lead.manufacturer, lead.model].filter(Boolean);
    const vehicleName = vehicleParts.length > 0
      ? vehicleParts.join(" ")
      : "Ihr Fahrzeug";
    const vehicleWithYear = lead.year
      ? `${vehicleName} (${lead.year})`
      : vehicleName;

    // Determine vehicle type for CTA text
    // Primary: use vehicle_type column (new leads). Fallback: body_type substring matching (legacy leads)
    const isCaravan = lead.vehicle_type === "Wohnwagen" || (
      !lead.vehicle_type && lead.body_type && ["wohnwagen", "caravan", "faltcaravan", "mobilheim"].some(t =>
        (lead.body_type || "").toLowerCase().includes(t)
      )
    );
    const vehicleTypeLabel = isCaravan ? "Wohnwagen" : "Wohnmobil";

    // Format the expert value
    const expertValueFormatted = lead.admin_estimated_value.toLocaleString("de-DE");

    // Build the email subject
    const subject = `Ihre fundierte Fahrzeugbewertung: ${vehicleWithYear}`;

    // Build vehicle details section
    const vehicleDetails = [
      lead.manufacturer ? detailRow("Hersteller", lead.manufacturer) : "",
      lead.model ? detailRow("Modell", lead.model) : "",
      lead.year ? detailRow("Baujahr", String(lead.year)) : "",
      lead.body_type ? detailRow("Aufbauart", lead.body_type) : "",
      // Kilometerstand nur bei Wohnmobilen anzeigen (Wohnwagen haben keinen eigenen Tacho)
      (!isCaravan && lead.mileage) ? detailRow("Kilometerstand", `${lead.mileage.toLocaleString("de-DE")} km`) : "",
      lead.condition ? detailRow("Zustand", lead.condition) : "",
    ].filter(Boolean).join("");

    // Build email content
    const customerName = lead.name || undefined;

    const emailContent = `
      ${greeting(customerName)}

      ${paragraph(`Vielen Dank f&uuml;r Ihr Interesse an einer professionellen Bewertung Ihres Fahrzeugs <strong>${vehicleWithYear}</strong>. Unser Experten-Team hat Ihr ${vehicleTypeLabel} sorgf&auml;ltig analysiert und bewertet.`)}

      ${amountDisplay("Fundierte Expertenbewertung", `${expertValueFormatted} &euro;`)}

      ${paragraph(`Dieser Wert basiert auf einer <strong>fundierten Marktanalyse</strong> unserer erfahrenen Fahrzeugexperten unter Ber&uuml;cksichtigung von Marke, Modell, Baujahr, Zustand${isCaravan ? '' : ', Kilometerstand'} und aktueller Marktlage.`)}

      ${vehicleDetails ? infoBox("Ihre Fahrzeugdaten", vehicleDetails, "info", settingsData) : ""}

      ${divider()}

      ${paragraph(`<strong>M&ouml;chten Sie Ihr ${vehicleTypeLabel} jetzt verkaufen?</strong> Geben Sie Ihr Fahrzeug f&uuml;r unsere H&auml;ndler-Auktion frei und erzielen Sie den besten Preis &ndash; schnell, sicher und ohne Aufwand.`)}

      ${infoBox("So funktioniert es", `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #374151;">
              <strong style="color: #1f8aa2;">1.</strong>&nbsp; Fahrzeug zur Auktion freigeben
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #374151;">
              <strong style="color: #1f8aa2;">2.</strong>&nbsp; Gepr&uuml;fte H&auml;ndler bieten auf Ihr ${vehicleTypeLabel}
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #374151;">
              <strong style="color: #1f8aa2;">3.</strong>&nbsp; Sie entscheiden &uuml;ber den Verkauf &ndash; kein Risiko
            </td>
          </tr>
        </table>
      `, "success", settingsData)}

      ${button(`Jetzt ${vehicleTypeLabel} zur Auktion freigeben`, "https://caravanwert.de/verkaufen", settingsData)}

      ${paragraph(`Sie haben Fragen? Rufen Sie uns gerne an unter <strong>${settingsData.support_phone}</strong> oder schreiben Sie uns an <a href="mailto:info@caravanwert.de" style="color: #1f8aa2; font-weight: 600;">info@caravanwert.de</a>.`)}
    `;

    const html = buildEmailLayout(settingsData, subject, emailContent);

    // Send via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <info@caravanwert.de>`,
        to: [recipientEmail],
        subject,
        html,
        reply_to: "info@caravanwert.de",
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const resendResult = await emailResponse.json();

    // Log in admin_emails
    await supabase.from("admin_emails").insert({
      sender_email: "info@caravanwert.de",
      sender_name: settingsData.site_name,
      recipient_email: recipientEmail,
      recipient_name: lead.name || null,
      subject,
      body_html: emailContent,
      body_text: emailContent.replace(/<[^>]*>/g, ""),
      email_type: "expert_valuation",
      direction: "outbound",
      status: "sent",
      resend_id: resendResult.id,
      is_read: true,
    });

    // Update lead status to "contacted"
    await supabase
      .from("value_assessment_leads")
      .update({
        contacted_at: new Date().toISOString(),
        status: "expert_valuation_sent",
      } as any)
      .eq("id", lead_id);

    console.log(`Expert valuation email sent to ${recipientEmail} for lead ${lead_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        resend_id: resendResult.id,
        recipient: recipientEmail,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending expert valuation email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unerwarteter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
