import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import {
  buildEmailLayout,
  infoBox,
  detailRow,
  paragraph,
  button,
} from "../_shared/email-builder.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "admin@caravanwert.de";

interface LeadNotificationRequest {
  type: "wertermittlung" | "wertrechner" | "wizard" | "kontakt" | "dealer";
  name: string;
  email: string;
  phone?: string;
  manufacturer?: string;
  model?: string;
  estimatedMin?: number;
  estimatedMax?: number;
  // Extra fields for contact form
  subject?: string;
  messageText?: string;
  // Extra fields for dealer registration
  companyName?: string;
  // Google Ads Click-IDs für serverseitige Conversion-Attribution
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  ga4ClientId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  try {
    const data: LeadNotificationRequest = await req.json();
    const {
      type,
      name,
      email,
      phone,
      manufacturer,
      model,
      estimatedMin,
      estimatedMax,
    } = data;

    console.log(`Processing ${type} lead notification for:`, email);

    // Fetch site settings
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: settings } = await supabase
      .from("site_settings")
      .select("*")
      .single();

    const settingsData = settings || {
      site_name: "CaravanWert",
      site_description: "Deutschlands führende Wohnmobil-Handelsplattform",
      contact_email: "kontakt@caravanwert.de",
      support_phone: "0800 123 456 78",
    };

    const sourceLabels: Record<string, string> = {
      wertermittlung: "Wertermittlung",
      wertrechner: "Wertrechner",
      wizard: "Verkaufen-Wizard",
      kontakt: "Kontaktformular",
      dealer: "H\u00e4ndler-Bewerbung",
    };
    const sourceLabel = sourceLabels[type] || type;

    // 1. Send notification to admin
    const adminSubject = `Neue Anfrage: ${sourceLabel} von ${name}`;
    const adminContent = `
      ${paragraph(`Eine neue ${sourceLabel}-Anfrage ist eingegangen.`)}
      ${infoBox(
        "Kontaktdaten",
        `
        ${detailRow("Name", name)}
        ${detailRow("E-Mail", email)}
        ${phone ? detailRow("Telefon", phone) : ""}
      `,
        "info",
        settingsData
      )}
      ${
        manufacturer || model
          ? infoBox(
              "Fahrzeugdaten",
              `
        ${manufacturer ? detailRow("Hersteller", manufacturer) : ""}
        ${model ? detailRow("Modell", model) : ""}
        ${
          estimatedMin && estimatedMax
            ? detailRow(
                "Gesch\u00e4tzter Wert",
                `${estimatedMin.toLocaleString("de-DE")} - ${estimatedMax.toLocaleString("de-DE")} \u20ac`
              )
            : ""
        }
      `,
              "default",
              settingsData
            )
          : ""
      }
      ${
        data.subject || data.messageText
          ? infoBox(
              "Nachricht",
              `
        ${data.subject ? detailRow("Betreff", data.subject) : ""}
        ${data.messageText ? paragraph(data.messageText) : ""}
      `,
              "default",
              settingsData
            )
          : ""
      }
      ${
        data.companyName
          ? infoBox(
              "Firmendetails",
              `${detailRow("Firma", data.companyName)}`,
              "default",
              settingsData
            )
          : ""
      }
      ${paragraph(
        `<a href="mailto:${email}">Jetzt antworten</a> | <a href="https://caravanwert.de/admin/leads">Alle Anfragen</a>`
      )}
    `;

    const adminHtml = buildEmailLayout(
      settingsData,
      adminSubject,
      adminContent
    );

