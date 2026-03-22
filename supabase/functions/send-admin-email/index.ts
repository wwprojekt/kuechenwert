import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { buildEmailLayout, paragraph, greeting } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SendEmailRequest {
  to: string;
  subject: string;
  body_html: string;
  cc?: string[];
  bcc?: string[];
  reply_to_message_id?: string;
  reply_to_message_type?: 'support' | 'contact';
  recipient_name?: string;
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

    const body: SendEmailRequest = await req.json();
    const { to, subject, body_html, cc, bcc, reply_to_message_id, reply_to_message_type, recipient_name } = body;

    if (!to || !subject || !body_html) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, body_html' }), { status: 400, headers });
    }

    // Fetch site settings
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'kontakt@caravanwert.de',
      support_phone: '+49 511 51532476',
    };

    // Build email with branding
    const emailContent = `
      ${recipient_name ? greeting(recipient_name) : ''}
      ${body_html}
    `;
    const html = buildEmailLayout(settingsData, subject, emailContent);

    // Send via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <info@caravanwert.de>`,
        to: [to],
        cc: cc || [],
        bcc: bcc || [],
        subject,
        html,
        reply_to: 'info@caravanwert.de',
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const resendResult = await emailResponse.json();

    // Determine email type
    const emailType = reply_to_message_id ? 'reply' : 'single';

    // Find recipient profile if exists
    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', to)
      .maybeSingle();

    // Log in admin_emails
    const { data: emailRecord, error: insertError } = await supabase
      .from('admin_emails')
      .insert({
        sender_email: 'info@caravanwert.de',
        sender_name: settingsData.site_name,
        recipient_email: to,
        recipient_name: recipient_name || null,
        recipient_id: recipientProfile?.id || null,
        cc: cc || [],
        bcc: bcc || [],
        subject,
        body_html,
        body_text: body_html.replace(/<[^>]*>/g, ''),
        email_type: emailType,
        direction: 'outbound',
        status: 'sent',
        resend_id: resendResult.id,
        related_message_id: reply_to_message_id || null,
        related_message_type: reply_to_message_type || null,
        sent_by: user.id,
        is_read: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error logging email:", insertError);
    }

    // If this is a reply to a support/contact message, update the original
    if (reply_to_message_id && reply_to_message_type) {
      const table = reply_to_message_type === 'support' ? 'support_messages' : 'contact_messages';
      await supabase
        .from(table)
        .update({
          admin_response: body_html.replace(/<[^>]*>/g, ''),
          responded_at: new Date().toISOString(),
          responded_by: user.id,
          status: 'resolved',
        })
        .eq('id', reply_to_message_id);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Email sent successfully',
      resend_id: resendResult.id,
      email_id: emailRecord?.id,
    }), { status: 200, headers });

  } catch (error: any) {
    console.error("Error sending admin email:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
};

serve(handler);
