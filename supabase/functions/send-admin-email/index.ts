import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph, greeting } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SendEmailRequest {
  to: string;
  subject: string;
  body_html: string;
  cc?: string;
  bcc?: string;
  reply_to_message_id?: string;
  reply_to_message_type?: 'support' | 'contact' | 'vehicle_question';
  recipient_name?: string;
  attachments?: Array<{ filename: string; content: string; type?: string }>;
  scheduled_at?: string;
  plain_answer?: string; // Die reine Admin-Antwort ohne Kontext-Text (für vehicle_questions)
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
    const { to, subject, body_html, cc, bcc, reply_to_message_id, reply_to_message_type, recipient_name, attachments, scheduled_at, plain_answer } = body;

    if (!to || !subject || !body_html) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, body_html' }), { status: 400, headers });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanTo = to.trim();
    if (!emailRegex.test(cleanTo)) {
      return new Response(JSON.stringify({ error: `Ungültige E-Mail-Adresse: "${cleanTo}". Bitte verwenden Sie das Format email@beispiel.de` }), { status: 400, headers });
    }

    // Validate CC emails if provided
    if (cc) {
      const invalidCc = cc.split(',').map(e => e.trim()).filter(e => e && !emailRegex.test(e));
      if (invalidCc.length > 0) {
        return new Response(JSON.stringify({ error: `Ungültige CC E-Mail-Adresse(n): ${invalidCc.join(', ')}` }), { status: 400, headers });
      }
    }

    // Validate BCC emails if provided
    if (bcc) {
      const invalidBcc = bcc.split(',').map(e => e.trim()).filter(e => e && !emailRegex.test(e));
      if (invalidBcc.length > 0) {
        return new Response(JSON.stringify({ error: `Ungültige BCC E-Mail-Adresse(n): ${invalidBcc.join(', ')}` }), { status: 400, headers });
      }
    }

    // Parse CC/BCC from comma-separated strings
    const ccList = cc ? cc.split(',').map(e => e.trim()).filter(Boolean) : [];
    const bccList = bcc ? bcc.split(',').map(e => e.trim()).filter(Boolean) : [];

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

    // If scheduled, save to DB and return
    if (scheduled_at) {
      const scheduledDate = new Date(scheduled_at);
      if (scheduledDate <= new Date()) {
        return new Response(JSON.stringify({ error: 'Geplanter Zeitpunkt muss in der Zukunft liegen' }), { status: 400, headers });
      }

      const { data: emailRecord, error: insertError } = await supabase
        .from('admin_emails')
        .insert({
          sender_email: 'info@caravanwert.de',
          sender_name: settingsData.site_name,
        recipient_email: cleanTo,
        recipient_name: recipient_name || null,
        cc: ccList,
        bcc: bccList,
        subject,
        body_html,
        body_text: body_html.replace(/<[^>]*>/g, ''),
        email_type: 'single',
        direction: 'outbound',
        status: 'scheduled',
          sent_by: user.id,
          is_read: true,
          scheduled_at: scheduledDate.toISOString(),
          attachments: attachments || [],
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Error saving scheduled email: ${insertError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Email scheduled successfully',
        scheduled_at: scheduledDate.toISOString(),
        email_id: emailRecord?.id,
      }), { status: 200, headers });
    }

    // Build Resend payload
    const resendPayload: any = {
      from: `${settingsData.site_name} <info@caravanwert.de>`,
      to: [cleanTo],
      cc: ccList,
      bcc: bccList,
      subject,
      html,
      reply_to: 'info@caravanwert.de',
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      resendPayload.attachments = attachments.map(att => ({
        filename: att.filename,
        content: att.content, // base64 encoded
        type: att.type || 'application/octet-stream',
      }));
    }

    // Validate payload size (Resend has limits)
    const payloadJson = JSON.stringify(resendPayload);
    const payloadSizeKB = Math.round(payloadJson.length / 1024);
    if (payloadSizeKB > 450) {
      console.error(`Email payload too large: ${payloadSizeKB}KB`);
      return new Response(JSON.stringify({ 
        error: `E-Mail ist zu groß (${payloadSizeKB}KB). Bitte entfernen Sie eingebettete Bilder oder reduzieren Sie den Inhalt. Maximum: ~450KB.` 
      }), { status: 400, headers });
    }

    // Send via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: payloadJson,
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(`Resend API error (${emailResponse.status}): ${errorText}`);
      
      // Parse Resend error for user-friendly message
      let userMessage = `E-Mail-Versand fehlgeschlagen (Resend ${emailResponse.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) userMessage = errorJson.message;
        if (errorJson.statusCode === 429) userMessage = 'Tageslimit für E-Mail-Versand erreicht. Bitte versuchen Sie es morgen erneut.';
        if (errorJson.statusCode === 422) userMessage = `Validierungsfehler: ${errorJson.message}`;
      } catch { /* ignore parse error */ }
      
      return new Response(JSON.stringify({ error: userMessage }), { status: 502, headers });
    }

    const resendResult = await emailResponse.json();

    // Determine email type
    const emailType = reply_to_message_id ? 'reply' : 'single';

    // Find recipient profile if exists
    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', cleanTo)
      .maybeSingle();

    // Log in admin_emails
    const { data: emailRecord, error: insertError } = await supabase
      .from('admin_emails')
      .insert({
        sender_email: 'info@caravanwert.de',
        sender_name: settingsData.site_name,
        recipient_email: cleanTo,
        recipient_name: recipient_name || null,
        recipient_id: recipientProfile?.id || null,
        cc: ccList,
        bcc: bccList,
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
        attachments: attachments ? attachments.map(a => ({ filename: a.filename, type: a.type, size: a.content?.length || 0 })) : [],
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error logging email:", insertError);
    }

    // If this is a reply to a support/contact/vehicle_question message, update the original
    if (reply_to_message_id && reply_to_message_type) {
      if (reply_to_message_type === 'vehicle_question') {
        // Speichere nur die reine Admin-Antwort, nicht den vollen E-Mail-Body mit Kontext
        const answerText = plain_answer || body_html.replace(/<[^>]*>/g, '');
        await supabase
          .from('vehicle_questions')
          .update({
            answer: answerText,
            answered_at: new Date().toISOString(),
            answered_by: user.id,
          })
          .eq('id', reply_to_message_id);
      } else {
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
