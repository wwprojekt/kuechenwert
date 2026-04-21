import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import {
  buildEmailLayout,
  infoBox,
  detailRow,
  paragraph,
  button,
} from "../_shared/email-builder.ts";

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
 */

// Must mirror the real wizard flow in VerkaufenWizard.tsx:
// 1=VehicleType 2=VehicleInfo 3=Details 4=Equipment
// 5=QuickContact 6=Photos 7=SaleChannel 8=AccountLocation (inkl. Marketing-Consent)
const STEP_NAMES: Record<number, string> = {
  1: "Fahrzeugtyp",
  2: "Fahrzeugdaten",
  3: "Details & Technik",
  4: "Ausstattung",
  5: "Kontakt",
  6: "Fotos",
  7: "Verkaufsweg & Telefon",
  8: "Standort & Konto",
};

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
 * Build the first reminder email (sent after 2 hours of inactivity).
 * Tone: friendly, encouraging, focused on progress already made.
 */
function buildFirstReminderEmail(
  session: any,
  settingsData: SiteSettings
): { subject: string; html: string } {
  const formData = session.form_data || {};
  const vehicleName = [
    formData.manufacturer,
    formData.model,
    formData.year ? `(${formData.year})` : "",
  ]
    .filter(Boolean)
    .join(" ") || "Ihr Wohnmobil";

  const customerName = session.customer_name || "Kunde";
  const currentStep = session.current_step || 1;
  const totalSteps = session.total_steps || 8;
  const progressPercent = Math.round((currentStep / totalSteps) * 100);
  const stepName = STEP_NAMES[currentStep] || `Schritt ${currentStep}`;
  // Cross-device resume: ?token=<resume_token> laedt die Original-Session
  // ueber find_wizard_session_by_resume_token RPC unabhaengig vom
  // localStorage des klickenden Geraets. Fallback auf step-only, wenn der
  // Token (alte Sessions vor der Migration) noch fehlen sollte.
  const resumeUrl = session.resume_token
    ? `https://caravanwert.de/verkaufen/wizard?token=${encodeURIComponent(session.resume_token)}&source=recovery_first`
    : `https://caravanwert.de/verkaufen/wizard?step=${currentStep}&source=recovery_first`;

  // Build progress bar HTML
  const progressBarHtml = `
    <div style="background-color: #e9ecef; border-radius: 10px; height: 20px; margin: 15px 0; overflow: hidden;">
      <div style="background-color: #195d3e; height: 100%; width: ${progressPercent}%; border-radius: 10px;"></div>
    </div>
    <p style="text-align: center; font-size: 14px; color: #666; margin: 5px 0;">
      ${progressPercent}% abgeschlossen – Schritt ${currentStep} von ${totalSteps}
    </p>
  `;

  // Build completed steps list
  const completedSteps: string[] = [];
  for (let i = 1; i < currentStep; i++) {
    completedSteps.push(
      `<span style="color: #195d3e;">&#10003;</span> ${STEP_NAMES[i] || `Schritt ${i}`}`
    );
  }

  let content = "";

  content += paragraph(`Hallo ${customerName},`);

  content += paragraph(
    `wir haben bemerkt, dass Sie die Inserierung Ihres Wohnmobils auf ${settingsData.site_name} noch nicht abgeschlossen haben. ` +
    `Keine Sorge – Ihre bisherigen Eingaben sind gespeichert und Sie können jederzeit genau dort weitermachen, wo Sie aufgehört haben.`
  );

  content += infoBox(
    `Ihr Inserat: ${vehicleName}`,
    `${detailRow("Aktueller Schritt", stepName)}
     ${detailRow("Fortschritt", `${progressPercent}%`)}
     ${progressBarHtml}
     ${completedSteps.length > 0
       ? `<p style="margin: 15px 0 5px; font-size: 14px; font-weight: bold; color: #333;">Bereits ausgefüllt:</p>
          <p style="margin: 0; font-size: 14px; line-height: 24px; color: #555;">
            ${completedSteps.join("<br/>")}
          </p>`
       : ""
     }`,
    "default",
    settingsData
  );

  content += button("Jetzt weitermachen", resumeUrl, settingsData);

  content += paragraph(`<strong>Warum jetzt abschließen?</strong>`);

  content += `
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr>
        <td style="padding: 12px; text-align: center; width: 33%;">
          <div style="font-size: 28px; margin-bottom: 5px;">&#9201;</div>
          <p style="margin: 0; font-size: 13px; color: #555;"><strong>Nur ${totalSteps - currentStep + 1} Schritte</strong><br/>bis zur Veröffentlichung</p>
        </td>
        <td style="padding: 12px; text-align: center; width: 33%;">
          <div style="font-size: 28px; margin-bottom: 5px;">&#128176;</div>
          <p style="margin: 0; font-size: 13px; color: #555;"><strong>Kostenlos</strong><br/>inserieren</p>
        </td>
        <td style="padding: 12px; text-align: center; width: 33%;">
          <div style="font-size: 28px; margin-bottom: 5px;">&#128664;</div>
          <p style="margin: 0; font-size: 13px; color: #555;"><strong>Hunderte Händler</strong><br/>warten auf Ihr Angebot</p>
        </td>
      </tr>
    </table>
  `;

  content += paragraph(
    `Falls Sie Fragen haben oder Hilfe benötigen, antworten Sie einfach auf diese E-Mail oder rufen Sie uns an unter ` +
    `<strong>${settingsData.support_phone}</strong>. Wir helfen Ihnen gerne!`
  );

  content += paragraph("Mit freundlichen Grüßen,<br/>Ihr CaravanWert Team");

  const subject = `Ihr Wohnmobil-Inserat wartet – machen Sie jetzt weiter!`;
  const html = buildEmailLayout(settingsData, subject, content);

  return { subject, html };
}

