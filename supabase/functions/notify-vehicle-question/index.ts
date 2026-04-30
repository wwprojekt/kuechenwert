import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "info@kuechenwert24.de";

/**
 * Sendet eine Admin-Benachrichtigung wenn eine neue Fahrzeugfrage eingereicht wird.
 * Keine Auth-Prüfung nötig, da nur eine Benachrichtigung an den Admin gesendet wird.
 * Rate-Limiting wird über die Supabase RLS-Policy und Client-seitige Validierung sichergestellt.
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };

  try {
    const { vehicle_title, questioner_name, questioner_email, question } = await req.json();

    if (!vehicle_title || !questioner_email || !question) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers });
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not set');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500, headers });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch site settings for email branding
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    const settingsData = settings || {
      site_name: 'KuechenWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'info@kuechenwert24.de',
      support_phone: '+49 511 51532476',
    };

    // Get admin emails from user_roles
    const recipients: string[] = [];
    try {
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      if (adminRoles && adminRoles.length > 0) {
        const adminIds = adminRoles.map((r: any) => r.user_id);
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('email')
          .in('id', adminIds);
        if (adminProfiles) {
          for (const p of adminProfiles) {
            if (p.email) recipients.push(p.email);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching admin emails:', e);
    }

    if (recipients.length === 0) {
      recipients.push(ADMIN_EMAIL);
    }

    // Build notification email
    const emailContent = `
      <p>Eine neue Fahrzeugfrage wurde eingereicht:</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; width: 120px;">Fahrzeug</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${vehicle_title}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Name</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${questioner_name || 'Nicht angegeben'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">E-Mail</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><a href="mailto:${questioner_email}" style="color: #1f8aa2;">${questioner_email}</a></td>
        </tr>
      </table>
      <blockquote style="border-left: 3px solid #1f8aa2; padding: 12px 16px; margin: 16px 0; background-color: #f8fafc; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: #374151; font-style: italic;">${question}</p>
      </blockquote>
      <p>Bitte beantworten Sie die Frage im <a href="https://kuechenwert24.de/admin/questions" style="color: #1f8aa2; font-weight: bold;">Admin-Bereich → Fahrzeugfragen</a>.</p>
    `;

    const subject = `[Neue Fahrzeugfrage] ${vehicle_title}`;
    const html = buildEmailLayout(settingsData, subject, emailContent);

    // Send via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} System <info@kuechenwert24.de>`,
        to: recipients,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send admin notification:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to send notification' }), { status: 500, headers });
    }

    const result = await response.json();
    console.log('Vehicle question notification sent to:', recipients.join(', '));

    // Log in admin_emails so the Email Center shows the notification.
    // Failure to log must not break the user-visible API response.
    try {
      await supabase.from('admin_emails').insert({
        sender_email: 'info@kuechenwert24.de',
        sender_name: `${settingsData.site_name} System`,
        recipient_email: recipients.join(', '),
        subject,
        body_html: html,
        body_text: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        email_type: 'vehicle_question',
        direction: 'outbound',
        status: 'sent',
        resend_id: result.id,
        is_read: true,
      });
    } catch (logErr) {
      console.error('Failed to log vehicle question email in admin_emails:', logErr);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Admin notification sent',
      resend_id: result.id,
    }), { status: 200, headers });

  } catch (error: any) {
    console.error("Error in notify-vehicle-question:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
};

serve(handler);
