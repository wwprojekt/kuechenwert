import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { buildEmailLayout, infoBox, detailRow, paragraph } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Checking for auctions ending soon...');

    // Find auctions ending in the next hour
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: endingAuctions, error: auctionError } = await supabase
      .from('auctions')
      .select(`
        *,
        motorhome:motorhomes(manufacturer, model)
      `)
      .eq('status', 'active')
      .gt('end_time', now)
      .lt('end_time', oneHourFromNow);

    if (auctionError) throw auctionError;

    console.log(`Found ${endingAuctions?.length || 0} auctions ending soon`);

    if (!endingAuctions || endingAuctions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No auctions ending soon' }),
        { headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } }
      );
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

    const notifications = [];

    for (const auction of endingAuctions) {
      // Get all unique bidders for this auction
      const { data: bids } = await supabase
        .from('bids')
        .select('bidder_id, amount')
        .eq('auction_id', auction.id);

      if (!bids || bids.length === 0) continue;

      // Get unique bidders
      const uniqueBidders = [...new Set(bids.map(b => b.bidder_id))];

      for (const bidderId of uniqueBidders) {
        // Get bidder's highest bid
        const bidderBids = bids.filter(b => b.bidder_id === bidderId);
        const highestBid = Math.max(...bidderBids.map(b => Number(b.amount)));
        const isWinning = highestBid >= Number(auction.current_bid);

        // Fetch bidder profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, first_name')
          .eq('id', bidderId)
          .single();

        if (!profile?.email) continue;

        const userName = profile.first_name || profile.email.split('@')[0];
        const motorhomeName = `${auction.motorhome.manufacturer} ${auction.motorhome.model}`;
        
        const endTime = new Date(auction.end_time);
        const timeRemaining = Math.ceil((endTime.getTime() - Date.now()) / (1000 * 60));
        const timeRemainingStr = timeRemaining > 60 
          ? `${Math.floor(timeRemaining / 60)} Stunde(n)` 
          : `${timeRemaining} Minuten`;

        const auctionUrl = `https://caravanwert.de/auktion/${auction.id}`;

        // Build email content
        const content = `
          ${paragraph(`Hallo ${userName},`)}
          ${paragraph(`Die Auktion für <strong>${motorhomeName}</strong> endet in Kürze!`)}
          
          ${infoBox('Auktionsstatus', `
            ${detailRow('Aktuelles Höchstgebot', `€${auction.current_bid.toLocaleString()}`)}
            ${detailRow('Ihr Gebot', `€${highestBid.toLocaleString()}`)}
            ${detailRow('Status', isWinning ? 'Sie sind Höchstbietender! 🎉' : 'Sie wurden überboten')}
            ${detailRow('Zeit verbleibend', timeRemainingStr)}
          `, isWinning ? 'success' : 'warning', settingsData)}
          
          ${paragraph(
            isWinning 
              ? 'Sie sind derzeit Höchstbietender! Behalten Sie die Auktion im Auge, falls jemand noch bietet.'
              : 'Geben Sie jetzt ein höheres Gebot ab, um diese Auktion zu gewinnen!'
          )}
          ${paragraph(`<a href="${auctionUrl}" style="color: #195d3e; text-decoration: underline; font-weight: bold;">${isWinning ? 'Auktion ansehen' : 'Jetzt bieten'} →</a>`)}
        `;

        const html = buildEmailLayout(settingsData, 'Auktion endet bald!', content);

        // Send email
        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: `${settingsData.site_name} <info@caravanwert.de>`,
              to: [profile.email],
              subject: `⏰ Auktion endet bald - ${motorhomeName}`,
              html,
            }),
          });

          const resendResult = emailResponse.ok ? await emailResponse.json() : null;
          if (emailResponse.ok) {
            notifications.push({ bidderId, auctionId: auction.id, success: true });
            console.log(`Notification sent to ${profile.email} for auction ${auction.id}`);

            // Log in admin_emails for System tab
            try {
              await supabase.from('admin_emails').insert({
                sender_email: 'info@caravanwert.de',
                sender_name: settingsData.site_name,
                recipient_email: profile.email,
                recipient_name: userName || null,
                subject: `⏰ Auktion endet bald - ${motorhomeName}`,
                body_html: html,
                body_text: '',
                email_type: 'auction_ending_soon',
                direction: 'outbound',
                status: 'sent',
                resend_id: resendResult?.id || null,
                is_read: true,
              });
            } catch (logErr) {
              console.error('Failed to log email in admin_emails:', logErr);
            }
          } else {
            throw new Error(await emailResponse.text());
          }
        } catch (emailError) {
          console.error(`Failed to send email to ${profile.email}:`, emailError);
          notifications.push({ bidderId, auctionId: auction.id, success: false });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        auctionsChecked: endingAuctions.length,
        notificationsSent: notifications.filter(n => n.success).length,
        notificationsFailed: notifications.filter(n => !n.success).length,
      }),
      { headers: { "Content-Type": "application/json", ...getCorsHeaders(req) } }
    );
  } catch (error: any) {
    console.error("Error in send-auction-ending-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
};

serve(handler);
