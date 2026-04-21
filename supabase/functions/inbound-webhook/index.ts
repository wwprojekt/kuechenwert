import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';

/**
 * Resend Webhook Handler (v2)
 * 
 * Features:
 * - Webhook-Signatur-Verifizierung (svix)
 * - Inbound E-Mails speichern
 * - Delivery-Status-Events verarbeiten
 * - Bounce-Management (E-Mail-Adressen markieren)
 * - Auto-Responder für eingehende E-Mails auslösen
 * - Kontaktformular-Nachrichten integrieren
 */

interface ResendWebhookPayload {
  data: any;
  type: string;
  created_at?: string;
}

// ── Webhook-Signatur-Verifizierung ──────────────────────────────────

async function verifyWebhookSignature(req: Request, body: string): Promise<boolean> {
  if (!RESEND_WEBHOOK_SECRET) {
    console.error("RESEND_WEBHOOK_SECRET not set – rejecting webhook (fail-closed)");
    return false;
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn("Missing svix headers");
    return false;
  }

  // Check timestamp is within 5 minutes
  const timestamp = parseInt(svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    console.warn("Webhook timestamp too old");
    return false;
  }

  // Compute expected signature
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  
  // The secret starts with "whsec_" prefix which needs to be removed
  const secretBytes = Uint8Array.from(
    atob(RESEND_WEBHOOK_SECRET.replace('whsec_', '')),
    c => c.charCodeAt(0)
  );

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(signedContent)
    );

    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    // Svix sends multiple signatures separated by space, each prefixed with "v1,"
    const signatures = svixSignature.split(' ');
    for (const sig of signatures) {
      const sigValue = sig.replace('v1,', '');
      if (sigValue === computedSignature) {
        return true;
      }
    }

    console.warn("Webhook signature mismatch");
    return false;
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function extractName(from: string): string | null {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : null;
}

const STATUS_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.complained': 'complained',
  'email.bounced': 'bounced',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
};

