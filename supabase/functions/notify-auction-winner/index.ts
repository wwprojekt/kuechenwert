import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph, infoBox, detailRow, amountDisplay, button, list } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const auth = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!auth.authorized) return auth.response;

  try {
    const { auctionId, winnerId, amount } = await req.json();

    if (!auctionId || !winnerId || !amount) {
      throw new Error('auctionId, winnerId, and amount are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Notifying auction winner:', winnerId, 'for auction:', auctionId);

    // Get auction details
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select(`*, motorhome:motorhomes(*)`)
      .eq('id', auctionId)
      .single();

    if (auctionError || !auction) {
      throw new Error('Auction not found');
    }

    // Get winner profile
    const { data: winnerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', winnerId)
      .single();

    if (profileError || !winnerProfile) {
      throw new Error('Winner profile not found');
    }

    // Opt-out check: email_auction_won. Strict opt-out — nur explizites `false` skippt;
    // fehlende Pref-Row oder Query-Fehler → senden (Bestand-User-Schutz).
    // Die in-App-Status-Updates + Invoice-Mail laufen separat und sind nicht betroffen.
    const { data: winnerPrefs, error: winnerPrefsError } = await supabase
      .from('user_notification_preferences')
      .select('email_auction_won')
      .eq('user_id', winnerId)
      .maybeSingle();

    if (winnerPrefsError) {
      console.error('[notify-auction-winner] prefs query failed, defaulting to SEND:', winnerPrefsError);
    } else if (winnerPrefs && winnerPrefs.email_auction_won === false) {
      console.log(`[notify-auction-winner] skipped winner mail for ${winnerId} (opted out)`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'opted_out_email_auction_won' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Get site settings for email
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Ihr Wohnmobil-Marktplatz',
      contact_email: 'info@caravanwert.de',
      support_phone: '',
    };

    const motorhome = auction.motorhome;
    const winnerName = `${winnerProfile.first_name} ${winnerProfile.last_name}`;
    const isInstantBuy = motorhome.sale_channel === 'instant_price' || motorhome.sale_type === 'instant';

    // Build email content with email-builder
    const content = `
      ${paragraph(`Sehr geehrte/r ${winnerName},`)}
      ${paragraph(isInstantBuy
        ? '<strong>Herzlichen Gl&uuml;ckwunsch!</strong> Ihr Kauf wurde erfolgreich abgeschlossen.'
        : '<strong>Herzlichen Gl&uuml;ckwunsch!</strong> Sie haben die Auktion erfolgreich gewonnen.'
      )}

      ${infoBox(`${motorhome.manufacturer} ${motorhome.model}`, `
        ${detailRow('Baujahr', String(motorhome.year))}
        ${detailRow('Kilometerstand', `${motorhome.mileage?.toLocaleString() || '–'} km`)}
        ${detailRow('Aufbauart', motorhome.body_type || '–')}
      `, 'success')}

      ${amountDisplay(isInstantBuy ? 'Kaufpreis' : 'Ihr Gebot', `&euro;${Number(amount).toLocaleString()}`)}

      ${paragraph('Wir werden uns in K&uuml;rze mit Ihnen in Verbindung setzen, um die n&auml;chsten Schritte zu besprechen:')}
      ${list([
        'Zahlungsabwicklung',
        'Terminvereinbarung f&uuml;r &Uuml;bergabe',
        'Fahrzeugdokumentation',
      ])}

      ${button('Zum Dashboard', 'https://caravanwert.de/dashboard')}

      ${paragraph(`Falls Sie Fragen haben, erreichen Sie uns unter <a href="mailto:${settingsData.contact_email}" style="color: #2563eb;">${settingsData.contact_email}</a>.`)}
      ${paragraph('Vielen Dank f&uuml;r Ihr Vertrauen!<br>Ihr CaravanWert Team')}
    `;

    const emailSubject = isInstantBuy
      ? 'Herzlichen Gl\u00fcckwunsch! Ihr Kauf wurde best\u00e4tigt'
      : 'Herzlichen Gl\u00fcckwunsch! Sie haben die Auktion gewonnen';
    const emailHtml = buildEmailLayout(settingsData, isInstantBuy ? 'Kauf best\u00e4tigt!' : 'Auktion gewonnen!', content);

    // Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'E-Mail-Dienst nicht konfiguriert (RESEND_API_KEY fehlt)' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }
    if (!winnerProfile.email) {
      console.error('Winner has no email address:', winnerId);
      return new Response(
        JSON.stringify({ error: 'Gewinner hat keine E-Mail-Adresse hinterlegt' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }
    {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: `${settingsData.site_name || 'CaravanWert'} <info@caravanwert.de>`,
          to: [winnerProfile.email],
          subject: emailSubject,
          html: emailHtml,
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.text();
        console.error('Error sending email via Resend:', errorData);
        throw new Error('Failed to send email');
      }

      const resendResult = await resendResponse.json();
      console.log('Winner notification email sent successfully');

      // Log in admin_emails for System tab
      try {
        await supabase.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: settingsData.site_name,
          recipient_email: winnerProfile.email,
          recipient_name: winnerName || null,
          subject: emailSubject,
          body_html: emailHtml,
          body_text: '',
          email_type: 'auction_winner',
          direction: 'outbound',
          status: 'sent',
          resend_id: resendResult?.id || null,
          is_read: true,
        });
      } catch (logErr) {
        console.error('Failed to log email in admin_emails:', logErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Winner notified successfully' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in notify-auction-winner:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
