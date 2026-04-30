import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, infoBox, detailRow, paragraph, button, customerBadge, amountDisplay } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import { MARKETING_CONFIG } from '../_shared/marketing-config.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AuctionEmailRequest {
  email: string;
  name: string;
  type:
    | "new_auction" | "new_bid" | "outbid" | "won" | "lost" | "ending_soon"
    | "auction_started" | "seller_sold" | "seller_not_sold"
    | "kaufchance_invite" | "seller_kaufchance" | "seller_relisted"
    | "seller_new_offer" | "admin_new_offer" | "buyer_offer_rejected"
    | "buyer_counter_offer" | "kaufchance_expired" | "seller_buyer_rejected"
    | "seller_auto_relisted" | "auction_relisted"
    // Festpreis lifecycle
    | "seller_festpreis_extended"
    | "admin_festpreis_needs_price"
    // Soft brake (round warning)
    | "seller_festpreis_round_warning"
    | "seller_auction_round_warning"
    // Phase-4 Audit-Fix #6: 3-Buttons-Mail wenn Marketing-Phase endgültig abläuft
    | "seller_soft_brake"
    // Phase-4 Audit-Fix #10: Festpreis erreicht 30-Tage-Cap (eigener Mailtype,
    // statt nur generic seller_not_sold), erklärt Cap + nächste Schritte
    | "seller_festpreis_cap_reached"
    // Phase-4 Audit-Fix #8: Opt-in Mail an Bestand-Inserate. Erklärt das neue
    // Phase-4-System, kündigt 60-Tage Soft-Cap transparent an, gibt Toggles im
    // Dashboard frei (Verkäufer entscheidet selbst über dynamic_pricing).
    | "seller_existing_listing_optin"
    // 2026-04-23: Eigener Mailtype für den Fall "Verkäufer hat in der
    // Kaufchance-Phase die Auto-Wiedereinstellung deaktiviert". Vorher wurde
    // hier die generische Bieter-Mail "kaufchance_expired" missbraucht, was
    // weder den Status (eigene Entscheidung) noch die nächsten Schritte
    // (manuell neu inserieren) kommuniziert hat.
    | "seller_chose_to_end";
  kitchenModel: string;
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
  // Festpreis flag
  isFestpreis?: boolean;
  // Flag: listing only ended/expired (not sold) – used for lost-subject
  listingEnded?: boolean;
  // Festpreis auto-extend / soft brake fields
  roundNumber?: string;       // e.g. "2"  – currently active round number
  extendedUntil?: string;     // formatted new end_time after auto-extension
  sellerName?: string;        // used for admin_festpreis_needs_price body
  kitchenId?: string;       // optional, for admin deep-link
  // Phase-4 Audit-Fix #6/#10: Soft-Brake & Festpreis-Cap Felder
  softBrakeReason?: 'max_rounds_reached' | 'marketing_phase_expired' | 'auto_relist_off';
  isAuctionType?: boolean;    // true=Auktion, false=Festpreis (für Soft-Brake-Mail)
  // Phase-4 Audit-Fix #8: Opt-in Mail Felder
  softCapDate?: string;       // formatted date (z.B. "20.06.2026") wann Bestand-Soft-Cap greift
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const auth = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!auth.authorized) return auth.response;

  try {
    const {
      email, name, type, kitchenModel, auctionUrl, currentBid, yourBid, endTime,
      customerNumber: passedCustNum, rank, expiresAt, reservePrice, topBiddersCount,
      offerAmount, buyerName, sellerResponse, counterAmount, isFestpreis, listingEnded,
      roundNumber, extendedUntil, sellerName, kitchenId,
      softBrakeReason, isAuctionType, softCapDate,
    }: AuctionEmailRequest = await req.json();

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
      site_name: 'KÃ¼chenWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'info@kuechenwert24.de',
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
            ${detailRow('Fahrzeug', kitchenModel)}
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
            ${detailRow('Fahrzeug', kitchenModel)}
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
            ${detailRow('Fahrzeug', kitchenModel)}
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
            ${detailRow('Fahrzeug', kitchenModel)}
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
            ${detailRow('Fahrzeug', kitchenModel)}
            ${currentBid ? detailRow('Ihr Gebot', currentBid) : ''}
          `, 'success', settingsData)}
          ${paragraph('Wir werden uns in Kürze mit den nächsten Schritten zur Abwicklung bei Ihnen melden.')}
          ${button('Details ansehen', auctionUrl, settingsData)}
        `;
        break;

      case "lost":
        subject = listingEnded
          ? "Inserat beendet – Ihr Angebot ist abgelaufen"
          : (isFestpreis ? "Fahrzeug verkauft – Ihr Angebot wurde nicht berücksichtigt" : "Auktion beendet");
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph(listingEnded
            ? 'Das Inserat für folgendes Fahrzeug wurde beendet, ohne dass ein Verkauf zustande kam. Ihr Angebot ist damit abgelaufen:'
            : (isFestpreis
              ? 'Das folgende Fahrzeug wurde an einen anderen Händler verkauft:'
              : 'Die Auktion für folgendes Fahrzeug wurde beendet:')
          )}
          ${infoBox(isFestpreis ? 'Angebotsdetails' : 'Auktionsdetails', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${yourBid ? detailRow(isFestpreis ? 'Ihr Angebot' : 'Ihr Gebot', yourBid) : ''}
            ${currentBid && !listingEnded ? detailRow(isFestpreis ? 'Verkaufspreis' : 'Höchstgebot', currentBid) : ''}
          `, 'default', settingsData)}
          ${paragraph('Entdecken Sie weitere verfügbare Wohnmobile auf unserer Plattform.')}
          ${button('Weitere Fahrzeuge', 'https://kuechenwert24.de/kaufen', settingsData)}
        `;
        break;

      case "seller_sold":
        subject = "Ihr Wohnmobil wurde erfolgreich verkauft!";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Großartige Neuigkeiten!</strong> Ihr Wohnmobil wurde über unsere Plattform erfolgreich an einen geprüften Händler verkauft.')}
          ${infoBox('Verkaufsdetails', `
            ${detailRow('Fahrzeug', kitchenModel)}
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
            ${detailRow('Fahrzeug', kitchenModel)}
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
        subject = `Kaufchance: ${kitchenModel} – Ihr Angebot ist gefragt!`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Sie haben eine exklusive Kaufchance!</strong>')}
          ${paragraph('Die Auktion für das folgende Fahrzeug wurde beendet, ohne dass das Mindestgebot erreicht wurde. Als einer der Höchstbieter haben Sie die Möglichkeit, dem Verkäufer ein neues Angebot zu unterbreiten.')}
          ${infoBox('Fahrzeugdetails', `
            ${detailRow('Fahrzeug', kitchenModel)}
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
        subject = `Kaufchance für Ihr Fahrzeug: ${kitchenModel}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Die Auktion für Ihr Fahrzeug wurde beendet. Leider wurde das Mindestgebot nicht erreicht – <strong>aber es gibt gute Neuigkeiten!</strong>')}
          ${infoBox('Auktionsergebnis', `
            ${detailRow('Fahrzeug', kitchenModel)}
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
          ${paragraph(`<strong>Hinweis zum Auto-System:</strong> Wenn die Kaufchance ohne Einigung endet, wird Ihr Inserat automatisch in eine neue Auktionsrunde überführt (max. ${MARKETING_CONFIG.AUCTION_MAX_ROUNDS} Runden insgesamt, max. -${Math.round(MARKETING_CONFIG.AUCTION_MAX_TOTAL_REDUCTION * 100)} % Mindestpreis-Reduktion). Sie können beide Automatiken (Wiedereinstellung und Preissenkung) jederzeit im Dashboard deaktivieren.`)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
          ${paragraph('Mit freundlichen Grüßen,<br>Ihr ' + settingsData.site_name + ' Team')}
        `;
        break;

      case "seller_relisted":
        subject = `Gute Neuigkeiten: ${kitchenModel} – Erneute Auktion gestartet!`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Gute Neuigkeiten!</strong> Ihr Fahrzeug wurde erneut in unsere H&auml;ndler-Auktion aufgenommen.')}
          ${infoBox('Auktionsdetails', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${endTime ? detailRow('Neues Auktionsende', endTime) : ''}
          `, 'success', settingsData)}
          ${paragraph('Ihr Fahrzeug ist ab sofort wieder f&uuml;r alle gepr&uuml;ften H&auml;ndler sichtbar und es k&ouml;nnen neue Gebote abgegeben werden.')}
          ${paragraph('<strong>Was bedeutet das f&uuml;r Sie?</strong>')}
          ${paragraph(`<strong>1.</strong> Ihr Fahrzeug wird erneut <strong>${MARKETING_CONFIG.AUCTION_DURATION_DAYS} Tage</strong> lang versteigert<br><strong>2.</strong> Sie werden &uuml;ber eingehende Gebote informiert<br><strong>3.</strong> Unser Team begleitet Sie w&auml;hrend des gesamten Prozesses`)}
          ${button('Auktion im Dashboard ansehen', auctionUrl, settingsData)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
          ${paragraph('Mit freundlichen Gr&uuml;&szlig;en,<br>Ihr ' + settingsData.site_name + ' Team')}
        `;
        break;

      case "seller_new_offer":
        // WICHTIG: Kein buyerName hier! Verkäufer darf Händler-Identität erst nach Kaufvertrag erfahren.
        subject = isFestpreis ? `Neuer Preisvorschlag f\u00fcr ${kitchenModel}` : `Neues Kaufangebot f\u00fcr ${kitchenModel}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Sie haben ein neues Kaufangebot erhalten!</strong>')}
          ${paragraph(isFestpreis
            ? 'Ein Händler hat einen Preisvorschlag für Ihr Fahrzeug abgegeben.'
            : 'Ein Händler hat während der Kaufchance-Phase ein Angebot für Ihr Fahrzeug abgegeben.'
          )}
          ${infoBox('Angebotsdetails', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${offerAmount ? detailRow('Angebotsbetrag', offerAmount) : ''}
            ${currentBid ? detailRow(isFestpreis ? 'Ihr Festpreis' : 'Letztes Auktionsgebot', currentBid) : ''}
          `, 'success', settingsData)}
          ${paragraph('<strong>Ihre M\u00f6glichkeiten:</strong>')}
          ${paragraph('<strong>1.</strong> Angebot annehmen \u2013 Kaufvertrag wird automatisch erstellt<br><strong>2.</strong> Gegenangebot machen \u2013 Verhandeln Sie den Preis<br><strong>3.</strong> Angebot ablehnen \u2013 Warten Sie auf weitere Angebote')}
          ${button('Angebot im Dashboard ansehen', auctionUrl, settingsData)}
          ${paragraph(`<em>Reagieren Sie zeitnah, damit der H\u00e4ndler nicht abspringt.</em>`)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
        `;
        break;

      case "admin_new_offer":
        subject = `[Admin] ${isFestpreis ? 'Neuer Preisvorschlag' : 'Neues Kaufangebot'} f\u00fcr ${kitchenModel}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${paragraph(isFestpreis ? '<strong>Ein neuer Preisvorschlag ist eingegangen.</strong>' : '<strong>Ein neues Kaufangebot ist eingegangen.</strong>')}
          ${infoBox('Angebotsdetails', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${offerAmount ? detailRow('Angebotsbetrag', offerAmount) : ''}
            ${buyerName ? detailRow('H\u00e4ndler', buyerName) : ''}
            ${currentBid ? detailRow(isFestpreis ? 'Festpreis' : 'Letztes Auktionsgebot', currentBid) : ''}
          `, 'success', settingsData)}
          ${button('Im Admin-Dashboard ansehen', auctionUrl, settingsData)}
        `;
        break;

      case "buyer_offer_rejected":
        subject = `Ihr Angebot f\u00fcr ${kitchenModel} wurde abgelehnt`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Leider wurde Ihr Kaufangebot f\u00fcr das folgende Fahrzeug abgelehnt:')}
          ${infoBox('Angebotsdetails', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${offerAmount ? detailRow('Ihr Angebot', offerAmount) : ''}
            ${sellerResponse ? detailRow('Begr\u00fcndung', sellerResponse) : ''}
          `, 'warning', settingsData)}
          ${paragraph('<strong>Wie geht es weiter?</strong>')}
          ${paragraph(isFestpreis
            ? 'Sie können jederzeit ein neues Angebot abgeben, solange das Inserat noch aktiv ist.'
            : 'Sie können jederzeit ein neues, höheres Angebot abgeben, solange die Kaufchance-Phase noch läuft. Nutzen Sie die Gelegenheit!'
          )}
          ${button('Neues Angebot abgeben', auctionUrl, settingsData)}
          ${paragraph(`Entdecken Sie auch weitere verf\u00fcgbare Fahrzeuge auf unserer Plattform.`)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a>.`)}
        `;
        break;

      case "buyer_counter_offer":
        subject = `Gegenangebot f\u00fcr ${kitchenModel} \u2013 Ihre Reaktion ist gefragt!`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Der Verk\u00e4ufer hat ein Gegenangebot gemacht!</strong>')}
          ${paragraph('Ihr Kaufangebot wurde nicht direkt angenommen, aber der Verk\u00e4ufer m\u00f6chte mit Ihnen verhandeln.')}
          ${infoBox('Verhandlungsdetails', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${offerAmount ? detailRow('Ihr Angebot', offerAmount) : ''}
            ${counterAmount ? detailRow('Gegenangebot des Verk\u00e4ufers', counterAmount) : ''}
            ${sellerResponse ? detailRow('Nachricht', sellerResponse) : ''}
          `, 'info', settingsData)}
          ${paragraph('<strong>Ihre M\u00f6glichkeiten:</strong>')}
          ${paragraph('<strong>1.</strong> Gegenangebot annehmen \u2013 Kaufvertrag wird erstellt<br><strong>2.</strong> Eigenes Gegenangebot machen \u2013 Weiter verhandeln<br><strong>3.</strong> Ablehnen \u2013 Verhandlung beenden')}
          ${button('Gegenangebot ansehen', auctionUrl, settingsData)}
          ${paragraph(isFestpreis
            ? '<em>Reagieren Sie zeitnah, damit das Angebot nicht verfällt!</em>'
            : '<em>Reagieren Sie zeitnah, um die Kaufchance nicht zu verpassen!</em>'
          )}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a>.`)}
        `;
        break;

      case "seller_buyer_rejected":
        subject = `Gegenangebot abgelehnt: ${kitchenModel}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Ein H\u00e4ndler hat Ihr Gegenangebot abgelehnt.</strong>')}
          ${paragraph('Der H\u00e4ndler hat sich entschieden, Ihr Gegenangebot f\u00fcr das folgende Fahrzeug nicht anzunehmen.')}
          ${infoBox('Verhandlungsdetails', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${offerAmount ? detailRow('Angebot des H\u00e4ndlers', offerAmount) : ''}
            ${counterAmount ? detailRow('Ihr Gegenangebot', counterAmount) : ''}
            ${buyerName ? detailRow('H\u00e4ndler', buyerName) : ''}
          `, 'warning', settingsData)}
          ${paragraph('<strong>Wie geht es weiter?</strong>')}
          ${paragraph(isFestpreis
            ? 'Sie können dem Händler ein neues Gegenangebot machen oder auf weitere Angebote von anderen Händlern warten.'
            : 'Sie können dem Händler ein neues, niedrigeres Gegenangebot machen oder auf weitere Angebote von anderen eingeladenen Bietern warten.'
          )}
          ${button('Angebote im Dashboard ansehen', auctionUrl, settingsData)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
        `;
        break;

      case "kaufchance_expired":
        subject = `Kaufchance abgelaufen: ${kitchenModel}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Die Kaufchance-Phase f\u00fcr das folgende Fahrzeug ist leider abgelaufen, ohne dass eine Einigung erzielt wurde.')}
          ${infoBox('Details', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${detailRow('Status', 'Kaufchance abgelaufen')}
          `, 'warning', settingsData)}
          ${paragraph('Offene Angebote wurden automatisch als abgelaufen markiert.')}
          ${paragraph('Entdecken Sie weitere verf\u00fcgbare Fahrzeuge auf unserer Plattform:')}
          ${button('Fahrzeuge entdecken', auctionUrl, settingsData)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a>.`)}
        `;
        break;

      case "seller_chose_to_end": {
        // 2026-04-23: Verkäufer-Bestätigungs-Mail nach Opt-out aus der
        // Auto-Wiedereinstellung. Tritt ein wenn `auto_relist=false` und die
        // Kaufchance-Phase regulär ausläuft. Erklärt explizit, dass die
        // Beendigung die eigene Entscheidung war, listet was passiert ist,
        // und führt mit einem direkten CTA ins Dashboard, wo das Inserat
        // jederzeit als neue Auktion oder als Festpreis wieder eingestellt
        // werden kann. Kein Hinweis auf "Re-Enable Auto-Relist", weil die
        // RPC `toggle_auto_relist` nur in den Stati `kaufchance` oder
        // `active` (instant_price) erlaubt ist – der Auktions-Datensatz
        // selbst ist hier bereits `ended` und nicht mehr toggle-bar.
        subject = `Auktion beendet wie gewünscht: ${kitchenModel}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Sie haben in der Kaufchance-Phase die <strong>Auto-Wiedereinstellung deaktiviert</strong>. Die 24-stündige Verhandlungsphase ist nun abgelaufen und Ihre Auktion ist – wie von Ihnen gewünscht – endgültig beendet.')}
          ${infoBox('Status Ihres Inserats', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${reservePrice ? detailRow('Letzter Mindestpreis', reservePrice) : ''}
            ${roundNumber ? detailRow('Erreichte Runde', String(roundNumber)) : ''}
            ${detailRow('Status', 'Beendet (auf Ihren Wunsch)')}
          `, 'info', settingsData)}
          ${paragraph('<strong>Was ist gerade passiert?</strong>')}
          ${paragraph('\u2022 Alle offenen Kaufchance-Angebote wurden automatisch als abgelaufen markiert<br>\u2022 Eingeladene H\u00e4ndler wurden \u00fcber das Auktionsende informiert<br>\u2022 Ihr Fahrzeug ist auf der Plattform <strong>nicht mehr sichtbar</strong>')}
          ${paragraph('<strong>So geht es weiter:</strong> Sie k\u00f6nnen Ihr Fahrzeug jederzeit als neues Inserat wieder einstellen \u2013 wahlweise als Auktion mit angepasstem Mindestpreis oder als Festpreis-Inserat. Ihre Fahrzeugdaten und Fotos sind im Dashboard gespeichert und k\u00f6nnen mit wenigen Klicks \u00fcbernommen werden.')}
          ${button('Inserat im Dashboard verwalten', auctionUrl, settingsData)}
          ${paragraph(`Sie haben Ihre Meinung ge\u00e4ndert oder ben\u00f6tigen Beratung zur n\u00e4chsten Vermarktung? Wir helfen Ihnen pers\u00f6nlich weiter \u2013 erreichbar unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
          ${paragraph('Mit freundlichen Grüßen,<br>Ihr ' + settingsData.site_name + ' Team')}
        `;
        break;
      }

      case "seller_auto_relisted":
        subject = `Neue Auktionsrunde gestartet: ${kitchenModel}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Die Kaufchance-Phase f\u00fcr Ihr Fahrzeug ist abgelaufen, ohne dass eine Einigung erzielt wurde. <strong>Gem\u00e4\u00df unseren AGB wurde Ihr Fahrzeug automatisch erneut in die Auktion aufgenommen.</strong>')}
          ${infoBox('Neue Auktion', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${currentBid ? detailRow('Auktionsrunde', currentBid) : ''}
            ${endTime ? detailRow('Neues Auktionsende', endTime) : ''}
            ${reservePrice ? detailRow('Neuer Mindestpreis', reservePrice) : ''}
          `, 'success', settingsData)}
          ${paragraph('<strong>Was bedeutet das f\u00fcr Sie?</strong>')}
          ${paragraph(`<strong>1.</strong> Ihr Fahrzeug wird erneut <strong>${MARKETING_CONFIG.AUCTION_DURATION_DAYS} Tage</strong> lang versteigert<br><strong>2.</strong> Alle gepr\u00fcften H\u00e4ndler k\u00f6nnen neue Gebote abgeben<br><strong>3.</strong> Der Mindestpreis wurde ggf. angepasst (Reduktion bis maximal -${Math.round(MARKETING_CONFIG.AUCTION_MAX_TOTAL_REDUCTION * 100)} % vom urspr\u00fcnglichen Wert)`)}
          ${paragraph(`<strong>Sie haben jederzeit die Kontrolle:</strong><br>\u2022 <strong>Auto-Wiedereinstellung</strong> deaktivieren: Auktion endet nach dieser Runde<br>\u2022 <strong>Automatische Preissenkung</strong> deaktivieren: Mindestpreis bleibt stabil<br>Beide Toggles finden Sie im Dashboard unter Ihrem Inserat.`)}
          ${button('Im Dashboard ansehen', auctionUrl, settingsData)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
        `;
        break;

      case "auction_relisted":
        subject = `Neue Chance: ${kitchenModel} \u2013 erneut in der Auktion!`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Gute Neuigkeiten!</strong> Ein Fahrzeug, f\u00fcr das Sie sich interessiert haben, ist erneut in der Auktion verf\u00fcgbar.')}
          ${infoBox('Auktionsdetails', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${currentBid ? detailRow('Auktionsrunde', currentBid) : ''}
            ${endTime ? detailRow('Auktionsende', endTime) : ''}
          `, 'info', settingsData)}
          ${paragraph('Die vorherige Kaufchance-Verhandlung endete ohne Einigung. Jetzt haben Sie erneut die M\u00f6glichkeit, auf dieses Fahrzeug zu bieten.')}
          ${paragraph('<strong>Tipp:</strong> Nutzen Sie die Auto-Bid Funktion, um automatisch bis zu Ihrem Maximalgebot mitzubieten.')}
          ${button('Jetzt mitbieten', auctionUrl, settingsData)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a>.`)}
        `;
        break;

      case "seller_festpreis_extended": {
        // Festpreis-Inserat wurde automatisch um INSTANT_PRICE_DURATION_DAYS
        // verlängert (kein Käufer hat den Festpreis akzeptiert). Verkäufer
        // wird informiert + zum Preis-Senken angeregt.
        const round = roundNumber || '2';
        subject = `Ihr Festpreis-Inserat wurde verlängert: ${kitchenModel}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph(`Ihr Festpreis-Inserat wurde leider noch nicht verkauft und deshalb <strong>automatisch um ${MARKETING_CONFIG.INSTANT_PRICE_DURATION_DAYS} Tage verlängert</strong>. Sie befinden sich nun in <strong>Runde ${round}</strong>.`)}
          ${infoBox('Inserat-Details', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${currentBid ? detailRow('Aktueller Festpreis', currentBid) : ''}
            ${extendedUntil ? detailRow('Neues Ablaufdatum', extendedUntil) : (endTime ? detailRow('Neues Ablaufdatum', endTime) : '')}
            ${detailRow('Runde', String(round))}
          `, 'info', settingsData)}
          ${paragraph('<strong>Tipp: Senken Sie Ihren Festpreis</strong>')}
          ${paragraph('Erfahrungsgemäß steigt die Kaufwahrscheinlichkeit deutlich, wenn der Festpreis um 5–10 % gesenkt wird. Sie können den Preis jederzeit in Ihrem Dashboard anpassen.')}
          ${button('Festpreis im Dashboard anpassen', auctionUrl, settingsData)}
          ${paragraph(`<strong>Sie haben jederzeit die Kontrolle:</strong><br>\u2022 <strong>Auto-Verlängerung</strong> deaktivieren: Inserat endet zum aktuellen Ablaufdatum<br>\u2022 <strong>Automatische Preissenkung</strong> deaktivieren: Festpreis bleibt stabil<br>Beide Toggles finden Sie im Dashboard unter dem Inserat.`)}
          ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
        `;
        break;
      }

      case "admin_festpreis_needs_price": {
        // Admin-Hilferuf: Festpreis-Inserat ist abgelaufen, hat aber NULL/0 als
        // instant_price. Admin muss manuell einen Preis setzen.
        subject = `[Admin] Festpreis fehlt: ${kitchenModel} – manuelle Aktion nötig`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${paragraph('<strong>Ein Festpreis-Inserat ist abgelaufen, hat aber keinen Festpreis hinterlegt.</strong> Bitte setzen Sie manuell einen Festpreis im Admin-Dashboard, damit das Inserat wieder verkauft werden kann.')}
          ${infoBox('Inserat-Details', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${sellerName ? detailRow('Verkäufer', sellerName) : ''}
            ${kitchenId ? detailRow('Kitchen-ID', kitchenId) : ''}
            ${detailRow('Status', 'Aktiv (24h Sichtbarkeit) – instant_price = NULL/0')}
          `, 'warning', settingsData)}
          ${paragraph('<strong>Was passiert ohne Aktion?</strong> Das Inserat bleibt 24 Stunden aktiv sichtbar und wird danach beendet. Es gibt keine weitere automatische Verlängerung.')}
          ${button('Im Admin-Dashboard öffnen', auctionUrl, settingsData)}
        `;
        break;
      }

      case "seller_festpreis_round_warning": {
        // Soft brake: Festpreis-Inserat ist in Runde >=2 → Verkäufer wird sanft
        // erinnert, dass das Inserat noch nicht verkauft wurde, und bekommt
        // konkrete Handlungsempfehlungen.
        const round = roundNumber || '2';
        subject = `Runde ${round}: ${kitchenModel} – Tipps für einen schnelleren Verkauf`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph(`Ihr Festpreis-Inserat befindet sich bereits in <strong>Runde ${round}</strong>. Damit es schneller verkauft wird, haben wir ein paar Empfehlungen für Sie zusammengestellt.`)}
          ${infoBox('Inserat-Details', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${currentBid ? detailRow('Aktueller Festpreis', currentBid) : ''}
            ${detailRow('Runde', String(round))}
            ${endTime ? detailRow('Aktuelles Ablaufdatum', endTime) : ''}
          `, 'warning', settingsData)}
          ${paragraph('<strong>Unsere Empfehlungen:</strong>')}
          ${paragraph('<strong>1.</strong> Festpreis senken (5–10 % deutlich erhöht die Kaufquote)<br><strong>2.</strong> Auf Auktion umstellen, um Händler-Konkurrenz zu nutzen<br><strong>3.</strong> Fotos und Beschreibung prüfen und ggf. ergänzen')}
          ${button('Inserat im Dashboard anpassen', auctionUrl, settingsData)}
          ${paragraph(`Gern beraten wir Sie persönlich. Erreichbar unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
        `;
        break;
      }

      case "seller_auction_round_warning": {
        // Soft brake: Auktion ist in Runde >=2 → Verkäufer wird sanft erinnert.
        const round = roundNumber || '2';
        subject = `Runde ${round}: Auktion ${kitchenModel} – Mindestpreis prüfen`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph(`Ihre Auktion läuft bereits in <strong>Runde ${round}</strong>. Bisher wurde noch keine Einigung erzielt. Damit Ihr Fahrzeug zügig den passenden Käufer findet, hier ein paar Hinweise.`)}
          ${infoBox('Auktion-Details', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${currentBid ? detailRow('Aktuelles Höchstgebot', currentBid) : detailRow('Gebote', 'Noch keine Gebote in dieser Runde')}
            ${reservePrice ? detailRow('Aktueller Mindestpreis', reservePrice) : ''}
            ${detailRow('Runde', String(round))}
            ${endTime ? detailRow('Auktionsende', endTime) : ''}
          `, 'warning', settingsData)}
          ${paragraph('<strong>Unsere Empfehlungen:</strong>')}
          ${paragraph('<strong>1.</strong> Mindestpreis prüfen – ist er marktrealistisch?<br><strong>2.</strong> Nachtrag mit zusätzlichen Informationen veröffentlichen (z. B. neue Reifen, frischer TÜV)<br><strong>3.</strong> Automatische Wiedereinstellung deaktivieren, wenn Sie das Fahrzeug aus dem Verkauf nehmen möchten')}
          ${button('Auktion im Dashboard ansehen', auctionUrl, settingsData)}
          ${paragraph(`Wir beraten Sie gern persönlich unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
        `;
        break;
      }

      case "seller_soft_brake": {
        // Phase-4 Audit-Fix #6: Endgültige Soft-Brake-Mail mit 3 Buttons.
        // Wird gesendet, wenn die Marketing-Phase final ausläuft (max rounds
        // erreicht oder marketing_phase_max_until überschritten oder Verkäufer
        // hat auto_relist deaktiviert). Erklärt den Status, gibt 3 klare CTAs.
        const reason = softBrakeReason || 'max_rounds_reached';
        const channelLabel = isAuctionType === false ? 'Festpreis-Inserat' : 'Auktion';
        const reasonText: Record<string, string> = {
          max_rounds_reached: `Ihr ${channelLabel} hat die maximale Anzahl von ${MARKETING_CONFIG.AUCTION_MAX_ROUNDS} Runden erreicht und die Marketing-Phase ist damit abgeschlossen.`,
          marketing_phase_expired: `Die vereinbarte Marketing-Phase für Ihr ${channelLabel} ist abgelaufen.`,
          auto_relist_off: `Die Auto-Wiedereinstellung Ihres ${channelLabel}s ist deaktiviert und die aktuelle Runde ist beendet.`,
        };
        subject = `Marketing-Phase abgeschlossen: ${kitchenModel} – wie geht es weiter?`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph(`<strong>${reasonText[reason] || reasonText.max_rounds_reached}</strong>`)}
          ${infoBox('Inserat-Status', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${roundNumber ? detailRow('Erreichte Runde', String(roundNumber)) : ''}
            ${reservePrice ? detailRow('Letzter Mindestpreis', reservePrice) : ''}
            ${detailRow('Status', 'Beendet – keine automatische Wiedereinstellung')}
          `, 'warning', settingsData)}
          ${paragraph('<strong>Drei Optionen, um Ihr Fahrzeug erfolgreich zu verkaufen:</strong>')}
          ${button('1. Erneut starten (frische Marketing-Phase)', auctionUrl + '?action=restart', settingsData)}
          ${button('2. Mindestpreis anpassen und neu starten', auctionUrl + '?action=adjust-price', settingsData)}
          ${button('3. Inserat archivieren (vom Markt nehmen)', auctionUrl + '?action=archive', settingsData)}
          ${paragraph('Alle drei Aktionen führen Sie sicher durch Ihr Dashboard. Sie müssen sich nur einmal einloggen und auf den passenden Button klicken.')}
          ${paragraph(`<em>Wir beraten Sie gern persönlich: <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.</em>`)}
          ${paragraph('Mit freundlichen Grüßen,<br>Ihr ' + settingsData.site_name + ' Team')}
        `;
        break;
      }

      case "seller_festpreis_cap_reached": {
        // Phase-4 Audit-Fix #10: Festpreis hat die 30-Tage-Marketing-Phase
        // erreicht. Eigene Mail (statt generic seller_not_sold), erklärt den
        // Cap und führt zu den nächsten Schritten.
        subject = `Ihr Festpreis-Inserat ist beendet: ${kitchenModel}`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph(`Ihr Festpreis-Inserat hat die vereinbarte Marketing-Phase von <strong>${MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_DAYS} Tagen</strong> erreicht und ist nun beendet.`)}
          ${infoBox('Inserat-Übersicht', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${currentBid ? detailRow('Letzter Festpreis', currentBid) : ''}
            ${roundNumber ? detailRow('Verlängerungs-Runden', String(roundNumber)) : ''}
            ${detailRow('Status', 'Beendet – Marketing-Phase abgeschlossen')}
          `, 'warning', settingsData)}
          ${paragraph('<strong>So geht es weiter:</strong>')}
          ${paragraph('<strong>1.</strong> Inserat erneut starten – mit angepasstem Festpreis<br><strong>2.</strong> Auf Auktion umstellen, um Händler-Wettbewerb zu nutzen<br><strong>3.</strong> Persönliche Beratung durch unser Team')}
          ${button('Optionen im Dashboard ansehen', auctionUrl, settingsData)}
          ${paragraph(`Wir beraten Sie gern: <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.`)}
          ${paragraph('Mit freundlichen Grüßen,<br>Ihr ' + settingsData.site_name + ' Team')}
        `;
        break;
      }

      case "seller_existing_listing_optin": {
        // Phase-4 Audit-Fix #8: Einmalige Opt-in-Info-Mail für Bestand-Inserate.
        // Erklärt das neue Phase-4-System, kündigt 60-Tage Soft-Cap transparent
        // an, weist auf Dashboard-Toggles hin (Verkäufer kann freiwillig
        // dynamic_pricing + auto_relist nutzen).
        subject = `Wichtige Info zu Ihrem Inserat: ${kitchenModel} – neue Vermarktungs-Optionen`;
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('<strong>Wir haben unser Vermarktungs-System verbessert</strong>, damit Ihr Fahrzeug schneller den passenden Käufer findet. Diese Mail informiert Sie über die Änderungen, die Ihr aktives Inserat betreffen.')}
          ${infoBox('Ihr Inserat', `
            ${detailRow('Fahrzeug', kitchenModel)}
            ${reservePrice ? detailRow('Aktueller Mindestpreis', reservePrice) : ''}
            ${detailRow('Status', 'Aktiv – nach bisheriger Logik')}
          `, 'info', settingsData)}
          ${paragraph(`<strong>Was ist neu?</strong>`)}
          ${paragraph(`\u2022 <strong>Dynamische Preissenkung</strong>: -${Math.round(MARKETING_CONFIG.AUCTION_REDUCTION_PER_ROUND * 100)} % pro Runde, max. -${Math.round(MARKETING_CONFIG.AUCTION_MAX_TOTAL_REDUCTION * 100)} % vom Initial-Wert (rechtlich abgesichert in §6 AGB).<br>\u2022 <strong>Auto-Wiedereinstellung</strong>: bis zu ${MARKETING_CONFIG.AUCTION_MAX_ROUNDS} Auktionsrunden à ${MARKETING_CONFIG.AUCTION_DURATION_DAYS} Tage + ${MARKETING_CONFIG.KAUFCHANCE_DURATION_HOURS}h Kaufchance.<br>\u2022 <strong>Frische Vermarktungs-Phase</strong>: 16 Tage Auktion / ${MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_DAYS} Tage Festpreis – danach klare Beendigung statt unbegrenzter Verlängerung.`)}
          ${infoBox('Übergangsregelung für Ihr Inserat', `
            ${detailRow('Soft-Cap-Datum', softCapDate || `${MARKETING_CONFIG.EXISTING_LISTINGS_GRACE_DAYS} Tage ab heute`)}
            ${detailRow('Status nach Soft-Cap', 'Inserat wird automatisch beendet')}
            ${detailRow('Vor Soft-Cap', 'Ihr Inserat läuft wie bisher weiter')}
          `, 'warning', settingsData)}
          ${paragraph(`<strong>Sie haben drei Optionen:</strong>`)}
          ${paragraph(`<strong>1. Nichts tun</strong> – Ihr Inserat läuft bis zum Soft-Cap-Datum unverändert weiter und endet dann automatisch.<br><strong>2. In Phase 4 wechseln</strong> – Aktivieren Sie im Dashboard die Toggles "Auto-Wiedereinstellung" und "Dynamische Preissenkung", um die neuen Vorteile zu nutzen.<br><strong>3. Inserat manuell verlängern</strong> – Bearbeiten Sie Ihr Inserat im Dashboard, um Preis oder Beschreibung anzupassen.`)}
          ${button('Inserat im Dashboard öffnen', auctionUrl, settingsData)}
          ${paragraph(`<em>Diese Mail erhalten Sie einmalig pro aktivem Bestand-Inserat. Bei Fragen erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a> oder telefonisch unter ${settingsData.support_phone || '0511 / 51532476'}.</em>`)}
          ${paragraph('Mit freundlichen Grüßen,<br>Ihr ' + settingsData.site_name + ' Team')}
        `;
        break;
      }

      case "ending_soon":
        subject = "Auktion endet bald!";
        emailContent = `
          ${paragraph(`Hallo ${name},`)}
          ${customerBadge(custNum)}
          ${paragraph('Eine Auktion, für die Sie geboten haben, endet in Kürze:')}
          ${infoBox('Auktionsdetails', `
            ${detailRow('Fahrzeug', kitchenModel)}
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
        from: `${settingsData.site_name} <info@kuechenwert24.de>`,
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
      // Bug-fix #8: write a structured dedup-key marker into body_text so
      // downstream callers (e.g. check-expired-auctions per-auction-per-round
      // dedup) can ilike-probe admin_emails without parsing the full HTML.
      // Format: `dedup:<auctionUrl>|round:<roundNumber>` — both fields are
      // guaranteed-unique for the festpreis lifecycle and harmless for other
      // notification types.
      const dedupMarker = [
        auctionUrl ? `dedup:${auctionUrl}` : '',
        roundNumber ? `round:${roundNumber}` : '',
        kitchenId ? `kitchen:${kitchenId}` : '',
      ].filter(Boolean).join('|');

      await supabase.from('admin_emails').insert({
        sender_email: 'info@kuechenwert24.de',
        sender_name: settingsData.site_name,
        recipient_email: email,
        recipient_name: name || null,
        subject,
        body_html: html,
        body_text: dedupMarker,
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