/**
 * Build the second re-engagement email (sent after 14 days of inactivity).
 * Tone: warm, personal, last-chance feeling, emphasizes value.
 */
function buildFollowupEmail(
  session: any,
  settingsData: SiteSettings
): { subject: string; html: string } {
  const formData = session.form_data || {};
  const vehicleName = [
    formData.manufacturer,
    formData.model,
    formData.year ? `(${formData.year})` : "",
  ]
    .filter(Boolean)
    .join(" ") || "Ihr Wohnmobil";

  const customerName = session.customer_name || "Kunde";
  const currentStep = session.current_step || 1;
  const totalSteps = session.total_steps || 8;
  const resumeUrl = session.resume_token
    ? `https://caravanwert.de/verkaufen/wizard?token=${encodeURIComponent(session.resume_token)}&source=recovery_followup`
    : `https://caravanwert.de/verkaufen/wizard?step=${currentStep}&source=recovery_followup`;

  let content = "";

  content += paragraph(`Hallo ${customerName},`);

  content += paragraph(
    `vor einiger Zeit haben Sie begonnen, <strong>${vehicleName}</strong> auf ${settingsData.site_name} zu inserieren. ` +
    `Wir möchten Sie daran erinnern, dass Ihre Daten noch gespeichert sind und Sie jederzeit dort weitermachen können, wo Sie aufgehört haben.`
  );

  content += infoBox(
    "Wussten Sie schon?",
    `<p style="margin: 0; font-size: 14px; line-height: 22px; color: #555;">
      Fahrzeuge, die über ${settingsData.site_name} angeboten werden, erhalten im Durchschnitt 
      <strong>Anfragen von mehreren geprüften Händlern</strong> – und das völlig kostenlos für Sie als Verkäufer. 
      Je früher Sie Ihr Inserat abschließen, desto schneller finden Sie den besten Käufer.
    </p>`,
    "info",
    settingsData
  );

  content += button("Inserat jetzt abschließen", resumeUrl, settingsData);

  content += paragraph(
    `Sie haben bereits <strong>${currentStep - 1} von ${totalSteps} Schritten</strong> ausgefüllt. ` +
    `Es fehlen nur noch wenige Angaben, bis Ihr Fahrzeug für Hunderte geprüfte Händler sichtbar wird.`
  );

  content += paragraph(
    `Brauchen Sie Unterstützung? Unser Team hilft Ihnen gerne persönlich weiter – ` +
    `antworten Sie einfach auf diese E-Mail oder rufen Sie uns an unter <strong>${settingsData.support_phone}</strong>.`
  );

  content += paragraph("Herzliche Grüße,<br/>Ihr CaravanWert Team");

  content += paragraph(
    `<span style="font-size: 12px; color: #6b7280;">` +
    `Sie erhalten diese E-Mail, weil Sie eine Fahrzeugbewertung auf ${settingsData.site_name} begonnen haben. ` +
    `Dies ist unsere letzte automatische Erinnerung.` +
    `</span>`
  );

  const subject = `${vehicleName} – Ihr Inserat ist fast fertig!`;
  const html = buildEmailLayout(settingsData, subject, content);

  return { subject, html };
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

        const { subject, html } = buildFirstReminderEmail(newestSession, settingsData);

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

        const { subject, html } = buildFollowupEmail(newestSession, settingsData);

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
