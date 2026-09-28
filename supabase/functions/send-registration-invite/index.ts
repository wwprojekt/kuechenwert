import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { buildEmailLayout, greeting, paragraph, button, infoBox, list } from "../_shared/email-builder.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { edgeLogger } from "../_shared/edgeLogger.ts";
import { checkServiceRoleOrAdmin } from "../_shared/auth.ts";
import { BRAND } from "../_shared/brand-config.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Einladung für Konten, die ein Admin angelegt hat. Die Mail enthält einen
 * Magic Link, der die E-Mail bestätigt, anmeldet und zum Dashboard führt
 * (dort wird bei Bedarf ein Passwort festgelegt).
 *
 * Body: {
 *   email: string            – Empfänger (Pflicht)
 *   customerName?: string    – Name für die Anrede
 *   inviteType?: "dealer" | "customer" (Standard "customer"; "seller" gilt als "customer")
 *   companyName?: string     – Firmenname bei Studio-Einladungen
 *   hasPassword?: boolean    – Passwort bereits gesetzt → direkt zum Dashboard
 * }
 */
interface InviteRequest {
  email: string;
  customerName?: string;
  inviteType?: "dealer" | "customer" | "seller";
  companyName?: string;
  hasPassword?: boolean;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);
  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  // Nur Admins bzw. service_role dürfen Einladungen verschicken.
  const authResult = await checkServiceRoleOrAdmin(req, headers);
  if (!authResult.authorized) return authResult.response;

  try {
    const body: InviteRequest = await req.json();
    if (!body.email || !body.email.trim()) {
      return new Response(JSON.stringify({ error: "E-Mail-Adresse ist erforderlich" }), { status: 400, headers });
    }

    const email = body.email.trim().toLowerCase();
    const customerName = escapeHtml(body.customerName?.trim() || "");
    const companyName = escapeHtml(body.companyName?.trim() || "");
    const isDealer = body.inviteType === "dealer";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: settings } = await supabase.from("site_settings").select("*").single();
    const settingsData = settings || {
      site_name: BRAND.name,
      site_description: "Das Vergleichsportal für neue Küchen",
      contact_email: BRAND.supportEmail,
      support_phone: "+49 511 51532476",
    };

    const redirectUrl = body.hasPassword ? `${BRAND.baseUrl}/dashboard` : `${BRAND.baseUrl}/dashboard?setup=password`;
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: redirectUrl },
    });
    if (linkError) {
      edgeLogger.error("Failed to generate magic link:", linkError.message);
      return new Response(JSON.stringify({ error: `Anmeldelink konnte nicht erstellt werden: ${linkError.message}` }), { status: 500, headers });
    }
    const registrationLink = linkData?.properties?.action_link;
    if (!registrationLink) {
      return new Response(JSON.stringify({ error: "Anmeldelink konnte nicht erstellt werden" }), { status: 500, headers });
    }

    const passwordHint = body.hasPassword
      ? "Dieser Link ist einmalig und führt Sie direkt in Ihr Konto. Danach melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an."
      : "Dieser Link ist einmalig und führt Sie direkt in Ihr Konto. Bei der ersten Anmeldung legen Sie ein persönliches Passwort fest.";
    const contactLine =
      `Bei Fragen erreichen Sie uns unter <strong>${escapeHtml(settingsData.support_phone || "")}</strong> ` +
      `oder per E-Mail an <a href="mailto:${settingsData.contact_email}">${settingsData.contact_email}</a>.`;

    let content = greeting(customerName || undefined);
    let subject: string;

    if (isDealer) {
      content += paragraph(
        `willkommen bei <strong>${settingsData.site_name}</strong>! Ihr Studio-Konto${companyName ? ` für <strong>${companyName}</strong>` : ""} ist eingerichtet.`,
      );
      content += paragraph("Aktivieren Sie jetzt Ihr Konto und hinterlegen Sie Ihr Einzugsgebiet – danach sehen Sie Küchenprojekte aus Ihrer Region:");
      content += button("Studio-Konto aktivieren", registrationLink, settingsData);
      content += infoBox(
        "So funktioniert KüchenWert für Studios",
        list([
          "<strong>Projekt-Börse</strong> – Küchenprojekte aus Ihrem Einzugsgebiet, zunächst ohne Kontaktdaten",
          "<strong>Angebote abgeben</strong> – kostenlos, mit Preis, Lieferzeit und Leistungsumfang",
          "<strong>Kontakt freischalten</strong> – optional und kostenpflichtig, Preis vor dem Kauf sichtbar",
          `<strong>Provision nur bei Zuschlag</strong> – Preise und Konditionen unter <a href="${BRAND.baseUrl}/preise">${BRAND.domain}/preise</a>`,
        ]),
        "info",
        settingsData,
      );
      subject = `${body.companyName?.trim() || "Ihr Studio-Konto"} – Willkommen bei ${settingsData.site_name}`;
    } else {
      content += paragraph(`für Sie wurde ein Konto bei <strong>${settingsData.site_name}</strong> angelegt. Aktivieren Sie es mit einem Klick:`);
      content += button("Konto aktivieren", registrationLink, settingsData);
      subject = `Ihr Konto bei ${settingsData.site_name} aktivieren`;
    }
    content += paragraph(`<strong>Wichtig:</strong> ${passwordHint}`);
    content += paragraph(contactLine);

    const emailHtml = buildEmailLayout(settingsData, subject, content);
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${settingsData.site_name} <${BRAND.noReplyEmail}>`,
        to: [email],
        subject,
        html: emailHtml,
        reply_to: settingsData.contact_email || BRAND.supportEmail,
      }),
    });
    if (!resendRes.ok) {
      const errorText = await resendRes.text();
      edgeLogger.error("Resend error:", errorText);
      return new Response(JSON.stringify({ error: "E-Mail konnte nicht gesendet werden" }), { status: 502, headers });
    }
    const resendResult = await resendRes.json();

    const { data: recipientProfile } = await supabase.from("profiles").select("id, first_name, last_name").eq("email", email).maybeSingle();
    await supabase.from("admin_emails").insert({
      sender_email: BRAND.noReplyEmail,
      sender_name: settingsData.site_name,
      recipient_email: email,
      recipient_name: body.customerName?.trim() || [recipientProfile?.first_name, recipientProfile?.last_name].filter(Boolean).join(" ") || null,
      recipient_id: recipientProfile?.id || null,
      subject,
      // Ohne Anmeldelink protokollieren: er ist ein Zugangsschlüssel.
      body_html: content.replace(registrationLink, "[Anmeldelink entfernt]"),
      body_text: "",
      email_type: isDealer ? "dealer_registration_invite" : "registration_invite",
      direction: "outbound",
      status: "sent",
      resend_id: resendResult.id,
      is_read: true,
    });

    return new Response(JSON.stringify({ success: true, message: `Einladung an ${email} gesendet`, resend_id: resendResult.id }), {
      status: 200,
      headers,
    });
  } catch (error: unknown) {
    edgeLogger.error("Error in send-registration-invite:", error);
    return new Response(JSON.stringify({ error: "Interner Fehler. Bitte später erneut versuchen." }), { status: 500, headers });
  }
};

serve(handler);
