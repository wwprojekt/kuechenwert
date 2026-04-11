import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph, greeting, button, infoBox, detailRow, divider } from '../_shared/email-builder.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Auktions-Zusammenfassung – wird per Cron-Job täglich aufgerufen.
 * Sendet Verkäufern eine Übersicht über ihre aktiven Auktionen.
 */

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  const authCheck = await checkServiceRoleOrAdmin(req);
  if (!authCheck.authorized) return authCheck.response;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all active auctions grouped by seller
    // FIXED: current_price → current_bid, start_price → starting_bid
    // FIXED: bid_count is NOT a column in auctions table, must be counted separately
    const { data: auctions, error: fetchError } = await supabase
      .from('auctions')
      .select(`
        id, current_bid, starting_bid, end_time, status,
        motorhomes (manufacturer, model, year, seller_id)
      `)
      .eq('status', 'active');

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!auctions || auctions.length === 0) {
      return new Response(JSON.stringify({ message: "No active auctions", count: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch bid counts for all active auctions
    const auctionIds = auctions.map(a => a.id);
    const bidCounts: Record<string, number> = {};
    for (const auctionId of auctionIds) {
      const { count } = await supabase
        .from('bids')
        .select('id', { count: 'exact', head: true })
        .eq('auction_id', auctionId);
      bidCounts[auctionId] = count || 0;
    }

    // Fetch site settings
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'kontakt@caravanwert.de',
      support_phone: '+49 511 51532476',
    };

    // Group auctions by seller (seller_id from motorhomes)
    const sellerAuctions: Record<string, any[]> = {};
    for (const auction of auctions) {
      const motorhome = auction.motorhomes as any;
      if (!motorhome?.seller_id) continue;
      const sellerId = motorhome.seller_id;
      if (!sellerAuctions[sellerId]) sellerAuctions[sellerId] = [];
      sellerAuctions[sellerId].push(auction);
    }

    let sent = 0;
    let failed = 0;

    for (const [sellerId, sellerAuctionList] of Object.entries(sellerAuctions)) {
      try {
        // Get seller profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', sellerId)
          .single();

        if (!profile?.email) continue;

        // Check notification preferences
        const { data: prefs } = await supabase
          .from('user_notification_preferences')
          .select('email_auction_updates')
          .eq('user_id', sellerId)
          .single();

        if (prefs && prefs.email_auction_updates === false) continue;

        const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');

        // Build auction summary content
        let auctionRows = '';
        for (const auction of sellerAuctionList) {
          const motorhome = auction.motorhomes as any;
          const vehicleStr = `${motorhome.manufacturer} ${motorhome.model} (${motorhome.year})`;
          const currentBid = typeof auction.current_bid === 'number'
            ? auction.current_bid.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
            : `${auction.current_bid || 0} €`;
          const endDate = new Date(auction.end_time);
          const remainingMs = endDate.getTime() - Date.now();
          const remainingDays = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));
          const remainingHours = Math.max(0, Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
          const auctionBidCount = bidCounts[auction.id] || 0;

          auctionRows += infoBox(vehicleStr, `
            ${detailRow('Aktueller Preis', `<strong style="color: #1f8aa2;">${currentBid}</strong>`)}
            ${detailRow('Anzahl Gebote', `${auctionBidCount}`)}
            ${detailRow('Verbleibende Zeit', `${remainingDays} Tage, ${remainingHours} Stunden`)}
          `, auctionBidCount > 0 ? 'success' : 'default', settingsData);
        }

        const subject = `Ihre Auktions-Übersicht – ${sellerAuctionList.length} aktive Auktion${sellerAuctionList.length > 1 ? 'en' : ''}`;
        const emailContent = `
          ${greeting(name || undefined)}
          ${paragraph(`Hier ist Ihre t&auml;gliche &Uuml;bersicht &uuml;ber Ihre <strong>${sellerAuctionList.length} aktive${sellerAuctionList.length > 1 ? 'n' : ''} Auktion${sellerAuctionList.length > 1 ? 'en' : ''}</strong>:`)}
          ${auctionRows}
          ${button('Alle Auktionen ansehen', 'https://caravanwert.de/dashboard', settingsData)}
          ${paragraph('<span style="font-size: 12px; color: #6b7280;">Sie erhalten diese &Uuml;bersicht t&auml;glich, solange Sie aktive Auktionen haben. Sie k&ouml;nnen diese Benachrichtigung in Ihren <a href="https://caravanwert.de/dashboard/profile" style="color: #1f8aa2;">Profileinstellungen</a> deaktivieren.</span>')}
        `;

        const html = buildEmailLayout(settingsData, `Ihre Auktions-Übersicht`, emailContent);

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
          throw new Error(error);
        }

        const resendResult = await emailResponse.json();

        // Log in admin_emails for System tab
        try {
          await supabase.from('admin_emails').insert({
            sender_email: 'info@caravanwert.de',
            sender_name: settingsData.site_name,
            recipient_email: profile.email,
            recipient_name: name || null,
            subject,
            body_html: html,
            body_text: '',
            email_type: 'auction_summary',
            direction: 'outbound',
            status: 'sent',
            resend_id: resendResult?.id || null,
            is_read: true,
          });
        } catch (logErr) {
          console.error('Failed to log email in admin_emails:', logErr);
        }

        sent++;
      } catch (err: any) {
        console.error(`Failed to send auction summary to seller ${sellerId}:`, err.message);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Auction summaries sent: ${sent}, failed: ${failed}`,
      sent,
      failed,
    }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in auction summary:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
