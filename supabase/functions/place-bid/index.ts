import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { checkRateLimit, createRateLimitErrorResponse, createRateLimitHeaders, RATE_LIMITS } from '../_shared/rate-limiter.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

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

    // Use service role client to validate user token
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

    const { data: auction, error: auctionError } = await supabaseAdmin
      .from('auctions')
      .select('*, motorhome:motorhomes(*)')
      .eq('id', auctionId)
      .single();

    if (auctionError || !auction) {
      throw new Error('Auction not found');
    }

    // Validate auction status
    if (auction.status !== 'active') {
      throw new Error('Auction is not active');
    }

    // Check if auction has ended
    const now = new Date().getTime();
    const endTime = new Date(auction.end_time).getTime();
    if (now > endTime) {
      throw new Error('Auction has ended');
    }

    // Check if motorhome is already sold
    if (auction.motorhome?.status === 'sold') {
      throw new Error('Motorhome is already sold');
    }

    // Validate bid amount (must be higher than current bid + minimum increment)
    const currentBid = auction.current_bid || auction.starting_bid;
    const minIncrement = 50; // €50 minimum increment
    const minimumBid = Number(currentBid) + minIncrement;

    if (amount < minimumBid) {
      throw new Error(`Bid must be at least €${minimumBid.toLocaleString()}`);
    }

    // Check if user is trying to bid on their own auction
    if (auction.motorhome?.seller_id === user.id) {
      throw new Error('You cannot bid on your own auction');
    }

    // Place the bid
    const { error: bidError } = await supabaseAdmin.from('bids').insert({
      auction_id: auctionId,
      bidder_id: user.id,
      amount: amount,
      is_autobid: isAutobid || false,
      max_autobid_amount: isAutobid ? maxAutobidAmount : null,
    });

    if (bidError) {
      console.error('Error placing bid:', bidError);
      throw new Error('Failed to place bid: ' + bidError.message);
    }

    // Update auction current bid
    const { error: updateError } = await supabaseAdmin
      .from('auctions')
      .update({ current_bid: amount })
      .eq('id', auctionId);

    if (updateError) {
      console.error('Error updating auction:', updateError);
      throw new Error('Failed to update auction');
    }

    // Check soft-close extension
    const timeLeft = endTime - now;
    const softCloseWindow = 5 * 60 * 1000; // 5 minutes
    let auctionExtended = false;
    let newEndTime = auction.end_time;

    if (timeLeft < softCloseWindow && timeLeft > 0) {
      const extensionMinutes = auction.soft_close_extension_minutes || 5;
      newEndTime = new Date(endTime + extensionMinutes * 60 * 1000).toISOString();

      const { error: extensionError } = await supabaseAdmin
        .from('auctions')
        .update({ end_time: newEndTime })
        .eq('id', auctionId);

      if (!extensionError) {
        auctionExtended = true;
        console.log('Auction extended by', extensionMinutes, 'minutes');
      }
    }

    // Trigger autobid check for other users (fire and forget)
    supabaseAdmin.functions.invoke('handle-autobid', {
      body: {
        auctionId,
        newBidAmount: amount,
        newBidderId: user.id,
      },
    }).catch((error) => {
      console.error('Error triggering autobid:', error);
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Bid placed successfully',
        bid: {
          amount,
          isAutobid: isAutobid || false,
          maxAutobidAmount: isAutobid ? maxAutobidAmount : null,
        },
        auctionExtended,
        newEndTime: auctionExtended ? newEndTime : auction.end_time,
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
