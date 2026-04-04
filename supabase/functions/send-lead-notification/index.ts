import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  buildEmailLayout,
  infoBox,
  detailRow,
  paragraph,
  button,
} from "../_shared/email-builder.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkRateLimit, createRateLimitErrorResponse } from '../_shared/rate-limiter.ts';
import { verifyTurnstileToken, getClientIp } from '../_shared/turnstile.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Rate limit: max 5 lead notifications per IP per 15 minutes
const LEAD_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
};

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
  // Transaction ID für Deduplizierung über alle Tracking-Schichten
  transactionId?: string;
  skipUserEmail?: boolean;
  // Bot-Schutz
  turnstileToken?: string;
  honeypot?: string;
}

const VALID_TYPES = ["wertermittlung", "wertrechner", "wizard", "kontakt", "dealer"];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    // ─── Rate Limiting ───────────────────────────────────────────────
    const rateLimitResult = await checkRateLimit(req, LEAD_RATE_LIMIT);
    if (!rateLimitResult.allowed) {
      return createRateLimitErrorResponse(rateLimitResult, corsHeaders);
    }

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

    // ─── Bot-Schutz: Honeypot ───────────────────────────────────────
    if (data.honeypot && data.honeypot.length > 0) {
      console.warn('Honeypot triggered – bot detected:', email);
      // Fake-Erfolg zurückgeben damit der Bot denkt es hat funktioniert
      return new Response(
        JSON.stringify({ success: true, message: "Notifications sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ─── Bot-Schutz: Cloudflare Turnstile ────────────────────────────
    const clientIp = getClientIp(req);
    const turnstileResult = await verifyTurnstileToken(data.turnstileToken, clientIp);
    if (!turnstileResult.valid) {
      console.warn('Turnstile verification failed:', turnstileResult.error, '– IP:', clientIp);
      return new Response(
        JSON.stringify({ error: "Bot-Schutz-Verifizierung fehlgeschlagen. Bitte laden Sie die Seite neu." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Input Validation ────────────────────────────────────────────
    if (!type || !VALID_TYPES.includes(type)) {
      return new Response(
        JSON.stringify({ error: "Ungültiger Anfragetyp." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.length > 200) {
      return new Response(
        JSON.stringify({ error: "Ungültiger Name." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !emailRegex.test(email) || email.length > 320) {
      return new Response(
        JSON.stringify({ error: "Ungültige E-Mail-Adresse." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      dealer: "Händler-Bewerbung",
    };
    const sourceLabel = sourceLabels[type] || type;

    // Admin-Email-Benachrichtigung entfernt:
    // Der Admin sieht alle Leadanfragen direkt im Dashboard unter "Leads & Anfragen".
    // Eine zusätzliche Email-Benachrichtigung ist nicht nötig.

    // Send confirmation to user
    if (!data.skipUserEmail) {
      const userSubjects: Record<string, string> = {
      wertermittlung: "Ihre Anfrage zur Wertermittlung",
      wertrechner: "Ihre Anfrage über den Wertrechner",
      wizard: "Ihre Verkaufsanfrage bei CaravanWert",
      kontakt: "Ihre Kontaktanfrage bei CaravanWert",
      dealer: "Ihre Händler-Bewerbung bei CaravanWert",
    };
    const userSubject = userSubjects[type] || "Ihre Anfrage bei CaravanWert";

    const userContent = `
      ${paragraph(`Hallo ${name},`)}
      ${paragraph(
        type === "dealer"
          ? `Vielen Dank für Ihre Händler-Bewerbung bei ${settingsData.site_name}. Wir prüfen Ihre Unterlagen und melden uns in Kürze bei Ihnen.`
          : type === "kontakt"
          ? `Vielen Dank für Ihre Nachricht. Wir haben Ihre Anfrage erhalten und werden uns schnellstmöglich bei Ihnen melden.`
          : type === "wizard"
          ? `Vielen Dank für Ihre Verkaufsanfrage. Wir haben Ihre Fahrzeugdaten erhalten und werden uns innerhalb von 24 Stunden bei Ihnen melden.`
          : `Vielen Dank für Ihre Anfrage über unseren ${sourceLabel}. Wir haben Ihre Daten erhalten und werden uns in Kürze bei Ihnen melden.`
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
        // Transaction ID für Deduplizierung
        transaction_id: data.transactionId || undefined,
        // Land des Nutzers für internationale Telefon-Normalisierung
        country_code: (data as any).country || (data as any).country_code || undefined,
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
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending lead notification:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