// ── Main Handler ────────────────────────────────────────────────────

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Read body as text for signature verification
    const bodyText = await req.text();

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(req, bodyText);
    if (!isValid) {
      console.error("Invalid webhook signature – rejecting request");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    const payload: ResendWebhookPayload = JSON.parse(bodyText);
    console.log("Webhook received:", payload.type, JSON.stringify(payload.data).substring(0, 300));

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Handle delivery status events ──────────────────────────────
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
        }

        // ── Bounce Management ──────────────────────────────────────
        if (newStatus === 'bounced' && payload.data?.to) {
          const bouncedEmails = Array.isArray(payload.data.to) ? payload.data.to : [payload.data.to];
          
          for (const bouncedEmail of bouncedEmails) {
            console.log(`BOUNCE detected for: ${bouncedEmail}`);
            
            // Mark profile as bounced
            const { error: bounceError } = await supabase
              .from('profiles')
              .update({ 
                email_bounced: true,
                email_bounced_at: new Date().toISOString(),
              })
              .eq('email', bouncedEmail);

            if (bounceError) {
              console.error(`Error marking bounce for ${bouncedEmail}:`, bounceError);
            } else {
              console.log(`Marked ${bouncedEmail} as bounced in profiles`);
            }

            // Add to global suppression list so future outreach skips it
            await supabase.from('email_suppressions').upsert(
              {
                email: bouncedEmail.toLowerCase(),
                reason: 'bounced',
                source: 'resend_webhook',
                notes: `Resend email_id: ${resendId}`,
              },
              { onConflict: 'email', ignoreDuplicates: false },
            );

            // Mark any in-flight Google review request for this email as bounced
            await supabase
              .from('google_review_requests')
              .update({
                delivery_status: 'bounced',
                delivery_error: 'resend_bounce',
              })
              .ilike('email', bouncedEmail)
              .in('delivery_status', ['queued', 'sent']);
          }
        }

        // ── Complaint Management (spam-Beschwerde) ─────────────────
        // Critical: spam complaints damage sender reputation; suppress
        // immediately and never reach this address again from any feature.
        if (newStatus === 'complained' && payload.data?.to) {
          const complainedEmails = Array.isArray(payload.data.to) ? payload.data.to : [payload.data.to];

          for (const complainedEmail of complainedEmails) {
            console.log(`COMPLAINT detected for: ${complainedEmail}`);

            await supabase.from('email_suppressions').upsert(
              {
                email: complainedEmail.toLowerCase(),
                reason: 'complained',
                source: 'resend_webhook',
                notes: `Resend email_id: ${resendId}`,
              },
              { onConflict: 'email', ignoreDuplicates: false },
            );

            await supabase
              .from('google_review_requests')
              .update({
                delivery_status: 'suppressed',
                delivery_error: 'resend_complaint',
              })
              .ilike('email', complainedEmail)
              .in('delivery_status', ['queued', 'sent']);
          }
        }

        // ── Un-bounce on successful delivery ───────────────────────
        if (newStatus === 'delivered' && payload.data?.to) {
          const deliveredEmails = Array.isArray(payload.data.to) ? payload.data.to : [payload.data.to];
          
          for (const deliveredEmail of deliveredEmails) {
            await supabase
              .from('profiles')
              .update({ 
                email_bounced: false,
                email_bounced_at: null,
              })
              .eq('email', deliveredEmail)
              .eq('email_bounced', true);
          }
        }
      }

      return new Response(JSON.stringify({ received: true, type: payload.type }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // ── Handle inbound emails ──────────────────────────────────────
    const emailData = payload.data;
    if (!emailData || !emailData.from) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const senderEmail = extractEmailAddress(emailData.from);
    const senderName = extractName(emailData.from);

    // Robust sender name resolution with explicit fallback chain
    const resolvedSenderName = (() => {
      if (senderName && senderName.trim()) return senderName.trim();
      // Will be resolved after profile lookup below
      return null;
    })();

    // Check if sender is a known user
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, company_name')
      .eq('email', senderEmail)
      .maybeSingle();

    // Final sender name with complete fallback chain
    const finalSenderName: string = resolvedSenderName
      || (senderProfile ? [senderProfile.first_name, senderProfile.last_name].filter(Boolean).join(' ').trim() : '')
      || (senderProfile?.company_name?.trim())
      || (senderEmail ? senderEmail.split('@')[0] : '')
      || 'Unbekannt';

    // Find existing conversation thread
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

    // ── Fetch full email content from Resend Received Email API ────
    // Webhooks only contain metadata, not the body or attachment content.
    let fullHtml = emailData.html || '';
    let fullText = emailData.text || '';
    let fullAttachments: any[] = [];
    let rawHeaders = emailData.headers || null;

    const receivedEmailId = emailData.email_id;
    if (RESEND_API_KEY && receivedEmailId) {
      // Helper: fetch email content from Resend Received Email API
      const fetchEmailContent = async (): Promise<{ html: string; text: string; headers: any; attachments: any[] }> => {
        const res = await fetch(`https://api.resend.com/emails/receiving/${receivedEmailId}`, {
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` },
        });
        if (!res.ok) throw new Error(`Resend API ${res.status}: ${await res.text()}`);
        return await res.json();
      };

      try {
        // First attempt – Resend may not have content ready yet
        let fullEmail = await fetchEmailContent();

        // Retry once after 2s if content is empty (Resend processing delay)
        if (!fullEmail.html && !fullEmail.text) {
          console.log('Email content empty on first fetch, retrying in 2s...');
          await new Promise(r => setTimeout(r, 2000));
          fullEmail = await fetchEmailContent();
          if (!fullEmail.html && !fullEmail.text) {
            console.warn(`Email content still empty after retry for ${receivedEmailId}`);
          }
        }

        fullHtml = fullEmail.html || fullHtml;
        fullText = fullEmail.text || fullText;
        rawHeaders = fullEmail.headers || rawHeaders;

        // Process attachments with download URLs
        if (fullEmail.attachments && fullEmail.attachments.length > 0) {
          for (const att of fullEmail.attachments) {
            try {
              const attRes = await fetch(
                `https://api.resend.com/emails/receiving/${receivedEmailId}/attachments/${att.id}`,
                { headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` } }
              );

              if (attRes.ok) {
                const attData = await attRes.json();
                fullAttachments.push({
                  id: att.id,
                  filename: att.filename || attData.filename,
                  content_type: att.content_type || attData.content_type,
                  size: attData.size || 0,
                  download_url: attData.download_url || null,
                  expires_at: attData.expires_at || null,
                });
              } else {
                fullAttachments.push({
                  id: att.id,
                  filename: att.filename,
                  content_type: att.content_type,
                  size: 0,
                });
              }
            } catch (attErr) {
              console.error(`Error fetching attachment ${att.id}:`, attErr);
              fullAttachments.push({
                id: att.id,
                filename: att.filename,
                content_type: att.content_type,
                size: 0,
              });
            }
          }
        }
        console.log(`Fetched full email content: html=${fullHtml.length}chars, text=${fullText.length}chars, attachments=${fullAttachments.length}`);
      } catch (fetchErr) {
        console.error('Error fetching full email from Resend API:', fetchErr);
        // Fallback: use webhook metadata
        fullAttachments = (emailData.attachments || []).map((att: any) => ({
          filename: att.filename,
          content_type: att.content_type,
          size: att.content ? Math.round(att.content.length * 0.75) : 0,
        }));
      }
    } else {
      // No API key or email ID – use webhook metadata as fallback
      fullAttachments = (emailData.attachments || []).map((att: any) => ({
        filename: att.filename,
        content_type: att.content_type,
        size: att.content ? Math.round(att.content.length * 0.75) : 0,
      }));
    }

    // Store the inbound email with full content
    const { data: emailRecord, error: insertError } = await supabase
      .from('admin_emails')
      .insert({
        sender_email: senderEmail,
        sender_name: finalSenderName,
        recipient_email: emailData.to?.[0] || 'info@caravanwert.de',
        recipient_name: 'CaravanWert',
        recipient_id: null,
        subject: emailData.subject || '(Kein Betreff)',
        body_html: fullHtml,
        body_text: fullText,
        email_type: 'inbound',
        direction: 'inbound',
        status: 'unread',
        resend_id: receivedEmailId || null,
        thread_id: threadId,
        in_reply_to: inReplyTo,
        raw_headers: rawHeaders,
        attachments: fullAttachments.length > 0 ? fullAttachments : [],
        is_read: false,
        sent_by: senderProfile?.id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error storing inbound email:", insertError, "Payload:", JSON.stringify({ sender_email: senderEmail, sender_name: finalSenderName, subject: emailData.subject }));
      throw insertError;
    }

    // Set thread_id to own id if new thread
    if (!threadId && emailRecord) {
      await supabase
        .from('admin_emails')
        .update({ thread_id: emailRecord.id })
        .eq('id', emailRecord.id);
    }

    console.log("Inbound email stored:", emailRecord?.id);

    // ── Trigger Auto-Responder ──────────────────────────────────────
    try {
      const autoRes = await fetch(`${SUPABASE_URL}/functions/v1/send-auto-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          sender_email: senderEmail,
          sender_name: finalSenderName,
        }),
      });
      if (!autoRes.ok) {
        console.error("Auto-response failed:", autoRes.status, await autoRes.text());
      } else {
        console.log("Auto-response triggered for:", senderEmail);
      }
    } catch (autoErr) {
      console.error("Auto-response trigger failed:", autoErr);
      // Don't fail the webhook because of auto-response
    }

    return new Response(JSON.stringify({
      received: true,
      email_id: emailRecord?.id,
    }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
