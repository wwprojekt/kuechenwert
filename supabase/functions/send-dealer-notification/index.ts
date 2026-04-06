import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, infoBox, detailRow, paragraph, button, list, customerBadge } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface DealerEmailRequest {
  email: string;
  name: string;
  type: "application_received" | "approved" | "rejected" | "role_upgrade";
  companyName: string;
  rejectionReason?: string;
  customerNumber?: string;
  confirmationUrl?: string; // Magic-Link für E-Mail-Bestätigung (nur bei application_received)
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  // ─── Auth check: must be service_role (cron/internal) or authenticated admin ───
  const authResult = await checkServiceRoleOrAdmin(req, getCorsHeaders(req));
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const { email, name, type, companyName, rejectionReason, customerNumber: passedCustNum, confirmationUrl }: DealerEmailRequest = await req.json();

    console.log(`Sending ${type} notification to dealer:`, email);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch customer number if not passed
    let custNum = passedCustNum || '';
    if (!custNum) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('customer_number')
        .eq('email', email)
        .maybeSingle();
      custNum = profile?.customer_number || '';
    }

    // Fetch site settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .single();

    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'kontakt@caravanwert.de',
      support_phone: '0800 123 456 78',
    };

    let subject = "";
    let emailContent = "";

    switch (type) {
      case "application_received":
        subject = "Ihre Händler-Bewerbung bei CaravanWert";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${paragraph(`Vielen Dank für Ihre Bewerbung als Händler bei <strong>${settingsData.site_name}</strong>! Wir freuen uns über Ihr Interesse an einer Partnerschaft.`)}
          ${infoBox('Ihre Bewerbung', `
            ${detailRow('Unternehmen', companyName)}
            ${detailRow('Status', '<span style="color: #f59e0b; font-weight: 700;">In Prüfung</span>')}
            ${paragraph('Ihre Bewerbung wird derzeit von unserem Team sorgfältig geprüft. Sie erhalten eine Benachrichtigung per E-Mail, sobald die Prüfung abgeschlossen ist.')}
          `, 'info', settingsData)}
          ${confirmationUrl ? `
            ${infoBox('E-Mail-Adresse bestätigen', `
              ${paragraph('Bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie auf den folgenden Button klicken. Dies ist erforderlich, damit wir Ihre Bewerbung bearbeiten können.')}
            `, 'warning', settingsData)}
            ${button('E-Mail-Adresse bestätigen', confirmationUrl, settingsData)}
            ${paragraph('<small style="color: #6b7280;">Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br/><a href="' + confirmationUrl + '" style="color: #1f8aa2; word-break: break-all;">' + confirmationUrl + '</a></small>')}
          ` : ''}
          ${infoBox('Wie geht es weiter?', `
            ${list([
              'Unser Team prüft Ihre Unterlagen (1\u20132 Werktage)',
              'Sie erhalten eine E-Mail mit dem Ergebnis der Prüfung',
              'Nach Genehmigung erhalten Sie sofort Zugang zum Händler-Portal',
              'Sie können dann auf Wohnmobile bieten und exklusive Angebote nutzen'
            ])}
          `, 'default', settingsData)}
          ${paragraph('Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.')}
        `;
        break;

      case "approved":
        subject = "Willkommen als Händler bei CaravanWert!";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph(`<strong>Herzlichen Glückwunsch! Ihre Bewerbung als Händler wurde genehmigt.</strong>`)}
          ${infoBox(`Willkommen bei ${settingsData.site_name}!`, `
            ${detailRow('Unternehmen', companyName)}
            ${custNum ? detailRow('Ihre Kundennummer', `<strong style="color: #1f8aa2; font-size: 16px;">${custNum}</strong>`) : ''}
            ${paragraph('Sie haben jetzt Zugriff auf unser Händler-Portal und können auf Wohnmobile bieten.')}
          `, 'success', settingsData)}
          ${infoBox('Nächste Schritte', `
            ${list([
              'Loggen Sie sich in Ihr Händler-Portal ein',
              'Vervollständigen Sie Ihr Unternehmensprofil',
              'Entdecken Sie aktuelle Auktionen',
              'Geben Sie Ihr erstes Gebot ab'
            ])}
          `, 'default', settingsData)}
          ${button('Zum Händler-Portal', 'https://caravanwert.de/dashboard', settingsData)}
        `;
        break;

      case "rejected":
        subject = "Händler-Bewerbung - Rückmeldung";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${paragraph(`Vielen Dank für Ihr Interesse an einer Partnerschaft mit ${settingsData.site_name}.`)}
          ${infoBox('Ihre Bewerbung', `
            ${detailRow('Unternehmen', companyName)}
            ${paragraph('Nach sorgfältiger Prüfung können wir Ihre Bewerbung derzeit leider nicht genehmigen.')}
            ${rejectionReason ? paragraph(`<strong>Grund:</strong> ${rejectionReason}`) : ''}
          `, 'warning', settingsData)}
          ${paragraph('Sie können sich jederzeit erneut bewerben. Bei Fragen stehen wir Ihnen gerne zur Verfügung.')}
        `;
        break;

      case "role_upgrade":
        subject = "Ihr Konto wird zum Händlerkonto aufgewertet";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${paragraph(`Gute Nachrichten! Unser Admin-Team hat Ihr Konto bei ${settingsData.site_name} für ein Upgrade zum Händlerkonto vorgemerkt.`)}
          ${infoBox('Händler-Upgrade', `
            ${companyName ? detailRow('Unternehmen', companyName) : ''}
            ${paragraph('Ihr Antrag wird derzeit geprüft. Sobald er genehmigt wurde, erhalten Sie vollen Zugriff auf das Händler-Portal und können auf Wohnmobile bieten.')}
          `, 'info', settingsData)}
          ${paragraph('Bitte loggen Sie sich in Ihr Dashboard ein, um den Status Ihres Antrags zu verfolgen. Dort können Sie auch weitere Unterlagen ergänzen.')}
          ${button('Zum Dashboard', 'https://caravanwert.de/dashboard', settingsData)}
          ${paragraph('Die Prüfung dauert in der Regel 1-2 Werktage.')}
        `;
        break;
    }

    const html = buildEmailLayout(settingsData, subject, emailContent);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <info@caravanwert.de>`,
        to: [email],
        subject,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const result = await emailResponse.json();
    console.log("Email sent successfully:", result);

    // Log in admin_emails for System tab
    try {
      await supabase.from('admin_emails').insert({
        sender_email: 'info@caravanwert.de',
        sender_name: settingsData.site_name,
        recipient_email: email,
        recipient_name: name || null,
        subject,
        body_html: html,
        body_text: '',
        email_type: `dealer_${type}`,
        direction: 'outbound',
        status: 'sent',
        resend_id: result?.id || null,
        is_read: true,
      });
    } catch (logErr) {
      console.error('Failed to log email in admin_emails:', logErr);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  } catch (error: any) {
    console.error("Error sending dealer notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
};

serve(handler);
