/**
 * Edge Function: send-purchase-inquiry-notification
 *
 * Sends two emails when a customer submits a purchase inquiry at an Ankaufstation:
 * 1. Notification to the station dealer (with all vehicle data)
 * 2. Confirmation to the customer (that they will be contacted)
 *
 * Also sends a copy to the admin (info@caravanwert.de).
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  buildEmailLayout,
  infoBox,
  detailRow,
  paragraph,
  button,
  divider,
} from "../_shared/email-builder.ts";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
} from "../_shared/cors.ts";
import { checkRateLimit, createRateLimitErrorResponse } from '../_shared/rate-limiter.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "info@caravanwert.de";

interface PurchaseInquiryRequest {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  vehicleType: string;
  manufacturer?: string;
  model?: string;
  year?: string;
  mileage?: string;
  bodyType?: string;
  condition?: string;
  priceExpectation?: string;
  description?: string;
  stationName: string;
  stationCity: string;
  stationEmail: string;
  stationPhone: string;
  stationManagerName?: string | null;
}

// Rate limit: max 5 purchase inquiry notifications per IP per 15 minutes
const INQUIRY_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    // ─── Rate Limiting ───────────────────────────────────────────────
    const rateLimitResult = await checkRateLimit(req, INQUIRY_RATE_LIMIT);
    if (!rateLimitResult.allowed) {
      return createRateLimitErrorResponse(rateLimitResult, corsHeaders);
    }

    const data: PurchaseInquiryRequest = await req.json();
    const {
      customerName,
      customerEmail,
      customerPhone,
      vehicleType,
      manufacturer,
      model,
      year,
      mileage,
      bodyType,
      condition,
      priceExpectation,
      description,
      stationName,
      stationCity,
      stationEmail,
      stationPhone,
      stationManagerName,
    } = data;

    // ─── Input Validation ────────────────────────────────────────────
    if (!customerName || typeof customerName !== "string" || customerName.trim().length < 2 || customerName.length > 200) {
      return new Response(
        JSON.stringify({ error: "Ungültiger Name." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerEmail || typeof customerEmail !== "string" || !emailRegex.test(customerEmail) || customerEmail.length > 320) {
      return new Response(
        JSON.stringify({ error: "Ungültige E-Mail-Adresse." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!stationEmail || typeof stationEmail !== "string" || !emailRegex.test(stationEmail)) {
      return new Response(
        JSON.stringify({ error: "Ungültige Stations-E-Mail." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!vehicleType || typeof vehicleType !== "string" || vehicleType.trim().length < 1) {
      return new Response(
        JSON.stringify({ error: "Fahrzeugtyp ist erforderlich." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `Processing purchase inquiry from ${customerEmail} for station ${stationName}`
    );

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

    // ── Build vehicle details block ──────────────────────────────
    const vehicleDetails = [
      vehicleType ? detailRow("Fahrzeugtyp", vehicleType) : "",
      manufacturer ? detailRow("Hersteller", manufacturer) : "",
      model ? detailRow("Modell", model) : "",
      year ? detailRow("Baujahr", year) : "",
      mileage
        ? detailRow(
            "Kilometerstand",
            `${parseInt(mileage).toLocaleString("de-DE")} km`
          )
        : "",
      bodyType ? detailRow("Aufbauart", bodyType) : "",
      condition ? detailRow("Zustand", condition) : "",
    ]
      .filter(Boolean)
      .join("");

    const priceFormatted = priceExpectation
      ? `${parseInt(priceExpectation).toLocaleString("de-DE")} €`
      : "Keine Angabe";

    // ── 1. Email to dealer (station) ─────────────────────────────
    const dealerSubject = `Neue Ankauf-Anfrage von ${customerName} – ${vehicleType}${manufacturer ? ` ${manufacturer}` : ""}${model ? ` ${model}` : ""}`;

    const dealerContent = `
      ${paragraph(`Hallo${stationManagerName ? ` ${stationManagerName}` : ""},`)}
      ${paragraph(`Über Ihre Ankaufstation <strong>${stationName}</strong> in ${stationCity} ist eine neue Ankauf-Anfrage eingegangen.`)}
      ${infoBox(
        "Kontaktdaten des Kunden",
        `
        ${detailRow("Name", customerName)}
        ${detailRow("E-Mail", customerEmail)}
        ${customerPhone ? detailRow("Telefon", customerPhone) : ""}
      `,
        "info",
        settingsData
      )}
      ${infoBox(
        "Fahrzeugdaten",
        `
        ${vehicleDetails}
      `,
        "default",
        settingsData
      )}
      ${infoBox(
        "Preisvorstellung",
        `
        ${detailRow("Preisvorstellung des Kunden", priceFormatted)}
      `,
        "warning",
        settingsData
      )}
      ${
        description
          ? infoBox(
              "Zusätzliche Informationen",
              paragraph(description),
              "default",
              settingsData
            )
          : ""
      }
      ${paragraph("Bitte kontaktieren Sie den Kunden zeitnah, um ein Angebot zu unterbreiten.")}
      ${button("Zum Admin-Dashboard", "https://caravanwert.de/admin", settingsData)}
      ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${settingsData.site_name} System`)}
    `;

    const dealerHtml = buildEmailLayout(
      settingsData,
      dealerSubject,
      dealerContent
    );

    // Send to dealer station email
    const dealerEmailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <info@caravanwert.de>`,
        to: [stationEmail],
        cc: [ADMIN_EMAIL],
        subject: dealerSubject,
        html: dealerHtml,
      }),
    });

    if (!dealerEmailResponse.ok) {
      const error = await dealerEmailResponse.text();
      console.error("Dealer email failed:", error);
    } else {
      console.log("Dealer notification sent to:", stationEmail);
      const dealerResult = await dealerEmailResponse.json();
      // Log in admin_emails
      try {
        await supabase.from("admin_emails").insert({
          sender_email: "info@caravanwert.de",
          sender_name: settingsData.site_name,
          recipient_email: stationEmail,
          recipient_name: stationManagerName || stationName,
          subject: dealerSubject,
          body_html: dealerHtml,
          body_text: "",
          email_type: "purchase_inquiry_dealer",
          direction: "outbound",
          status: "sent",
          resend_id: dealerResult?.id || null,
          is_read: true,
        });
      } catch (logErr) {
        console.error("Failed to log dealer email:", logErr);
      }
    }

    // ── 2. Confirmation email to customer ────────────────────────
    const customerSubject = `Ihre Ankauf-Anfrage bei ${stationName}`;

    const customerContent = `
      ${paragraph(`Hallo ${customerName},`)}
      ${paragraph(`Vielen Dank für Ihre Ankauf-Anfrage bei <strong>${stationName}</strong> in ${stationCity}. Wir haben Ihre Fahrzeugdaten erhalten und leiten sie direkt an den Händler weiter.`)}
      ${infoBox(
        "Zusammenfassung Ihrer Anfrage",
        `
        ${vehicleDetails}
        ${detailRow("Preisvorstellung", priceFormatted)}
      `,
        "success",
        settingsData
      )}
      ${infoBox(
        "Wie geht es weiter?",
        `
        ${paragraph("Der Händler wird sich in der Regel innerhalb von 24 Stunden bei Ihnen melden, um Ihre Anfrage zu besprechen und Ihnen ein konkretes Angebot zu unterbreiten.")}
        ${paragraph(`<strong>Ankaufstation:</strong> ${stationName}<br><strong>Adresse:</strong> ${stationCity}<br><strong>Telefon:</strong> ${stationPhone}`)}
      `,
        "info",
        settingsData
      )}
      ${paragraph("Falls Sie Fragen haben, können Sie sich jederzeit direkt an die Ankaufstation wenden.")}
      ${button("Zur Website", "https://caravanwert.de", settingsData)}
      ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${settingsData.site_name} Team`)}
    `;

    const customerHtml = buildEmailLayout(
      settingsData,
      customerSubject,
      customerContent
    );

    const customerEmailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <info@caravanwert.de>`,
        to: [customerEmail],
        subject: customerSubject,
        html: customerHtml,
      }),
    });

    if (!customerEmailResponse.ok) {
      const error = await customerEmailResponse.text();
      console.error("Customer email failed:", error);
    } else {
      console.log("Customer confirmation sent to:", customerEmail);
      const customerResult = await customerEmailResponse.json();
      // Log in admin_emails
      try {
        await supabase.from("admin_emails").insert({
          sender_email: "info@caravanwert.de",
          sender_name: settingsData.site_name,
          recipient_email: customerEmail,
          recipient_name: customerName,
          subject: customerSubject,
          body_html: customerHtml,
          body_text: "",
          email_type: "purchase_inquiry_customer",
          direction: "outbound",
          status: "sent",
          resend_id: customerResult?.id || null,
          is_read: true,
        });
      } catch (logErr) {
        console.error("Failed to log customer email:", logErr);
      }
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
    console.error("Error sending purchase inquiry notification:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
};

serve(handler);
