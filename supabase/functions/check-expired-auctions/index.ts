import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

/**
 * Edge Function: check-expired-auctions
 *
 * Scans for active auctions whose end_time has passed and triggers
 * the close-auction function for each one.
 *
 * Also checks for kaufchance auctions whose kaufchance_expires_at has
 * passed and closes them (status → ended).
 *
 * Auth: Requires either service_role key (cron/internal) or admin role.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  try {
    // ─── Auth check: must be service_role (cron/internal) or authenticated admin ───
    const authResult = await checkServiceRoleOrAdmin(req, getCorsHeaders(req));
    if (!authResult.authorized) {
      return authResult.response;
    }

    // ─── Main logic ────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date().toISOString();
    console.log(`Checking for expired auctions at ${now}...`);

    // ─── 1. Active auctions whose end_time has passed ──────────────
    const { data: expiredAuctions, error: fetchError } = await supabase
      .from('auctions')
      .select('id, end_time, status')
      .eq('status', 'active')
      .lt('end_time', now);

    if (fetchError) {
      console.error('Error fetching expired auctions:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredAuctions?.length || 0} expired active auctions`);

    // Close each expired auction via close-auction Edge Function
    const results = [];
    if (expiredAuctions && expiredAuctions.length > 0) {
      for (const auction of expiredAuctions) {
        try {
          console.log(`Closing auction ${auction.id}...`);
          
          const { data, error } = await supabase.functions.invoke('close-auction', {
            body: { auctionId: auction.id },
          });

          if (error) {
            console.error(`Error closing auction ${auction.id}:`, error);
            results.push({
              auctionId: auction.id,
              type: 'active_expired',
              success: false,
              error: error.message,
            });
          } else {
            console.log(`Successfully closed auction ${auction.id}:`, data);
            results.push({
              auctionId: auction.id,
              type: 'active_expired',
              success: true,
              data,
            });
          }
        } catch (error: any) {
          console.error(`Exception closing auction ${auction.id}:`, error);
          results.push({
            auctionId: auction.id,
            type: 'active_expired',
            success: false,
            error: error.message,
          });
        }
      }
    }

    // ─── 2. Kaufchance auctions whose kaufchance_expires_at has passed ──
    const { data: expiredKaufchancen, error: kaufchanceError } = await supabase
      .from('auctions')
      .select('id, kaufchance_expires_at, status')
      .eq('status', 'kaufchance')
      .lt('kaufchance_expires_at', now);

    if (kaufchanceError) {
      console.error('Error fetching expired kaufchancen:', kaufchanceError);
      // Don't throw - continue with results from step 1
    } else {
      console.log(`Found ${expiredKaufchancen?.length || 0} expired kaufchancen`);

      if (expiredKaufchancen && expiredKaufchancen.length > 0) {
        for (const kaufchance of expiredKaufchancen) {
          try {
            console.log(`Closing expired kaufchance ${kaufchance.id}...`);

            // Update auction status to 'ended'
            const { error: updateError } = await supabase
              .from('auctions')
              .update({ status: 'ended', updated_at: now })
              .eq('id', kaufchance.id);

            if (updateError) {
              console.error(`Error closing kaufchance ${kaufchance.id}:`, updateError);
              results.push({
                auctionId: kaufchance.id,
                type: 'kaufchance_expired',
                success: false,
                error: updateError.message,
              });
            } else {
              // Load auction with motorhome data for notifications
              const { data: auctionData } = await supabase
                .from('auctions')
                .select('motorhome_id, motorhome:motorhomes(id, seller_id, manufacturer, model)')
                .eq('id', kaufchance.id)
                .single();

              const mh = Array.isArray(auctionData?.motorhome) ? auctionData.motorhome[0] : auctionData?.motorhome;

              // Update motorhome status back to 'active' (available again)
              if (auctionData?.motorhome_id) {
                const { error: mhError } = await supabase
                  .from('motorhomes')
                  .update({ status: 'active', updated_at: now })
                  .eq('id', auctionData.motorhome_id);
                if (mhError) console.error(`Failed to update motorhome status for ${auctionData.motorhome_id}:`, mhError);
              }

              // Set all pending/countered offers to 'expired'
              const { error: expireOffersErr } = await supabase
                .from('post_auction_offers')
                .update({
                  status: 'expired',
                  seller_response: 'Kaufchance-Frist abgelaufen',
                  updated_at: now,
                })
                .eq('auction_id', kaufchance.id)
                .in('status', ['pending', 'countered']);

              if (expireOffersErr) {
                console.error(`Failed to expire offers for kaufchance ${kaufchance.id}:`, expireOffersErr);
              }

              // Send anonymous notifications to involved parties
              const motorhomeName = mh ? `${mh.manufacturer || ''} ${mh.model || ''}`.trim() : 'Fahrzeug';

              // Notify invited bidders (no seller identity revealed)
              try {
                const { data: invitations } = await supabase
                  .from('kaufchance_invitations')
                  .select('bidder_id')
                  .eq('auction_id', kaufchance.id);

                if (invitations) {
                  for (const inv of invitations) {
                    const { data: profile } = await supabase
                      .from('profiles')
                      .select('email, first_name, company_name')
                      .eq('id', inv.bidder_id)
                      .single();

                    if (profile?.email) {
                      await supabase.functions.invoke('send-auction-notification', {
                        body: {
                          email: profile.email,
                          name: profile.company_name || profile.first_name || profile.email.split('@')[0],
                          type: 'kaufchance_expired',
                          motorhomeModel: motorhomeName,
                          auctionUrl: 'https://caravanwert.de/kaufen',
                        },
                      }).catch((e: any) => console.error(`Failed to notify bidder ${inv.bidder_id}:`, e));
                    }
                  }
                }
              } catch (notifyErr) {
                console.error(`Failed to notify bidders for kaufchance ${kaufchance.id}:`, notifyErr);
              }

              // Notify seller (no buyer identity revealed)
              if (mh?.seller_id) {
                try {
                  const { data: sellerProfile } = await supabase
                    .from('profiles')
                    .select('email, first_name')
                    .eq('id', mh.seller_id)
                    .single();

                  if (sellerProfile?.email) {
                    await supabase.functions.invoke('send-auction-notification', {
                      body: {
                        email: sellerProfile.email,
                        name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
                        type: 'kaufchance_expired',
                        motorhomeModel: motorhomeName,
                        auctionUrl: 'https://caravanwert.de/dashboard',
                      },
                    }).catch((e: any) => console.error(`Failed to notify seller ${mh.seller_id}:`, e));
                  }
                } catch (sellerNotifyErr) {
                  console.error(`Failed to notify seller for kaufchance ${kaufchance.id}:`, sellerNotifyErr);
                }
              }

              console.log(`Successfully closed kaufchance ${kaufchance.id} (offers expired, parties notified)`);
              results.push({
                auctionId: kaufchance.id,
                type: 'kaufchance_expired',
                success: true,
              });
            }
          } catch (error: any) {
            console.error(`Exception closing kaufchance ${kaufchance.id}:`, error);
            results.push({
              auctionId: kaufchance.id,
              type: 'kaufchance_expired',
              success: false,
              error: error.message,
            });
          }
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Processing completed: ${successCount} successful, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} expired auctions/kaufchancen`,
        successCount,
        failCount,
        results,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in check-expired-auctions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
