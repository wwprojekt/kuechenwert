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
  type: "wertermittlung" | "wertrechner";
  name: string;
  email: string;
  phone?: string;
  manufacturer?: string;
  model?: string;
  estimatedMin?: number;
  estimatedMax?: number;
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

    const sourceLabel =
      type === "wertermittlung" ? "Wertermittlung" : "Wertrechner";

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
                "Geschätzter Wert",
                `${estimatedMin.toLocaleString("de-DE")} - ${estimatedMax.toLocaleString("de-DE")} €`
              )
            : ""
        }
      `,
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
    }

    // 2. Send confirmation to user
    const userSubject =
      type === "wertermittlung"
        ? "Ihre Anfrage zur Wertermittlung"
        : "Ihre Anfrage über den Wertrechner";

    const userContent = `
      ${paragraph(`Hallo ${name},`)}
      ${paragraph(
        `Vielen Dank für Ihre Anfrage über unseren ${sourceLabel}. Wir haben Ihre Daten erhalten und werden uns in Kürze bei Ihnen melden.`
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
