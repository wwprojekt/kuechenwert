import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { buildEmailLayout, infoBox, detailRow, paragraph, button, list, customerBadge } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface DealerEmailRequest {
  email: string;
  name: string;
  type: "application_received" | "approved" | "rejected";
  companyName: string;
  rejectionReason?: string;
  customerNumber?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  // Auth check: must be service_role (internal) or authenticated admin
  const authHeader = req.headers.get('authorization') ?? '';
  const isServiceRole = authHeader.includes(SUPABASE_SERVICE_ROLE_KEY);

  if (!isServiceRole) {
    // Use service role client to validate user token
    const token = authHeader.replace('Bearer ', '');
    const supabaseCheck = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: { user }, error: userError } = await supabaseCheck.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const { email, name, type, companyName, rejectionReason, customerNumber: passedCustNum }: DealerEmailRequest = await req.json();

    console.log(`Sending ${type} notification to dealer:`, email);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch customer number if not passed
    let custNum = passedCustNum || '';
    if (!custNum) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('customer_number')
        .eq('email', email)
        .maybeSingle();
      custNum = profile?.customer_number || '';
    }

    // Fetch site settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .single();

    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'kontakt@caravanwert.de',
      support_phone: '0800 123 456 78',
    };

    let subject = "";
    let emailContent = "";

    switch (type) {
      case "application_received":
        subject = "Händler-Bewerbung erhalten";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${paragraph(`Vielen Dank für Ihre Bewerbung als Händler bei ${settingsData.site_name}!`)}
          ${infoBox('Ihre Bewerbung', `
            ${detailRow('Unternehmen', companyName)}
            ${paragraph('Ihre Bewerbung wird derzeit von unserem Team geprüft. Sie erhalten in Kürze eine Rückmeldung per E-Mail.')}
          `, 'info', settingsData)}
          ${paragraph('Die Prüfung dauert in der Regel 1-2 Werktage.')}
        `;
        break;

      case "approved":
        subject = "Händler-Bewerbung genehmigt";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph(`<strong>Herzlichen Glückwunsch! Ihre Bewerbung als Händler wurde genehmigt.</strong>`)}
          ${infoBox(`Willkommen bei ${settingsData.site_name}!`, `
            ${detailRow('Unternehmen', companyName)}
            ${custNum ? detailRow('Ihre Kundennummer', `<strong style="color: #1f8aa2; font-size: 16px;">${custNum}</strong>`) : ''}
            ${paragraph('Sie haben jetzt Zugriff auf unser Händler-Portal und können auf Wohnmobile bieten.')}
          `, 'success', settingsData)}
          ${infoBox('Nächste Schritte', `
            ${list([
              'Loggen Sie sich in Ihr Händler-Portal ein',
              'Vervollständigen Sie Ihr Unternehmensprofil',
              'Entdecken Sie aktuelle Auktionen',
              'Geben Sie Ihr erstes Gebot ab'
            ])}
          `, 'default', settingsData)}
          ${button('Zum Händler-Portal', 'https://caravanwert.de/dealer', settingsData)}
        `;
        break;

      case "rejected":
        subject = "Händler-Bewerbung - Rückmeldung";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${paragraph(`Vielen Dank für Ihr Interesse an einer Partnerschaft mit ${settingsData.site_name}.`)}
          ${infoBox('Ihre Bewerbung', `
            ${detailRow('Unternehmen', companyName)}
            ${paragraph('Nach sorgfältiger Prüfung können wir Ihre Bewerbung derzeit leider nicht genehmigen.')}
            ${rejectionReason ? paragraph(`<strong>Grund:</strong> ${rejectionReason}`) : ''}
          `, 'warning', settingsData)}
          ${paragraph('Sie können sich jederzeit erneut bewerben. Bei Fragen stehen wir Ihnen gerne zur Verfügung.')}
        `;
        break;
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
        to: [email],
        subject,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const result = await emailResponse.json();
    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  } catch (error: any) {
    console.error("Error sending dealer notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
};

serve(handler);
