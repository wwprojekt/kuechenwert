import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { BRAND, BRAND_LEGAL } from '../_shared/brand-config.ts';
import { getBroadcastRecipients, isBroadcastGroup, type BroadcastGroup } from '../_shared/broadcast-recipients.ts';
import { createUnsubscribeToken, unsubscribeUrls, type UnsubscribeScope } from '../_shared/unsubscribe-token.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Studios und Kunden verwalten ihre freiwilligen E-Mails unter /dashboard/settings.
const EMAIL_SETTINGS_URL = `${BRAND.baseUrl}/dashboard/settings`;

function unsubscribeFooter(unsubscribePageUrl: string | null): string {
  const settingsLink = `<a href="${EMAIL_SETTINGS_URL}" style="color: #336753; text-decoration: underline;">E-Mail-Einstellungen</a>`;
  const action = unsubscribePageUrl
    ? `<a href="${unsubscribePageUrl}" style="color: #336753; text-decoration: underline;">Mit einem Klick abmelden</a> oder ${settingsLink} verwalten.`
    : `${settingsLink} verwalten oder abmelden.`;
  return paragraph(`<span style="font-size: 11px; color: #9ca3af;">Sie erhalten diese E-Mail, weil Sie bei ${BRAND.name} registriert sind. ${action}</span>`);
}

interface BroadcastRequest {
  subject: string;
  body_html: string;
  group: BroadcastGroup;
  custom_emails?: string[];
  test_mode?: boolean;
  test_email?: string;
  include_unsubscribe?: boolean;
  // Werbe-/Promo-Kampagnen (Rabatte, Aktionen, Partnerangebote) gehen nur an
  // Nutzer mit ausdruecklicher Einwilligung `promotional_emails = true`
  // (§ 7 Abs. 2 UWG, gilt auch gegenueber Unternehmen). Default: false,
  // reine Informations-Broadcasts gehen an alle, die
  // `broadcast_emails_enabled` nicht abgewaehlt haben.
  is_promotional?: boolean;
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
    const { subject, body_html, group, custom_emails, test_mode, test_email, is_promotional = false } = body;

    if (!subject || !body_html || !group) {
      return new Response(JSON.stringify({ error: 'Missing required fields: subject, body_html, group' }), { status: 400, headers });
    }
    if (!isBroadcastGroup(group)) {
      return new Response(JSON.stringify({ error: `Unknown group: ${group}` }), { status: 400, headers });
    }

    // Werbung und Newsletter immer mit Abmeldemöglichkeit (§ 7 Abs. 3 UWG,
    // Art. 21 Abs. 4 DSGVO); nur reine Service-Hinweise dürfen ohne.
    const isAdvertising = is_promotional || group === 'newsletter';
    const include_unsubscribe = isAdvertising || body.include_unsubscribe !== false;
    const unsubscribeScope: UnsubscribeScope = isAdvertising ? 'werbung' : 'hinweise';

    // Fetch site settings
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    const settingsData = settings || {
      site_name: BRAND.name,
      site_description: BRAND.tagline,
      contact_email: BRAND.supportEmail,
      support_phone: BRAND_LEGAL.phone,
    };

    // Test mode: send only to test_email
    if (test_mode && test_email) {
      let emailContent = body_html;
      if (include_unsubscribe) {
        emailContent += unsubscribeFooter(null);
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
          to: [test_email],
          subject: `[TEST] ${subject}`,
          html,
          reply_to: BRAND.supportEmail,
          headers: {
            'List-Unsubscribe': `<${EMAIL_SETTINGS_URL}>`,
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

    // Get recipients (already filtered for unsubscribed; with
    // is_promotional=true only users with promotional opt-in).
    const recipients = await getBroadcastRecipients(supabase, group, { customEmails: custom_emails, isPromotional: is_promotional });

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients found for this group' }), { status: 400, headers });
    }

    // Generate broadcast_id for grouping
    const broadcastId = crypto.randomUUID();

    // Send in batches of 10 (Resend rate limit)
    const BATCH_SIZE = 10;
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      const promises = batch.map(async (recipient) => {
        try {
          // Pro Empfänger signierter Abmeldelink; ohne Konto (eigene Liste)
          // bleibt nur der Weg über die Einstellungsseite.
          const urls = include_unsubscribe && recipient.id
            ? unsubscribeUrls(await createUnsubscribeToken(recipient.id, unsubscribeScope))
            : null;
          const html = buildEmailLayout(
            settingsData,
            subject,
            include_unsubscribe ? body_html + unsubscribeFooter(urls?.page ?? null) : body_html,
          );
          const resendPayload: any = {
            from: `${settingsData.site_name} <${BRAND.supportEmail}>`,
            to: [recipient.email],
            subject,
            html,
            reply_to: BRAND.supportEmail,
          };

          if (urls) {
            resendPayload.headers = {
              'List-Unsubscribe': `<${urls.oneClick}>, <mailto:${BRAND.supportEmail}?subject=Abmelden>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            };
          } else if (include_unsubscribe) {
            resendPayload.headers = { 'List-Unsubscribe': `<${EMAIL_SETTINGS_URL}>` };
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
            sender_email: BRAND.supportEmail,
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
