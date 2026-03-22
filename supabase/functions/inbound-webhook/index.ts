import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Resend Webhook Handler
 * 
 * Handles both:
 * 1. Inbound emails (email.received) - stores in admin_emails
 * 2. Delivery status events (email.delivered, email.opened, email.bounced, etc.) - updates admin_emails status
 */

interface ResendWebhookPayload {
  data: any;
  type: string;
  created_at?: string;
}

function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function extractName(from: string): string | null {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : null;
}

// Map Resend event types to our status values
const STATUS_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.complained': 'complained',
  'email.bounced': 'bounced',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload: ResendWebhookPayload = await req.json();
    console.log("Webhook received:", payload.type, JSON.stringify(payload.data).substring(0, 300));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Handle delivery status events ──────────────────────────────────
    if (payload.type && payload.type !== 'email.received') {
      const newStatus = STATUS_MAP[payload.type];
      
      if (newStatus && payload.data?.email_id) {
        const resendId = payload.data.email_id;
        
        // Update the email status in admin_emails
        const { data: updated, error } = await supabase
          .from('admin_emails')
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('resend_id', resendId)
          .select('id')
          .maybeSingle();

        if (error) {
          console.error(`Error updating status for ${resendId}:`, error);
        } else if (updated) {
          console.log(`Updated email ${updated.id} status to ${newStatus}`);
        } else {
          console.log(`No email found with resend_id ${resendId} - might be a system email`);
        }

        // Track bounces for future reference
        if (newStatus === 'bounced' && payload.data?.to) {
          const bouncedEmail = Array.isArray(payload.data.to) ? payload.data.to[0] : payload.data.to;
          console.log(`BOUNCE detected for: ${bouncedEmail}`);
          // Could add to a bounced_emails table in the future
        }
      }

      return new Response(JSON.stringify({ received: true, type: payload.type }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Handle inbound emails ──────────────────────────────────────────
    const emailData = payload.data;
    if (!emailData || !emailData.from) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const senderEmail = extractEmailAddress(emailData.from);
    const senderName = extractName(emailData.from);

    // Check if sender is a known user
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, company_name')
      .eq('email', senderEmail)
      .maybeSingle();

    // Try to find existing conversation thread with this sender
    let threadId: string | null = null;
    let inReplyTo: string | null = null;

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

    // Process attachments metadata
    const attachmentsMeta = (emailData.attachments || []).map((att: any) => ({
      filename: att.filename,
      content_type: att.content_type,
      size: att.content ? Math.round(att.content.length * 0.75) : 0,
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

    // If no thread_id was set, use the new email's own id
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
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
