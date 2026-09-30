/**
 * kw-auth-email — Send-Email-Hook von Supabase Auth.
 *
 * Supabase Auth schickt Registrierungs-, Passwort-, Einladungs-, Anmelde- und
 * Sicherheitsmails nicht selbst, sondern ruft diese Function auf
 * (Dashboard → Authentication → Hooks → Send Email, HTTPS). Der Aufruf ist
 * signiert; Secret SEND_EMAIL_HOOK_SECRET ist der Wert „v1,whsec_…“ aus dem
 * Hook-Dialog. Inhalte: _shared/auth-email.ts.
 *
 * Antwort 200 heißt versendet. Bei einem Fehler zeigt Supabase dem Nutzer die
 * Meldung aus {"error":{"http_code","message"}} und verschickt nichts.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { buildAuthMails, redactSecrets, type AuthHookEmailData, type AuthHookUser, type AuthMail } from "../_shared/auth-email.ts";
import { verifyAuthHook } from "../_shared/auth-hook.ts";
import { BRAND } from "../_shared/brand-config.ts";
import { serviceClient } from "../_shared/kw-http.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const FROM = `${BRAND.name} <${BRAND.noReplyEmail}>`;
// Supabase bricht Hooks nach wenigen Sekunden ab; lieber selbst mit klarer Meldung.
const RESEND_TIMEOUT_MS = 4500;
// Bei Registrierung und Einladung ist das Profil womöglich noch nicht sichtbar (FK auf profiles).
const NEW_ACCOUNT_TYPES = new Set(["signup", "invite"]);

type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

function hookError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function send(mail: AuthMail): Promise<SendResult> {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY fehlt" };
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        reply_to: BRAND.supportEmail,
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
    const body = await resp.text();
    if (!resp.ok) return { ok: false, error: `Resend ${resp.status}: ${body.slice(0, 200)}` };
    try {
      return { ok: true, id: JSON.parse(body)?.id ?? null };
    } catch {
      return { ok: true, id: null };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function logMail(sb: SupabaseClient, recipientId: string | null, mail: AuthMail, result: SendResult) {
  const { error } = await sb.from("admin_emails").insert({
    sender_email: BRAND.noReplyEmail,
    sender_name: BRAND.name,
    recipient_email: mail.to,
    recipient_id: recipientId,
    subject: mail.subject,
    body_html: redactSecrets(mail.html, mail.secrets),
    body_text: redactSecrets(mail.text, mail.secrets),
    email_type: mail.emailType,
    direction: "outbound",
    status: result.ok ? "sent" : "failed",
    resend_id: result.ok ? result.id : null,
    is_read: true,
  });
  if (error) console.warn("[kw-auth-email] Protokoll fehlgeschlagen", mail.emailType, error.message);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return hookError(405, "Method not allowed");
  if (!HOOK_SECRET) {
    console.error("[kw-auth-email] SEND_EMAIL_HOOK_SECRET fehlt");
    return hookError(500, "Der E-Mail-Versand ist nicht eingerichtet. Bitte versuchen Sie es später erneut.");
  }

  let user: AuthHookUser;
  let data: AuthHookEmailData;
  try {
    ({ user, email_data: data } = verifyAuthHook<{ user: AuthHookUser; email_data: AuthHookEmailData }>(
      await req.text(),
      req.headers,
      HOOK_SECRET,
    ));
  } catch {
    return hookError(401, "Ungültige Signatur.");
  }

  let mails: AuthMail[];
  try {
    mails = buildAuthMails(user, data);
  } catch (err) {
    console.error("[kw-auth-email] Mail nicht erstellt", data?.email_action_type, err instanceof Error ? err.message : err);
    return hookError(500, "Diese E-Mail kann gerade nicht versendet werden. Bitte wenden Sie sich an " + BRAND.supportEmail + ".");
  }

  const sb = serviceClient();
  const recipientId = user.id && !NEW_ACCOUNT_TYPES.has(data.email_action_type) ? user.id : null;
  for (const mail of mails) {
    const result = await send(mail);
    await logMail(sb, recipientId, mail, result);
    if (!result.ok) {
      console.error("[kw-auth-email] Versand fehlgeschlagen", mail.emailType, result.error);
      return hookError(500, "Die E-Mail konnte nicht versendet werden. Bitte versuchen Sie es in ein paar Minuten erneut.");
    }
  }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
});
