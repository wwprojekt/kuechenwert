import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph } from '../_shared/email-builder.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Geplanter E-Mail-Versand – wird per Cron-Job alle 5 Minuten aufgerufen.
 * Versendet E-Mails deren scheduled_at Zeitpunkt erreicht ist.
 */

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  // ─── Auth check: must be service_role (cron/internal) or authenticated admin ───
  const authResult = await checkServiceRoleOrAdmin(req, { 'Content-Type': 'application/json' });
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    // Find scheduled emails that are due
    const { data: emails, error: fetchError } = await supabase
      .from('admin_emails')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ message: "No scheduled emails due", count: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch site settings
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'info@caravanwert.de',
      support_phone: '+49 511 51532476',
    };

    let sent = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        // Build HTML with branding
        const html = buildEmailLayout(settingsData, email.subject, email.body_html || paragraph(email.body_text || ''));

        const emailPayload: any = {
          from: `${email.sender_name || settingsData.site_name} <${email.sender_email || 'info@caravanwert.de'}>`,
          to: [email.recipient_email],
          subject: email.subject,
          html,
          reply_to: 'info@caravanwert.de',
        };

        // Add CC/BCC if present
        if (email.cc) emailPayload.cc = Array.isArray(email.cc) ? email.cc : [email.cc];
        if (email.bcc) emailPayload.bcc = Array.isArray(email.bcc) ? email.bcc : [email.bcc];

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify(emailPayload),
        });

        if (!emailResponse.ok) {
          const error = await emailResponse.text();
          throw new Error(error);
        }

        const resendResult = await emailResponse.json();

        // Update status to sent
        await supabase
          .from('admin_emails')
          .update({
            status: 'sent',
            resend_id: resendResult.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id);

        sent++;
      } catch (err: any) {
        console.error(`Failed to send scheduled email ${email.id}:`, err.message);

        // Mark as failed
        await supabase
          .from('admin_emails')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id);

        failed++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Scheduled emails processed: sent=${sent}, failed=${failed}`,
      sent,
      failed,
    }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error processing scheduled emails:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
