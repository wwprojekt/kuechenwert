/**
 * kw-contact — Kontaktformular (/kontakt)
 *
 * POST { name, email, phone?, subject, message, turnstile_token?, website, submission_id }
 *
 * Speichert die Nachricht in contact_messages (Admin → Nachrichten) und
 * benachrichtigt das Service-Team; Antworten gehen per reply_to direkt an den
 * Absender. Eine Eingangsbestätigung an die angegebene Adresse gibt es nur mit
 * bestandener Bot-Prüfung, damit das Formular nicht als Mail-Relay taugt.
 * Rate-Limits pro IP und pro E-Mail-Adresse, Honeypot, Idempotenz über
 * submission_id.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  HttpError,
  cleanText,
  clientIp,
  enforceRateLimit,
  escapeHtml,
  isEmail,
  jsonResponse,
  normalizePhone,
  readJson,
  serve,
  serviceClient,
} from "../_shared/kw-http.ts";
import { checkTurnstile } from "../_shared/turnstile.ts";
import { parseSubmissionId } from "../_shared/lead-intake.ts";
import { buildEmailLayout, detailRow, greeting, infoBox, paragraph, type Settings } from "../_shared/email-builder.ts";
import { BRAND } from "../_shared/brand-config.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

async function sendMail(
  sb: SupabaseClient,
  opts: { to: string; subject: string; html: string; replyTo: string; type: string; recipientName?: string | null },
) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY fehlt");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${BRAND.name} <${BRAND.noReplyEmail}>`,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      reply_to: opts.replyTo,
    }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${text.slice(0, 300)}`);
  let resendId: string | null = null;
  try {
    resendId = JSON.parse(text)?.id ?? null;
  } catch {
    /* Antwort ohne JSON-Body */
  }
  const { error } = await sb.from("admin_emails").insert({
    sender_email: BRAND.noReplyEmail,
    sender_name: BRAND.name,
    recipient_email: opts.to,
    recipient_name: opts.recipientName ?? null,
    subject: opts.subject,
    body_html: opts.html,
    body_text: "",
    email_type: opts.type,
    direction: "outbound",
    status: "sent",
    resend_id: resendId,
    is_read: true,
  });
  if (error) console.warn("[kw-contact] admin_emails log failed", error.message);
}

serve(async (req) => {
  const body = await readJson(req);
  const sb = serviceClient();

  if (typeof body.website === "string" && body.website.trim().length > 0) {
    console.warn("[kw-contact] Honeypot ausgelöst");
    return jsonResponse(req, { ok: true });
  }

  const ip = clientIp(req);
  await enforceRateLimit(sb, `kw:contact:${ip}`, 3600, 5);

  const name = cleanText(body.name, 120);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phoneInput = typeof body.phone === "string" ? body.phone.trim() : "";
  const phone = phoneInput ? normalizePhone(phoneInput) : null;
  const subject = cleanText(body.subject, 160)?.replace(/[\r\n]+/g, " ") ?? null;
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 5000) : "";

  if (!name || name.length < 2) throw new HttpError(422, "Bitte geben Sie Ihren Namen an.", "name");
  if (!isEmail(email)) throw new HttpError(422, "Bitte geben Sie eine gültige E-Mail-Adresse an.", "email");
  if (phoneInput && !phone) throw new HttpError(422, "Bitte eine gültige Telefonnummer angeben oder das Feld leer lassen.", "phone");
  if (!subject || subject.length < 2) throw new HttpError(422, "Bitte geben Sie einen Betreff an.", "subject");
  if (message.length < 10) throw new HttpError(422, "Bitte schreiben Sie uns mindestens ein paar Worte (10 Zeichen).", "message");

  await enforceRateLimit(sb, `kw:contact-mail:${email}`, 3600, 3);

  const submissionId = parseSubmissionId(body.submission_id);
  if (submissionId) {
    const { data: existing } = await sb.from("contact_messages").select("id").eq("submission_id", submissionId).maybeSingle();
    if (existing) return jsonResponse(req, { ok: true });
  }

  const botCheck = await checkTurnstile(body.turnstile_token, ip);
  const { error: insertErr } = await sb.from("contact_messages").insert({
    name,
    email,
    phone,
    subject,
    message,
    submission_id: submissionId,
    bot_check: botCheck,
  });
  if (insertErr) {
    if (insertErr.code === "23505") return jsonResponse(req, { ok: true });
    throw insertErr;
  }

  const { data: settingsRow } = await sb
    .from("site_settings")
    .select("site_name, site_description, contact_email, support_phone")
    .limit(1)
    .maybeSingle();
  const settings = (settingsRow ?? {
    site_name: BRAND.name,
    site_description: "",
    contact_email: BRAND.supportEmail,
    support_phone: "",
  }) as Settings;
  const teamAddress = settings.contact_email || BRAND.supportEmail;

  const adminHtml = buildEmailLayout(
    settings,
    "Neue Kontaktanfrage",
    [
      paragraph(`Neue Nachricht über das Kontaktformular${botCheck === "unverified" ? " (Bot-Prüfung nicht bestanden)" : ""}.`),
      infoBox(
        "Absender",
        [
          detailRow("Name", escapeHtml(name)),
          detailRow("E-Mail", escapeHtml(email)),
          detailRow("Telefon", escapeHtml(phone ?? "–")),
          detailRow("Betreff", escapeHtml(subject)),
        ].join(""),
      ),
      paragraph(escapeHtml(message).replace(/\n/g, "<br>")),
      paragraph("Antworten auf diese E-Mail gehen direkt an den Absender."),
    ].join(""),
  );
  await sendMail(sb, {
    to: teamAddress,
    subject: `Kontaktanfrage: ${subject}`,
    html: adminHtml,
    replyTo: email,
    type: "contact_admin",
  });

  if (botCheck !== "unverified") {
    try {
      const confirmationHtml = buildEmailLayout(
        settings,
        "Ihre Nachricht ist angekommen",
        [
          greeting(name),
          paragraph("vielen Dank für Ihre Nachricht. Wir haben sie erhalten und melden uns werktags so schnell wie möglich bei Ihnen."),
          infoBox("Ihre Nachricht", [detailRow("Betreff", escapeHtml(subject))].join("")),
        ].join(""),
      );
      await sendMail(sb, {
        to: email,
        subject: "Ihre Nachricht an KüchenWert",
        html: confirmationHtml,
        replyTo: teamAddress,
        type: "contact_confirmation",
        recipientName: name,
      });
    } catch (err) {
      console.warn("[kw-contact] Bestätigung fehlgeschlagen", err instanceof Error ? err.message : err);
    }
  }

  return jsonResponse(req, { ok: true });
});
