import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { buildEmailLayout, infoBox, detailRow, paragraph, button, customerBadge } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AuctionEmailRequest {
  email: string;
  name: string;
  type: "new_auction" | "new_bid" | "outbid" | "won" | "lost" | "ending_soon" | "auction_started";
  motorhomeModel: string;
  auctionUrl: string;
  currentBid?: string;
  yourBid?: string;
  endTime?: string;
  customerNumber?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  try {
    const { email, name, type, motorhomeModel, auctionUrl, currentBid, yourBid, endTime, customerNumber: passedCustNum }: AuctionEmailRequest = await req.json();

    console.log(`Sending ${type} notification to:`, email);

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
      case "auction_started":
        subject = "Ihre Auktion wurde gestartet";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Ihr Wohnmobil wurde erfolgreich in die Auktion aufgenommen und ist jetzt für Händler sichtbar.')}
          ${infoBox('Fahrzeugdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${currentBid ? detailRow('Startgebot', currentBid) : ''}
            ${endTime ? detailRow('Auktionsende', endTime) : ''}
          `, 'success', settingsData)}
          ${paragraph('Sie werden per E-Mail benachrichtigt, wenn neue Gebote eingehen.')}
          ${button('Auktion ansehen', auctionUrl, settingsData)}
        `;
        break;

      case "new_auction":
        subject = "Neue Auktion verfügbar";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Eine neue Auktion, die Ihren Kriterien entspricht, ist jetzt verfügbar:')}
          ${infoBox('Fahrzeugdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${currentBid ? detailRow('Startgebot', currentBid) : ''}
            ${endTime ? detailRow('Endet am', endTime) : ''}
          `, 'info', settingsData)}
          ${button('Jetzt bieten', auctionUrl, settingsData)}
        `;
        break;

      case "new_bid":
        subject = "Neues Gebot eingegangen";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Auf Ihr Wohnmobil wurde ein neues Gebot abgegeben:')}
          ${infoBox('Gebotsdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${currentBid ? detailRow('Aktuelles Höchstgebot', currentBid) : ''}
          `, 'success', settingsData)}
          ${button('Auktion ansehen', auctionUrl, settingsData)}
        `;
        break;

      case "outbid":
        subject = "Sie wurden überboten";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Ein anderer Händler hat ein höheres Gebot abgegeben:')}
          ${infoBox('Gebotsdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${yourBid ? detailRow('Ihr Gebot', yourBid) : ''}
            ${currentBid ? detailRow('Aktuelles Höchstgebot', currentBid) : ''}
          `, 'warning', settingsData)}
          ${button('Höher bieten', auctionUrl, settingsData)}
        `;
        break;

      case "won":
        subject = "Glückwunsch! Sie haben die Auktion gewonnen";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Herzlichen Glückwunsch! Sie haben die Auktion gewonnen!</strong>')}
          ${infoBox('Auktionsdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${currentBid ? detailRow('Ihr Gebot', currentBid) : ''}
          `, 'success', settingsData)}
          ${paragraph('Wir werden uns in Kürze mit den nächsten Schritten zur Abwicklung bei Ihnen melden.')}
          ${button('Details ansehen', auctionUrl, settingsData)}
        `;
        break;

      case "lost":
        subject = "Auktion beendet";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Die Auktion für folgendes Fahrzeug wurde beendet:')}
          ${infoBox('Auktionsdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${yourBid ? detailRow('Ihr Gebot', yourBid) : ''}
            ${currentBid ? detailRow('Höchstgebot', currentBid) : ''}
          `, 'default', settingsData)}
          ${paragraph('Entdecken Sie weitere verfügbare Wohnmobile in unserer Plattform.')}
          ${button('Weitere Auktionen', 'https://caravanwert.de/kaufen', settingsData)}
        `;
        break;

      case "ending_soon":
        subject = "Auktion endet bald!";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Eine Auktion, für die Sie geboten haben, endet in Kürze:')}
          ${infoBox('Auktionsdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${yourBid ? detailRow('Ihr Gebot', yourBid) : ''}
            ${currentBid ? detailRow('Aktuelles Höchstgebot', currentBid) : ''}
            ${endTime ? detailRow('Endet am', endTime) : ''}
          `, 'warning', settingsData)}
          ${paragraph('<strong>Letzte Chance zum Bieten!</strong>')}
          ${button('Jetzt bieten', auctionUrl, settingsData)}
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
    console.error("Error sending auction notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
};

serve(handler);
