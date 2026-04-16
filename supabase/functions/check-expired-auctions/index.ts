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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date().toISOString();
    console.log(`Checking for expired auctions at ${now}...`);

    // ─── 1. Active auctions whose end_time has passed ──────────────
    const { data: expiredAuctions, error: fetchError } = await supabase
      .from('auctions')
      .select('id, end_time, status, motorhome_id, motorhomes!inner(sale_channel)')
      .eq('status', 'active')
      .lt('end_time', now);

    if (fetchError) {
      console.error('Error fetching expired auctions:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredAuctions?.length || 0} expired active auctions`);

    // Close each expired auction via close-auction Edge Function
    // For instant_price listings: end directly (no Kaufchance/bidder flows)
    const results = [];
    if (expiredAuctions && expiredAuctions.length > 0) {
      for (const auction of expiredAuctions) {
        try {
          const saleChannel = (auction.motorhomes as any)?.sale_channel;

          // Instant-price-only listings: simply mark as ended (no bidder/Kaufchance logic)
          if (saleChannel === 'instant_price') {
            console.log(`Ending instant-price listing ${auction.id} (no Kaufchance)...`);
            const { error: endError } = await supabase
              .from('auctions')
              .update({ status: 'ended', updated_at: now })
              .eq('id', auction.id);

            if (!endError && auction.motorhome_id) {
              const { error: mhErr } = await supabase
                .from('motorhomes')
                .update({ status: 'ended', updated_at: now })
                .eq('id', auction.motorhome_id);
              if (mhErr) console.error(`Failed to update motorhome ${auction.motorhome_id} status:`, mhErr);
            }

            // Expire any pending price proposals for this listing
            const { error: expireOffersErr } = await supabase
              .from('post_auction_offers')
              .update({ status: 'expired', seller_response: 'Inserat abgelaufen', updated_at: now })
              .eq('auction_id', auction.id)
              .in('status', ['pending', 'countered']);
            if (expireOffersErr) console.error(`Failed to expire offers for ${auction.id}:`, expireOffersErr);

            results.push({
              auctionId: auction.id,
              type: 'instant_price_expired',
              success: !endError,
              error: endError?.message,
            });
            continue;
          }

          console.log(`Closing auction ${auction.id}...`);
          
          // Explicit Authorization: nested invoke must present service_role JWT for close-auction auth
          const { data, error } = await supabase.functions.invoke('close-auction', {
            body: { auctionId: auction.id },
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
            },
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
      .select('id, kaufchance_expires_at, status, auto_relist, auction_round, reserve_price')
      .eq('status', 'kaufchance')
      .lt('kaufchance_expires_at', now);

    if (kaufchanceError) {
      console.error('Error fetching expired kaufchancen:', kaufchanceError);
    } else {
      console.log(`Found ${expiredKaufchancen?.length || 0} expired kaufchancen`);

      if (expiredKaufchancen && expiredKaufchancen.length > 0) {
        for (const kaufchance of expiredKaufchancen) {
          try {
            // Load auction with motorhome data
            const { data: auctionData } = await supabase
              .from('auctions')
              .select('motorhome_id, motorhome:motorhomes(id, seller_id, manufacturer, model, reserve_price)')
              .eq('id', kaufchance.id)
              .single();

            const mh = Array.isArray(auctionData?.motorhome) ? auctionData.motorhome[0] : auctionData?.motorhome;
            const motorhomeName = mh ? `${mh.manufacturer || ''} ${mh.model || ''}`.trim() : 'Fahrzeug';

            // ── AUTO-RELIST: default on (matches DB NOT NULL + frontend `!== false`) ──
            if (kaufchance.auto_relist !== false) {
              console.log(`Auto-relisting kaufchance ${kaufchance.id} (round ${kaufchance.auction_round})...`);

              // Baseline reserve (auction row, else motorhome — same idea as close-auction)
              let newReservePrice =
                kaufchance.reserve_price ?? (mh as { reserve_price?: number | null } | undefined)?.reserve_price ?? null;

              // Lowest seller counter_offer_amount becomes new reserve price for next round
              const { data: allOffers } = await supabase
                .from('post_auction_offers')
                .select('counter_offer_amount')
                .eq('auction_id', kaufchance.id)
                .not('counter_offer_amount', 'is', null);

              if (allOffers && allOffers.length > 0) {
                const lowestCounterOffer = Math.min(
                  ...allOffers.map((o: { counter_offer_amount: unknown }) => Number(o.counter_offer_amount))
                );
                if (lowestCounterOffer > 0) {
                  newReservePrice = lowestCounterOffer;
                  console.log(`New reserve price from lowest seller counter-offer: ${newReservePrice}`);
                }
              }

              // Collect bidder IDs from kaufchance_invitations BEFORE any destructive writes
              const { data: invitedBidders } = await supabase
                .from('kaufchance_invitations')
                .select('bidder_id')
                .eq('auction_id', kaufchance.id);

              // Transition auction first — avoids orphaned state if update fails after deletes
              const endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
              const newRound = (kaufchance.auction_round || 1) + 1;

              const { error: relistError } = await supabase
                .from('auctions')
                .update({
                  status: 'active',
                  start_time: now,
                  end_time: endTime,
                  current_bid: null,
                  kaufchance_expires_at: null,
                  kaufchance_min_price: null,
                  reserve_price: newReservePrice,
                  auction_round: newRound,
                  auto_relist: true,
                  updated_at: now,
                })
                .eq('id', kaufchance.id);

              if (relistError) {
                console.error(`Failed to auto-relist ${kaufchance.id}:`, relistError);
                results.push({ auctionId: kaufchance.id, type: 'auto_relist', success: false, error: relistError.message });
                continue;
              }

              const { error: expireErr } = await supabase
                .from('post_auction_offers')
                .update({ status: 'expired', seller_response: 'Kaufchance-Frist abgelaufen – automatische Wiedereinstellung', updated_at: now })
                .eq('auction_id', kaufchance.id)
                .in('status', ['pending', 'countered']);
              if (expireErr) console.error(`Expire offers after relist ${kaufchance.id}:`, expireErr);

              const { error: bidsDelErr } = await supabase.from('bids').delete().eq('auction_id', kaufchance.id);
              if (bidsDelErr) console.error(`Delete bids after relist ${kaufchance.id}:`, bidsDelErr);

              const { error: invDelErr } = await supabase.from('kaufchance_invitations').delete().eq('auction_id', kaufchance.id);
              if (invDelErr) console.error(`Delete kaufchance_invitations after relist ${kaufchance.id}:`, invDelErr);

              if (auctionData?.motorhome_id) {
                const { error: mhErr } = await supabase.from('motorhomes')
                  .update({ status: 'active', reserve_price: newReservePrice, updated_at: now })
                  .eq('id', auctionData.motorhome_id);
                if (mhErr) console.error(`Motorhome sync after relist ${kaufchance.id}:`, mhErr);
              }

              const endTimeFormatted = new Date(endTime).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              const reserveFormatted = newReservePrice ? `${Number(newReservePrice).toLocaleString('de-DE')} €` : 'nicht gesetzt';

              // Notify seller about auto-relist
              if (mh?.seller_id) {
                try {
                  const { data: sellerProfile } = await supabase
                    .from('profiles').select('email, first_name').eq('id', mh.seller_id).single();
                  if (sellerProfile?.email) {
                    await supabase.functions.invoke('send-auction-notification', {
                      body: {
                        email: sellerProfile.email,
                        name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
                        type: 'seller_auto_relisted',
                        motorhomeModel: motorhomeName,
                        auctionUrl: `https://caravanwert.de/dashboard/listings/${mh.id}`,
                        endTime: endTimeFormatted,
                        reservePrice: reserveFormatted,
                        currentBid: `Runde ${newRound}`,
                      },
                    }).catch((e: any) => console.error(`Failed to notify seller:`, e));
                  }
                } catch (e) { console.error('Seller notification error:', e); }
              }

              // Notify previous bidders about new round (use pre-collected invitedBidders + offer buyers)
              try {
                const notifiedIds = new Set<string>();

                // Invited bidders (collected before deletion)
                for (const inv of (invitedBidders || [])) {
                  if (!inv.bidder_id || notifiedIds.has(inv.bidder_id)) continue;
                  notifiedIds.add(inv.bidder_id);
                  const { data: profile } = await supabase
                    .from('profiles').select('email, first_name, company_name').eq('id', inv.bidder_id).single();
                  if (profile?.email) {
                    await supabase.functions.invoke('send-auction-notification', {
                      body: {
                        email: profile.email,
                        name: profile.company_name || profile.first_name || profile.email.split('@')[0],
                        type: 'auction_relisted',
                        motorhomeModel: motorhomeName,
                        auctionUrl: `https://caravanwert.de/auktion/${kaufchance.id}`,
                        endTime: endTimeFormatted,
                        currentBid: `Runde ${newRound}`,
                      },
                    }).catch((e: any) => console.error(`Failed to notify bidder:`, e));
                  }
                }

                // Also notify offer buyers who weren't in the invitation list
                const { data: offerBuyers } = await supabase
                  .from('post_auction_offers')
                  .select('buyer_id')
                  .eq('auction_id', kaufchance.id);
                for (const buyer of (offerBuyers || [])) {
                  if (!buyer.buyer_id || notifiedIds.has(buyer.buyer_id)) continue;
                  notifiedIds.add(buyer.buyer_id);
                  const { data: profile } = await supabase
                    .from('profiles').select('email, first_name, company_name').eq('id', buyer.buyer_id).single();
                  if (profile?.email) {
                    await supabase.functions.invoke('send-auction-notification', {
                      body: {
                        email: profile.email,
                        name: profile.company_name || profile.first_name || profile.email.split('@')[0],
                        type: 'auction_relisted',
                        motorhomeModel: motorhomeName,
                        auctionUrl: `https://caravanwert.de/auktion/${kaufchance.id}`,
                        endTime: endTimeFormatted,
                        currentBid: `Runde ${newRound}`,
                      },
                    }).catch((e: any) => console.error(`Failed to notify buyer:`, e));
                  }
                }
              } catch (e) { console.error('Buyer notification error:', e); }

              console.log(`Auto-relisted ${kaufchance.id} → round ${newRound}, reserve ${newReservePrice}`);
              results.push({ auctionId: kaufchance.id, type: 'auto_relist', success: true, data: { round: newRound, reservePrice: newReservePrice } });

            } else {
              // ── OPT-OUT: Seller disabled auto-relist → end auction as before ──
              console.log(`Closing expired kaufchance ${kaufchance.id} (auto_relist=false)...`);

              const { error: updateError } = await supabase
                .from('auctions')
                .update({ status: 'ended', updated_at: now })
                .eq('id', kaufchance.id);

              if (updateError) {
                console.error(`Error closing kaufchance ${kaufchance.id}:`, updateError);
                results.push({ auctionId: kaufchance.id, type: 'kaufchance_expired', success: false, error: updateError.message });
                continue;
              }

              if (auctionData?.motorhome_id) {
                await supabase.from('motorhomes')
                  .update({ status: 'active', updated_at: now })
                  .eq('id', auctionData.motorhome_id);
              }

              await supabase.from('post_auction_offers')
                .update({ status: 'expired', seller_response: 'Kaufchance-Frist abgelaufen', updated_at: now })
                .eq('auction_id', kaufchance.id)
                .in('status', ['pending', 'countered']);

              // Notify bidders
              try {
                const { data: invitations } = await supabase
                  .from('kaufchance_invitations').select('bidder_id').eq('auction_id', kaufchance.id);
                if (invitations) {
                  for (const inv of invitations) {
                    const { data: profile } = await supabase
                      .from('profiles').select('email, first_name, company_name').eq('id', inv.bidder_id).single();
                    if (profile?.email) {
                      await supabase.functions.invoke('send-auction-notification', {
                        body: {
                          email: profile.email,
                          name: profile.company_name || profile.first_name || profile.email.split('@')[0],
                          type: 'kaufchance_expired',
                          motorhomeModel: motorhomeName,
                          auctionUrl: `https://caravanwert.de/auktion/${kaufchance.id}`,
                        },
                      }).catch((e: any) => console.error(`Failed to notify bidder ${inv.bidder_id}:`, e));
                    }
                  }
                }
              } catch (e) { console.error('Bidder notification error:', e); }

              // Notify seller
              if (mh?.seller_id) {
                try {
                  const { data: sellerProfile } = await supabase
                    .from('profiles').select('email, first_name').eq('id', mh.seller_id).single();
                  if (sellerProfile?.email) {
                    await supabase.functions.invoke('send-auction-notification', {
                      body: {
                        email: sellerProfile.email,
                        name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
                        type: 'kaufchance_expired',
                        motorhomeModel: motorhomeName,
                        auctionUrl: `https://caravanwert.de/dashboard/listings/${mh.id}`,
                      },
                    }).catch((e: any) => console.error(`Failed to notify seller:`, e));
                  }
                } catch (e) { console.error('Seller notification error:', e); }
              }

              console.log(`Closed kaufchance ${kaufchance.id} (opted out of auto-relist)`);
              results.push({ auctionId: kaufchance.id, type: 'kaufchance_expired', success: true });
            }
          } catch (error: any) {
            console.error(`Exception processing kaufchance ${kaufchance.id}:`, error);
            results.push({ auctionId: kaufchance.id, type: 'kaufchance_expired', success: false, error: error.message });
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
