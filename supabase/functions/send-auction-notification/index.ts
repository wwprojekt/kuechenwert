import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, infoBox, detailRow, paragraph, button, customerBadge, amountDisplay } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AuctionEmailRequest {
  email: string;
  name: string;
  type: "new_auction" | "new_bid" | "outbid" | "won" | "lost" | "ending_soon" | "auction_started" | "seller_sold" | "seller_not_sold" | "kaufchance_invite" | "seller_kaufchance" | "seller_relisted" | "seller_new_offer" | "admin_new_offer" | "buyer_offer_rejected" | "buyer_counter_offer" | "kaufchance_expired";
  motorhomeModel: string;
  auctionUrl: string;
  currentBid?: string;
  yourBid?: string;
  endTime?: string;
  customerNumber?: string;
  // Kaufchance-specific fields
  rank?: string;
  expiresAt?: string;
  reservePrice?: string;
  topBiddersCount?: string;
  // Offer notification fields
  offerAmount?: string;
  buyerName?: string;
  sellerResponse?: string;
  counterAmount?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const auth = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!auth.authorized) return auth.response;

  try {
    const { email, name, type, motorhomeModel, auctionUrl, currentBid, yourBid, endTime, customerNumber: passedCustNum, rank, expiresAt, reservePrice, topBiddersCount, offerAmount, buyerName, sellerResponse, counterAmount }: AuctionEmailRequest = await req.json();

    console.log(`Sending ${type} notification to:`, email);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ─── ANTI-SPAM: new_bid max 1x pro 6h pro Seller pro Auktion ───
    if (type === 'new_bid' && email && auctionUrl) {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: recentBidEmail } = await supabase
        .from('admin_emails')
        .select('id')
        .eq('recipient_email', email)
        .eq('email_type', 'auction_new_bid')
        .ilike('subject', '%Neues Gebot%')
        .gt('created_at', sixHoursAgo)
        .limit(1);
      if (recentBidEmail && recentBidEmail.length > 0) {
        console.log(`Anti-spam: Skipped new_bid email to ${email} (already sent in last 6h)`);
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'throttled' }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
        });
      }
    }

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
      .limit(1)
      .maybeSingle();

    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'info@caravanwert.de',
      support_phone: '0511 / 51532476',
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

      case "seller_sold":
        subject = "Ihr Wohnmobil wurde erfolgreich verkauft!";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Großartige Neuigkeiten!</strong> Ihr Wohnmobil wurde über unsere Plattform erfolgreich an einen geprüften Händler verkauft.')}
          ${infoBox('Verkaufsdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${currentBid ? detailRow('Verkaufspreis', currentBid) : ''}
          `, 'success', settingsData)}
          ${paragraph('Wir werden uns in Kürze bei Ihnen melden, um die nächsten Schritte zu besprechen:')}
          ${paragraph('<strong>1.</strong> Terminvereinbarung für die Fahrzeugübergabe<br><strong>2.</strong> Bereitstellung aller Fahrzeugdokumente<br><strong>3.</strong> Zahlungsabwicklung')}
          ${paragraph('Den Kaufvertrag erhalten Sie in einer separaten E-Mail.')}
          ${button('Zum Dashboard', auctionUrl, settingsData)}
          ${paragraph(`Bei Fragen erreichen Sie uns jederzeit unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
          ${paragraph('Vielen Dank für Ihr Vertrauen!<br>Ihr ' + settingsData.site_name + ' Team')}
        `;
        break;

      case "seller_not_sold":
        subject = "Ihre Auktion ist beendet – Fahrzeug nicht verkauft";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Ihre Auktion für das folgende Fahrzeug ist leider ohne Verkauf beendet worden:')}
          ${infoBox('Auktionsdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${currentBid ? detailRow('Höchstes Gebot', currentBid) : detailRow('Gebote', 'Keine Gebote eingegangen')}
          `, 'default', settingsData)}
          ${paragraph(currentBid 
            ? 'Das Mindestgebot wurde leider nicht erreicht. Das bedeutet, dass kein verbindlicher Verkauf zustande gekommen ist.' 
            : 'Leider wurden keine Gebote auf Ihr Fahrzeug abgegeben.'
          )}
          ${paragraph('<strong>Wie geht es weiter?</strong> Unser Team wird sich in Kürze bei Ihnen melden, um die weiteren Optionen zu besprechen. Mögliche nächste Schritte sind:')}
          ${paragraph('<strong>1.</strong> Erneute Auktion mit angepasstem Mindestgebot<br><strong>2.</strong> Direktverkauf an einen unserer Partnerhändler<br><strong>3.</strong> Individuelle Beratung durch unser Expertenteam')}
          ${button('Zum Dashboard', auctionUrl, settingsData)}
          ${paragraph(`Kontaktieren Sie uns gerne unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
          ${paragraph('Mit freundlichen Grüßen,<br>Ihr ' + settingsData.site_name + ' Team')}
        `;
        break;

      case "kaufchance_invite":
        subject = `Kaufchance: ${motorhomeModel} – Ihr Angebot ist gefragt!`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Sie haben eine exklusive Kaufchance!</strong>')}
          ${paragraph('Die Auktion für das folgende Fahrzeug wurde beendet, ohne dass das Mindestgebot erreicht wurde. Als einer der Höchstbieter haben Sie die Möglichkeit, dem Verkäufer ein neues Angebot zu unterbreiten.')}
          ${infoBox('Fahrzeugdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${yourBid ? detailRow('Ihr höchstes Gebot', yourBid) : ''}
            ${currentBid ? detailRow('Höchstes Gebot insgesamt', currentBid) : ''}
            ${rank ? detailRow('Ihre Position', `Platz ${rank} von ${topBiddersCount || '2'} eingeladenen Bietern`) : ''}
          `, 'info', settingsData)}
          ${infoBox('Kaufchance-Details', `
            ${expiresAt ? detailRow('Angebotsfrist', expiresAt) : ''}
            ${detailRow('Status', 'Offen – Sie können jetzt ein Angebot abgeben')}
          `, 'warning', settingsData)}
          ${paragraph('<strong>So funktioniert es:</strong>')}
          ${paragraph('<strong>1.</strong> Klicken Sie auf den Button unten, um zur Auktionsseite zu gelangen<br><strong>2.</strong> Geben Sie Ihr Kaufangebot ab<br><strong>3.</strong> Der Verkäufer kann Ihr Angebot annehmen, ablehnen oder ein Gegenangebot machen<br><strong>4.</strong> Bei Einigung wird der Kaufvertrag automatisch erstellt')}
          ${button('Jetzt Angebot abgeben', auctionUrl, settingsData)}
          ${paragraph(`<em>Diese Kaufchance ist zeitlich begrenzt${expiresAt ? ` und läuft am ${expiresAt} ab` : ''}. Handeln Sie schnell!</em>`)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a>.`)}
          ${paragraph('Mit freundlichen Grüßen,<br>Ihr ' + settingsData.site_name + ' Team')}
        `;
        break;

      case "seller_kaufchance":
        subject = `Kaufchance für Ihr Fahrzeug: ${motorhomeModel}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Die Auktion für Ihr Fahrzeug wurde beendet. Leider wurde das Mindestgebot nicht erreicht – <strong>aber es gibt gute Neuigkeiten!</strong>')}
          ${infoBox('Auktionsergebnis', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${currentBid ? detailRow('Höchstes Gebot', currentBid) : ''}
            ${reservePrice ? detailRow('Ihr Mindestgebot', reservePrice) : ''}
          `, 'info', settingsData)}
          ${paragraph(`Wir haben die <strong>${topBiddersCount || '2'} Höchstbieter</strong> eingeladen, Ihnen ein neues Kaufangebot zu unterbreiten. Sie können diese Angebote in Ihrem Dashboard einsehen und darauf reagieren.`)}
          ${infoBox('Kaufchance-Phase', `
            ${expiresAt ? detailRow('Angebotsfrist', expiresAt) : ''}
            ${detailRow('Eingeladene Bieter', topBiddersCount || '2')}
            ${detailRow('Status', 'Warten auf Angebote')}
          `, 'warning', settingsData)}
          ${paragraph('<strong>Ihre Möglichkeiten:</strong>')}
          ${paragraph('<strong>1.</strong> Angebote im Dashboard einsehen<br><strong>2.</strong> Angebote annehmen, ablehnen oder Gegenangebote machen<br><strong>3.</strong> Unser Team unterstützt Sie bei der Verhandlung')}
          ${button('Angebote im Dashboard ansehen', auctionUrl, settingsData)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
          ${paragraph('Mit freundlichen Grüßen,<br>Ihr ' + settingsData.site_name + ' Team')}
        `;
        break;

      case "seller_relisted":
        subject = `Gute Neuigkeiten: ${motorhomeModel} – Erneute Auktion gestartet!`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Gute Neuigkeiten!</strong> Ihr Fahrzeug wurde erneut in unsere H&auml;ndler-Auktion aufgenommen.')}
          ${infoBox('Auktionsdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${endTime ? detailRow('Neues Auktionsende', endTime) : ''}
          `, 'success', settingsData)}
          ${paragraph('Ihr Fahrzeug ist ab sofort wieder f&uuml;r alle gepr&uuml;ften H&auml;ndler sichtbar und es k&ouml;nnen neue Gebote abgegeben werden.')}
          ${paragraph('<strong>Was bedeutet das f&uuml;r Sie?</strong>')}
          ${paragraph('<strong>1.</strong> Ihr Fahrzeug wird erneut 7 Tage lang versteigert<br><strong>2.</strong> Sie werden &uuml;ber eingehende Gebote informiert<br><strong>3.</strong> Unser Team begleitet Sie w&auml;hrend des gesamten Prozesses')}
          ${button('Auktion im Dashboard ansehen', auctionUrl, settingsData)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
          ${paragraph('Mit freundlichen Gr&uuml;&szlig;en,<br>Ihr ' + settingsData.site_name + ' Team')}
        `;
        break;

      case "seller_new_offer":
        // WICHTIG: Kein buyerName hier! Verkäufer darf Händler-Identität erst nach Kaufvertrag erfahren.
        subject = `Neues Kaufangebot f\u00fcr ${motorhomeModel}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Sie haben ein neues Kaufangebot erhalten!</strong>')}
          ${paragraph(`Ein H\u00e4ndler hat w\u00e4hrend der Kaufchance-Phase ein Angebot f\u00fcr Ihr Fahrzeug abgegeben.`)}
          ${infoBox('Angebotsdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${offerAmount ? detailRow('Angebotsbetrag', offerAmount) : ''}
            ${currentBid ? detailRow('Letztes Auktionsgebot', currentBid) : ''}
          `, 'success', settingsData)}
          ${paragraph('<strong>Ihre M\u00f6glichkeiten:</strong>')}
          ${paragraph('<strong>1.</strong> Angebot annehmen \u2013 Kaufvertrag wird automatisch erstellt<br><strong>2.</strong> Gegenangebot machen \u2013 Verhandeln Sie den Preis<br><strong>3.</strong> Angebot ablehnen \u2013 Warten Sie auf weitere Angebote')}
          ${button('Angebot im Dashboard ansehen', auctionUrl, settingsData)}
          ${paragraph(`<em>Reagieren Sie zeitnah, damit der H\u00e4ndler nicht abspringt.</em>`)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
        `;
        break;

      case "admin_new_offer":
        subject = `[Admin] Neues Kaufangebot f\u00fcr ${motorhomeModel}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${paragraph('<strong>Ein neues Kaufangebot ist eingegangen.</strong>')}
          ${infoBox('Angebotsdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${offerAmount ? detailRow('Angebotsbetrag', offerAmount) : ''}
            ${buyerName ? detailRow('H\u00e4ndler', buyerName) : ''}
            ${currentBid ? detailRow('Letztes Auktionsgebot', currentBid) : ''}
          `, 'success', settingsData)}
          ${button('Im Admin-Dashboard ansehen', auctionUrl, settingsData)}
        `;
        break;

      case "buyer_offer_rejected":
        subject = `Ihr Angebot f\u00fcr ${motorhomeModel} wurde abgelehnt`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Leider wurde Ihr Kaufangebot f\u00fcr das folgende Fahrzeug abgelehnt:')}
          ${infoBox('Angebotsdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${offerAmount ? detailRow('Ihr Angebot', offerAmount) : ''}
            ${sellerResponse ? detailRow('Begr\u00fcndung', sellerResponse) : ''}
          `, 'warning', settingsData)}
          ${paragraph('<strong>Wie geht es weiter?</strong>')}
          ${paragraph('Sie k\u00f6nnen jederzeit ein neues, h\u00f6heres Angebot abgeben, solange die Kaufchance-Phase noch l\u00e4uft. Nutzen Sie die Gelegenheit!')}
          ${button('Neues Angebot abgeben', auctionUrl, settingsData)}
          ${paragraph(`Entdecken Sie auch weitere verf\u00fcgbare Fahrzeuge auf unserer Plattform.`)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a>.`)}
        `;
        break;

      case "buyer_counter_offer":
        subject = `Gegenangebot f\u00fcr ${motorhomeModel} \u2013 Ihre Reaktion ist gefragt!`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Der Verk\u00e4ufer hat ein Gegenangebot gemacht!</strong>')}
          ${paragraph('Ihr Kaufangebot wurde nicht direkt angenommen, aber der Verk\u00e4ufer m\u00f6chte mit Ihnen verhandeln.')}
          ${infoBox('Verhandlungsdetails', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${offerAmount ? detailRow('Ihr Angebot', offerAmount) : ''}
            ${counterAmount ? detailRow('Gegenangebot des Verk\u00e4ufers', counterAmount) : ''}
            ${sellerResponse ? detailRow('Nachricht', sellerResponse) : ''}
          `, 'info', settingsData)}
          ${paragraph('<strong>Ihre M\u00f6glichkeiten:</strong>')}
          ${paragraph('<strong>1.</strong> Gegenangebot annehmen \u2013 Kaufvertrag wird erstellt<br><strong>2.</strong> Eigenes Gegenangebot machen \u2013 Weiter verhandeln<br><strong>3.</strong> Ablehnen \u2013 Verhandlung beenden')}
          ${button('Gegenangebot ansehen', auctionUrl, settingsData)}
          ${paragraph(`<em>Reagieren Sie zeitnah, um die Kaufchance nicht zu verpassen!</em>`)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a>.`)}
        `;
        break;

      case "kaufchance_expired":
        subject = `Kaufchance abgelaufen: ${motorhomeModel}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Die Kaufchance-Phase f\u00fcr das folgende Fahrzeug ist leider abgelaufen, ohne dass eine Einigung erzielt wurde.')}
          ${infoBox('Details', `
            ${detailRow('Fahrzeug', motorhomeModel)}
            ${detailRow('Status', 'Kaufchance abgelaufen')}
          `, 'warning', settingsData)}
          ${paragraph('Offene Angebote wurden automatisch als abgelaufen markiert.')}
          ${paragraph('Entdecken Sie weitere verf\u00fcgbare Fahrzeuge auf unserer Plattform:')}
          ${button('Fahrzeuge entdecken', auctionUrl, settingsData)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a>.`)}
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

    // Log in admin_emails for System tab
    try {
      await supabase.from('admin_emails').insert({
        sender_email: 'info@caravanwert.de',
        sender_name: settingsData.site_name,
        recipient_email: email,
        recipient_name: name || null,
        subject,
        body_html: html,
        body_text: '',
        email_type: `auction_${type}`,
        direction: 'outbound',
        status: 'sent',
        resend_id: result.id || null,
        is_read: true,
      });
    } catch (logErr) {
      console.error('Failed to log email in admin_emails:', logErr);
    }

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
