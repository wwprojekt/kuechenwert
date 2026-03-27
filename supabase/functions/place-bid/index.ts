import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { checkRateLimit, createRateLimitErrorResponse, createRateLimitHeaders, RATE_LIMITS } from '../_shared/rate-limiter.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

/**
 * Edge Function: place-bid
 *
 * Places a bid on an active auction. Uses the place_bid_atomic PostgreSQL
 * RPC function to prevent race conditions when multiple bids arrive
 * simultaneously. The entire read-validate-insert-update cycle runs
 * inside a single database transaction with pg_advisory_xact_lock.
 */

/**
 * Zod schema for bid request validation
 * Provides type-safe input validation with clear error messages
 */
const BidRequestSchema = z.object({
  auctionId: z.string().uuid('Ungültige Auktions-ID'),
  amount: z.number()
    .positive('Gebotsbetrag muss positiv sein')
    .max(100_000_000, 'Gebotsbetrag zu hoch'),
  isAutobid: z.boolean().optional().default(false),
  maxAutobidAmount: z.number()
    .positive('Max. Autobid-Betrag muss positiv sein')
    .max(100_000_000, 'Max. Autobid-Betrag zu hoch')
    .optional(),
}).refine(
  (data) => !data.isAutobid || (data.maxAutobidAmount && data.maxAutobidAmount > data.amount),
  { message: 'Max. Autobid-Betrag muss höher als aktuelles Gebot sein', path: ['maxAutobidAmount'] }
);

