import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
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

const STEP_NAMES: Record<number, string> = {
  1: "Fahrzeugdetails",
  2: "Technische Daten",
  3: "Abmessungen & Kapazität",
  4: "Innenausstattung",
  5: "Ausstattung & Features",
  6: "Fotos hochladen",
  7: "Mängel angeben",
  8: "Verkaufsweg wählen",
  9: "Termin / Überprüfung",
  10: "Überprüfung / Anmeldung",
  11: "Anmeldung & Absenden",
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
  const totalSteps = session.total_steps || 10;
  const progressPercent = Math.round((currentStep / totalSteps) * 100);
  const stepName = STEP_NAMES[currentStep] || `Schritt ${currentStep}`;
  const resumeUrl = `https://caravanwert.de/verkaufen/wizard?step=${currentStep}`;

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
  const totalSteps = session.total_steps || 10;
  const resumeUrl = `https://caravanwert.de/verkaufen/wizard?step=${currentStep}`;

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
      <strong>Gebote von mehreren Händlern</strong> – und das völlig kostenlos für Sie als Verkäufer. 
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

  // Auth check: must be service_role (cron/internal) or authenticated admin
  const authHeader = req.headers.get('authorization') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const isServiceRole = authHeader.includes(serviceRoleKey);
  if (!isServiceRole) {
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
    const { data: roles } = await createClient(SUPABASE_URL, serviceRoleKey)
      .from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some((r: any) => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }
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
    let errors = 0;

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
      for (const session of sessionsForFirstEmail) {
        const { subject, html } = buildFirstReminderEmail(session, settingsData);

        const success = await sendEmailAndLog(
          supabase,
          session.customer_email,
          session.customer_name,
          subject,
          html,
          "wizard_recovery_first",
          settingsData,
          session.id
        );

        if (success) {
          // Mark email as sent and update status to abandoned
          await supabase
            .from("wizard_sessions")
            .update({
              resume_email_sent_at: now.toISOString(),
              status: "abandoned",
            })
            .eq("id", session.id);

          firstEmailSent++;
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
      for (const session of sessionsForFollowup) {
        const { subject, html } = buildFollowupEmail(session, settingsData);

        const success = await sendEmailAndLog(
          supabase,
          session.customer_email,
          session.customer_name,
          subject,
          html,
          "wizard_recovery_followup",
          settingsData,
          session.id
        );

        if (success) {
          // Mark followup email as sent
          await supabase
            .from("wizard_sessions")
            .update({
              followup_email_sent_at: now.toISOString(),
            })
            .eq("id", session.id);

          followupEmailSent++;
        } else {
          errors++;
        }
      }
    }

    const summary = {
      success: true,
      message: `Wizard recovery processed: first_emails=${firstEmailSent}, followup_emails=${followupEmailSent}, errors=${errors}`,
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
