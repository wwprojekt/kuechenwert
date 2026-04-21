import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { buildEmailLayout, paragraph, infoBox, detailRow, amountDisplay, warningBox, button } from '../_shared/email-builder.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import { logEdgeError } from '../_shared/edgeLogger.ts';
import { uploadSaleConversionToGoogleAds } from '../_shared/gads-sale-conversion.ts';
import { sendContractSentNotification } from '../_shared/contract-notification.ts';
import { MARKETING_CONFIG, computeNextReducedReserve } from '../_shared/marketing-config.ts';

/**
 * Edge Function: close-auction
 * 
 * Closes an auction after it has ended. Determines the outcome:
 * - Sold: Reserve price met → update motorhome, create invoice, generate purchase contract, send emails
 * - Kaufchance: Reserve not met but bids exist → invite top-2 bidders for negotiation
 * - Ended: No bids → notify seller
 * 
 * Invoice flow (when sold):
 * 1. create_auction_invoice RPC → creates invoice + line items
 * 2. generate-invoice-pdf → generates PDF, uploads to storage, updates pdf_url
 * 3. send-invoice-email → sends email with PDF attachment to dealer
 * 
 * Purchase contract flow (when sold):
 * 4. generate-purchase-contract → generates Kaufvertrag PDF between seller and buyer
 * 5. Send contract to both parties via email
 * 
 * Kaufchance flow (when reserve not met but bids exist):
 * 1. Set auction status to 'kaufchance' with 72h expiry
 * 2. Identify top-2 unique bidders by their highest bid
 * 3. Create kaufchance_invitations for top-2 bidders
 * 4. Send invitation emails to top-2 bidders
 * 5. Notify seller about kaufchance phase
 * 6. Notify admin about kaufchance
 * 
 * Notifications:
 * - Winner dealer: notify-auction-winner
 * - Losing dealers: send-auction-notification (type: 'lost')
 * - Seller (sold): send-auction-notification (type: 'seller_sold')
 * - Seller (not sold): send-auction-notification (type: 'seller_not_sold')
 * - Seller (kaufchance): send-auction-notification (type: 'seller_kaufchance')
 * - Top-2 bidders (kaufchance): send-auction-notification (type: 'kaufchance_invite')
 * - Admin: summary email with all results and any errors
 * 
 * Auth: service_role (cron/internal) or admin
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'info@caravanwert.de';

// Helper: Send admin notification email directly via Resend
async function sendAdminEmail(
  supabase: any,
  subject: string,
  content: string,
) {
  try {
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const settingsData = settings || {
      site_name: 'CaravanWert',
      contact_email: 'info@caravanwert.de',
    };

    // Get admin emails: find users with admin role, then get their emails
    const recipients: string[] = [];
    try {
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (adminRoles && adminRoles.length > 0) {
        const adminIds = adminRoles.map((r: any) => r.user_id);
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('email')
          .in('id', adminIds);

        if (adminProfiles) {
          for (const p of adminProfiles) {
            if (p.email) recipients.push(p.email);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching admin emails:', e);
    }

    if (recipients.length === 0) {
      recipients.push(ADMIN_EMAIL);
    }

    const html = buildEmailLayout(settingsData, subject, content);

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not set, cannot send admin email');
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} System <info@caravanwert.de>`,
        to: recipients,
        subject: `[Admin] ${subject}`,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send admin email:', errorText);
    } else {
      const result = await response.json();
      console.log('Admin notification email sent to:', recipients.join(', '));

      // Log in admin_emails for System tab
      try {
        await supabase.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: `${settingsData.site_name} System`,
          recipient_email: recipients[0],
          recipient_name: 'Admin',
          subject: `[Admin] ${subject}`,
          body_html: html,
          body_text: '',
          email_type: 'auto',
          direction: 'outbound',
          status: 'sent',
          resend_id: result?.id || null,
          is_read: false,
        });
      } catch (logErr) {
        console.error('Failed to log admin email in admin_emails:', logErr);
      }
    }
  } catch (error) {
    console.error('Error sending admin email:', error);
  }
}

// Helper: Get top-N unique bidders by their highest bid
function getTopBidders(bids: any[], count: number): { bidderId: string; highestBid: number }[] {
  // Group bids by bidder and find each bidder's highest bid
  const bidderHighest = new Map<string, number>();
  
  for (const bid of bids) {
    const amount = Number(bid.amount);
    const current = bidderHighest.get(bid.bidder_id) || 0;
    if (amount > current) {
      bidderHighest.set(bid.bidder_id, amount);
    }
  }
  
  // Sort by highest bid descending and take top N
  const sorted = Array.from(bidderHighest.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count);
  
  return sorted.map(([bidderId, highestBid]) => ({ bidderId, highestBid }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  // ─── Auth check: must be service_role (cron/internal) or authenticated admin ───
  const authResult = await checkServiceRoleOrAdmin(req, getCorsHeaders(req));
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const { auctionId } = await req.json();

    if (!auctionId || typeof auctionId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'auctionId is required and must be a string' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Closing auction:', auctionId);

    // Track errors for admin summary
    const errors: string[] = [];

    // Get auction with bids
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select(`
        *,
        motorhome:motorhomes(*),
        bids(*)
      `)
      .eq('id', auctionId)
      .single();

    if (auctionError || !auction) {
      throw new Error('Auction not found');
    }

    // Check if auction is already closed
    if (auction.status === 'ended' || auction.status === 'sold' || auction.status === 'cancelled' || auction.status === 'kaufchance') {
      return new Response(
        JSON.stringify({ message: 'Auction already closed or in kaufchance phase' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Festpreis-only listings: no bidding/Kaufchance logic — just end cleanly
    if (auction.motorhome?.sale_channel === 'instant_price') {
      console.log(`Closing instant-price listing ${auctionId} — no Kaufchance/bid logic`);
      const now = new Date().toISOString();

      await supabase.from('auctions')
        .update({ status: 'ended', updated_at: now })
        .eq('id', auctionId);

      if (auction.motorhome?.id) {
        // Bug-fix #1: motorhomes.status CHECK constraint forbids 'ended'
        // (allowed: available, active, sold, pending, not_sold, reserved).
        // 'not_sold' matches the semantics used by end-kaufchance and
        // AdminPostAuctionOffers.handleEndKaufchance for "offered, not transacted".
        await supabase.from('motorhomes')
          .update({ status: 'not_sold', updated_at: now })
          .eq('id', auction.motorhome.id);
      }

      // Expire any pending price proposals and notify proposers
      const { data: expiredOffers } = await supabase
        .from('post_auction_offers')
        .select('buyer_id, offer_amount')
        .eq('auction_id', auctionId)
        .in('status', ['pending', 'countered']);

      const { error: expireOffersErr } = await supabase
        .from('post_auction_offers')
        .update({ status: 'expired', seller_response: 'Inserat abgelaufen', updated_at: now })
        .eq('auction_id', auctionId)
        .in('status', ['pending', 'countered']);
      if (expireOffersErr) console.error(`Failed to expire offers for ${auctionId}:`, expireOffersErr);

      if (expiredOffers && expiredOffers.length > 0) {
        const motorhomeName = `${auction.motorhome?.manufacturer || ''} ${auction.motorhome?.model || ''}`.trim();
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

      return new Response(
        JSON.stringify({ success: true, message: 'Instant-price listing ended', outcome: 'ended' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Get highest bid
    const { data: highestBid, error: bidError } = await supabase
      .from('bids')
      .select('*')
      .eq('auction_id', auctionId)
      .order('amount', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bidError) {
      console.error('Error fetching highest bid:', bidError);
    }

    // Determine auction outcome
    let newStatus = 'ended';
    let motorhomeStatus = 'available';
    let soldTo: string | null = null;
    let isKaufchance = false;

    // CRITICAL FIX: Use auction.reserve_price, but fallback to motorhome.reserve_price
    // This prevents selling below the seller's minimum price even if the admin forgot
    // to set the reserve_price on the auction itself.
    const effectiveReservePrice = auction.reserve_price
      ?? auction.motorhome?.reserve_price
      ?? null;

    if (effectiveReservePrice && !auction.reserve_price) {
      console.warn(
        `WARN: Auction ${auctionId} has no reserve_price set, using motorhome reserve_price: ${effectiveReservePrice}`
      );
      // Auto-fix: write the motorhome reserve_price back to the auction for consistency
      await supabase
        .from('auctions')
        .update({ reserve_price: effectiveReservePrice })
        .eq('id', auctionId);
    }

    if (highestBid) {
      const reserveMet = effectiveReservePrice
        ? Number(highestBid.amount) >= Number(effectiveReservePrice)
        : true;

      if (reserveMet) {
        newStatus = 'sold';
        motorhomeStatus = 'sold';
        soldTo = highestBid.bidder_id;
        console.log('Auction sold to:', soldTo, 'for:', highestBid.amount, '(reserve:', effectiveReservePrice, ')');
      } else {
        // Reserve not met but bids exist → Kaufchance!
        newStatus = 'kaufchance';
        isKaufchance = true;
        console.log('Reserve price not met. Highest bid:', highestBid.amount, 'Reserve:', effectiveReservePrice, '→ Entering Kaufchance phase');
      }
    } else {
      console.log('No bids placed on auction');
    }

    // Calculate kaufchance expiry: MARKETING_CONFIG.KAUFCHANCE_DURATION_HOURS
    // (24h ab Phase 3, vorher hartcodiert 72h)
    const kaufchanceExpiresAt = isKaufchance
      ? new Date(Date.now() + MARKETING_CONFIG.KAUFCHANCE_DURATION_HOURS * 60 * 60 * 1000).toISOString()
      : null;

    // ═══════════════════════════════════════════════════════════════════════
    // ─── AUTO-RELIST FOR NO-BID AUCTIONS (Phase 3 Marketing-Phase Logik) ──
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Wenn eine Auktion ohne Gebote endet, soll sie automatisch erneut
    // eingestellt werden – mit reduzierter Reserve und neuem zufälligem
    // Startgebot. Voraussetzung: Es ist ein Inserat unter der neuen
    // Marketingphase-Logik (`seller_initial_reserve` gesetzt).
    //
    // Eligibility (alle müssen TRUE sein):
    //   1. Kein Gebot vorhanden                           → newStatus === 'ended'
    //   2. sale_channel === 'auction' (nicht instant_price; das ist
    //      schon weiter oben gehandelt worden)
    //   3. seller_initial_reserve IS NOT NULL              → neue Logik
    //   4. auto_relist !== false                           → Verkäufer-Opt-In
    //   5. auction_round < AUCTION_MAX_ROUNDS              → max 4 Runden
    //   6. marketing_phase_max_until > now()               → Bindungs-Cap nicht
    //                                                       überschritten
    //
    // Wenn alle erfüllt: relist; sonst klassisches "ended".
    // (Soft-Brake-Mail kommt in Phase 6 – hier loggen wir nur den Grund.)
    const isNoBidsAuctionEnding =
      newStatus === 'ended' && !highestBid && auction.motorhome?.sale_channel === 'auction';
    const sellerInitialReserveNum = auction.seller_initial_reserve != null
      ? Number(auction.seller_initial_reserve)
      : null;

    if (isNoBidsAuctionEnding && sellerInitialReserveNum !== null && sellerInitialReserveNum > 0) {
      const autoRelistEnabled = auction.auto_relist !== false;
      const currentRound = Number(auction.auction_round || 1);
      const maxRoundsReached = currentRound >= MARKETING_CONFIG.AUCTION_MAX_ROUNDS;
      const maxUntil = auction.marketing_phase_max_until
        ? new Date(auction.marketing_phase_max_until)
        : null;
      const phaseExpired = maxUntil != null && maxUntil.getTime() <= Date.now();
      const isEligible = autoRelistEnabled && !maxRoundsReached && !phaseExpired;

      if (isEligible) {
        // Reserve reduzieren – nur wenn dynamic_pricing aktiviert
        const dynamicPricing = auction.dynamic_pricing !== false;
        const currentReserveNum = Number(effectiveReservePrice ?? sellerInitialReserveNum);
        const newReserve = dynamicPricing
          ? computeNextReducedReserve(currentReserveNum, sellerInitialReserveNum, 'auction')
          : currentReserveNum;

        // Neues Random-Startgebot 40-60% von Reserve, gerundet auf 50er
        let newStartingBid = 50;
        try {
          const { data: bidData, error: bidErr } = await supabase.rpc('compute_random_starting_bid', {
            p_reserve_price: newReserve,
          });
          if (!bidErr && typeof bidData === 'number' && bidData > 0) {
            newStartingBid = bidData;
          } else if (bidErr) {
            console.warn('compute_random_starting_bid RPC error, fallback 50:', bidErr.message);
          }
        } catch (e: any) {
          console.warn('compute_random_starting_bid threw, fallback 50:', e?.message);
        }

        const newRound = currentRound + 1;
        const startTime = new Date();
        const endTime = new Date(
          Date.now() + MARKETING_CONFIG.AUCTION_DURATION_DAYS * 24 * 60 * 60 * 1000
        );
        const nowIso = new Date().toISOString();

        // last_price_reduction_at nur setzen, wenn tatsächlich reduziert wurde
        // (= dynamic_pricing aktiv UND newReserve < currentReserveNum). Wird im
        // Käufer-View für den "Stabil seit X Tagen"-Badge ausgewertet.
        const reduceHappened = dynamicPricing && newReserve < currentReserveNum;
        const updatePayload: Record<string, unknown> = {
          status: 'active',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          current_bid: null,
          starting_bid: newStartingBid,
          reserve_price: newReserve,
          auction_round: newRound,
          // marketing_phase_started_at + max_until werden NICHT zurückgesetzt
          // – die Bindung läuft kontinuierlich (siehe Phase-1-Schema-Doku).
          updated_at: nowIso,
        };
        if (reduceHappened) {
          updatePayload.last_price_reduction_at = nowIso;
        }

        const { error: relistErr } = await supabase
          .from('auctions')
          .update(updatePayload)
          .eq('id', auctionId);

        if (relistErr) {
          console.error(`Auto-relist UPDATE failed for ${auctionId}:`, relistErr);
          errors.push(`Auto-Relist fehlgeschlagen: ${relistErr.message}`);
          // Fall through to normal "ended" path as defensive fallback
        } else {
          // Motorhome-Status synchronisieren
          if (auction.motorhome?.id) {
            const { error: mhErr } = await supabase
              .from('motorhomes')
              .update({
                status: 'active',
                reserve_price: newReserve,
                updated_at: nowIso,
              })
              .eq('id', auction.motorhome.id);
            if (mhErr) console.error(`Motorhome sync after relist ${auctionId}:`, mhErr);
          }

          // Verkäufer informieren (gleicher Template-Type wie bei Kaufchance-Relist
          // in check-expired-auctions, damit alle Auto-Relist-Mails konsistent sind)
          if (auction.motorhome?.seller_id) {
            try {
              const { data: sellerProfile } = await supabase
                .from('profiles')
                .select('email, first_name')
                .eq('id', auction.motorhome.seller_id)
                .single();
              if (sellerProfile?.email) {
                const dashboardUrl = `https://caravanwert.de/dashboard/listings/${auction.motorhome.id}`;
                const endTimeFmt = endTime.toLocaleDateString('de-DE', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                });
                const reserveFmt = `€${newReserve.toLocaleString('de-DE')}`;

                await supabase.functions.invoke('send-auction-notification', {
                  body: {
                    email: sellerProfile.email,
                    name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
                    type: 'seller_auto_relisted',
                    motorhomeModel: motorhomeName,
                    auctionUrl: dashboardUrl,
                    endTime: endTimeFmt,
                    reservePrice: reserveFmt,
                    currentBid: `Runde ${newRound}`,
                  },
                }).catch((e: any) => console.error('Seller relist mail failed:', e?.message));

                // Ab Runde 2 zusätzlich Soft-Warning mit konkreten Empfehlungen
                if (newRound >= 2) {
                  await supabase.functions.invoke('send-auction-notification', {
                    body: {
                      email: sellerProfile.email,
                      name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
                      type: 'seller_auction_round_warning',
                      motorhomeModel: motorhomeName,
                      auctionUrl: dashboardUrl,
                      endTime: endTimeFmt,
                      reservePrice: reserveFmt,
                      roundNumber: String(newRound),
                    },
                  }).catch((e: any) => console.error('Seller round_warning mail failed:', e?.message));
                }
              }
            } catch (e: any) {
              console.error('Seller profile lookup failed during relist:', e?.message);
            }
          }

          console.log(
            `[auto-relist] auction=${auctionId} round=${currentRound}->${newRound} ` +
            `reserve=${currentReserveNum}->${newReserve} startbid=${newStartingBid} ` +
            `dynamic_pricing=${dynamicPricing}`
          );

          return new Response(
            JSON.stringify({
              success: true,
              status: 'active',
              outcome: 'auto_relisted',
              round: newRound,
              newReserve,
              newStartingBid,
              endTime: endTime.toISOString(),
              dynamicPricing,
              errors: errors.length > 0 ? errors : undefined,
            }),
            { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Soft-Brake-Trigger: Eligibility nicht erfüllt → Auktion endet endgültig.
        // Phase-4 Audit-Fix #6: 3-Buttons-Mail an den Verkäufer senden.
        const reason = !autoRelistEnabled
          ? 'auto_relist_off'
          : maxRoundsReached
            ? 'max_rounds_reached'
            : phaseExpired
              ? 'marketing_phase_expired'
              : 'unknown';
        console.log(
          `[soft-brake] auction=${auctionId} round=${currentRound} ` +
          `seller_initial_reserve=${sellerInitialReserveNum} reason=${reason}`
        );

        if (auction.motorhome?.seller_id && reason !== 'unknown') {
          try {
            const { data: sellerProfile } = await supabase
              .from('profiles')
              .select('email, first_name')
              .eq('id', auction.motorhome.seller_id)
              .single();
            if (sellerProfile?.email) {
              const dashboardUrl = `https://caravanwert.de/dashboard/listings/${auction.motorhome.id}`;
              const reserveFmt = effectiveReservePrice
                ? `€${Number(effectiveReservePrice).toLocaleString('de-DE')}`
                : '—';
              await supabase.functions.invoke('send-auction-notification', {
                body: {
                  email: sellerProfile.email,
                  name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
                  type: 'seller_soft_brake',
                  motorhomeModel: motorhomeName,
                  auctionUrl: dashboardUrl,
                  roundNumber: String(currentRound),
                  reservePrice: reserveFmt,
                  softBrakeReason: reason,
                  isAuctionType: true,
                },
              }).catch((e: any) => console.error('Soft-brake mail (auction) failed:', e?.message));
            }
          } catch (e: any) {
            console.error('Seller lookup for soft-brake failed:', e?.message);
          }
        }
      }
    }

    // Update auction status
    const updateData: any = { status: newStatus };
    if (kaufchanceExpiresAt) {
      updateData.kaufchance_expires_at = kaufchanceExpiresAt;
      // Set initial kaufchance_min_price to the reserve_price (admin can adjust later)
      updateData.kaufchance_min_price = effectiveReservePrice;
    }

    const { error: updateAuctionError } = await supabase
      .from('auctions')
      .update(updateData)
      .eq('id', auctionId);

    if (updateAuctionError) {
      console.error('Error updating auction status:', updateAuctionError);
      throw updateAuctionError;
    }

    const motorhomeName = `${auction.motorhome?.manufacturer || ''} ${auction.motorhome?.model || ''}`.trim();
    const auctionUrl = `https://caravanwert.de/auktion/${auctionId}`;

    // ═══════════════════════════════════════════════════════════════════════════
    // ─── KAUFCHANCE FLOW ───────────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════════
    if (isKaufchance && auction.bids && auction.bids.length > 0) {
      console.log('Processing Kaufchance flow...');
      
      // Get top-2 unique bidders
      const topBidders = getTopBidders(auction.bids, 2);
      console.log('Top bidders identified:', topBidders);

      // ─── Bug 3 fix: clean stale invitations from previous rounds ────────
      // Without this, a re-close, manual restart, or admin re-run would
      // leave phantom rows for bidders who are no longer in the new top-2.
      // post_auction_offers are independent (no FK to invitations), so this
      // is safe and never destroys offer data. Sweeping ALL invitations for
      // this auction is the simplest correct strategy: the loop below then
      // re-inserts exactly the current top-2.
      try {
        const { error: deleteStaleErr } = await supabase
          .from('kaufchance_invitations')
          .delete()
          .eq('auction_id', auctionId);
        if (deleteStaleErr) {
          console.error('Error deleting stale invitations:', deleteStaleErr);
          errors.push(`Alte Einladungen löschen fehlgeschlagen: ${deleteStaleErr.message}`);
        }
      } catch (e: any) {
        console.error('Exception deleting stale invitations:', e);
        errors.push(`Alte Einladungen löschen fehlgeschlagen: ${e.message}`);
      }

      // Create kaufchance_invitations for top-2 bidders
      for (let i = 0; i < topBidders.length; i++) {
        const bidder = topBidders[i];
        const rank = i + 1;

        try {
          const { error: inviteError } = await supabase
            .from('kaufchance_invitations')
            .upsert({
              auction_id: auctionId,
              bidder_id: bidder.bidderId,
              highest_bid: bidder.highestBid,
              rank: rank,
              invited_at: new Date().toISOString(),
            }, {
              onConflict: 'auction_id,bidder_id',
            });

          if (inviteError) {
            console.error(`Error creating invitation for bidder ${bidder.bidderId}:`, inviteError);
            errors.push(`Einladung für Bieter ${rank} fehlgeschlagen: ${inviteError.message}`);
          } else {
            console.log(`Invitation created for bidder ${bidder.bidderId} (rank ${rank})`);
          }
        } catch (e: any) {
          console.error(`Error creating invitation for bidder ${bidder.bidderId}:`, e);
          errors.push(`Einladung für Bieter ${rank} fehlgeschlagen: ${e.message}`);
        }
      }

      // Send invitation emails to top-2 bidders
      for (let i = 0; i < topBidders.length; i++) {
        const bidder = topBidders[i];
        const rank = i + 1;

        try {
          const { data: bidderProfile } = await supabase
            .from('profiles')
            .select('email, first_name, company_name')
            .eq('id', bidder.bidderId)
            .single();

          if (bidderProfile?.email) {
            const { error: invokeErr } = await supabase.functions.invoke('send-auction-notification', {
              body: {
                email: bidderProfile.email,
                name: bidderProfile.company_name || bidderProfile.first_name || bidderProfile.email.split('@')[0],
                type: 'kaufchance_invite',
                motorhomeModel: motorhomeName,
                auctionUrl,
                yourBid: `€${bidder.highestBid.toLocaleString()}`,
                currentBid: `€${Number(highestBid!.amount).toLocaleString()}`,
                rank: String(rank),
                expiresAt: new Date(kaufchanceExpiresAt!).toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              },
            });
            if (invokeErr) throw invokeErr;
            console.log(`Kaufchance invitation email sent to bidder ${rank}:`, bidderProfile.email);
          }
        } catch (e: any) {
          console.error(`Error sending kaufchance invitation to bidder ${rank}:`, e);
          errors.push(`Kaufchance-E-Mail an Bieter ${rank} fehlgeschlagen: ${e.message}`);
        }
      }

      // Notify seller about kaufchance phase
      if (auction.motorhome?.seller_id) {
        try {
          const { data: sellerProfile } = await supabase
            .from('profiles')
            .select('email, first_name')
            .eq('id', auction.motorhome.seller_id)
            .single();

          if (sellerProfile?.email) {
            const { error: sellerInvokeErr } = await supabase.functions.invoke('send-auction-notification', {
              body: {
                email: sellerProfile.email,
                name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
                type: 'seller_kaufchance',
                motorhomeModel: motorhomeName,
                auctionUrl: `https://caravanwert.de/dashboard/listings/${auction.motorhome.id}`,
                currentBid: `€${Number(highestBid!.amount).toLocaleString()}`,
                reservePrice: `€${Number(effectiveReservePrice).toLocaleString()}`,
                topBiddersCount: String(topBidders.length),
                expiresAt: new Date(kaufchanceExpiresAt!).toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              },
            });
            if (sellerInvokeErr) throw sellerInvokeErr;
            console.log('Kaufchance notification sent to seller:', sellerProfile.email);
          }
        } catch (e: any) {
          console.error('Error sending kaufchance notification to seller:', e);
          errors.push(`Kaufchance-E-Mail an Verkäufer fehlgeschlagen: ${e.message}`);
        }
      }

      // Admin notification for Kaufchance
      let adminContent = `
        ${paragraph('<strong>Eine Auktion ist in die Kaufchance-Phase eingetreten.</strong>')}
        ${infoBox('Auktionsergebnis', `
          ${detailRow('Status', '🔔 KAUFCHANCE')}
          ${detailRow('Fahrzeug', motorhomeName)}
          ${detailRow('Mindestgebot', `€${Number(effectiveReservePrice).toLocaleString()}`)}
          ${detailRow('Höchstes Gebot', `€${Number(highestBid!.amount).toLocaleString()}`)}
          ${detailRow('Differenz', `€${(Number(effectiveReservePrice) - Number(highestBid!.amount)).toLocaleString()}`)}
          ${detailRow('Anzahl Gebote', String(auction.bids?.length || 0))}
        `, 'warning')}
        ${infoBox('Eingeladene Bieter (Top-2)', topBidders.map((b, i) => 
          `${detailRow(`Platz ${i + 1}`, `€${b.highestBid.toLocaleString()}`)}`
        ).join(''), 'info')}
        ${paragraph(`<strong>Kaufchance läuft ab:</strong> ${new Date(kaufchanceExpiresAt!).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`)}
        ${paragraph('<strong>Nächste Schritte:</strong><br>• Die Top-2-Bieter wurden eingeladen und können Angebote abgeben<br>• Der Verkäufer wurde informiert<br>• Sie können im Admin-Dashboard die Verhandlung moderieren<br>• Bei Bedarf können Sie das Mindestgebot anpassen')}
      `;

      if (errors.length > 0) {
        adminContent += warningBox(`<strong>⚠️ ${errors.length} Fehler aufgetreten:</strong><br>${errors.map(e => `• ${e}`).join('<br>')}`);
      }

      adminContent += button('Kaufchancen verwalten', `https://caravanwert.de/admin/offers`);

      await sendAdminEmail(supabase, `Kaufchance gestartet: ${motorhomeName}`, adminContent);

      return new Response(
        JSON.stringify({
          success: true,
          status: newStatus,
          kaufchance: true,
          topBidders: topBidders.map((b, i) => ({ rank: i + 1, highestBid: b.highestBid })),
          expiresAt: kaufchanceExpiresAt,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ─── SOLD FLOW ─────────────────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════════════
    if (motorhomeStatus === 'sold' && soldTo) {
      // Update motorhome status
      const { error: updateMotorhomeError } = await supabase
        .from('motorhomes')
        .update({
          status: motorhomeStatus,
          sold_to: soldTo,
          sold_at: new Date().toISOString(),
          sale_type: 'auction',
        })
        .eq('id', auction.motorhome.id);

      if (updateMotorhomeError) {
        console.error('Error updating motorhome status:', updateMotorhomeError);
        errors.push(`Motorhome-Status-Update fehlgeschlagen: ${updateMotorhomeError.message}`);
      }

      // Send winner notification
      try {
        const { error: winnerInvokeErr } = await supabase.functions.invoke('notify-auction-winner', {
          body: {
            auctionId,
            winnerId: soldTo,
            amount: highestBid!.amount,
          },
        });
        if (winnerInvokeErr) throw winnerInvokeErr;
      } catch (notifyError: any) {
        console.error('Error sending winner notification:', notifyError);
        errors.push(`Gewinner-Benachrichtigung fehlgeschlagen: ${notifyError.message}`);
      }

      // ─── INVOICE FLOW ─────────────────────────────────────────────
      let invoiceSuccess = false;
      let invoiceNumber = '';
      try {
        console.log('Creating invoice for auction:', auctionId, 'dealer:', soldTo);
        
        // Step 1: Create invoice
        const { data: invoiceId, error: invoiceRpcError } = await supabase.rpc('create_auction_invoice', {
          auction_id_param: auctionId,
          dealer_id_param: soldTo
        });

        if (invoiceRpcError) {
          console.error('Invoice RPC error:', invoiceRpcError);
          throw invoiceRpcError;
        }

        if (!invoiceId) {
          throw new Error('Invoice creation returned no ID');
        }

        console.log('Invoice created:', invoiceId);

        // Step 2: Generate PDF
        let pdfBase64: string | undefined;
        try {
          const { data: pdfResult, error: pdfError } = await supabase.functions.invoke('generate-invoice-pdf', {
            body: { invoiceId }
          });
          
          if (pdfError) {
            console.error('PDF generation error:', pdfError);
            errors.push(`Rechnungs-PDF-Generierung fehlgeschlagen: ${pdfError.message || 'Unbekannter Fehler'}`);
          } else {
            console.log('Invoice PDF generated:', pdfResult?.invoiceNumber);
            pdfBase64 = pdfResult?.pdfBase64;
            invoiceNumber = pdfResult?.invoiceNumber || '';
          }
        } catch (pdfError: any) {
          console.error('Error generating invoice PDF:', pdfError);
          errors.push(`Rechnungs-PDF-Generierung fehlgeschlagen: ${pdfError.message}`);
        }

        // Step 3: Send invoice email (with PDF attachment if available)
        try {
          const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-invoice-email', {
            body: { invoiceId, pdfBase64 }
          });
          
          if (emailError) {
            console.error('Invoice email error:', emailError);
            errors.push(`Rechnungs-E-Mail fehlgeschlagen: ${emailError.message || 'Unbekannter Fehler'}`);
          } else {
            console.log('Invoice email sent:', emailResult?.invoiceNumber, '→', emailResult?.sentTo);
            invoiceSuccess = true;
          }
        } catch (emailError: any) {
          console.error('Error sending invoice email:', emailError);
          errors.push(`Rechnungs-E-Mail fehlgeschlagen: ${emailError.message}`);
        }

        console.log('Invoice flow completed for auction:', auctionId);
        
      } catch (invoiceError: any) {
        console.error('Error in invoice flow:', invoiceError);
        errors.push(`Rechnungserstellung komplett fehlgeschlagen: ${invoiceError.message}`);
      }

      // ─── PURCHASE CONTRACT FLOW ───────────────────────────────────
      let contractSuccess = false;
      let contractNumber = '';
      let contractPdfBase64 = '';
      try {
        console.log('Generating purchase contract for auction:', auctionId);

        const { data: contractResult, error: contractError } = await supabase.functions.invoke('generate-purchase-contract', {
          body: {
            auctionId,
            motorhomeId: auction.motorhome.id,
            buyerId: soldTo,
            sellerId: auction.motorhome.seller_id,
            salePrice: Number(highestBid!.amount),
          },
        });

        if (contractError) {
          console.error('Purchase contract error:', contractError);
          errors.push(`Kaufvertrag-Generierung fehlgeschlagen: ${contractError.message || 'Unbekannter Fehler'}`);
        } else if (contractResult?.success) {
          contractSuccess = true;
          contractNumber = contractResult.contractNumber;
          contractPdfBase64 = contractResult.pdfBase64 || '';
          const sellerContractUrl: string = contractResult.contractUrl || '';
          const buyerContractUrl: string = contractResult.buyerContractUrl || contractResult.contractUrl || '';
          console.log('Purchase contract generated:', contractNumber);

          // Send contract to both parties via email
          const { data: sellerProfile } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('id', auction.motorhome.seller_id)
            .single();

          const { data: buyerProfile } = await supabase
            .from('profiles')
            .select('email, first_name, last_name, company_name')
            .eq('id', soldTo)
            .single();

          const { data: settings } = await supabase
            .from('site_settings')
            .select('*')
            .limit(1)
            .maybeSingle();

          const settingsData = settings || { site_name: 'CaravanWert', contact_email: 'info@caravanwert.de' };

          // Send contract email to seller
          if (sellerProfile?.email && contractPdfBase64) {
            try {
              const sellerName = `${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`.trim() || 'Kunde';
              const contractEmailHtml = buildEmailLayout(settingsData, 'Ihr Kaufvertrag', `
                ${paragraph(`Hallo ${sellerName},`)}
                ${paragraph('Anbei erhalten Sie den Kaufvertrag für Ihr verkauftes Fahrzeug.')}
                ${infoBox('Vertragsdetails', `
                  ${detailRow('Vertragsnr.', contractNumber)}
                  ${detailRow('Fahrzeug', motorhomeName)}
                  ${detailRow('Kaufpreis', `€${Number(highestBid!.amount).toLocaleString()}`)}
                `, 'success')}
                ${paragraph('Bitte prüfen Sie den Vertrag sorgfältig. Bei Fragen stehen wir Ihnen gerne zur Verfügung.')}
                ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${settingsData.site_name} Team`)}
              `);

              const sellerEmailRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                  from: `${settingsData.site_name} <info@caravanwert.de>`,
                  to: [sellerProfile.email],
                  subject: `Kaufvertrag ${contractNumber} – ${motorhomeName}`,
                  html: contractEmailHtml,
                  attachments: [{
                    filename: `${contractNumber}.pdf`,
                    content: contractPdfBase64,
                  }],
                }),
              });
              if (!sellerEmailRes.ok) {
                const errText = await sellerEmailRes.text();
                throw new Error(`Resend API: ${errText}`);
              }
              const sellerResendResult = await sellerEmailRes.json();
              console.log('Contract email sent to seller:', sellerProfile.email);

              try {
                const { error: logError } = await supabase.from('admin_emails').insert({
                  sender_email: 'info@caravanwert.de',
                  sender_name: settingsData.site_name,
                  recipient_email: sellerProfile.email,
                  recipient_name: sellerName,
                  subject: `Kaufvertrag ${contractNumber} – ${motorhomeName}`,
                  body_html: contractEmailHtml,
                  body_text: '',
                  email_type: 'purchase_contract',
                  direction: 'outbound',
                  status: 'sent',
                  resend_id: sellerResendResult?.id || null,
                  is_read: false,
                });
                if (logError) console.error('Failed to log seller contract email:', logError);
              } catch (logErr) {
                console.error('Failed to log seller contract email:', logErr);
              }

              if (RESEND_API_KEY && sellerContractUrl) {
                await sendContractSentNotification({
                  resendApiKey: RESEND_API_KEY,
                  supabase,
                  settingsData,
                  recipientEmail: sellerProfile.email,
                  recipientName: sellerName,
                  contractNumber,
                  vehicleName: motorhomeName,
                  salePrice: Number(highestBid!.amount),
                  downloadUrl: sellerContractUrl,
                  party: 'seller',
                });
              }
            } catch (e: any) {
              console.error('Error sending contract to seller:', e);
              errors.push(`Kaufvertrag-E-Mail an Verkäufer fehlgeschlagen: ${e.message}`);
            }
          } else {
            const reason = !sellerProfile?.email ? 'Verkäufer-E-Mail fehlt' : 'PDF-Base64 leer';
            console.error(`Contract email to seller SKIPPED: ${reason}`);
            errors.push(`Kaufvertrag-E-Mail an Verkäufer übersprungen: ${reason}`);
          }

          // Send contract email to buyer (dealer)
          if (buyerProfile?.email && contractPdfBase64) {
            try {
              const buyerName = buyerProfile.company_name || `${buyerProfile.first_name || ''} ${buyerProfile.last_name || ''}`.trim() || 'Händler';
              const contractEmailHtml = buildEmailLayout(settingsData, 'Kaufvertrag', `
                ${paragraph(`Sehr geehrte/r ${buyerName},`)}
                ${paragraph('Anbei erhalten Sie den Kaufvertrag für das ersteigerte Fahrzeug.')}
                ${infoBox('Vertragsdetails', `
                  ${detailRow('Vertragsnr.', contractNumber)}
                  ${detailRow('Fahrzeug', motorhomeName)}
                  ${detailRow('Kaufpreis', `€${Number(highestBid!.amount).toLocaleString()}`)}
                `, 'success')}
                ${paragraph('Bitte prüfen Sie den Vertrag sorgfältig. Die Rechnung über die Vermittlungsprovision erhalten Sie in einer separaten E-Mail.')}
                ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${settingsData.site_name} Team`)}
              `);

              const buyerEmailRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                  from: `${settingsData.site_name} <info@caravanwert.de>`,
                  to: [buyerProfile.email],
                  subject: `Kaufvertrag ${contractNumber} – ${motorhomeName}`,
                  html: contractEmailHtml,
                  attachments: [{
                    filename: `${contractNumber}.pdf`,
                    content: contractPdfBase64,
                  }],
                }),
              });
              if (!buyerEmailRes.ok) {
                const errText = await buyerEmailRes.text();
                throw new Error(`Resend API: ${errText}`);
              }
              const buyerResendResult = await buyerEmailRes.json();
              console.log('Contract email sent to buyer:', buyerProfile.email);

              try {
                const { error: logError } = await supabase.from('admin_emails').insert({
                  sender_email: 'info@caravanwert.de',
                  sender_name: settingsData.site_name,
                  recipient_email: buyerProfile.email,
                  recipient_name: buyerName,
                  subject: `Kaufvertrag ${contractNumber} – ${motorhomeName}`,
                  body_html: contractEmailHtml,
                  body_text: '',
                  email_type: 'purchase_contract',
                  direction: 'outbound',
                  status: 'sent',
                  resend_id: buyerResendResult?.id || null,
                  is_read: false,
                });
                if (logError) console.error('Failed to log buyer contract email:', logError);
              } catch (logErr) {
                console.error('Failed to log buyer contract email:', logErr);
              }

              if (RESEND_API_KEY && buyerContractUrl) {
                await sendContractSentNotification({
                  resendApiKey: RESEND_API_KEY,
                  supabase,
                  settingsData,
                  recipientEmail: buyerProfile.email,
                  recipientName: buyerName,
                  contractNumber,
                  vehicleName: motorhomeName,
                  salePrice: Number(highestBid!.amount),
                  downloadUrl: buyerContractUrl,
                  party: 'buyer',
                });
              }
            } catch (e: any) {
              console.error('Error sending contract to buyer:', e);
              errors.push(`Kaufvertrag-E-Mail an Käufer fehlgeschlagen: ${e.message}`);
            }
          } else {
            const reason = !buyerProfile?.email ? 'Käufer-E-Mail fehlt' : 'PDF-Base64 leer';
            console.error(`Contract email to buyer SKIPPED: ${reason}`);
            errors.push(`Kaufvertrag-E-Mail an Käufer übersprungen: ${reason}`);
          }
        } else {
          errors.push(`Kaufvertrag-Generierung: Unerwartete Antwort`);
        }
      } catch (contractError: any) {
        console.error('Error in purchase contract flow:', contractError);
        errors.push(`Kaufvertrag komplett fehlgeschlagen: ${contractError.message}`);
      }

      // ─── GOOGLE ADS SALE CONVERSION (only after invoice confirmed) ──
      // The sale is only truly complete when the invoice has been created.
      // Only then do we report revenue to Google Ads so Smart Bidding
      // learns from real, confirmed sales — not from tentative status changes.
      if (invoiceSuccess) {
        const saleResult = await uploadSaleConversionToGoogleAds({
          supabase,
          source: 'close-auction',
          auctionId,
          motorhomeId: auction.motorhome.id,
          sellerId: auction.motorhome.seller_id,
          dealerId: soldTo!,
          saleAmount: Number(highestBid!.amount),
          clickIds: {
            gclid: auction.motorhome?.gclid,
            gbraid: auction.motorhome?.gbraid,
            wbraid: auction.motorhome?.wbraid,
            msclkid: auction.motorhome?.msclkid,
          },
        });
        if (saleResult.attempted && !saleResult.success) {
          errors.push(`Google Ads Sale-Conversion: ${saleResult.error || 'Unbekannter Fehler'}`);
        }
      } else {
        console.log('[close-auction] Invoice not created successfully, skipping sale conversion (no confirmed sale)');
      }

      // ─── ADMIN NOTIFICATION (SOLD) ────────────────────────────────
      const { data: winnerProfile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name, company_name')
        .eq('id', soldTo)
        .single();

      const winnerName = winnerProfile?.company_name || `${winnerProfile?.first_name || ''} ${winnerProfile?.last_name || ''}`.trim() || 'Unbekannt';

      let adminContent = `
        ${paragraph('<strong>Eine Auktion wurde erfolgreich abgeschlossen.</strong>')}
        ${infoBox('Auktionsergebnis', `
          ${detailRow('Status', '✅ VERKAUFT')}
          ${detailRow('Fahrzeug', motorhomeName)}
          ${detailRow('Zuschlagspreis', `€${Number(highestBid!.amount).toLocaleString()}`)}
          ${detailRow('Mindestgebot', effectiveReservePrice ? `€${Number(effectiveReservePrice).toLocaleString()}` : 'Keines')}
          ${detailRow('Anzahl Gebote', String(auction.bids?.length || 0))}
        `, 'success')}
        ${infoBox('Gewinner (Käufer)', `
          ${detailRow('Händler', winnerName)}
          ${detailRow('E-Mail', winnerProfile?.email || '–')}
        `, 'info')}
        ${infoBox('Dokumente', `
          ${detailRow('Rechnung', invoiceSuccess ? `✅ Erstellt${invoiceNumber ? ` (${invoiceNumber})` : ''}` : '❌ Fehlgeschlagen')}
          ${detailRow('Kaufvertrag', contractSuccess ? `✅ Erstellt${contractNumber ? ` (${contractNumber})` : ''}` : '❌ Fehlgeschlagen')}
        `, invoiceSuccess && contractSuccess ? 'success' : 'warning')}
      `;

      if (errors.length > 0) {
        adminContent += warningBox(`<strong>⚠️ ${errors.length} Fehler aufgetreten:</strong><br>${errors.map(e => `• ${e}`).join('<br>')}`);
      }

      adminContent += button('Im Admin-Dashboard ansehen', `https://caravanwert.de/admin/auctions`);

      await sendAdminEmail(supabase, `Auktion verkauft: ${motorhomeName} für €${Number(highestBid!.amount).toLocaleString()}`, adminContent);
    }

    // ─── Notify losing bidders ───────────────────────────────────
    if (highestBid && auction.bids && auction.bids.length > 0 && newStatus === 'sold') {
      const losingBidderIds = [...new Set(
        auction.bids
          .map((b: any) => b.bidder_id)
          .filter((id: string) => id !== soldTo)
      )];

      for (const loserId of losingBidderIds) {
        const loserHighestBid = Math.max(
          ...auction.bids
            .filter((b: any) => b.bidder_id === loserId)
            .map((b: any) => Number(b.amount))
        );

        const { data: loserProfile } = await supabase
          .from('profiles')
          .select('email, first_name')
          .eq('id', loserId)
          .single();

        if (loserProfile?.email) {
          supabase.functions.invoke('send-auction-notification', {
            body: {
              email: loserProfile.email,
              name: loserProfile.first_name || loserProfile.email.split('@')[0],
              type: 'lost',
              motorhomeModel: motorhomeName,
              auctionUrl,
              yourBid: `€${loserHighestBid.toLocaleString()}`,
              currentBid: `€${Number(highestBid.amount).toLocaleString()}`,
            },
          }).catch((e: any) => console.error('Error sending loser notification:', e));
        }
      }
    }

    // ─── Notify seller about auction end (FIXED: correct templates) ──
    if (auction.motorhome?.seller_id && (newStatus === 'sold' || newStatus === 'ended')) {
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('email, first_name')
        .eq('id', auction.motorhome.seller_id)
        .single();

      if (sellerProfile?.email) {
        // Use correct seller-specific templates instead of dealer templates
        const sellerType = newStatus === 'sold' ? 'seller_sold' : 'seller_not_sold';
        supabase.functions.invoke('send-auction-notification', {
          body: {
            email: sellerProfile.email,
            name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
            type: sellerType,
            motorhomeModel: motorhomeName,
            auctionUrl: `https://caravanwert.de/dashboard/listings/${auction.motorhome.id}`,
            currentBid: highestBid ? `€${Number(highestBid.amount).toLocaleString()}` : undefined,
          },
        }).catch((e: any) => console.error('Error sending seller end notification:', e));
      }
    }

    // ─── ADMIN NOTIFICATION (NOT SOLD - no bids) ──────────────────────────────
    if (newStatus === 'ended') {
      let adminContent = `
        ${paragraph('<strong>Eine Auktion ist ohne Verkauf beendet worden.</strong>')}
        ${infoBox('Auktionsergebnis', `
          ${detailRow('Status', '⚠️ NICHT VERKAUFT')}
          ${detailRow('Fahrzeug', motorhomeName)}
          ${detailRow('Mindestgebot', effectiveReservePrice ? `€${Number(effectiveReservePrice).toLocaleString()}` : 'Keines')}
          ${detailRow('Höchstes Gebot', highestBid ? `€${Number(highestBid.amount).toLocaleString()}` : 'Keine Gebote')}
          ${detailRow('Anzahl Gebote', String(auction.bids?.length || 0))}
        `, 'warning')}
        ${paragraph('Es wurden keine Gebote auf diese Auktion abgegeben.')}
        ${paragraph('<strong>Empfohlene nächste Schritte:</strong><br>• Kontakt mit dem Verkäufer aufnehmen<br>• Mindestgebot anpassen und erneut einstellen<br>• Alternativ Direktverkauf anbieten')}
      `;
      adminContent += button('Im Admin-Dashboard ansehen', `https://caravanwert.de/admin/auctions`);

      await sendAdminEmail(supabase, `Auktion beendet ohne Verkauf: ${motorhomeName}`, adminContent);
    }

    if (errors.length > 0) {
      await logEdgeError(supabase, {
        component: 'close-auction',
        message: `Auktion ${auctionId} geschlossen mit ${errors.length} Folge-Fehlern (Status: ${newStatus})`,
        severity: errors.length >= 3 ? 'high' : 'medium',
        category: 'auction',
        metadata: {
          auctionId,
          status: newStatus,
          soldTo,
          amount: highestBid?.amount || null,
          errors,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        soldTo,
        amount: highestBid?.amount || null,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in close-auction:', error);
    try {
      const supabaseLog = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      await logEdgeError(supabaseLog, {
        component: 'close-auction',
        message: `Unerwarteter Fehler beim Schließen einer Auktion: ${error?.message || 'unbekannt'}`,
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
