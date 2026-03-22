import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { buildEmailLayout, paragraph } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type BroadcastGroup = 'all' | 'customers' | 'dealers' | 'verified_dealers' | 'newsletter' | 'active_bidders' | 'custom';

interface BroadcastRequest {
  subject: string;
  body_html: string;
  group: BroadcastGroup;
  custom_emails?: string[];
  test_mode?: boolean;
  test_email?: string;
}

async function getRecipients(supabase: any, group: BroadcastGroup, customEmails?: string[]): Promise<{ email: string; name: string | null; id: string | null }[]> {
  switch (group) {
    case 'all': {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .not('email', 'is', null);
      return (data || []).map((p: any) => ({
        email: p.email,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
        id: p.id,
      }));
    }
    case 'customers': {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .eq('account_type', 'private')
        .not('email', 'is', null);
      return (data || []).map((p: any) => ({
        email: p.email,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
        id: p.id,
      }));
    }
    case 'dealers': {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, company_name')
        .eq('account_type', 'dealer')
        .not('email', 'is', null);
      return (data || []).map((p: any) => ({
        email: p.email,
        name: p.company_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
        id: p.id,
      }));
    }
    case 'verified_dealers': {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, company_name')
        .eq('account_type', 'dealer')
        .eq('is_verified', true)
        .not('email', 'is', null);
      return (data || []).map((p: any) => ({
        email: p.email,
        name: p.company_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
        id: p.id,
      }));
    }
    case 'newsletter': {
      const { data: prefs } = await supabase
        .from('user_notification_preferences')
        .select('user_id')
        .eq('newsletter_enabled', true);
      if (!prefs || prefs.length === 0) return [];
      const userIds = prefs.map((p: any) => p.user_id);
      const { data } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds)
        .not('email', 'is', null);
      return (data || []).map((p: any) => ({
        email: p.email,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
        id: p.id,
      }));
    }
    case 'active_bidders': {
      // Users who have placed bids in the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: bids } = await supabase
        .from('bids')
        .select('bidder_id')
        .gte('created_at', thirtyDaysAgo);
      if (!bids || bids.length === 0) return [];
      const uniqueIds = [...new Set(bids.map((b: any) => b.bidder_id))];
      const { data } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', uniqueIds)
        .not('email', 'is', null);
      return (data || []).map((p: any) => ({
        email: p.email,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
        id: p.id,
      }));
    }
    case 'custom': {
      return (customEmails || []).map(email => ({ email, name: null, id: null }));
    }
    default:
      return [];
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };

  try {
    // Auth: Admin-only
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some((r: any) => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403, headers });
    }

    const body: BroadcastRequest = await req.json();
    const { subject, body_html, group, custom_emails, test_mode, test_email } = body;

    if (!subject || !body_html || !group) {
      return new Response(JSON.stringify({ error: 'Missing required fields: subject, body_html, group' }), { status: 400, headers });
    }

    // Fetch site settings
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'kontakt@caravanwert.de',
      support_phone: '+49 511 51532476',
    };

    // Test mode: send only to test_email
    if (test_mode && test_email) {
      const unsubscribeNote = paragraph(`<span style="font-size: 12px; color: #9ca3af;">Dies ist eine Test-E-Mail. Im echten Versand wird hier ein Abmelde-Link angezeigt.</span>`);
      const emailContent = `${body_html}${unsubscribeNote}`;
      const html = buildEmailLayout(settingsData, subject, emailContent);

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `${settingsData.site_name} <info@caravanwert.de>`,
          to: [test_email],
          subject: `[TEST] ${subject}`,
          html,
          reply_to: 'info@caravanwert.de',
        }),
      });

      if (!emailResponse.ok) {
        const error = await emailResponse.text();
        throw new Error(`Resend API error: ${error}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Test email sent to ${test_email}`,
        total_recipients: 1,
      }), { status: 200, headers });
    }

    // Get recipients
    const recipients = await getRecipients(supabase, group, custom_emails);

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients found for this group' }), { status: 400, headers });
    }

    // Generate broadcast_id for grouping
    const broadcastId = crypto.randomUUID();

    // Build email HTML with unsubscribe link
    const unsubscribeNote = paragraph(`<span style="font-size: 12px; color: #9ca3af;">Wenn Sie diese E-Mails nicht mehr erhalten m&ouml;chten, k&ouml;nnen Sie sich in Ihrem <a href="https://caravanwert.de/dashboard" style="color: #1f8aa2;">Profil</a> abmelden.</span>`);
    const emailContent = `${body_html}${unsubscribeNote}`;
    const html = buildEmailLayout(settingsData, subject, emailContent);

    // Send in batches of 10 (Resend rate limit: 10/sec on free plan)
    const BATCH_SIZE = 10;
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      const promises = batch.map(async (recipient) => {
        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: `${settingsData.site_name} <info@caravanwert.de>`,
              to: [recipient.email],
              subject,
              html,
              reply_to: 'info@caravanwert.de',
            }),
          });

          if (!emailResponse.ok) {
            const error = await emailResponse.text();
            throw new Error(error);
          }

          const resendResult = await emailResponse.json();

          // Log each email
          await supabase.from('admin_emails').insert({
            sender_email: 'info@caravanwert.de',
            sender_name: settingsData.site_name,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            recipient_id: recipient.id,
            subject,
            body_html,
            body_text: body_html.replace(/<[^>]*>/g, ''),
            email_type: 'broadcast',
            direction: 'outbound',
            broadcast_group: group,
            broadcast_id: broadcastId,
            status: 'sent',
            resend_id: resendResult.id,
            sent_by: user.id,
            is_read: true,
          });

          sent++;
        } catch (err: any) {
          failed++;
          errors.push(`${recipient.email}: ${err.message}`);
          console.error(`Failed to send to ${recipient.email}:`, err.message);
        }
      });

      await Promise.all(promises);

      // Rate limit pause between batches
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Broadcast completed: ${sent} sent, ${failed} failed`,
      broadcast_id: broadcastId,
      total_recipients: recipients.length,
      sent,
      failed,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    }), { status: 200, headers });

  } catch (error: any) {
    console.error("Error sending broadcast:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
};

serve(handler);
