/**
 * Edge Function: send-disposition-email
 *
 * Sends a professional follow-up email to leads based on their disposition status.
 * Supports: no_answer, considering, done
 *
 * Expects JSON body:
 * - lead_id: UUID of the lead entry
 * - lead_type: "wizard" | "quick" | "valuation"
 * - disposition_type: "no_answer" | "considering" | "done"
 * - estimated_value: (optional) override value if not stored in DB
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  buildEmailLayout,
  paragraph,
  greeting,
  button,
  infoBox,
  detailRow,
  amountDisplay,
  divider,
  list,
} from "../_shared/email-builder.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const VALID_DISPOSITIONS = ["no_answer", "considering", "done"] as const;
type DispositionType = typeof VALID_DISPOSITIONS[number];

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

// Build vehicle description
function buildVehicleDescription(info: ReturnType<typeof extractLeadInfo>) {
  const vehicleParts = [info.manufacturer, info.model].filter(Boolean);
  const vehicleName = vehicleParts.length > 0
    ? vehicleParts.join(" ")
    : (info.vehicleSummary || "Ihr Fahrzeug");
  const vehicleWithYear = info.year
    ? `${vehicleName} (${info.year})`
    : vehicleName;

  const isCaravan = info.bodyType && ["wohnwagen", "caravan"].some(t =>
    (info.bodyType || "").toLowerCase().includes(t)
  );
  const vehicleTypeLabel = isCaravan ? "Wohnwagen" : "Wohnmobil";

  return { vehicleName, vehicleWithYear, vehicleTypeLabel };
}

// Build vehicle details section
function buildVehicleDetails(info: ReturnType<typeof extractLeadInfo>) {
  return [
    info.manufacturer ? detailRow("Hersteller", info.manufacturer) : "",
    info.model ? detailRow("Modell", info.model) : "",
    info.year ? detailRow("Baujahr", String(info.year)) : "",
    info.bodyType ? detailRow("Aufbauart", info.bodyType) : "",
    info.mileage ? detailRow("Kilometerstand", `${Number(info.mileage).toLocaleString("de-DE")} km`) : "",
    info.condition ? detailRow("Zustand", info.condition) : "",
  ].filter(Boolean).join("");
}

// ============================================================================
// Email Templates per Disposition
// ============================================================================

function buildNoAnswerEmail(
  info: ReturnType<typeof extractLeadInfo>,
  vehicle: ReturnType<typeof buildVehicleDescription>,
  vehicleDetails: string,
  estimatedValue: number | null,
  settings: any,
) {
  const customerName = info.name || undefined;
  const expertValueFormatted = estimatedValue
    ? Number(estimatedValue).toLocaleString("de-DE")
    : null;

  const subject = `Wir konnten Sie leider nicht erreichen – Ihr ${vehicle.vehicleWithYear}`;

  const content = `
    ${greeting(customerName)}

    ${paragraph(`Wir haben mehrfach versucht, Sie telefonisch zu erreichen, um Ihnen ein attraktives Angebot f&uuml;r Ihr ${vehicle.vehicleTypeLabel} zu unterbreiten &ndash; leider konnten wir Sie nicht erreichen.`)}

    ${infoBox("Warum rufen wir an?", `
      <p style="margin: 0; font-size: 14px; color: #155e75;">
        Unsere gepr&uuml;ften H&auml;ndler haben <strong>konkretes Kaufinteresse</strong> an Ihrem ${vehicle.vehicleTypeLabel} <strong>${vehicle.vehicleWithYear}</strong>. Wir m&ouml;chten Ihnen gerne ein unverbindliches Angebot unterbreiten.
      </p>
    `, "info", settings)}

    ${estimatedValue && expertValueFormatted ? amountDisplay("Gesch\u00e4tzter Marktwert Ihres Fahrzeugs", `${expertValueFormatted} \u20ac`) : ""}

    ${vehicleDetails ? infoBox("Ihre Fahrzeugdaten", vehicleDetails, "info", settings) : ""}

    ${divider()}

    ${paragraph(`<strong>So erreichen Sie uns:</strong> Rufen Sie uns einfach zur&uuml;ck oder schreiben Sie uns eine kurze E-Mail &ndash; wir melden uns umgehend bei Ihnen.`)}

    ${infoBox("Ihre Vorteile bei CaravanWert", `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;"><strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Kostenlose Fahrzeugbewertung durch Experten</td></tr>
        <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;"><strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Gepr&uuml;fte H&auml;ndler bieten auf Ihr Fahrzeug</td></tr>
        <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;"><strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Kein Risiko &ndash; Sie entscheiden &uuml;ber den Verkauf</td></tr>
        <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;"><strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Schnelle und unkomplizierte Abwicklung</td></tr>
      </table>
    `, "success", settings)}

    ${button("Jetzt R\u00fcckruf vereinbaren", "https://caravanwert.de/kontakt", settings)}

    ${paragraph(`Oder rufen Sie uns direkt an unter <strong>${settings.support_phone}</strong> &ndash; wir freuen uns auf Ihren Anruf!`)}

    ${paragraph(`Sie k&ouml;nnen uns auch per E-Mail erreichen: <a href="mailto:info@caravanwert.de" style="color: #1f8aa2; font-weight: 600;">info@caravanwert.de</a>`)}
  `;

  return { subject, content };
}

function buildConsideringEmail(
  info: ReturnType<typeof extractLeadInfo>,
  vehicle: ReturnType<typeof buildVehicleDescription>,
  vehicleDetails: string,
  estimatedValue: number | null,
  settings: any,
) {
  const customerName = info.name || undefined;
  const expertValueFormatted = estimatedValue
    ? Number(estimatedValue).toLocaleString("de-DE")
    : null;

  const subject = `Ihr ${vehicle.vehicleWithYear} ist weiterhin gefragt – lassen Sie sich diese Chance nicht entgehen!`;

  const content = `
    ${greeting(customerName)}

    ${paragraph(`Wir m&ouml;chten uns kurz bei Ihnen melden, da Sie sich noch &uuml;berlegen, ob Sie Ihr ${vehicle.vehicleTypeLabel} <strong>${vehicle.vehicleWithYear}</strong> &uuml;ber CaravanWert verkaufen m&ouml;chten.`)}

    ${infoBox("Aktuelle Marktsituation", `
      <p style="margin: 0; font-size: 14px; color: #065f46;">
        <strong>Gute Nachricht:</strong> Die Nachfrage nach ${vehicle.vehicleTypeLabel}en wie Ihrem ist aktuell sehr hoch. Unsere H&auml;ndler suchen aktiv nach genau solchen Fahrzeugen &ndash; jetzt ist ein idealer Zeitpunkt f&uuml;r den Verkauf!
      </p>
    `, "success", settings)}

    ${estimatedValue && expertValueFormatted ? amountDisplay("Gesch\u00e4tzter Marktwert Ihres Fahrzeugs", `${expertValueFormatted} \u20ac`) : ""}

    ${vehicleDetails ? infoBox("Ihre Fahrzeugdaten", vehicleDetails, "info", settings) : ""}

    ${divider()}

    ${paragraph(`<strong>Warum jetzt verkaufen?</strong>`)}

    ${infoBox("Ihre Vorteile", `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;"><strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Hohe aktuelle Nachfrage = bessere Preise</td></tr>
        <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;"><strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Mehrere H&auml;ndler bieten gleichzeitig &ndash; Wettbewerb treibt den Preis</td></tr>
        <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;"><strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Kein Risiko: Sie sind zu nichts verpflichtet</td></tr>
        <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;"><strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Komplette Abwicklung durch CaravanWert</td></tr>
      </table>
    `, "success", settings)}

    ${paragraph(`Haben Sie noch Fragen oder m&ouml;chten Sie den n&auml;chsten Schritt gehen? Wir beraten Sie gerne &ndash; unverbindlich und kostenlos.`)}

    ${button("Jetzt Verkauf starten", "https://caravanwert.de/kontakt", settings)}

    ${paragraph(`Oder rufen Sie uns direkt an unter <strong>${settings.support_phone}</strong> &ndash; wir freuen uns auf Ihren Anruf!`)}
  `;

  return { subject, content };
}

function buildDoneEmail(
  info: ReturnType<typeof extractLeadInfo>,
  vehicle: ReturnType<typeof buildVehicleDescription>,
  vehicleDetails: string,
  estimatedValue: number | null,
  settings: any,
) {
  const customerName = info.name || undefined;

  const subject = `Vielen Dank f\u00fcr Ihr Vertrauen – Ihr ${vehicle.vehicleWithYear}`;

  const content = `
    ${greeting(customerName)}

    ${paragraph(`Vielen Dank, dass Sie CaravanWert f&uuml;r den Verkauf Ihres ${vehicle.vehicleTypeLabel}s <strong>${vehicle.vehicleWithYear}</strong> in Betracht gezogen haben.`)}

    ${infoBox("Zusammenfassung", `
      <p style="margin: 0; font-size: 14px; color: #155e75;">
        Ihre Anfrage wurde erfolgreich bearbeitet. Sollten Sie in Zukunft ein weiteres Fahrzeug verkaufen wollen, stehen wir Ihnen jederzeit gerne zur Verf&uuml;gung.
      </p>
    `, "info", settings)}

    ${vehicleDetails ? infoBox("Ihre Fahrzeugdaten", vehicleDetails, "info", settings) : ""}

    ${divider()}

    ${paragraph(`<strong>Wussten Sie schon?</strong> Bei CaravanWert k&ouml;nnen Sie nicht nur verkaufen, sondern auch Ihr n&auml;chstes Traumfahrzeug finden. Schauen Sie sich unsere aktuellen Angebote an!`)}

    ${infoBox("CaravanWert f\u00fcr die Zukunft", `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;"><strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Jederzeit kostenlose Fahrzeugbewertung</td></tr>
        <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;"><strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Gro&szlig;es Netzwerk gepr&uuml;fter H&auml;ndler</td></tr>
        <tr><td style="padding: 6px 0; font-size: 14px; color: #374151;"><strong style="color: #1f8aa2;">&#10003;</strong>&nbsp; Empfehlen Sie uns weiter &ndash; auch Ihre Freunde profitieren</td></tr>
      </table>
    `, "success", settings)}

    ${button("CaravanWert besuchen", "https://caravanwert.de", settings)}

    ${paragraph(`Wir w&uuml;rden uns freuen, wenn Sie uns weiterempfehlen. Bei Fragen erreichen Sie uns jederzeit unter <strong>${settings.support_phone}</strong> oder per E-Mail an <a href="mailto:info@caravanwert.de" style="color: #1f8aa2; font-weight: 600;">info@caravanwert.de</a>.`)}
  `;

  return { subject, content };
}

// ============================================================================
// Main Handler
// ============================================================================

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const body = await req.json();
    const { lead_id, lead_type, disposition_type, estimated_value: overrideValue } = body;

    if (!lead_id || !lead_type || !disposition_type) {
      return new Response(
        JSON.stringify({ error: "lead_id, lead_type und disposition_type sind erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!VALID_DISPOSITIONS.includes(disposition_type)) {
      return new Response(
        JSON.stringify({ error: `Ung\u00fcltiger disposition_type: ${disposition_type}. Erlaubt: ${VALID_DISPOSITIONS.join(", ")}` }),
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

    // Anti-Spam: Check if we already sent a disposition email recently (via admin_emails log)
    const emailType = `${disposition_type}_followup`;
    const { data: recentEmails } = await supabase
      .from("admin_emails")
      .select("id, created_at")
      .eq("recipient_email", recipientEmail)
      .eq("email_type", emailType)
      .order("created_at", { ascending: false })
      .limit(1);

    const lastSentEmail = recentEmails?.[0];
    if (lastSentEmail) {
      const daysSinceLast = (Date.now() - new Date(lastSentEmail.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLast < 7) {
        const nextAllowed = new Date(new Date(lastSentEmail.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
        return new Response(
          JSON.stringify({
            error: `Letzte E-Mail vor ${Math.round(daysSinceLast)} Tag(en) gesendet. N\u00e4chster Versand m\u00f6glich ab ${nextAllowed.toLocaleDateString("de-DE")}.`,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Count total disposition emails sent to this lead
    const { count: totalSent } = await supabase
      .from("admin_emails")
      .select("id", { count: "exact", head: true })
      .eq("recipient_email", recipientEmail)
      .eq("email_type", emailType);

    if ((totalSent || 0) >= 3) {
      return new Response(
        JSON.stringify({ error: `Bereits ${totalSent}x gesendet. Maximale Anzahl (3) erreicht.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use override value, or DB value (not required for "done" emails)
    const estimatedValue = overrideValue || info.estimatedValue;

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
      contact_email: "kontakt@caravanwert.de",
      support_phone: "+49 511 51532476",
    };

    // Build vehicle info
    const vehicle = buildVehicleDescription(info);
    const vehicleDetails = buildVehicleDetails(info);

    // Build email based on disposition type
    let emailData: { subject: string; content: string };
    switch (disposition_type as DispositionType) {
      case "no_answer":
        emailData = buildNoAnswerEmail(info, vehicle, vehicleDetails, estimatedValue, settingsData);
        break;
      case "considering":
        emailData = buildConsideringEmail(info, vehicle, vehicleDetails, estimatedValue, settingsData);
        break;
      case "done":
        emailData = buildDoneEmail(info, vehicle, vehicleDetails, estimatedValue, settingsData);
        break;
      default:
        throw new Error(`Unbekannter disposition_type: ${disposition_type}`);
    }

    const html = buildEmailLayout(settingsData, emailData.subject, emailData.content);

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
        subject: emailData.subject,
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
      subject: emailData.subject,
      body_html: emailData.content,
      body_text: emailData.content.replace(/<[^>]*>/g, ""),
      email_type: emailType,
      direction: "outbound",
      status: "sent",
      resend_id: resendResult.id,
      is_read: true,
    });

    const newCount = (totalSent || 0) + 1;

    console.log(`Disposition email (${disposition_type}) sent to ${recipientEmail} for ${lead_type} lead ${lead_id} (count: ${newCount})`);

    return new Response(
      JSON.stringify({
        success: true,
        resend_id: resendResult.id,
        recipient: recipientEmail,
        email_count: newCount,
        disposition_type,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending disposition email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unerwarteter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
