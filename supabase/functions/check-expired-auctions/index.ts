import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import { logEdgeError } from '../_shared/edgeLogger.ts';

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
    // We need festpreis-specific fields (instant_price, seller_id) for the
    // auto-extend path, plus auto_relist + auction_round + festpreis_admin_notified_at.
    const { data: expiredAuctions, error: fetchError } = await supabase
      .from('auctions')
      .select(`
        id, end_time, status, motorhome_id,
        auto_relist, auction_round, reserve_price,
        festpreis_admin_notified_at,
        motorhomes!inner(
          id, sale_channel, manufacturer, model,
          instant_price, seller_id
        )
      `)
      .eq('status', 'active')
      .lt('end_time', now);

    if (fetchError) {
      console.error('Error fetching expired auctions:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredAuctions?.length || 0} expired active auctions`);

    // Close each expired auction via close-auction Edge Function.
    // For festpreis (instant_price) listings, replace the old "end immediately"
    // path with a tiered auto-lifecycle:
    //   • auto_relist === false                  → end (existing behavior)
    //   • instant_price > 0                      → extend by 7 days, increment
    //                                              auction_round, keep offers
    //                                              alive, notify seller (+ soft
    //                                              brake handled in commit 4)
    //   • instant_price NULL/0 + first encounter → 24h grace, send admin alert,
    //                                              set festpreis_admin_notified_at
    //   • instant_price NULL/0 + already alerted → end (admin had 24h)
    const results = [];
    if (expiredAuctions && expiredAuctions.length > 0) {
      for (const auction of expiredAuctions) {
        try {
          const mh = (auction.motorhomes as any) || {};
          const saleChannel = mh.sale_channel;

          // Instant-price-only listings: lifecycle handled inline
          if (saleChannel === 'instant_price') {
            const motorhomeName = `${mh.manufacturer || ''} ${mh.model || ''}`.trim();
            const instantPriceNum = Number(mh.instant_price ?? 0);
            const hasValidPrice = Number.isFinite(instantPriceNum) && instantPriceNum > 0;
            const autoRelist = auction.auto_relist !== false; // default true
            const previouslyNotified = !!auction.festpreis_admin_notified_at;

            // ── Path A: seller opted out OR admin grace window already used ──
            const shouldEnd = !autoRelist || (!hasValidPrice && previouslyNotified);

            if (shouldEnd) {
              console.log(
                `[festpreis-end] auction=${auction.id} motorhome=${auction.motorhome_id} ` +
                `autoRelist=${autoRelist} hasValidPrice=${hasValidPrice} previouslyNotified=${previouslyNotified}`
              );

              const { error: endError } = await supabase
                .from('auctions')
                .update({ status: 'ended', updated_at: now })
                .eq('id', auction.id);

              if (!endError && auction.motorhome_id) {
                // motorhomes.status CHECK constraint allows
                // ('available', 'active', 'sold', 'pending', 'not_sold', 'reserved').
                // 'ended' is INVALID and would silently throw 23514 here, leaving
                // motorhomes stuck on 'available' while the auction is gone.
                // 'not_sold' matches end-kaufchance + AdminPostAuctionOffers
                // semantics: the listing was offered but did not transact.
                const { error: mhErr } = await supabase
                  .from('motorhomes')
                  .update({ status: 'not_sold', updated_at: now })
                  .eq('id', auction.motorhome_id);
                if (mhErr) console.error(`Failed to update motorhome ${auction.motorhome_id} status:`, mhErr);
              }

              // Expire any pending price proposals and notify proposers
              const { data: expiredOffers } = await supabase
                .from('post_auction_offers')
                .select('buyer_id, offer_amount')
                .eq('auction_id', auction.id)
                .in('status', ['pending', 'countered']);

              const { error: expireOffersErr } = await supabase
                .from('post_auction_offers')
                .update({ status: 'expired', seller_response: 'Inserat abgelaufen', updated_at: now })
                .eq('auction_id', auction.id)
                .in('status', ['pending', 'countered']);
              if (expireOffersErr) console.error(`Failed to expire offers for ${auction.id}:`, expireOffersErr);

              if (expiredOffers && expiredOffers.length > 0) {
                for (const eo of expiredOffers) {
                  try {
                    const { data: profile } = await supabase
                      .from('profiles')
                      .select('email, first_name, company_name')
                      .eq('id', eo.buyer_id)
                      .single();
                    if (profile?.email) {
                      await supabase.functions.invoke('send-auction-notification', {
                        body: {
                          email: profile.email,
                          name: profile.company_name || profile.first_name || profile.email.split('@')[0],
                          type: 'lost',
                          motorhomeModel: motorhomeName,
                          auctionUrl: 'https://caravanwert.de/kaufen',
                          yourBid: `€${Number(eo.offer_amount).toLocaleString('de-DE')}`,
                          isFestpreis: true,
                          listingEnded: true,
                        },
                      });
                    }
                  } catch (notifyErr: any) {
                    console.error(`Failed to notify proposer ${eo.buyer_id}:`, notifyErr.message);
                  }
                }
              }

              results.push({
                auctionId: auction.id,
                type: 'instant_price_ended',
                reason: !autoRelist ? 'auto_relist_off' : 'admin_grace_expired',
                success: !endError,
                error: endError?.message,
              });
              continue;
            }

            // ── Path B: instant_price > 0 → 7-day auto-extend ───────────────
            if (hasValidPrice) {
              const newEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
              const newRound = (auction.auction_round || 1) + 1;

              console.log(
                `[festpreis-extend] auction=${auction.id} round=${auction.auction_round}->${newRound} ` +
                `instant_price=${instantPriceNum} newEnd=${newEnd}`
              );

              const { error: extError } = await supabase
                .from('auctions')
                .update({
                  end_time: newEnd,
                  auction_round: newRound,
                  // Reset admin marker if it was ever set — price is now valid
                  festpreis_admin_notified_at: null,
                  updated_at: now,
                })
                .eq('id', auction.id);

              if (extError) {
                console.error(`Failed to auto-extend festpreis ${auction.id}:`, extError);
                results.push({
                  auctionId: auction.id,
                  type: 'festpreis_extend',
                  success: false,
                  error: extError.message,
                });
                continue;
              }

              // Keep motorhome.updated_at in sync so dashboards refresh
              if (auction.motorhome_id) {
                await supabase
                  .from('motorhomes')
                  .update({ updated_at: now })
                  .eq('id', auction.motorhome_id);
              }

              // Notify seller about auto-extension. Offers stay alive (β1).
              //
              // Soft brake (commit 4 + bug-fix #5):
              // User spec δ2 explicitly says soft brake fires at auction_round >= 2.
              // The "extended" mail is a status notification, the round_warning is
              // the actual nudge with concrete recommendations + opt-out reminder.
              // Both fire from round 2 (= first auto-extension) onwards so the
              // seller never gets only the soft "extended" mail without the warning.
              if (mh.seller_id) {
                try {
                  const { data: sellerProfile } = await supabase
                    .from('profiles').select('email, first_name').eq('id', mh.seller_id).single();
                  if (sellerProfile?.email) {
                    const endFmt = new Date(newEnd).toLocaleDateString('de-DE', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    });
                    const sellerNameStr = sellerProfile.first_name || sellerProfile.email.split('@')[0];
                    const dashboardUrl = `https://caravanwert.de/dashboard/listings/${mh.id}`;
                    const currentBidStr = `€${instantPriceNum.toLocaleString('de-DE')}`;

                    await supabase.functions.invoke('send-auction-notification', {
                      body: {
                        email: sellerProfile.email,
                        name: sellerNameStr,
                        type: 'seller_festpreis_extended',
                        motorhomeModel: motorhomeName,
                        auctionUrl: dashboardUrl,
                        currentBid: currentBidStr,
                        endTime: endFmt,
                        extendedUntil: endFmt,
                        roundNumber: String(newRound),
                      },
                    }).catch((e: any) => console.error('Festpreis seller extend mail:', e?.message));

                    if (newRound >= 2) {
                      await supabase.functions.invoke('send-auction-notification', {
                        body: {
                          email: sellerProfile.email,
                          name: sellerNameStr,
                          type: 'seller_festpreis_round_warning',
                          motorhomeModel: motorhomeName,
                          auctionUrl: dashboardUrl,
                          currentBid: currentBidStr,
                          endTime: endFmt,
                          roundNumber: String(newRound),
                        },
                      }).catch((e: any) => console.error('Festpreis seller round_warning mail:', e?.message));
                    }
                  }
                } catch (e: any) {
                  console.error('Festpreis seller lookup failed:', e?.message);
                }
              }

              results.push({
                auctionId: auction.id,
                type: 'festpreis_extend',
                success: true,
                data: { round: newRound, endTime: newEnd, instantPrice: instantPriceNum },
              });
              continue;
            }

            // ── Path C: instant_price NULL/0, first encounter → 24h grace + admin alert
            const grace = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            console.log(
              `[festpreis-admin-alert] auction=${auction.id} motorhome=${auction.motorhome_id} ` +
              `instant_price NULL/0 → 24h grace, end_time=${grace}`
            );

            const { error: graceError } = await supabase
              .from('auctions')
              .update({
                end_time: grace,
                festpreis_admin_notified_at: now,
                updated_at: now,
              })
              .eq('id', auction.id);

            if (graceError) {
              console.error(`Failed to set 24h grace on ${auction.id}:`, graceError);
              results.push({
                auctionId: auction.id,
                type: 'festpreis_admin_alert',
                success: false,
                error: graceError.message,
              });
              continue;
            }

            // Send admin alert (recipient: site_settings.contact_email or admins).
            // Anti-spam: send-auction-notification logs to admin_emails;
            // duplicate suppression handled by the 24h grace marker itself
            // (we won't re-enter this branch until grace expires).
            try {
              const { data: settings } = await supabase
                .from('site_settings').select('contact_email, site_name').limit(1).maybeSingle();
              const adminEmail = settings?.contact_email || 'info@caravanwert.de';

              // Lookup seller name for richer admin context
              let sellerNameStr: string | undefined;
              if (mh.seller_id) {
                const { data: sp } = await supabase
                  .from('profiles')
                  .select('first_name, last_name, company_name, email')
                  .eq('id', mh.seller_id)
                  .single();
                if (sp) {
                  sellerNameStr = sp.company_name
                    || `${sp.first_name || ''} ${sp.last_name || ''}`.trim()
                    || sp.email
                    || mh.seller_id;
                }
              }

              await supabase.functions.invoke('send-auction-notification', {
                body: {
                  email: adminEmail,
                  name: 'Admin',
                  type: 'admin_festpreis_needs_price',
                  motorhomeModel: motorhomeName,
                  // Bug-fix #3: link straight to the motorhome edit dialog.
                  // /admin/auctions does not let admins set the missing instant_price;
                  // /admin/motorhomes/<id> opens the edit row where price + sale_channel
                  // can be corrected in one click.
                  auctionUrl: `https://caravanwert.de/admin/motorhomes/${mh.id}`,
                  motorhomeId: mh.id,
                  sellerName: sellerNameStr,
                },
              }).catch((e: any) => console.error('Festpreis admin alert mail:', e?.message));
            } catch (e: any) {
              console.error('Festpreis admin alert lookup failed:', e?.message);
            }

            results.push({
              auctionId: auction.id,
              type: 'festpreis_admin_alert',
              success: true,
              data: { graceEnd: grace, motorhomeId: mh.id },
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

              // Bug-fix #6: scope the lowest counter-offer query to the
              // CURRENT round (the one being closed). Previously this pulled
              // every counter-offer ever made on this auction_id, including
              // expired ones from older rounds, and could undercut the
              // seller with a stale 4 500 € counter from round 1 even though
              // they had moved up to 6 000 € in round 3.
              // post_auction_offers.auction_round is now stamped via trigger
              // on insert (migration 20260420010000).
              const currentRound = kaufchance.auction_round || 1;
              const { data: allOffers } = await supabase
                .from('post_auction_offers')
                .select('counter_offer_amount')
                .eq('auction_id', kaufchance.id)
                .eq('auction_round', currentRound)
                .not('counter_offer_amount', 'is', null);

              if (allOffers && allOffers.length > 0) {
                const lowestCounterOffer = Math.min(
                  ...allOffers.map((o: { counter_offer_amount: unknown }) => Number(o.counter_offer_amount))
                );
                if (lowestCounterOffer > 0) {
                  newReservePrice = lowestCounterOffer;
                  console.log(`New reserve price from lowest seller counter-offer (round ${currentRound}): ${newReservePrice}`);
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

              // Notify seller about auto-relist + soft brake (commit 4):
              // seller_auto_relisted is a status mail without recommendations.
              // From round 2 onwards we additionally send seller_auction_round_warning
              // which carries concrete tips (reserve check, addendum, opt-out).
              if (mh?.seller_id) {
                try {
                  const { data: sellerProfile } = await supabase
                    .from('profiles').select('email, first_name').eq('id', mh.seller_id).single();
                  if (sellerProfile?.email) {
                    const sellerNameStr = sellerProfile.first_name || sellerProfile.email.split('@')[0];
                    const dashboardUrl = `https://caravanwert.de/dashboard/listings/${mh.id}`;

                    await supabase.functions.invoke('send-auction-notification', {
                      body: {
                        email: sellerProfile.email,
                        name: sellerNameStr,
                        type: 'seller_auto_relisted',
                        motorhomeModel: motorhomeName,
                        auctionUrl: dashboardUrl,
                        endTime: endTimeFormatted,
                        reservePrice: reserveFormatted,
                        currentBid: `Runde ${newRound}`,
                      },
                    }).catch((e: any) => console.error(`Failed to notify seller:`, e));

                    if (newRound >= 2) {
                      await supabase.functions.invoke('send-auction-notification', {
                        body: {
                          email: sellerProfile.email,
                          name: sellerNameStr,
                          type: 'seller_auction_round_warning',
                          motorhomeModel: motorhomeName,
                          auctionUrl: dashboardUrl,
                          endTime: endTimeFormatted,
                          reservePrice: reserveFormatted,
                          roundNumber: String(newRound),
                        },
                      }).catch((e: any) => console.error('Auction seller round_warning mail:', e?.message));
                    }
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

    // ─── 3. Orphan sweep: offers on already-dead auctions ───────────────────
    // Finds post_auction_offers in pending/countered whose auction is already
    // sold/ended/cancelled. This can happen if admin cancelled/sold directly
    // in a place we didn't instrument, or if a race left offers stranded.
    // We expire them defensively so buyers don't see phantom offers forever.
    let orphanCount = 0;
    try {
      const { data: orphanOffers } = await supabase
        .from('post_auction_offers')
        .select('id, auction_id, buyer_id, offer_amount, auction:auctions(status, motorhome:motorhomes(manufacturer, model))')
        .in('status', ['pending', 'countered'])
        .limit(500);

      const deadStatuses = new Set(['sold', 'ended', 'cancelled']);
      const toExpire = (orphanOffers || []).filter((o: any) => {
        const auc = Array.isArray(o.auction) ? o.auction[0] : o.auction;
        return auc && deadStatuses.has(auc.status);
      });

      if (toExpire.length > 0) {
        const ids = toExpire.map((o: any) => o.id);
        const { error: orphanErr } = await supabase
          .from('post_auction_offers')
          .update({
            status: 'expired',
            seller_response: 'Inserat bereits beendet – Angebot automatisch storniert',
            updated_at: now,
          })
          .in('id', ids);
        if (orphanErr) {
          console.error('Orphan sweep update failed:', orphanErr);
        } else {
          orphanCount = toExpire.length;
          console.log(`Orphan sweep expired ${orphanCount} offers on dead auctions`);

          // Best-effort: notify proposers so they aren't left in the dark.
          // Only notify for offers whose auction is cancelled (user-driven end
          // that would otherwise surprise them). sold/ended offers are noisy
          // because the winning-buyer path already sent "lost" mails.
          for (const o of toExpire) {
            const auc = Array.isArray(o.auction) ? o.auction[0] : o.auction;
            if (auc?.status !== 'cancelled') continue;
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('email, first_name, company_name')
                .eq('id', o.buyer_id)
                .single();
              if (profile?.email) {
                const mh = auc?.motorhome
                  ? (Array.isArray(auc.motorhome) ? auc.motorhome[0] : auc.motorhome)
                  : null;
                const motorhomeName = mh
                  ? `${mh.manufacturer || ''} ${mh.model || ''}`.trim()
                  : 'Inserat';
                await supabase.functions.invoke('send-auction-notification', {
                  body: {
                    email: profile.email,
                    name: profile.company_name || profile.first_name || profile.email.split('@')[0],
                    type: 'lost',
                    motorhomeModel: motorhomeName,
                    auctionUrl: 'https://caravanwert.de/kaufen',
                    yourBid: `€${Number(o.offer_amount).toLocaleString('de-DE')}`,
                    isFestpreis: true,
                    listingEnded: true,
                  },
                });
              }
            } catch (notifyErr: any) {
              console.error(`Orphan sweep notify failed for ${o.buyer_id}:`, notifyErr?.message);
            }
          }
        }
      }
    } catch (orphanBlockErr: any) {
      console.error('Orphan sweep block failed:', orphanBlockErr?.message);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Processing completed: ${successCount} successful, ${failCount} failed, ${orphanCount} orphan offers swept`);

    if (failCount > 0) {
      await logEdgeError(supabase, {
        component: 'check-expired-auctions',
        message: `Cron: ${failCount} Auktion(en) konnten nicht geschlossen/relisted werden`,
        severity: failCount >= 3 ? 'high' : 'medium',
        category: 'auction',
        metadata: {
          successCount,
          failCount,
          orphanCount,
          failures: results.filter(r => !r.success),
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} expired auctions/kaufchancen; swept ${orphanCount} orphan offers`,
        successCount,
        failCount,
        orphanCount,
        results,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in check-expired-auctions:', error);
    try {
      const supabaseLog = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      await logEdgeError(supabaseLog, {
        component: 'check-expired-auctions',
        message: `Cron: Unerwarteter Fehler beim Prüfen abgelaufener Auktionen: ${error?.message || 'unbekannt'}`,
        severity: 'critical',
        category: 'auction',
        originalError: error,
      });
    } catch { /* swallow */ }
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
