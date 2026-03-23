import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { buildEmailLayout, paragraph, greeting, button, list, infoBox, customerBadge } from '../_shared/email-builder.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Willkommens-E-Mail – wird nach erfolgreicher E-Mail-Bestätigung gesendet.
 * Kann per Webhook (auth.user_confirmed) oder manuell aufgerufen werden.
 * 
 * Body: { user_id: string } oder Supabase Auth Webhook payload
 */

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Support both direct call and Supabase Auth webhook format
    let userId: string;
    if (body.record?.id) {
      // Auth webhook format
      userId = body.record.id;
    } else if (body.user_id) {
      userId = body.user_id;
    } else {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, email, account_type, customer_number')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.email) {
      console.error("Profile not found:", profileError);
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }

    // Check if welcome email was already sent (prevent duplicates)
    const { data: existing } = await supabase
      .from('admin_emails')
      .select('id')
      .eq('recipient_email', profile.email)
      .eq('email_type', 'welcome')
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ message: "Welcome email already sent" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch site settings
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'kontakt@caravanwert.de',
      support_phone: '+49 511 51532476',
    };

    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
    const isDealer = profile.account_type === 'dealer';

    let emailContent: string;
    if (isDealer) {
      emailContent = `
        ${greeting(name || undefined)}
        ${customerBadge(profile.customer_number)}
        ${paragraph(`Herzlich willkommen bei <strong>${settingsData.site_name}</strong> &ndash; Deutschlands f&uuml;hrender Wohnmobil-Handelsplattform f&uuml;r H&auml;ndler!`)}
        ${paragraph('Ihr Konto wurde erfolgreich erstellt. Um auf Auktionen bieten zu k&ouml;nnen, reichen Sie bitte Ihre H&auml;ndler-Bewerbung ein.')}
        ${infoBox('Ihre n&auml;chsten Schritte', `
          ${list([
            'Vervollst&auml;ndigen Sie Ihr Unternehmensprofil',
            'Reichen Sie Ihre H&auml;ndler-Bewerbung ein',
            'Nach Freischaltung: Entdecken Sie aktuelle Auktionen',
            'Geben Sie Ihr erstes Gebot ab',
          ])}
        `, 'info', settingsData)}
        ${button('Zum H&auml;ndler-Portal', 'https://caravanwert.de/dealer', settingsData)}
        ${paragraph('Unser Team pr&uuml;ft Ihre Bewerbung in der Regel innerhalb von 1&ndash;2 Werktagen. Sie erhalten eine Best&auml;tigung per E-Mail.')}
      `;
    } else {
      emailContent = `
        ${greeting(name || undefined)}
        ${paragraph(`Herzlich willkommen bei <strong>${settingsData.site_name}</strong>! Wir freuen uns, dass Sie dabei sind.`)}
        ${paragraph('Ihr Konto wurde erfolgreich erstellt. Hier ist ein kurzer &Uuml;berblick, was Sie jetzt tun k&ouml;nnen:')}
        ${infoBox('Das erwartet Sie', `
          ${list([
            '<strong>Wohnmobil verkaufen</strong> &ndash; Lassen Sie Ihr Fahrzeug kostenlos bewerten und in unsere Auktion aufnehmen',
            '<strong>Marktpreise vergleichen</strong> &ndash; Erfahren Sie den aktuellen Wert Ihres Wohnmobils',
            '<strong>Profil vervollst&auml;ndigen</strong> &ndash; Halten Sie Ihre Kontaktdaten aktuell',
            '<strong>Benachrichtigungen einstellen</strong> &ndash; W&auml;hlen Sie, wor&uuml;ber Sie informiert werden m&ouml;chten',
          ])}
        `, 'info', settingsData)}
        ${button('Jetzt Wohnmobil bewerten', 'https://caravanwert.de/verkaufen', settingsData)}
        ${paragraph('Bei Fragen stehen wir Ihnen jederzeit gerne zur Verf&uuml;gung.')}
      `;
    }

    const subject = `Willkommen bei ${settingsData.site_name}!`;
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
        to: [profile.email],
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

    // Log in admin_emails
    await supabase.from('admin_emails').insert({
      sender_email: 'info@caravanwert.de',
      sender_name: settingsData.site_name,
      recipient_email: profile.email,
      recipient_name: name || null,
      recipient_id: userId,
      subject,
      body_html: emailContent,
      body_text: emailContent.replace(/<[^>]*>/g, ''),
      email_type: 'welcome',
      direction: 'outbound',
      status: 'sent',
      resend_id: resendResult.id,
      is_read: true,
    });

    console.log(`Welcome email sent to ${profile.email}`);

    return new Response(JSON.stringify({ success: true, resend_id: resendResult.id }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
