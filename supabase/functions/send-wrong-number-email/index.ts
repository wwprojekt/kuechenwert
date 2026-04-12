/**
 * Edge Function: send-wrong-number-email
 *
 * Sends a professional email to a lead whose phone number was incorrect,
 * informing them we have buyers for their vehicle and asking them to
 * provide a correct phone number.
 *
 * Expects JSON body:
 * - lead_id: UUID of the lead entry
 * - lead_type: "wizard" | "quick" | "valuation"
 * - estimated_value: (optional) override value if not stored in DB
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
import { checkServiceRoleOrAdmin } from "../_shared/auth.ts";

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

// Map lead_type to table name
function getTableName(leadType: string): string {
  switch (leadType) {
    case "wizard": return "wizard_sessions";
    case "quick": return "quick_leads";
    case "valuation": return "value_assessment_leads";
    default: throw new Error(`Unbekannter Lead-Typ: ${leadType}`);
  }
}

// Extract lead info depending on type
function extractLeadInfo(lead: any, leadType: string) {
  if (leadType === "wizard") {
    const formData = lead.form_data || {};
    return {
      name: lead.customer_name || null,
      email: lead.customer_email || null,
      phone: lead.customer_phone || null,
      manufacturer: formData.manufacturer || formData.brand || null,
      model: formData.model || null,
      year: formData.year || formData.baujahr || null,
      bodyType: formData.body_type || formData.aufbauart || null,
      mileage: formData.mileage || formData.kilometerstand || null,
      condition: formData.condition || formData.zustand || null,
      estimatedValue: lead.admin_estimated_value || null,
      vehicleSummary: lead.vehicle_summary || null,
    };
  } else if (leadType === "quick") {
    const formData = lead.form_data_snapshot || {};
    return {
      name: lead.name || null,
      email: lead.email || null,
      phone: lead.phone || null,
      manufacturer: lead.manufacturer || null,
      model: lead.model || null,
      year: formData.year || formData.baujahr || null,
      bodyType: lead.body_type || null,
      mileage: formData.mileage || formData.kilometerstand || null,
      condition: formData.condition || null,
      estimatedValue: lead.admin_estimated_value || null,
      vehicleSummary: null,
    };
  } else {
    // valuation
    return {
      name: lead.name || null,
      email: lead.email || null,
      phone: lead.phone || null,
      manufacturer: lead.manufacturer || null,
      model: lead.model || null,
      year: lead.year || null,
      bodyType: lead.body_type || null,
      mileage: lead.mileage || null,
      condition: lead.condition || null,
      estimatedValue: lead.admin_estimated_value || lead.ai_estimated_value || null,
      vehicleSummary: null,
    };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  const authCheck = await checkServiceRoleOrAdmin(req, getCorsHeaders(req));
  if (!authCheck.authorized) return authCheck.response;

  const corsHeaders = getCorsHeaders(req);

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const body = await req.json();
    const { lead_id, lead_type, estimated_value: overrideValue } = body;

    if (!lead_id || !lead_type) {
      return new Response(
        JSON.stringify({ error: "lead_id und lead_type sind erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tableName = getTableName(lead_type);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the lead
    const { data: lead, error: leadError } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const info = extractLeadInfo(lead, lead_type);
    const recipientEmail = info.email;

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "Keine E-Mail-Adresse vorhanden" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Anti-Spam: Max 3 emails per lead, ever
    const currentCount = lead.wrong_number_email_count || 0;
    if (currentCount >= 3) {
      return new Response(
        JSON.stringify({ error: `Bereits ${currentCount}x gesendet. Maximale Anzahl erreicht.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Anti-Spam: Cooldown 7 days between sends to same lead
    const lastSent = lead.wrong_number_email_last_sent;
    if (lastSent) {
      const daysSinceLast = (Date.now() - new Date(lastSent).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLast < 7) {
        const nextAllowed = new Date(new Date(lastSent).getTime() + 7 * 24 * 60 * 60 * 1000);
        return new Response(
          JSON.stringify({
            error: `Letzte E-Mail vor ${Math.round(daysSinceLast)} Tag(en) gesendet. Nächster Versand möglich ab ${nextAllowed.toLocaleDateString("de-DE")}.`,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Use override value, or DB value
    const estimatedValue = overrideValue || info.estimatedValue;
    if (!estimatedValue) {
      return new Response(
        JSON.stringify({ error: "Kein Expertenwert vorhanden. Bitte zuerst einen Wert eingeben." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If override value provided and lead doesn't have one, save it
    if (overrideValue && !info.estimatedValue) {
      await supabase
        .from(tableName)
        .update({ admin_estimated_value: overrideValue })
        .eq("id", lead_id);
    }

    // Fetch site settings
    const { data: settings } = await supabase
      .from("site_settings")
      .select("*")
      .single();

    const settingsData = settings || {
      site_name: "CaravanWert",
      site_description: "Deutschlands f\u00fchrende Wohnmobil-Handelsplattform",
      contact_email: "info@caravanwert.de",
      support_phone: "+49 511 51532476",
    };

    // Build vehicle description
    const vehicleParts = [info.manufacturer, info.model].filter(Boolean);
    const vehicleName = vehicleParts.length > 0
      ? vehicleParts.join(" ")
      : (info.vehicleSummary || "Ihr Fahrzeug");
    const vehicleWithYear = info.year
      ? `${vehicleName} (${info.year})`
      : vehicleName;

    // Determine vehicle type
    const isCaravan = info.bodyType && ["wohnwagen", "caravan"].some(t =>
      (info.bodyType || "").toLowerCase().includes(t)
    );
    const vehicleTypeLabel = isCaravan ? "Wohnwagen" : "Wohnmobil";

    // Format the expert value
    const expertValueFormatted = Number(estimatedValue).toLocaleString("de-DE");

    // Build the email subject
    const subject = `Wir haben K\u00e4ufer f\u00fcr Ihr ${vehicleWithYear} \u2013 bitte melden Sie sich!`;

    // Build vehicle details section
    const vehicleDetails = [
      info.manufacturer ? detailRow("Hersteller", info.manufacturer) : "",
      info.model ? detailRow("Modell", info.model) : "",
      info.year ? detailRow("Baujahr", String(info.year)) : "",
      info.bodyType ? detailRow("Aufbauart", info.bodyType) : "",
      info.mileage ? detailRow("Kilometerstand", `${Number(info.mileage).toLocaleString("de-DE")} km`) : "",
      info.condition ? detailRow("Zustand", info.condition) : "",
    ].filter(Boolean).join("");

    const customerName = info.name || undefined;

    // Build email content
    const emailContent = `
      ${greeting(customerName)}

      ${paragraph(`Wir haben versucht, Sie telefonisch zu erreichen, um Ihnen eine gro&szlig;artige Nachricht zu &uuml;bermitteln &ndash; leider war die hinterlegte Rufnummer <strong>nicht erreichbar</strong>.`)}

      ${infoBox("Wichtige Information", `
        <p style="margin: 0; font-size: 14px; color: #92400e;">
          Die von Ihnen angegebene Telefonnummer scheint nicht korrekt zu sein. Bitte kontaktieren Sie uns mit Ihrer aktuellen Nummer, damit wir Ihnen unser Angebot unterbreiten k&ouml;nnen.
        </p>
      `, "warning", settingsData)}

      ${paragraph(`Die gute Nachricht: Wir haben <strong>konkrete Kaufinteressenten</strong> f&uuml;r Ihr ${vehicleTypeLabel} <strong>${vehicleWithYear}</strong>! Unsere gepr&uuml;ften H&auml;ndler suchen genau nach einem Fahrzeug wie Ihrem.`)}

      ${amountDisplay("Gesch\u00e4tzter Marktwert Ihres Fahrzeugs", `${expertValueFormatted} \u20ac`)}

      ${vehicleDetails ? infoBox("Ihre Fahrzeugdaten", vehicleDetails, "info", settingsData) : ""}

      ${divider()}

      ${paragraph(`<strong>So geht es weiter:</strong> Melden Sie sich einfach bei uns mit Ihrer korrekten Telefonnummer &ndash; per E-Mail oder &uuml;ber unser Kontaktformular. Wir k&uuml;mmern uns um alles Weitere und finden den besten K&auml;ufer f&uuml;r Ihr ${vehicleTypeLabel}.`)}

      ${infoBox("Ihre Vorteile bei CaravanWert", `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #374151;">
              <strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Kostenlose Fahrzeugbewertung durch Experten
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #374151;">
              <strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Gepr&uuml;fte H&auml;ndler bieten auf Ihr Fahrzeug
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #374151;">
              <strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Kein Risiko &ndash; Sie entscheiden &uuml;ber den Verkauf
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #374151;">
              <strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Schnelle Abwicklung &ndash; oft innerhalb weniger Tage
            </td>
          </tr>
        </table>
      `, "success", settingsData)}

      ${button("Jetzt korrekte Nummer mitteilen", "https://caravanwert.de/kontakt", settingsData)}

      ${paragraph(`Oder rufen Sie uns direkt an unter <strong>${settingsData.support_phone}</strong> &ndash; wir freuen uns auf Ihren Anruf!`)}

      ${paragraph(`Sie k&ouml;nnen uns auch per E-Mail erreichen: <a href="mailto:info@caravanwert.de" style="color: #1f8aa2; font-weight: 600;">info@caravanwert.de</a>`)}
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
      recipient_name: info.name || null,
      subject,
      body_html: emailContent,
      body_text: emailContent.replace(/<[^>]*>/g, ""),
      email_type: "wrong_number_followup",
      direction: "outbound",
      status: "sent",
      resend_id: resendResult.id,
      is_read: true,
    });

    // Increment wrong_number_email_count and set last_sent timestamp
    await supabase
      .from(tableName)
      .update({
        wrong_number_email_count: currentCount + 1,
        wrong_number_email_last_sent: new Date().toISOString(),
      })
      .eq("id", lead_id);

    console.log(`Wrong number email sent to ${recipientEmail} for ${lead_type} lead ${lead_id} (count: ${currentCount + 1})`);

    return new Response(
      JSON.stringify({
        success: true,
        resend_id: resendResult.id,
        recipient: recipientEmail,
        email_count: currentCount + 1,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending wrong number email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unerwarteter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
