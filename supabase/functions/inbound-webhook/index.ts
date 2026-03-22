import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Resend Inbound Webhook
 * 
 * Receives incoming emails sent to info@caravanwert.de via Resend's
 * inbound email feature. Stores them in the admin_emails table.
 * 
 * Resend sends a POST with JSON body containing:
 * - from: sender email address
 * - to: recipient email address(es)
 * - subject: email subject
 * - html: HTML body
 * - text: plain text body
 * - headers: raw email headers
 * - attachments: array of attachment objects
 */

interface ResendInboundPayload {
  data: {
    from: string;
    to: string[];
    subject: string;
    html?: string;
    text?: string;
    headers?: Record<string, string>[];
    attachments?: Array<{
      filename: string;
      content_type: string;
      content: string;
    }>;
    created_at?: string;
    email_id?: string;
  };
  type: string;
}

function extractEmailAddress(from: string): string {
  // Extract email from "Name <email@example.com>" format
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function extractName(from: string): string | null {
  // Extract name from "Name <email@example.com>" format
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : null;
}

const handler = async (req: Request): Promise<Response> => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload: ResendInboundPayload = await req.json();
    console.log("Inbound webhook received:", JSON.stringify(payload).substring(0, 500));

    // Handle different webhook event types
    if (payload.type && payload.type !== 'email.received') {
      // Could be email.delivered, email.opened, etc. - just acknowledge
      console.log(`Webhook event type: ${payload.type}`);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const emailData = payload.data;
    if (!emailData || !emailData.from) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const senderEmail = extractEmailAddress(emailData.from);
    const senderName = extractName(emailData.from);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if sender is a known user
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, company_name')
      .eq('email', senderEmail)
      .maybeSingle();

    // Check if this is a reply to an existing thread
    let threadId: string | null = null;
    let inReplyTo: string | null = null;

    // Try to find existing conversation with this sender
    const { data: existingThread } = await supabase
      .from('admin_emails')
      .select('id, thread_id')
      .or(`recipient_email.eq.${senderEmail},sender_email.eq.${senderEmail}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingThread) {
      threadId = existingThread.thread_id || existingThread.id;
      inReplyTo = existingThread.id;
    }

    // Process attachments metadata (store info, not content)
    const attachmentsMeta = (emailData.attachments || []).map(att => ({
      filename: att.filename,
      content_type: att.content_type,
      size: att.content ? Math.round(att.content.length * 0.75) : 0, // base64 to bytes estimate
    }));

    // Store the inbound email
    const { data: emailRecord, error: insertError } = await supabase
      .from('admin_emails')
      .insert({
        sender_email: senderEmail,
        sender_name: senderName || (senderProfile ? [senderProfile.first_name, senderProfile.last_name].filter(Boolean).join(' ') : null),
        recipient_email: emailData.to?.[0] || 'info@caravanwert.de',
        recipient_name: 'CaravanWert',
        recipient_id: null,
        subject: emailData.subject || '(Kein Betreff)',
        body_html: emailData.html || '',
        body_text: emailData.text || '',
        email_type: 'inbound',
        direction: 'inbound',
        status: 'unread',
        resend_id: emailData.email_id || null,
        thread_id: threadId,
        in_reply_to: inReplyTo,
        raw_headers: emailData.headers || null,
        attachments: attachmentsMeta.length > 0 ? attachmentsMeta : [],
        is_read: false,
        sent_by: senderProfile?.id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error storing inbound email:", insertError);
      throw insertError;
    }

    // If no thread_id was set, use the new email's own id as thread_id
    if (!threadId && emailRecord) {
      await supabase
        .from('admin_emails')
        .update({ thread_id: emailRecord.id })
        .eq('id', emailRecord.id);
    }

    console.log("Inbound email stored:", emailRecord?.id);

    return new Response(JSON.stringify({
      received: true,
      email_id: emailRecord?.id,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error processing inbound webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