type PlaceBidRequest = z.infer<typeof BidRequestSchema>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  // Check rate limit first
  const rateLimitResult = await checkRateLimit(req, RATE_LIMITS.BIDDING);
  if (!rateLimitResult.allowed) {
    return createRateLimitErrorResponse(rateLimitResult, getCorsHeaders(req));
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Use service role client to validate user token and for all DB operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user by passing the JWT token directly
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError?.message);
      throw new Error('Unauthorized');
    }

    // Parse and validate request body with Zod
    const rawBody = await req.json();
    const validationResult = BidRequestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map(e => e.message)
        .join(', ');
      throw new Error(errorMessage);
    }
    
    const { auctionId, amount, isAutobid, maxAutobidAmount }: PlaceBidRequest = validationResult.data;

    console.log('Place bid request:', { auctionId, amount, userId: user.id, isAutobid });

    // ─── ATOMIC BID PLACEMENT via PostgreSQL RPC ───────────────────
    // This replaces the previous non-atomic read-validate-insert-update
    // sequence with a single database transaction that uses
    // pg_advisory_xact_lock to prevent race conditions.
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      'place_bid_atomic',
      {
        p_auction_id: auctionId,
        p_bidder_id: user.id,
        p_bid_amount: amount,
        p_is_autobid: isAutobid || false,
        p_max_autobid_amount: isAutobid ? maxAutobidAmount : null,
        p_min_increment: 50,
      },
    );

    if (rpcError) {
      console.error('RPC place_bid_atomic error:', rpcError);
      throw new Error('Fehler beim Platzieren des Gebots: ' + rpcError.message);
    }

    const outcome = result as {
      success: boolean;
      error?: string;
      message?: string;
      bid_id?: string;
      amount?: number;
      auction_extended?: boolean;
      new_end_time?: string;
      current_bid?: number;
      motorhome_seller_id?: string;
      motorhome_id?: string;
      minimum_bid?: number;
    };

    // If the RPC returned a validation error, throw it
    if (!outcome.success) {
      throw new Error(outcome.error || 'Gebot konnte nicht platziert werden');
    }

    console.log('Bid placed successfully via RPC:', outcome);

    // ─── Post-bid actions (fire and forget) ────────────────────────

    // Trigger autobid check for other users
    supabaseAdmin.functions.invoke('handle-autobid', {
      body: {
        auctionId,
        newBidAmount: amount,
        newBidderId: user.id,
      },
    }).catch((error) => {
      console.error('Error triggering autobid:', error);
    });

    // ─── Notifications (fire and forget) ───────────────────────────

    // Fetch motorhome details for notification text
    let motorhomeName = '';
    if (outcome.motorhome_id) {
      const { data: motorhomeData } = await supabaseAdmin
        .from('motorhomes')
        .select('manufacturer, model')
        .eq('id', outcome.motorhome_id)
        .single();

      if (motorhomeData) {
        motorhomeName = `${motorhomeData.manufacturer || ''} ${motorhomeData.model || ''}`.trim();
      }
    }

    // 0a. In-App Notification: Bid confirmed for current bidder
    supabaseAdmin
      .from('dealer_notifications')
      .insert({
        user_id: user.id,
        type: 'bid_confirmed',
        title: 'Gebot platziert',
        message: `Ihr Gebot von \u20ac${amount.toLocaleString('de-DE')} auf ${motorhomeName || 'eine Auktion'} wurde erfolgreich platziert.`,
        link: `/auktion/${auctionId}`,
        auction_id: auctionId,
      })
      .then(({ error }) => { if (error) console.error('Error inserting bid_confirmed notification:', error); })
      .catch((e: unknown) => console.error('Error inserting bid_confirmed notification:', e));

    // 1. Notify the current bidder that their bid was placed
    supabaseAdmin.functions.invoke('send-bid-notification', {
      body: {
        bidderId: user.id,
        auctionId,
        bidAmount: amount,
        isOutbid: false,
      },
    }).catch((e) => console.error('Error sending bid confirmation:', e));

    // 2. Notify the previous highest bidder that they were outbid
    const { data: previousBids } = await supabaseAdmin
      .from('bids')
      .select('bidder_id')
      .eq('auction_id', auctionId)
      .neq('bidder_id', user.id)
      .order('amount', { ascending: false })
      .limit(1);

    if (previousBids && previousBids.length > 0) {
      // 2a. In-App Notification: Outbid notification for previous highest bidder
      supabaseAdmin
        .from('dealer_notifications')
        .insert({
          user_id: previousBids[0].bidder_id,
          type: 'outbid',
          title: 'Sie wurden \u00fcberboten!',
          message: `Ihr Gebot auf ${motorhomeName || 'eine Auktion'} wurde \u00fcberboten. Neuer Preis: \u20ac${amount.toLocaleString('de-DE')}`,
          link: `/auktion/${auctionId}`,
          auction_id: auctionId,
        })
        .then(({ error }) => { if (error) console.error('Error inserting outbid notification:', error); })
        .catch((e: unknown) => console.error('Error inserting outbid notification:', e));

      supabaseAdmin.functions.invoke('send-bid-notification', {
        body: {
          bidderId: previousBids[0].bidder_id,
          auctionId,
          bidAmount: amount,
          isOutbid: true,
        },
      }).catch((e) => console.error('Error sending outbid notification:', e));

      // Push notification to outbid user
      supabaseAdmin.functions.invoke('send-push-notification', {
        body: {
          userId: previousBids[0].bidder_id,
          title: 'Sie wurden überboten!',
          body: `Ihr Gebot auf ${motorhomeName || 'eine Auktion'} wurde überboten. Neuer Preis: €${amount.toLocaleString('de-DE')}`,
          url: `https://caravanwert.de/auktion/${auctionId}`,
          tag: 'outbid',
        },
      }).catch((e) => console.error('Error sending outbid push:', e));
    }

    // 3. Notify the seller about the new bid
    if (outcome.motorhome_seller_id) {
      const { data: sellerProfile } = await supabaseAdmin
        .from('profiles')
        .select('email, first_name')
        .eq('id', outcome.motorhome_seller_id)
        .single();

      if (sellerProfile?.email) {
        supabaseAdmin.functions.invoke('send-auction-notification', {
          body: {
            email: sellerProfile.email,
            name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
            type: 'new_bid',
            motorhomeModel: motorhomeName,
            auctionUrl: `https://caravanwert.de/auktion/${auctionId}`,
            currentBid: `€${amount.toLocaleString()}`,
          },
        }).catch((e) => console.error('Error sending seller notification:', e));
      }
    }

    // 4. Notify users who have this motorhome as favorite
    if (outcome.motorhome_id) {
      supabaseAdmin.functions.invoke('send-favorite-notification', {
        body: {
          motorhome_id: outcome.motorhome_id,
          auction_id: auctionId,
          event_type: 'price_change',
          new_price: amount,
          auction_title: motorhomeName,
        },
      }).catch((e) => console.error('Error sending favorite notifications:', e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Bid placed successfully',
        bid: {
          amount,
          isAutobid: isAutobid || false,
          maxAutobidAmount: isAutobid ? maxAutobidAmount : null,
        },
        auctionExtended: outcome.auction_extended || false,
        newEndTime: outcome.new_end_time,
      }),
      { 
        headers: { 
          ...getCorsHeaders(req), 
          ...createRateLimitHeaders(rateLimitResult),
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error: unknown) {
    console.error('Error in place-bid:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
