import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, infoBox, paragraph, button, list, warningBox } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RequestBody {
  dealer_application_id: string;
  dealer_email: string;
  dealer_name: string;
  company_name: string;
  missing_documents?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    // Auth check: must be service_role or authenticated admin
    const authResult = await checkServiceRoleOrAdmin(req, corsHeaders);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { dealer_application_id, dealer_email, dealer_name, company_name, missing_documents }: RequestBody = await req.json();

    if (!dealer_application_id || !dealer_email) {
      return new Response(JSON.stringify({ error: 'dealer_application_id und dealer_email sind erforderlich' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Sending document request email to ${dealer_email} for application ${dealer_application_id}`);

    // Fetch site settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .single();

    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'info@caravanwert.de',
      support_phone: '+49 511 51532476',
    };

    // Build the document list
    const defaultMissing = [
      'Gewerbenachweis (Gewerbeanmeldung oder aktueller Gewerbeschein)',
      'Ausweis – Vorderseite (Personalausweis oder Reisepass)',
      'Ausweis – Rückseite (Personalausweis oder Reisepass)',
    ];
    const docList = missing_documents && missing_documents.length > 0 ? missing_documents : defaultMissing;

    // Build email content
    const emailContent = `
      ${paragraph(`Hallo ${dealer_name},`)}
      ${paragraph(`vielen Dank für Ihre Registrierung als Händler bei <strong>${settingsData.site_name}</strong>. Um Ihren Händlerzugang freizuschalten, benötigen wir noch einige Dokumente von Ihnen.`)}
      ${warningBox('Bitte laden Sie die folgenden Dokumente in Ihrem Händler-Dashboard hoch, damit wir Ihren Antrag prüfen können.')}
      ${infoBox('Erforderliche Dokumente', `
        ${list(docList)}
        ${paragraph('<strong>Erlaubte Dateiformate:</strong> PDF, JPG, PNG (max. 10 MB pro Datei)')}
      `, 'info', settingsData)}
      ${paragraph('So laden Sie Ihre Dokumente hoch:')}
      ${list([
        'Melden Sie sich in Ihrem Händler-Dashboard an',
        'Klicken Sie auf "Dokumente für Verifizierung"',
        'Laden Sie die erforderlichen Dokumente hoch',
      ])}
      ${button('Zum Händler-Dashboard', 'https://caravanwert.de/dashboard')}
      ${paragraph('Ihre Dokumente werden vertraulich behandelt und nur zur Verifizierung Ihres Händlerkontos verwendet. Nach der Prüfung erhalten Sie eine E-Mail-Benachrichtigung.')}
      ${paragraph(`Bei Fragen stehen wir Ihnen gerne unter <a href="mailto:${settingsData.contact_email}" style="color: #1f8aa2;">${settingsData.contact_email}</a> oder telefonisch unter <strong>${settingsData.support_phone}</strong> zur Verfügung.`)}
      ${paragraph('Mit freundlichen Grüßen,<br>Ihr CaravanWert-Team')}
    `;

    const subject = `Dokumente für Ihre Händler-Verifizierung erforderlich – ${settingsData.site_name}`;
    const html = buildEmailLayout(settingsData, subject, emailContent);

    // Send email via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <noreply@caravanwert.de>`,
        to: [dealer_email],
        subject: subject,
        html: html,
      }),
    });

    const emailResult = await emailRes.json();

    if (!emailRes.ok) {
      console.error('Resend API error:', emailResult);
      return new Response(JSON.stringify({ error: `E-Mail konnte nicht gesendet werden: ${emailResult.message || 'Unbekannter Fehler'}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Document request email sent successfully:', emailResult.id);

    // Update counter in dealer_applications
    const { error: updateError } = await supabase.rpc('increment_counter', {
      table_name: 'dealer_applications',
      column_name: 'document_request_sent_count',
      row_id: dealer_application_id,
    });

    // Fallback: direct update if RPC doesn't exist
    if (updateError) {
      console.log('RPC increment_counter not available, using direct update');
      // First get current count
      const { data: currentApp } = await supabase
        .from('dealer_applications')
        .select('document_request_sent_count')
        .eq('id', dealer_application_id)
        .single();

      const currentCount = currentApp?.document_request_sent_count || 0;

      await supabase
        .from('dealer_applications')
        .update({
          document_request_sent_count: currentCount + 1,
          document_request_last_sent_at: new Date().toISOString(),
        })
        .eq('id', dealer_application_id);
    }

    // Log in admin_emails table
    try {
      await supabase.from('admin_emails').insert({
        sender_email: 'noreply@caravanwert.de',
        sender_name: settingsData.site_name,
        recipient_email: dealer_email,
        recipient_name: dealer_name,
        subject: subject,
        body_html: html,
        email_type: 'auto',
        direction: 'outbound',
        status: 'sent',
        resend_id: emailResult.id,
        sent_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.log('Could not log email in admin_emails:', logErr);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Dokument-Anforderung wurde an ${dealer_email} gesendet.`,
      email_id: emailResult.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in request-dealer-documents:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
