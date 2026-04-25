import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
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
  include_unsubscribe?: boolean;
  // Wenn true, werden zusaetzlich zum `broadcast_emails_enabled`-Opt-Out
  // auch Nutzer mit `promotional_emails=false` ausgefiltert. Gedacht fuer
  // Werbe-/Promo-Kampagnen (Rabatte, neue Features, Partnerangebote).
  // Default: false (reine Informations-Broadcasts / System-Updates gehen
  // an alle, die `broadcast_emails_enabled` nicht abgewaehlt haben).
  is_promotional?: boolean;
}

async function getRecipients(
  supabase: any,
  group: BroadcastGroup,
  customEmails?: string[],
  isPromotional?: boolean,
): Promise<{ email: string; name: string | null; id: string | null }[]> {
  // First, get users who have unsubscribed from broadcasts
  const { data: unsubscribed } = await supabase
    .from('user_notification_preferences')
    .select('user_id')
    .eq('broadcast_emails_enabled', false);
  const unsubscribedIds = new Set((unsubscribed || []).map((u: any) => u.user_id));

  // Werbe-Kampagne: zusaetzlicher Opt-Out-Check auf promotional_emails.
  // Gilt NICHT fuer transactional-aehnliche Broadcasts (System-Updates,
  // Sicherheits-Hinweise), damit diese auch User erreichen, die Werbung
  // deaktiviert haben.
  let promoUnsubscribedIds = new Set<string>();
  if (isPromotional) {
    const { data: promoOptOut } = await supabase
      .from('user_notification_preferences')
      .select('user_id')
      .eq('promotional_emails', false);
    promoUnsubscribedIds = new Set((promoOptOut || []).map((u: any) => u.user_id));
  }

  let recipients: { email: string; name: string | null; id: string | null }[] = [];

  switch (group) {
    case 'all': {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .not('email', 'is', null);
      recipients = (data || []).map((p: any) => ({
        email: p.email,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
        id: p.id,
      }));
      break;
    }
    case 'customers': {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .eq('account_type', 'private')
        .not('email', 'is', null);
      recipients = (data || []).map((p: any) => ({
        email: p.email,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
        id: p.id,
      }));
      break;
    }
    case 'dealers': {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, company_name')
        .eq('account_type', 'dealer')
        .not('email', 'is', null);
      recipients = (data || []).map((p: any) => ({
        email: p.email,
        name: p.company_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
        id: p.id,
      }));
      break;
    }
    case 'verified_dealers': {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, company_name')
        .eq('account_type', 'dealer')
        .eq('is_verified', true)
        .not('email', 'is', null);
      recipients = (data || []).map((p: any) => ({
        email: p.email,
        name: p.company_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
        id: p.id,
      }));
      break;
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
      recipients = (data || []).map((p: any) => ({
        email: p.email,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
        id: p.id,
      }));
      break;
    }
    case 'active_bidders': {
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
      recipients = (data || []).map((p: any) => ({
        email: p.email,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
        id: p.id,
      }));
      break;
    }
    case 'custom': {
      return (customEmails || []).map(email => ({ email, name: null, id: null }));
    }
    default:
      return [];
  }

  // Filter out unsubscribed users (except for custom lists).
  // Custom-Lists bypassen jeden Opt-Out, weil der Admin explizit Emails
  // eintraegt (z. B. fuer Wiederherstellungs-Mails nach Bounce).
  if (group !== 'custom') {
    recipients = recipients.filter(r => !r.id || !unsubscribedIds.has(r.id));
    if (isPromotional) {
      recipients = recipients.filter(r => !r.id || !promoUnsubscribedIds.has(r.id));
    }
  }

  return recipients;
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
    const { subject, body_html, group, custom_emails, test_mode, test_email, include_unsubscribe = true, is_promotional = false } = body;

    if (!subject || !body_html || !group) {
      return new Response(JSON.stringify({ error: 'Missing required fields: subject, body_html, group' }), { status: 400, headers });
    }

    // Fetch site settings
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'info@caravanwert.de',
      support_phone: '+49 511 51532476',
    };

    // Test mode: send only to test_email
    if (test_mode && test_email) {
      let emailContent = body_html;
      if (include_unsubscribe) {
        emailContent += paragraph(`<span style="font-size: 11px; color: #9ca3af;">Sie erhalten diese E-Mail, weil Sie bei CaravanWert registriert sind. <a href="https://caravanwert.de/dashboard/profile" style="color: #1f8aa2; text-decoration: underline;">E-Mail-Einstellungen verwalten</a> | <a href="https://caravanwert.de/dashboard/profile" style="color: #1f8aa2; text-decoration: underline;">Von Rundmails abmelden</a></span>`);
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
          to: [test_email],
          subject: `[TEST] ${subject}`,
          html,
          reply_to: 'info@caravanwert.de',
          headers: {
            'List-Unsubscribe': '<https://caravanwert.de/dashboard/profile>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
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

    // Get recipients (already filtered for unsubscribed + optional
    // promotional-opt-out if is_promotional=true).
    const recipients = await getRecipients(supabase, group, custom_emails, is_promotional);

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients found for this group' }), { status: 400, headers });
    }

    // Generate broadcast_id for grouping
    const broadcastId = crypto.randomUUID();

    // Build email HTML with optional unsubscribe link
    let emailContent = body_html;
    if (include_unsubscribe) {
      emailContent += paragraph(`<span style="font-size: 11px; color: #9ca3af;">Sie erhalten diese E-Mail, weil Sie bei CaravanWert registriert sind. <a href="https://caravanwert.de/dashboard/profile" style="color: #1f8aa2; text-decoration: underline;">E-Mail-Einstellungen verwalten</a> | <a href="https://caravanwert.de/dashboard/profile" style="color: #1f8aa2; text-decoration: underline;">Von Rundmails abmelden</a></span>`);
    }
    const html = buildEmailLayout(settingsData, subject, emailContent);

    // Send in batches of 10 (Resend rate limit)
    const BATCH_SIZE = 10;
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      const promises = batch.map(async (recipient) => {
        try {
          const resendPayload: any = {
            from: `${settingsData.site_name} <info@caravanwert.de>`,
            to: [recipient.email],
            subject,
            html,
            reply_to: 'info@caravanwert.de',
          };

          if (include_unsubscribe) {
            resendPayload.headers = {
              'List-Unsubscribe': '<https://caravanwert.de/dashboard/profile>',
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            };
          }

          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify(resendPayload),
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
