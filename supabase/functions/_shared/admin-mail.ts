/**
 * Betriebs-Mails an die Betreiber-Adresse (site_settings.lead_forward_email,
 * sonst contact_email, sonst BRAND.supportEmail) im KüchenWert-Layout, über
 * Resend von noreply@. Jede Mail landet vorher in admin_emails (email_type muss
 * im Constraint admin_emails_email_type_check stehen); email_type dient als
 * Wiederholungssperre (sentRecently).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { BRAND } from "./brand-config.ts";
import { buildEmailLayout } from "./email-builder.ts";
import { HttpError } from "./kw-http.ts";

export interface AdminEmail {
  emailType: string;
  /** Erhält den Seitennamen aus site_settings. */
  subject: (siteName: string) => string;
  title: string;
  contentHtml: string;
}

export async function sendAdminEmail(sb: SupabaseClient, mail: AdminEmail): Promise<{ to: string; resendId: string | null }> {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!apiKey) throw new HttpError(503, "RESEND_API_KEY fehlt.", "mail_unconfigured");

  const { data: settings } = await sb
    .from("site_settings")
    .select("site_name, site_description, contact_email, support_phone, lead_forward_email")
    .limit(1)
    .maybeSingle();
  const to = settings?.lead_forward_email || settings?.contact_email || BRAND.supportEmail;
  const layoutSettings = {
    site_name: settings?.site_name || BRAND.name,
    site_description: settings?.site_description || BRAND.tagline,
    contact_email: settings?.contact_email || BRAND.supportEmail,
    support_phone: settings?.support_phone || "",
  };
  const subject = mail.subject(layoutSettings.site_name);
  const html = buildEmailLayout(layoutSettings, mail.title, mail.contentHtml);

  // Erst protokollieren: Lehnt admin_emails die Zeile ab, geht keine unprotokollierte Mail raus.
  const { data: logged, error: logError } = await sb
    .from("admin_emails")
    .insert({
      sender_email: BRAND.noReplyEmail,
      sender_name: BRAND.name,
      recipient_email: to,
      subject,
      body_html: html,
      body_text: "",
      email_type: mail.emailType,
      direction: "outbound",
      status: "queued",
      is_read: false,
    })
    .select("id")
    .single();
  if (logError || !logged) throw new Error(`admin_emails: ${logError?.message ?? "keine Zeile"}`);

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${BRAND.name} <${BRAND.noReplyEmail}>`, to: [to], subject, html }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    await sb.from("admin_emails").update({ status: "failed" }).eq("id", logged.id);
    throw new Error(`Resend ${resp.status}: ${text.slice(0, 300)}`);
  }
  let resendId: string | null = null;
  try {
    resendId = JSON.parse(text)?.id ?? null;
  } catch {
    /* Antwort ohne JSON-Body */
  }
  await sb.from("admin_emails").update({ status: "sent", resend_id: resendId }).eq("id", logged.id);
  return { to, resendId };
}

export async function sentRecently(sb: SupabaseClient, emailType: string, hours: number): Promise<boolean> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { count, error } = await sb
    .from("admin_emails")
    .select("id", { count: "exact", head: true })
    .eq("email_type", emailType)
    .neq("status", "failed")
    .gte("created_at", since);
  if (error) throw new Error(`admin_emails: ${error.message}`);
  return (count ?? 0) > 0;
}
