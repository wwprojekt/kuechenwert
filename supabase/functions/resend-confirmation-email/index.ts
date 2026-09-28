/**
 * resend-confirmation-email — Admin sendet einem Konto mit unbestätigter
 * E-Mail-Adresse einen neuen Bestätigungslink (KüchenWert-Layout über Resend).
 *
 * Der Link ist ein Magic Link: Beim Öffnen bestätigt Supabase die Adresse und
 * meldet das Konto an. Ins Mail-Protokoll kommt er nicht, weil er wie ein
 * Passwort wirkt.
 *
 * Body: { email?: string; user_id?: string; dealer_application_id?: string }
 * Auth: Admin oder service_role
 */
import { checkServiceRoleOrAdmin } from "../_shared/auth.ts";
import { BRAND } from "../_shared/brand-config.ts";
import { buildEmailLayout, button, greeting, paragraph } from "../_shared/email-builder.ts";
import { HttpError, isEmail, jsonResponse, readJson, serve, serviceClient } from "../_shared/kw-http.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = { email?: unknown; user_id?: unknown; dealer_application_id?: unknown };

serve(async (req) => {
  const auth = await checkServiceRoleOrAdmin(req, {});
  if (!auth.authorized) {
    throw new HttpError(auth.response.status === 403 ? 403 : 401, "Nur für Admins.", "unauthorized");
  }

  const body = await readJson<Body>(req);
  const sb = serviceClient();

  let userId = typeof body.user_id === "string" && UUID_RE.test(body.user_id) ? body.user_id : null;
  if (!userId) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!isEmail(email)) throw new HttpError(422, "Bitte eine gültige E-Mail-Adresse oder Nutzer-ID angeben.", "target");
    const { data: profile, error } = await sb.from("profiles").select("id").eq("email", email).maybeSingle();
    if (error) throw error;
    if (!profile) throw new HttpError(404, "Zu dieser E-Mail-Adresse gibt es kein Konto.", "not_found");
    userId = profile.id as string;
  }

  const { data: target, error: lookupError } = await sb.auth.admin.getUserById(userId);
  if (lookupError || !target?.user?.email) throw new HttpError(404, "Konto nicht gefunden.", "not_found");
  const user = target.user;
  const email = user.email!;
  if (user.email_confirmed_at) {
    throw new HttpError(409, "Diese E-Mail-Adresse ist bereits bestätigt.", "already_confirmed");
  }

  const { data: link, error: linkError } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${BRAND.baseUrl}/login` },
  });
  const actionLink = link?.properties?.action_link;
  if (linkError || !actionLink) {
    console.error("[resend-confirmation-email] generateLink failed", linkError?.message);
    throw new HttpError(502, "Der Bestätigungslink konnte nicht erzeugt werden.", "link_failed");
  }

  if (!RESEND_API_KEY) throw new HttpError(503, "E-Mail-Versand ist nicht konfiguriert.", "mail_unconfigured");

  const { data: settings } = await sb
    .from("site_settings")
    .select("site_name, site_description, contact_email, support_phone")
    .limit(1)
    .maybeSingle();
  const layoutSettings = {
    site_name: settings?.site_name || BRAND.name,
    site_description: settings?.site_description || BRAND.tagline,
    contact_email: settings?.contact_email || BRAND.supportEmail,
    support_phone: settings?.support_phone || "",
  };
  const firstName = typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name : undefined;
  const subject = `Bitte bestätigen Sie Ihre E-Mail-Adresse – ${layoutSettings.site_name}`;
  const content = (url: string) =>
    greeting(firstName) +
    paragraph(`bitte bestätigen Sie Ihre E-Mail-Adresse für Ihr ${layoutSettings.site_name}-Konto. Mit dem Klick auf den Button wird die Adresse bestätigt und Sie werden angemeldet.`) +
    button("E-Mail-Adresse bestätigen", url) +
    paragraph("Der Link ist aus Sicherheitsgründen nur begrenzt gültig. Falls Sie kein Konto bei uns angelegt haben, können Sie diese E-Mail ignorieren.");

  const html = buildEmailLayout(layoutSettings, "E-Mail-Adresse bestätigen", content(actionLink));
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${layoutSettings.site_name} <${BRAND.noReplyEmail}>`,
      to: [email],
      reply_to: BRAND.supportEmail,
      subject,
      html,
    }),
  });
  const resendText = await resp.text();
  if (!resp.ok) {
    console.error("[resend-confirmation-email] Resend", resp.status, resendText.slice(0, 300));
    throw new HttpError(502, "Die E-Mail konnte nicht versendet werden.", "send_failed");
  }
  let resendId: string | null = null;
  try {
    resendId = JSON.parse(resendText)?.id ?? null;
  } catch {
    /* Antwort ohne JSON-Body */
  }

  const { error: logError } = await sb.from("admin_emails").insert({
    sender_email: BRAND.noReplyEmail,
    sender_name: layoutSettings.site_name,
    recipient_email: email,
    recipient_id: user.id,
    subject,
    body_html: buildEmailLayout(layoutSettings, "E-Mail-Adresse bestätigen", content(`${BRAND.baseUrl}/login`)),
    body_text: "",
    email_type: "email_confirmation_resend",
    direction: "outbound",
    status: "sent",
    resend_id: resendId,
    is_read: true,
  });
  if (logError) console.warn("[resend-confirmation-email] admin_emails log failed", logError.message);

  const applicationId =
    typeof body.dealer_application_id === "string" && UUID_RE.test(body.dealer_application_id)
      ? body.dealer_application_id
      : null;
  if (applicationId) {
    const { data: app } = await sb
      .from("dealer_applications")
      .select("confirmation_link_sent_count")
      .eq("id", applicationId)
      .maybeSingle();
    const { error: counterError } = await sb
      .from("dealer_applications")
      .update({
        confirmation_link_sent_count: (app?.confirmation_link_sent_count ?? 0) + 1,
        confirmation_link_last_sent_at: new Date().toISOString(),
      })
      .eq("id", applicationId);
    if (counterError) console.warn("[resend-confirmation-email] counter update failed", counterError.message);
  }

  return jsonResponse(req, {
    success: true,
    method: "resend",
    message: `Bestätigungslink wurde an ${email} gesendet.`,
  });
});
