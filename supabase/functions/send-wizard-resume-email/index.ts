import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import {
  buildEmailLayout,
  infoBox,
  detailRow,
  paragraph,
  button,
} from "../_shared/email-builder.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ResumeEmailRequest {
  sessionId: string;
  customMessage?: string;
}

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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  try {
    const { sessionId, customMessage }: ResumeEmailRequest = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId ist erforderlich" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load wizard session
    const { data: session, error: sessionError } = await supabase
      .from("wizard_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Wizard-Session nicht gefunden" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Determine recipient email
    const recipientEmail = session.customer_email;
    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "Keine E-Mail-Adresse für diese Session vorhanden" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Load site settings
    const { data: settings } = await supabase
      .from("site_settings")
      .select("*")
      .single();

    const settingsData = settings || {
      site_name: "CaravanWert",
      site_description: "Deutschlands führende Wohnmobil-Handelsplattform",
      contact_email: "info@caravanwert.de",
      support_phone: "0800 123 456 78",
    };

    // Build resume URL
    const currentStep = session.current_step || 1;
    const resumeUrl = `https://caravanwert.de/verkaufen/wizard?step=${currentStep}`;

    // Extract vehicle info from form_data
    const formData = session.form_data || {};
    const vehicleName = [
      formData.manufacturer,
      formData.model,
      formData.year ? `(${formData.year})` : "",
    ].filter(Boolean).join(" ") || "Ihr Wohnmobil";

    const customerName = session.customer_name || "Kunde";
    const stepName = STEP_NAMES[currentStep] || `Schritt ${currentStep}`;
    const totalSteps = session.total_steps || 10;
    const progressPercent = Math.round((currentStep / totalSteps) * 100);

    // Build progress bar HTML
    const progressBarHtml = `
      <div style="background-color: #e9ecef; border-radius: 10px; height: 20px; margin: 15px 0; overflow: hidden;">
        <div style="background-color: #195d3e; height: 100%; width: ${progressPercent}%; border-radius: 10px; transition: width 0.3s;"></div>
      </div>
      <p style="text-align: center; font-size: 14px; color: #666; margin: 5px 0;">
        ${progressPercent}% abgeschlossen – Schritt ${currentStep} von ${totalSteps}
      </p>
    `;

    // Build completed steps list
    const completedSteps: string[] = [];
    for (let i = 1; i < currentStep; i++) {
      completedSteps.push(`<span style="color: #195d3e;">&#10003;</span> ${STEP_NAMES[i] || `Schritt ${i}`}`);
    }

    // Build email content
    let content = "";

    content += paragraph(`Hallo ${customerName},`);

    content += paragraph(
      `wir haben bemerkt, dass Sie die Inserierung Ihres Wohnmobils auf CaravanWert noch nicht abgeschlossen haben. ` +
      `Keine Sorge – Ihre bisherigen Eingaben sind gespeichert und Sie können jederzeit genau dort weitermachen, wo Sie aufgehört haben.`
    );

    // Custom message from admin
    if (customMessage) {
      content += infoBox(
        "Nachricht von unserem Team",
        paragraph(customMessage),
        "info",
        settingsData
      );
    }

    // Vehicle & Progress info
    content += infoBox(
      `Ihr Inserat: ${vehicleName}`,
      `${detailRow("Aktueller Schritt", stepName)}
       ${detailRow("Fortschritt", `${progressPercent}%`)}
       ${progressBarHtml}
       ${completedSteps.length > 0 ? `
         <p style="margin: 15px 0 5px; font-size: 14px; font-weight: bold; color: #333;">Bereits ausgefüllt:</p>
         <p style="margin: 0; font-size: 14px; line-height: 24px; color: #555;">
           ${completedSteps.join("<br/>")}
         </p>
       ` : ""}`,
      "default",
      settingsData
    );

    content += button("Jetzt weitermachen", resumeUrl, settingsData);

    content += paragraph(
      `<strong>Warum jetzt abschließen?</strong>`
    );

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

    const emailHtml = buildEmailLayout(
      settingsData,
      `Ihr Wohnmobil-Inserat wartet auf Sie – ${vehicleName}`,
      content
    );

    // Send email via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `CaravanWert <info@caravanwert.de>`,
        to: [recipientEmail],
        subject: `Ihr Wohnmobil-Inserat wartet – machen Sie jetzt weiter!`,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errorText = await resendRes.text();
      console.error("Resend error:", errorText);
      return new Response(
        JSON.stringify({ error: "E-Mail konnte nicht gesendet werden", details: errorText }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Update session: mark email sent
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
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-wizard-resume-email:", error);
    return new Response(
      JSON.stringify({ error: "Interner Serverfehler" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
