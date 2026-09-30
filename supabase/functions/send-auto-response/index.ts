import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph, greeting, infoBox, list } from '../_shared/email-builder.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import { BRAND, BRAND_LEGAL } from '../_shared/brand-config.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Auto-Responder – wird vom inbound-webhook aufgerufen.
 * Sendet eine automatische Bestätigung, wenn eine E-Mail an die Support-Adresse eingeht.
 */

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const authResult = await checkServiceRoleOrAdmin(req);
    if (!authResult.authorized) return authResult.response;
    const { sender_email, sender_name } = await req.json();

    if (!sender_email) {
      return new Response(JSON.stringify({ error: "Missing sender_email" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // Don't auto-respond to noreply addresses or our own emails
    const skipPatterns = ['noreply', 'no-reply', 'mailer-daemon', 'postmaster', BRAND.domain];
    if (skipPatterns.some(p => sender_email.toLowerCase().includes(p))) {
      return new Response(JSON.stringify({ message: "Skipped auto-response for system address" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if we already sent an auto-response to this address in the last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentAutoReply } = await supabase
      .from('admin_emails')
      .select('id')
      .eq('recipient_email', sender_email)
      .eq('email_type', 'auto_response')
      .gte('created_at', oneDayAgo)
      .limit(1);

    if (recentAutoReply && recentAutoReply.length > 0) {
      return new Response(JSON.stringify({ message: "Auto-response already sent within 24h" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch site settings
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    const settingsData = settings || {
      site_name: BRAND.name,
      site_description: BRAND.tagline,
      contact_email: BRAND.supportEmail,
      support_phone: BRAND_LEGAL.phone,
    };

    const displayName = sender_name?.split(' ')[0] || undefined;

    const subject = `Eingangsbestätigung – Ihre Nachricht an ${settingsData.site_name}`;
    const emailContent = `
      ${greeting(displayName)}
      ${paragraph(`Vielen Dank f&uuml;r Ihre Nachricht an <strong>${settingsData.site_name}</strong>. Wir haben Ihre E-Mail erhalten und werden uns schnellstm&ouml;glich bei Ihnen melden.`)}
      ${infoBox('Unser Service-Versprechen', `
        ${paragraph('In der Regel antworten wir innerhalb von <strong>24 Stunden</strong> an Werktagen (Mo&ndash;Fr, 10:00&ndash;18:00 Uhr).')}
      `, 'info', settingsData)}
      ${paragraph('In der Zwischenzeit finden Sie Antworten auf h&auml;ufige Fragen m&ouml;glicherweise in unserem FAQ-Bereich:')}
      ${list([
        `<a href="${BRAND.baseUrl}/faq" style="color: #336753;">H&auml;ufig gestellte Fragen</a>`,
        `<a href="${BRAND.baseUrl}/formular" style="color: #336753;">Angebote f&uuml;r Ihre Traumk&uuml;che einholen</a>`,
        `<a href="${BRAND.baseUrl}/funnel/b" style="color: #336753;">Bestehendes K&uuml;chen-Angebot unterbieten lassen</a>`,
        `<a href="${BRAND.baseUrl}/haendler" style="color: #336753;">Als K&uuml;chenstudio mitmachen</a>`,
      ])}
      ${paragraph('<em>Dies ist eine automatische Best&auml;tigung. Bitte antworten Sie nicht auf diese E-Mail.</em>')}
    `;

    const html = buildEmailLayout(settingsData, subject, emailContent);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <${BRAND.supportEmail}>`,
        to: [sender_email],
        subject,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const resendResult = await emailResponse.json();

    // Log in admin_emails
    await supabase.from('admin_emails').insert({
      sender_email: BRAND.supportEmail,
      sender_name: settingsData.site_name,
      recipient_email: sender_email,
      recipient_name: sender_name || null,
      subject,
      body_html: emailContent,
      email_type: 'auto_response',
      direction: 'outbound',
      status: 'sent',
      resend_id: resendResult.id,
      is_read: true,
    });

    console.log(`Auto-response sent to ${sender_email}`);

    return new Response(JSON.stringify({ success: true, resend_id: resendResult.id }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error sending auto-response:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
