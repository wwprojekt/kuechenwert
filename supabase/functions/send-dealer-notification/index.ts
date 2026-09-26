import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, infoBox, detailRow, paragraph, button, list, customerBadge } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import { BRAND } from '../_shared/brand-config.ts';

const PROJECTS_URL = `${BRAND.baseUrl}/dashboard/projekte`;
const SERVICE_AREA_URL = `${BRAND.baseUrl}/dashboard/projekte/einstellungen`;

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

    // ─── Dedup for "approved" welcome email (defense-in-depth) ────────────────
    // Primary safety: approve_dealer_application RPC uses WHERE status='pending'
    // so only the first admin click wins. This check is a belt-and-suspenders
    // guard against any other accidental double-invocation (retry, queue, etc).
    if (type === 'approved') {
      try {
        const { data: existing } = await supabase
          .from('admin_emails')
          .select('id')
          .eq('recipient_email', email)
          .eq('email_type', 'dealer_approved')
          .eq('status', 'sent')
          .limit(1)
          .maybeSingle();
        if (existing) {
          console.log(`[send-dealer-notification] Duplicate 'approved' for ${email} suppressed (already sent id=${existing.id})`);
          return new Response(
            JSON.stringify({ ok: true, deduped: true, message: 'Welcome email already sent' }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
          );
        }
      } catch (dedupErr) {
        console.error('[send-dealer-notification] Dedup check failed (continuing):', dedupErr);
      }
    }

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
      site_name: BRAND.name,
      site_description: BRAND.tagline,
      contact_email: BRAND.supportEmail,
      support_phone: '0511 / 51532476',
    };

    const costNote = 'Registrierung, Projekt-Börse und Angebotsabgabe sind kostenlos. Kosten entstehen nur, wenn Sie einen Kundenkontakt freiwillig vorab freischalten (Preis wird vor dem Kauf angezeigt) oder wenn Kund:innen Ihr Angebot annehmen (Vermittlungsprovision, gestaffelt nach Auftragswert).';

    let subject = "";
    let emailContent = "";

    switch (type) {
      case "application_received":
        subject = `Ihre Studio-Registrierung bei ${BRAND.name}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${paragraph(`vielen Dank für Ihre Registrierung als Partner-Studio bei <strong>${settingsData.site_name}</strong>. Wir freuen uns auf die Zusammenarbeit.`)}
          ${infoBox('Ihre Registrierung', `
            ${detailRow('Unternehmen', companyName)}
            ${detailRow('Status', '<span style="color: #b45309; font-weight: 700;">In Prüfung</span>')}
            ${paragraph('Wir prüfen Ihre Angaben und melden uns per E-Mail, sobald Ihr Studio freigeschaltet ist.')}
          `, 'info', settingsData)}
          ${confirmationUrl ? `
            ${infoBox('E-Mail-Adresse bestätigen', `
              ${paragraph('Bitte bestätigen Sie Ihre E-Mail-Adresse über den folgenden Button. Erst danach können wir Ihre Registrierung bearbeiten.')}
            `, 'warning', settingsData)}
            ${button('E-Mail-Adresse bestätigen', confirmationUrl, settingsData)}
            ${paragraph('<small style="color: #6b7280;">Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br/><a href="' + confirmationUrl + '" style="color: #336753; word-break: break-all;">' + confirmationUrl + '</a></small>')}
          ` : ''}
          ${infoBox('Wie geht es weiter?', `
            ${list([
              'Wir prüfen Ihre Unterlagen (in der Regel 1\u20132 Werktage).',
              'Nach der Freischaltung legen Sie Ihr Einzugsgebiet fest (PLZ und Umkreis).',
              'In der Projekt-Börse sehen Sie anonymisierte Küchenprojekte aus Ihrer Region \u2013 mit Maßen, Wünschen und Preisrahmen.',
              'Sie geben Angebote ab; die Kund:innen vergleichen und wählen das beste Angebot.',
            ])}
          `, 'default', settingsData)}
          ${paragraph(costNote)}
          ${paragraph('Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.')}
        `;
        break;

      case "approved": {
        subject = `Ihr Studio ist bei ${BRAND.name} freigeschaltet`;

        let openProjectsHtml = '';
        try {
          const { count: openProjects } = await supabase
            .from('lead_auctions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active');
          if (openProjects && openProjects > 0) {
            openProjectsHtml = infoBox(
              openProjects === 1
                ? 'Gerade sucht 1 Küchenprojekt ein Studio'
                : `Gerade suchen ${openProjects} Küchenprojekte ein Studio`,
              paragraph('Nach dem Festlegen Ihres Einzugsgebiets sehen Sie, welche davon in Ihrer Region liegen.'),
              'info',
              settingsData
            );
          }
        } catch (err) {
          console.error('Failed to count open projects for approval email:', err);
        }

        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Willkommen an Bord! Ihr Studio wurde geprüft und freigeschaltet.</strong>')}
          ${infoBox(`Willkommen bei ${settingsData.site_name}`, `
            ${detailRow('Unternehmen', companyName)}
            ${custNum ? detailRow('Ihre Kundennummer', `<strong style="font-size: 16px;">${custNum}</strong>`) : ''}
            ${paragraph('Ab sofort sehen Sie anonymisierte Küchenprojekte aus Ihrer Region und können Angebote abgeben.')}
          `, 'success', settingsData)}
          ${openProjectsHtml}
          ${infoBox('So starten Sie', `
            ${list([
              `<strong>Einzugsgebiet festlegen</strong> &ndash; PLZ und Umkreis, in dem Sie Küchen planen und montieren (<a href="${SERVICE_AREA_URL}" style="color: #336753;">jetzt festlegen</a>).`,
              '<strong>Projekte prüfen</strong> &ndash; Raumfoto, Maße, Wunschkonfiguration und Preisrahmen der Kund:innen.',
              '<strong>Angebot abgeben</strong> &ndash; Preis, Lieferzeit und Leistungen eintragen. Die Kund:innen vergleichen und wählen.',
              '<strong>Zuschlag erhalten</strong> &ndash; Sie bekommen die Kontaktdaten und vereinbaren Aufmaß und Detailplanung.',
            ])}
          `, 'default', settingsData)}
          ${button('Zur Projekt-Börse', PROJECTS_URL, settingsData)}
          ${paragraph(costNote)}
        `;
        break;
      }

      case "rejected":
        subject = `Ihre Studio-Registrierung bei ${BRAND.name}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${paragraph(`vielen Dank für Ihr Interesse an einer Partnerschaft mit ${settingsData.site_name}.`)}
          ${infoBox('Ihre Registrierung', `
            ${detailRow('Unternehmen', companyName)}
            ${paragraph('Nach sorgfältiger Prüfung können wir Ihr Studio derzeit leider nicht freischalten.')}
            ${rejectionReason ? paragraph(`<strong>Grund:</strong> ${rejectionReason}`) : ''}
          `, 'warning', settingsData)}
          ${paragraph('Sie können sich jederzeit erneut registrieren, zum Beispiel mit ergänzten Unterlagen. Bei Fragen stehen wir Ihnen gerne zur Verfügung.')}
        `;
        break;

      case "role_upgrade":
        subject = `Ihr Konto wird zum Studio-Konto bei ${BRAND.name}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${paragraph(`gute Nachrichten: Unser Team hat Ihr Konto bei ${settingsData.site_name} für die Umstellung auf ein Studio-Konto vorgemerkt.`)}
          ${infoBox('Studio-Konto', `
            ${companyName ? detailRow('Unternehmen', companyName) : ''}
            ${paragraph('Wir prüfen den Antrag. Nach der Freischaltung sehen Sie Küchenprojekte aus Ihrer Region und können Angebote abgeben.')}
          `, 'info', settingsData)}
          ${paragraph('Im Dashboard sehen Sie den Status und können fehlende Unterlagen ergänzen.')}
          ${button('Zum Dashboard', `${BRAND.baseUrl}/dashboard`, settingsData)}
          ${paragraph('Die Prüfung dauert in der Regel 1\u20132 Werktage.')}
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
        from: `${settingsData.site_name} <${BRAND.supportEmail}>`,
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
        sender_email: BRAND.supportEmail,
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
