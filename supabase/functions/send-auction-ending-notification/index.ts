import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, infoBox, detailRow, paragraph } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Benachrichtigung über bald endende Auktionen – wird per Cron-Job aufgerufen.
 * Sendet Bietern eine Email wenn eine Auktion in der nächsten Stunde endet.
 *
 * FIXED: Auth-Check hinzugefügt (BUG-5)
 * FIXED: Duplikat-Prüfung über admin_emails (BUG-6)
 */

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  // ─── Auth check: must be service_role (cron/internal) or authenticated admin ───
  const authResult = await checkServiceRoleOrAdmin(req, getCorsHeaders(req));
  if (!authResult.authorized) {
    return authResult.response;
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
      contact_email: 'info@caravanwert.de',
      support_phone: '0511 / 51532476',
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

      // ─── Notification-Preferences laden für alle Bieter ───
      const { data: notifPrefs } = await supabase
        .from('user_notification_preferences')
        .select('user_id, email_auction_ending')
        .in('user_id', uniqueBidders);
      const prefsMap = new Map(notifPrefs?.map(p => [p.user_id, p]) || []);

      for (const bidderId of uniqueBidders) {
        // ─── NOTIFICATION-PREFERENCE CHECK ───
        const userPref = prefsMap.get(bidderId);
        if (userPref && userPref.email_auction_ending === false) {
          console.log(`Skipping notification for bidder ${bidderId} - opted out`);
          notifications.push({ bidderId, auctionId: auction.id, success: true, skipped: true });
          continue;
        }

        // Fetch bidder profile FIRST so we can use email for duplicate check
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, first_name')
          .eq('id', bidderId)
          .single();

        if (!profile?.email) continue;

        // ─── DUPLIKAT-PRÜFUNG: Über recipient_id + auction_id (bombensicher) ───
        const motorhomeName = `${auction.motorhome.manufacturer} ${auction.motorhome.model}`;
        const { data: existingNotification } = await supabase
          .from('dealer_notifications')
          .select('id')
          .eq('user_id', bidderId)
          .eq('type', 'auction_ending_soon')
          .eq('auction_id', auction.id)
          .limit(1);

        if (existingNotification && existingNotification.length > 0) {
          console.log(`Skipping duplicate ending-soon for ${profile.email} on auction ${auction.id}`);
          notifications.push({ bidderId, auctionId: auction.id, success: true, skipped: true });
          continue;
        }

        // In-App Notification + Dedup-Marker (insert BEFORE email to prevent race conditions)
        await supabase.from('dealer_notifications').insert({
          user_id: bidderId,
          type: 'auction_ending_soon',
          title: `Auktion endet bald: ${motorhomeName}`,
          message: `Die Auktion für ${motorhomeName} endet in Kürze.`,
          link: `/auktion/${auction.id}`,
          auction_id: auction.id,
        });

        // Get bidder's highest bid
        const bidderBids = bids.filter(b => b.bidder_id === bidderId);
        const highestBid = Math.max(...bidderBids.map(b => Number(b.amount)));
        const isWinning = highestBid >= Number(auction.current_bid);

        const userName = profile.first_name || profile.email.split('@')[0];
        
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
        const subject = `⏰ Auktion endet bald - ${motorhomeName}`;

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
              subject,
              html,
            }),
          });

          const resendResult = emailResponse.ok ? await emailResponse.json() : null;
          if (emailResponse.ok) {
            notifications.push({ bidderId, auctionId: auction.id, success: true });
            console.log(`Notification sent to ${profile.email} for auction ${auction.id}`);

            // Log in admin_emails for System tab (also used for duplicate check)
            try {
              await supabase.from('admin_emails').insert({
                sender_email: 'info@caravanwert.de',
                sender_name: settingsData.site_name,
                recipient_email: profile.email,
                recipient_name: userName || null,
                recipient_id: bidderId,
                subject,
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
        notificationsSent: notifications.filter(n => n.success && !n.skipped).length,
        notificationsSkipped: notifications.filter(n => n.skipped).length,
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
