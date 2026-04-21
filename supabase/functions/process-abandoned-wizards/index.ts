import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import {
  buildWizardRecoveryFirstEmail,
  buildWizardRecoveryFollowupEmail,
  type WizardSession,
} from "../_shared/wizard-recovery-email.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Automated Wizard Recovery – called via Cron every 30 minutes.
 *
 * Sends exactly TWO emails per abandoned wizard session:
 *   1) First email:  2 hours after last activity (reminder)
 *   2) Second email: 14 days after last activity (re-engagement)
 *
 * Conditions for sending:
 *   - Session status is "in_progress" or "abandoned"
 *   - customer_email is present
 *   - Session is NOT completed
 *   - The respective email has not been sent yet
 *
 * Die HTML-Bodies kommen aus `_shared/wizard-recovery-email.ts`, damit der
 * Cron-Pfad und der manuelle Admin-Trigger (`send-wizard-resume-email`)
 * pixelgleich aussehen — das war frueher zwei Mal kopiert + aus dem Drift
 * geraten (alter Akzentgr\u00fcn #195d3e statt Brand-Teal #1f8aa2).
 */

interface SiteSettings {
  site_name: string;
  site_description: string;
  contact_email: string;
  support_phone: string;
}

const DEFAULT_SETTINGS: SiteSettings = {
  site_name: "CaravanWert",
  site_description: "Deutschlands führende Wohnmobil-Handelsplattform",
  contact_email: "info@caravanwert.de",
  support_phone: "+49 511 51532476",
};

/**
 * Konservative E-Mail-Format-Validierung. Filtert Tippfehler (`gmailcom`),
 * Test-Eingaben (`xxcc`, `asdf`) und sonstige offensichtlich kaputte Werte
 * heraus, BEVOR wir Resend mit dem Send beauftragen.
 *
 * Hintergrund: Vor diesem Check liefen kaputte Adressen alle 5 Minuten erneut
 * durch den Cron, weil `resume_email_sent_at` bei Send-Fehlschlag NULL bleibt
 * und der Cron-Filter (`is null`) sie damit immer wieder erfasst hat.
 * Resend rejected sie zwar (kostenlos), aber das verursacht permanente
 * `errors > 0` und unnoetigen API-Traffic.
 *
 * Pattern bewusst NICHT RFC 5322-vollstaendig (das waere Overkill und wuerde
 * tatsaechlich gueltige Edge-Cases ablehnen). Reicht fuer "gibt es ein @ mit
 * Domain + TLD?".
 */
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function isValidEmailFormat(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAIL_FORMAT.test(email.trim());
}

/**
 * Send an email via Resend API and log it in admin_emails.
 */
async function sendEmailAndLog(
  supabase: any,
  recipientEmail: string,
  recipientName: string | null,
  subject: string,
  html: string,
  emailType: string,
  settingsData: SiteSettings,
  sessionId: string
): Promise<boolean> {
  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <info@caravanwert.de>`,
        to: [recipientEmail],
        subject,
        html,
        reply_to: "info@caravanwert.de",
      }),
    });

    if (!resendRes.ok) {
      const errorText = await resendRes.text();
      console.error(`Resend error for session ${sessionId}:`, errorText);
      return false;
    }

    const resendResult = await resendRes.json();

    // Log in admin_emails for tracking
    await supabase.from("admin_emails").insert({
      sender_email: "info@caravanwert.de",
      sender_name: settingsData.site_name,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      subject,
      body_html: html,
      email_type: emailType,
      direction: "outbound",
      status: "sent",
      resend_id: resendResult.id,
      is_read: true,
    });

    return true;
  } catch (err: any) {
    console.error(`Failed to send ${emailType} email for session ${sessionId}:`, err.message);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  // ─── Auth check: must be service_role (cron/internal) or authenticated admin ───
  const authResult = await checkServiceRoleOrAdmin(req, { 'Content-Type': 'application/json' });
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // Timestamps for the two email triggers
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Load site settings
    const { data: settings } = await supabase
      .from("site_settings")
      .select("*")
      .single();

    const settingsData: SiteSettings = settings || DEFAULT_SETTINGS;

    let firstEmailSent = 0;
    let followupEmailSent = 0;
    let autoConverted = 0;
    let errors = 0;

    // ─────────────────────────────────────────────────────
    // 0) SAFETY NET: Completed sessions that were never converted.
    //    If the client-side auto-convert call was aborted (browser closed
    //    before the Danke-page useEffect fired, mobile tab backgrounded,
    //    network drop, JS crash), the session stays at "completed" with
    //    user_id=null forever. This picks them up after 10 minutes.
    //
    //    Defense-in-Depth: a DB-Trigger now guarantees completed_at is set
    //    whenever status flips to 'completed' (Migration 20260421131500),
    //    so the `completed_at IS NULL` branch is currently redundant. We
    //    keep it as a belt-and-suspenders fallback in case a future
    //    direct-update path bypasses the trigger somehow (e.g. COPY,
    //    CREATE TABLE AS, restore from a pre-trigger backup).
    // ─────────────────────────────────────────────────────
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: stuckSessions, error: stuckError } = await supabase
      .from("wizard_sessions")
      // anonymous_id is REQUIRED so auto-convert-wizard can pass
      // verify_wizard_session_ownership when called with the service-role
      // bearer (which itself bypasses the user_id branch of that RPC).
      .select("id, customer_email, customer_name, anonymous_id, completed_at, updated_at")
      .eq("status", "completed")
      .is("user_id", null)
      .not("customer_email", "is", null)
      // Catch BOTH the normal case (completed_at set, > 10 min ago) AND the
      // pathological case (completed_at NULL, but row clearly aged via
      // updated_at). The OR-filter accepts either condition.
      .or(
        `and(completed_at.lt.${tenMinutesAgo},completed_at.gt.${twentyFourHoursAgo}),` +
        `and(completed_at.is.null,updated_at.lt.${tenMinutesAgo},updated_at.gt.${twentyFourHoursAgo})`
      )
      .order("updated_at", { ascending: true })
      .limit(10);

    if (stuckError) {
      console.error("Error fetching stuck completed sessions:", stuckError.message);
    }

    if (stuckSessions && stuckSessions.length > 0) {
      console.log(`Found ${stuckSessions.length} stuck completed session(s) — triggering auto-convert`);

      for (const session of stuckSessions) {
        try {
          const convertRes = await fetch(`${SUPABASE_URL}/functions/v1/auto-convert-wizard`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              sessionId: session.id,
              userId: null,
              hasPassword: false,
              // anonymousId is required so verify_wizard_session_ownership
              // returns TRUE inside auto-convert-wizard. Without this the
              // RPC sees both p_user_id=null AND p_anonymous_id=null and
              // rejects with 403 — which is exactly how this safety net
              // silently failed before the 2026-04-21 hardening.
              anonymousId: (session as any).anonymous_id ?? null,
            }),
          });

          if (convertRes.ok) {
            autoConverted++;
            console.log(`Auto-converted stuck session ${session.id} (${session.customer_email})`);
          } else {
            const errText = await convertRes.text();
            console.error(`Failed to auto-convert session ${session.id}: ${convertRes.status} ${errText}`);
            errors++;
          }
        } catch (convertErr: any) {
          console.error(`Error auto-converting session ${session.id}:`, convertErr.message);
          errors++;
        }
      }
    }

    // ─────────────────────────────────────────────────────
    // 1) FIRST EMAIL: Sessions inactive for >2 hours,
    //    where resume_email_sent_at IS NULL
    // ─────────────────────────────────────────────────────
    const { data: sessionsForFirstEmail, error: firstError } = await supabase
      .from("wizard_sessions")
      .select("*")
      .in("status", ["in_progress", "abandoned"])
      .not("customer_email", "is", null)
      .is("completed_at", null)
      .is("resume_email_sent_at", null)
      .lt("last_activity_at", twoHoursAgo)
      .order("last_activity_at", { ascending: true })
      .limit(50);

    if (firstError) {
      console.error("Error fetching sessions for first email:", firstError.message);
    }

    if (sessionsForFirstEmail && sessionsForFirstEmail.length > 0) {
      // ─── DEDUPLIZIERUNG: Nur EINE Email pro customer_email ───
      // Wenn ein Nutzer mehrere abandoned Sessions hat, sende nur für die neueste
      // und markiere ALLE als gesendet
      const sessionsByEmail = new Map<string, typeof sessionsForFirstEmail>();
      for (const session of sessionsForFirstEmail) {
        const email = session.customer_email?.toLowerCase();
        if (!email) continue;
        if (!sessionsByEmail.has(email)) {
          sessionsByEmail.set(email, []);
        }
        sessionsByEmail.get(email)!.push(session);
      }

      for (const [email, sessions] of sessionsByEmail) {
        // PRE-FLIGHT: Tippfehler & Test-Eingaben rausfiltern, BEVOR wir
        // Resend ueberhaupt anfragen. Sonst retried der Cron diese Sessions
        // alle 5 Minuten endlos (resume_email_sent_at wuerde bei Send-
        // Fehlschlag NULL bleiben → wieder erfasst → wieder fehlschlagen).
        if (!isValidEmailFormat(email)) {
          const sessionIds = sessions.map((s: any) => s.id);
          await supabase
            .from("wizard_sessions")
            .update({ resume_email_sent_at: now.toISOString(), status: "abandoned" })
            .in("id", sessionIds);
          console.log(`Skipped recovery_first for invalid email format: "${email}" (${sessions.length} session(s))`);
          continue;
        }

        // ANTI-SPAM: Max 1 recovery_first pro Email pro 7 Tage
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentRecovery } = await supabase
          .from("admin_emails")
          .select("id")
          .eq("recipient_email", email)
          .eq("email_type", "wizard_recovery_first")
          .gt("created_at", sevenDaysAgo)
          .limit(1);
        if (recentRecovery && recentRecovery.length > 0) {
          // Trotzdem alle Sessions als gesendet markieren damit sie nicht erneut auftauchen
          const sessionIds = sessions.map((s: any) => s.id);
          await supabase.from("wizard_sessions").update({ resume_email_sent_at: now.toISOString(), status: "abandoned" }).in("id", sessionIds);
          console.log(`Anti-spam: Skipped recovery_first for ${email} (already sent in last 7 days)`);
          continue;
        }

        // Sortiere nach last_activity_at DESC - neueste Session zuerst
        sessions.sort((a: any, b: any) => 
          new Date(b.last_activity_at || b.created_at).getTime() - 
          new Date(a.last_activity_at || a.created_at).getTime()
        );
        const newestSession = sessions[0];

        const { subject, html } = buildWizardRecoveryFirstEmail(
          newestSession as WizardSession,
          settingsData,
        );

        const success = await sendEmailAndLog(
          supabase,
          newestSession.customer_email,
          newestSession.customer_name,
          subject,
          html,
          "wizard_recovery_first",
          settingsData,
          newestSession.id
        );

        if (success) {
          // Markiere ALLE Sessions dieses Nutzers als gesendet
          const sessionIds = sessions.map((s: any) => s.id);
          await supabase
            .from("wizard_sessions")
            .update({
              resume_email_sent_at: now.toISOString(),
              status: "abandoned",
            })
            .in("id", sessionIds);

          firstEmailSent++;
          if (sessions.length > 1) {
            console.log(`Deduplicated: ${email} had ${sessions.length} sessions, sent 1 email, marked all as sent`);
          }
        } else {
          errors++;
        }
      }
    }

    // ─────────────────────────────────────────────────────
    // 2) SECOND EMAIL: Sessions inactive for >14 days,
    //    where resume_email_sent_at IS NOT NULL (first was sent)
    //    AND followup_email_sent_at IS NULL (second not yet sent)
    // ─────────────────────────────────────────────────────
    const { data: sessionsForFollowup, error: followupError } = await supabase
      .from("wizard_sessions")
      .select("*")
      .in("status", ["abandoned"])
      .not("customer_email", "is", null)
      .is("completed_at", null)
      .not("resume_email_sent_at", "is", null)
      .is("followup_email_sent_at", null)
      .lt("last_activity_at", fourteenDaysAgo)
      .order("last_activity_at", { ascending: true })
      .limit(50);

    if (followupError) {
      console.error("Error fetching sessions for followup email:", followupError.message);
    }

    if (sessionsForFollowup && sessionsForFollowup.length > 0) {
      // ─── DEDUPLIZIERUNG: Nur EINE Followup-Email pro customer_email ───
      const followupByEmail = new Map<string, typeof sessionsForFollowup>();
      for (const session of sessionsForFollowup) {
        const email = session.customer_email?.toLowerCase();
        if (!email) continue;
        if (!followupByEmail.has(email)) {
          followupByEmail.set(email, []);
        }
        followupByEmail.get(email)!.push(session);
      }

      for (const [email, sessions] of followupByEmail) {
        // PRE-FLIGHT: kaputte Mails rausfiltern (siehe gleicher Block oben).
        if (!isValidEmailFormat(email)) {
          const sessionIds = sessions.map((s: any) => s.id);
          await supabase
            .from("wizard_sessions")
            .update({ followup_email_sent_at: now.toISOString() })
            .in("id", sessionIds);
          console.log(`Skipped followup for invalid email format: "${email}" (${sessions.length} session(s))`);
          continue;
        }

        // ANTI-SPAM: Max 1 followup pro Email pro 30 Tage
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentFollowup } = await supabase
          .from("admin_emails").select("id")
          .eq("recipient_email", email).eq("email_type", "wizard_recovery_followup")
          .gt("created_at", thirtyDaysAgo).limit(1);
        if (recentFollowup && recentFollowup.length > 0) {
          const sessionIds = sessions.map((s: any) => s.id);
          await supabase.from("wizard_sessions").update({ followup_email_sent_at: now.toISOString() }).in("id", sessionIds);
          console.log(`Anti-spam: Skipped followup for ${email} (already sent in last 30 days)`);
          continue;
        }

        sessions.sort((a: any, b: any) => 
          new Date(b.last_activity_at || b.created_at).getTime() - 
          new Date(a.last_activity_at || a.created_at).getTime()
        );
        const newestSession = sessions[0];

        const { subject, html } = buildWizardRecoveryFollowupEmail(
          newestSession as WizardSession,
          settingsData,
        );

        const success = await sendEmailAndLog(
          supabase,
          newestSession.customer_email,
          newestSession.customer_name,
          subject,
          html,
          "wizard_recovery_followup",
          settingsData,
          newestSession.id
        );

        if (success) {
          // Markiere ALLE Sessions dieses Nutzers als gesendet
          const sessionIds = sessions.map((s: any) => s.id);
          await supabase
            .from("wizard_sessions")
            .update({
              followup_email_sent_at: now.toISOString(),
            })
            .in("id", sessionIds);

          followupEmailSent++;
          if (sessions.length > 1) {
            console.log(`Deduplicated followup: ${email} had ${sessions.length} sessions, sent 1 email, marked all as sent`);
          }
        } else {
          errors++;
        }
      }
    }

    const summary = {
      success: true,
      message: `Wizard recovery processed: auto_converted=${autoConverted}, first_emails=${firstEmailSent}, followup_emails=${followupEmailSent}, errors=${errors}`,
      auto_converted: autoConverted,
      first_emails_sent: firstEmailSent,
      followup_emails_sent: followupEmailSent,
      errors,
    };

    console.log(summary.message);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in process-abandoned-wizards:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
