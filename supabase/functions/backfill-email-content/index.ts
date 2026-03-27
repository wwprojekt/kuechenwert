import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Backfill email content for inbound emails that were stored without body/attachments.
 * This is a one-time utility to fix emails received before the inbound-webhook was updated
 * to fetch full content from the Resend Received Email API.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find inbound emails with empty body that have a resend_id
    const { data: emails, error: queryError } = await supabase
      .from('admin_emails')
      .select('id, resend_id, sender_email, subject')
      .eq('direction', 'inbound')
      .not('resend_id', 'is', null)
      .or('body_html.eq.,body_html.is.null')
      .order('created_at', { ascending: false })
      .limit(50);

    if (queryError) {
      console.error('Query error:', queryError);
      return new Response(JSON.stringify({ error: 'Database query failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ message: 'No emails to backfill', count: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const email of emails) {
      try {
        // Fetch full email content from Resend
        const emailRes = await fetch(`https://api.resend.com/emails/receiving/${email.resend_id}`, {
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` },
        });

        if (!emailRes.ok) {
          results.push({ id: email.id, status: 'failed', reason: `Resend API ${emailRes.status}` });
          continue;
        }

        const fullEmail = await emailRes.json();

        // Process attachments with download URLs
        const fullAttachments: any[] = [];
        if (fullEmail.attachments && fullEmail.attachments.length > 0) {
          for (const att of fullEmail.attachments) {
            try {
              const attRes = await fetch(
                `https://api.resend.com/emails/receiving/${email.resend_id}/attachments/${att.id}`,
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

        // Update the email record
        const { error: updateError } = await supabase
          .from('admin_emails')
          .update({
            body_html: fullEmail.html || '',
            body_text: fullEmail.text || '',
            raw_headers: fullEmail.headers || null,
            attachments: fullAttachments.length > 0 ? fullAttachments : [],
          })
          .eq('id', email.id);

        if (updateError) {
          results.push({ id: email.id, status: 'update_failed', reason: updateError.message });
        } else {
          results.push({
            id: email.id,
            status: 'success',
            sender: email.sender_email,
            subject: email.subject,
            htmlLength: (fullEmail.html || '').length,
            attachments: fullAttachments.length,
          });
        }
      } catch (err) {
        results.push({ id: email.id, status: 'error', reason: String(err) });
      }
    }

    return new Response(JSON.stringify({
      message: `Processed ${results.length} emails`,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
