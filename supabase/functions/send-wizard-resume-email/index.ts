import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkServiceRoleOrAdmin } from "../_shared/auth.ts";
import {
  buildWizardRecoveryFirstEmail,
  type WizardSession,
} from "../_shared/wizard-recovery-email.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Manueller Admin-Trigger fuer die Wizard-Resume-Mail.
 *
 * Nutzt seit 2026-04-21 dieselbe Builder-Logik wie der 5-Min-Cron
 * (`process-abandoned-wizards`) ueber `_shared/wizard-recovery-email.ts`,
 * damit beide Mail-Wege pixelgleich aussehen und kein Brand-Drift mehr
 * entstehen kann (alter Hardcode-Akzent #195d3e ist hier komplett raus).
 *
 * Zusaetzlich kann der Admin im Body `customMessage` mitgeben — die wird
 * dann als hervorgehobene Personal-Note ueber dem CTA gerendert.
 */
interface ResumeEmailRequest {
  sessionId: string;
  customMessage?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const authCheck = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!authCheck.authorized) return authCheck.response;

  try {
    const { sessionId, customMessage }: ResumeEmailRequest = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId ist erforderlich" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: session, error: sessionError } = await supabase
      .from("wizard_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Wizard-Session nicht gefunden" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const recipientEmail = session.customer_email;
    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "Keine E-Mail-Adresse für diese Session vorhanden" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: settings } = await supabase
      .from("site_settings")
      .select("*")
      .single();

    const settingsData = settings || {
      site_name: "KÃ¼chenWert",
      site_description: "Deutschlands führende Wohnmobil-Handelsplattform",
      contact_email: "info@kuechenwert24.de",
      support_phone: "0511 / 51532476",
    };

    const { subject, html } = buildWizardRecoveryFirstEmail(
      session as WizardSession,
      settingsData,
      customMessage,
    );

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `KuechenWert <info@kuechenwert24.de>`,
        to: [recipientEmail],
        subject,
        html,
        reply_to: "info@kuechenwert24.de",
      }),
    });

    if (!resendRes.ok) {
      const errorText = await resendRes.text();
      console.error("Resend error:", errorText);
      return new Response(
        JSON.stringify({
          error: "E-Mail konnte nicht gesendet werden",
          details: errorText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const resumeResult = await resendRes.json();

    try {
      await supabase.from("admin_emails").insert({
        sender_email: "info@kuechenwert24.de",
        sender_name: "KuechenWert",
        recipient_email: recipientEmail,
        subject,
        body_html: html,
        body_text: "",
        email_type: "wizard_resume",
        direction: "outbound",
        status: "sent",
        resend_id: resumeResult?.id || null,
        is_read: true,
      });
    } catch (logErr) {
      console.error("Failed to log email in admin_emails:", logErr);
    }

    await supabase
      .from("wizard_sessions")
      .update({
        resume_email_sent_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Wiederaufnahme-E-Mail an ${recipientEmail} gesendet`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in send-wizard-resume-email:", error);
    return new Response(
      JSON.stringify({ error: "Interner Serverfehler" }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      },
    );
  }
};

serve(handler);