    // Send admin email
    const adminEmailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <info@caravanwert.de>`,
        to: [ADMIN_EMAIL],
        subject: adminSubject,
        html: adminHtml,
      }),
    });

    if (!adminEmailResponse.ok) {
      const error = await adminEmailResponse.text();
      console.error("Admin email failed:", error);
    } else {
      console.log("Admin notification sent successfully");
      const adminResult = await adminEmailResponse.json();
      // Log admin notification in admin_emails
      try {
        await supabase.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: settingsData.site_name,
          recipient_email: ADMIN_EMAIL,
          recipient_name: 'Admin',
          subject: adminSubject,
          body_html: adminHtml,
          body_text: '',
          email_type: `lead_admin_${type}`,
          direction: 'outbound',
          status: 'sent',
          resend_id: adminResult?.id || null,
          is_read: true,
        });
      } catch (logErr) {
        console.error('Failed to log admin email in admin_emails:', logErr);
      }
    }

    // 2. Send confirmation to user
    const userSubjects: Record<string, string> = {
      wertermittlung: "Ihre Anfrage zur Wertermittlung",
      wertrechner: "Ihre Anfrage \u00fcber den Wertrechner",
      wizard: "Ihre Verkaufsanfrage bei CaravanWert",
      kontakt: "Ihre Kontaktanfrage bei CaravanWert",
      dealer: "Ihre H\u00e4ndler-Bewerbung bei CaravanWert",
    };
    const userSubject = userSubjects[type] || "Ihre Anfrage bei CaravanWert";

    const userContent = `
      ${paragraph(`Hallo ${name},`)}
      ${paragraph(
        type === "dealer"
          ? `Vielen Dank f\u00fcr Ihre H\u00e4ndler-Bewerbung bei ${settingsData.site_name}. Wir pr\u00fcfen Ihre Unterlagen und melden uns in K\u00fcrze bei Ihnen.`
          : type === "kontakt"
          ? `Vielen Dank f\u00fcr Ihre Nachricht. Wir haben Ihre Anfrage erhalten und werden uns schnellstm\u00f6glich bei Ihnen melden.`
          : type === "wizard"
          ? `Vielen Dank f\u00fcr Ihre Verkaufsanfrage. Wir haben Ihre Fahrzeugdaten erhalten und werden uns innerhalb von 24 Stunden bei Ihnen melden.`
          : `Vielen Dank f\u00fcr Ihre Anfrage \u00fcber unseren ${sourceLabel}. Wir haben Ihre Daten erhalten und werden uns in K\u00fcrze bei Ihnen melden.`
      )}
      ${infoBox(
        "Ihre Anfrage",
        `
        ${paragraph(
          `Sie haben uns über unseren ${sourceLabel} kontaktiert. Unser Team wird Ihre Anfrage prüfen und sich innerhalb von 24 Stunden bei Ihnen melden.`
        )}
        ${
          estimatedMin && estimatedMax
            ? paragraph(
                `<strong>Vorläufige Schätzung:</strong> ${estimatedMin.toLocaleString("de-DE")} - ${estimatedMax.toLocaleString("de-DE")} €`
              )
            : ""
        }
      `,
        "success",
        settingsData
      )}
      ${paragraph(
        "Falls Sie Fragen haben, können Sie uns jederzeit kontaktieren."
      )}
      ${button("Zur Website", "https://caravanwert.de", settingsData)}
      ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${settingsData.site_name} Team`)}
    `;

    const userHtml = buildEmailLayout(settingsData, userSubject, userContent);

    // Send user confirmation email
    const userEmailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <info@caravanwert.de>`,
        to: [email],
        subject: userSubject,
        html: userHtml,
      }),
    });

    if (!userEmailResponse.ok) {
      const error = await userEmailResponse.text();
      console.error("User email failed:", error);
    } else {
      console.log("User confirmation sent successfully");
      const userResult = await userEmailResponse.json();
      // Log user confirmation in admin_emails
      try {
        await supabase.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: settingsData.site_name,
          recipient_email: email,
          recipient_name: name || null,
          subject: userSubject,
          body_html: userHtml,
          body_text: '',
          email_type: `lead_user_${type}`,
          direction: 'outbound',
          status: 'sent',
          resend_id: userResult?.id || null,
          is_read: true,
        });
      } catch (logErr) {
        console.error('Failed to log user email in admin_emails:', logErr);
      }
    }

    // ─── Server-Side Conversion Tracking (non-blocking) ───────────
    try {
      const conversionPayload = {
        event_name: "generate_lead",
        lead_type: type,
        name,
        email,
        phone,
        manufacturer,
        model,
        estimated_min: estimatedMin,
        estimated_max: estimatedMax,
        // Google Ads Click-IDs für direkte Attribution
        gclid: data.gclid || undefined,
        gbraid: data.gbraid || undefined,
        wbraid: data.wbraid || undefined,
        client_id: data.ga4ClientId || undefined,
      };

      // Call track-conversion Edge Function via Supabase
      const trackingUrl = `${SUPABASE_URL}/functions/v1/track-conversion`;
      fetch(trackingUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(conversionPayload),
      }).then(res => {
        console.log(`[track-conversion] Triggered: ${res.status}`);
      }).catch(err => {
        console.error("[track-conversion] Failed to trigger:", err);
      });
    } catch (trackErr) {
      console.error("[track-conversion] Error preparing tracking:", trackErr);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notifications sent" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending lead notification:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
};

serve(handler);
