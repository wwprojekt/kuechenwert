import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { edgeLogger, logEdgeError } from "../_shared/edgeLogger.ts";
import { checkServiceRoleOrAdmin } from "../_shared/auth.ts";
import {
  buildEmailLayout,
  paragraph,
  greeting,
  infoBox,
  warningBox,
} from "../_shared/email-builder.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

/**
 * Admin-only Edge Function to completely delete a user.
 *
 * This function:
 *   1. Loads the user's profile + auth record (so we can mail them)
 *   2. Sends a deletion confirmation email BEFORE the account is destroyed
 *      (after deletion, we'd lose the email address)
 *   3. Removes the user from auth.users via the Supabase Admin API
 *   4. Cleans up application-level tables (profiles, user_roles,
 *      dealer_applications) — best effort, since cascade may already cover it
 *   5. Audit log + persistent error_logs on email failure
 *
 * Body:
 *   { userId: string,
 *     reason?: string,    // shown in the email (e.g. "auf eigenen Wunsch")
 *     sendEmail?: boolean }
 */

interface DeleteUserRequest {
  userId: string;
  reason?: string | null;
  sendEmail?: boolean;
}

interface ProfileLite {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

interface SettingsLike {
  site_name: string;
  site_description: string;
  contact_email: string;
  support_phone: string;
}

const fallbackSettings: SettingsLike = {
  site_name: "KuechenWert",
  site_description: "Deutschlands führende Wohnmobil-Handelsplattform",
  contact_email: "info@kuechenwert.de",
  support_phone: "+49 511 51532476",
};

function displayName(p: ProfileLite | null | undefined, emailFallback?: string | null): string {
  if (p) {
    const v = p.company_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || (p.email?.split("@")[0] ?? "");
    if (v) return v;
  }
  return emailFallback?.split("@")[0] ?? "";
}

async function sendMail(
  recipientEmail: string,
  subject: string,
  html: string,
  settings: SettingsLike,
): Promise<{ ok: boolean; error: string | null; resendId: string | null }> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not configured", resendId: null };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settings.site_name} <info@kuechenwert.de>`,
        to: [recipientEmail],
        subject,
        html,
        reply_to: "info@kuechenwert.de",
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `${res.status}: ${(await res.text()).slice(0, 200)}`,
        resendId: null,
      };
    }
    const json = await res.json();
    return { ok: true, error: null, resendId: json?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), resendId: null };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  // Check authorization (admin only)
  const authResult = await checkServiceRoleOrAdmin(req, getCorsHeaders(req));
  if (!authResult.authorized) {
    return authResult.response;
  }

  // Resolve admin user ID for audit_logs (may be null if invoked via service role key)
  let adminUserId: string | null = null;
  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (token) {
      const tmp = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: { user } } = await tmp.auth.getUser(token);
      adminUserId = user?.id ?? null;
    }
  } catch {
    // ignore — service-role calls have no JWT
  }

  try {
    const body: DeleteUserRequest = await req.json();

    if (!body.userId || !body.userId.trim()) {
      return new Response(
        JSON.stringify({ error: "userId ist erforderlich" }),
        { status: 400, headers }
      );
    }

    const userId = body.userId.trim();
    const reason = body.reason?.trim() || null;
    const sendEmail = body.sendEmail !== false;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ─── 1. Load auth user + profile BEFORE deletion (need email to mail) ──
    const { data: authUser, error: getUserError } = await supabase.auth.admin.getUserById(userId);
    if (getUserError || !authUser?.user) {
      edgeLogger.warn(`User ${userId} not found in auth.users: ${getUserError?.message ?? "missing"}`);
    }
    const userEmail = authUser?.user?.email ?? null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, company_name")
      .eq("id", userId)
      .maybeSingle();
    const recipientEmail = profile?.email ?? userEmail;
    const recipientName = displayName(profile as ProfileLite | null, recipientEmail);

    // ─── 2. Send deletion notification BEFORE we destroy the account ───────
    let mailSent = false;
    let mailError: string | null = null;
    if (sendEmail && recipientEmail) {
      const { data: settingsRow } = await supabase.from("site_settings").select("*").single();
      const settings: SettingsLike = (settingsRow as SettingsLike | null) ?? fallbackSettings;

      const subject = `Ihr Konto bei ${settings.site_name} wurde gelöscht`;
      const content = `
        ${greeting(recipientName)}
        ${paragraph(`wir möchten Sie informieren, dass Ihr Konto bei <strong>${settings.site_name}</strong> vollständig gelöscht wurde. Sämtliche personenbezogenen Daten wurden aus unseren produktiven Systemen entfernt.`)}
        ${warningBox("Eine Anmeldung mit dieser E-Mail-Adresse ist nicht mehr möglich. Sie können sich bei Bedarf jederzeit wieder neu registrieren.")}
        ${reason ? infoBox("Grund", paragraph(reason), "info") : ""}
        ${paragraph(`Falls Sie die Löschung nicht selbst veranlasst haben oder Rückfragen zur Datenverarbeitung haben, wenden Sie sich bitte umgehend an unseren Datenschutzbeauftragten unter <a href="mailto:${settings.contact_email}" style="color:#1f8aa2;">${settings.contact_email}</a> oder telefonisch unter ${settings.support_phone}.`)}
        ${paragraph("Wir bedanken uns für die Zeit, die Sie mit uns verbracht haben, und wünschen Ihnen alles Gute.")}
      `;

      const html = buildEmailLayout(settings, subject, content);
      const result = await sendMail(recipientEmail, subject, html, settings);
      mailSent = result.ok;
      mailError = result.error;

      if (result.ok) {
        try {
          await supabase.from("admin_emails").insert({
            sender_email: "info@kuechenwert.de",
            sender_name: settings.site_name,
            recipient_email: recipientEmail,
            recipient_name: recipientName,
            // recipient_id intentionally omitted — the user row is about to vanish
            subject,
            body_html: html,
            body_text: html.replace(/<[^>]*>/g, ""),
            email_type: "account_deleted",
            direction: "outbound",
            status: "sent",
            resend_id: result.resendId,
            sent_by: adminUserId,
            is_read: true,
          });
        } catch (e) {
          edgeLogger.error("admin_emails insert failed", e);
        }
      } else {
        await logEdgeError(supabase, {
          component: "admin-delete-user",
          message: `User ${userId} about to be deleted but email failed: ${result.error}`,
          severity: "high",
          category: "email",
          userId: adminUserId,
          metadata: { targetUserId: userId, recipientEmail, error: result.error },
        });
      }
    }

    edgeLogger.info(`Deleting user ${userId} (${recipientEmail ?? "no email"}) completely`);

    // ─── 3. Delete from auth.users ─────────────────────────────────────────
    if (authUser?.user) {
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteAuthError) {
        edgeLogger.error(`Failed to delete auth user ${userId}: ${deleteAuthError.message}`);
        return new Response(
          JSON.stringify({
            error: `Auth-Benutzer konnte nicht gelöscht werden: ${deleteAuthError.message}`,
            mailSent,
            mailError,
          }),
          { status: 500, headers }
        );
      }
    }

    // ─── 4. Best-effort cleanup of application-level tables ────────────────
    const { error: dealerAppError } = await supabase
      .from("dealer_applications")
      .delete()
      .eq("user_id", userId);
    if (dealerAppError) {
      edgeLogger.warn(`Could not delete dealer_applications for ${userId}: ${dealerAppError.message}`);
    }

    const { error: rolesError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    if (rolesError) {
      edgeLogger.warn(`Could not delete user_roles for ${userId}: ${rolesError.message}`);
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profileError) {
      edgeLogger.warn(`Could not delete profile for ${userId}: ${profileError.message}`);
    }

    edgeLogger.info(`Successfully deleted user ${userId} (${recipientEmail ?? "no email"})`);

    // ─── 5. Audit log ──────────────────────────────────────────────────────
    try {
      await supabase.from("audit_logs").insert({
        user_id: adminUserId,
        action: "user_deleted",
        entity_type: "user",
        entity_id: userId,
        details: {
          target_user_id: userId,
          target_email: recipientEmail,
          target_company_name: profile?.company_name ?? null,
          reason,
          mail_sent: mailSent,
          mail_error: mailError,
          send_email_requested: sendEmail,
        },
      });
    } catch (e) {
      edgeLogger.error("audit_logs insert failed", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Benutzer ${recipientEmail ?? userId} wurde vollständig gelöscht`,
        mailSent,
        mailError,
      }),
      { status: 200, headers }
    );
  } catch (error: unknown) {
    edgeLogger.error("Error in admin-delete-user:", error);
    const msg = error instanceof Error ? error.message : "Interner Serverfehler";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers }
    );
  }
};

serve(handler);
