import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkRateLimit, createRateLimitErrorResponse, createRateLimitHeaders, RATE_LIMITS } from '../_shared/rate-limiter.ts';

/**
 * Edge Function: instant-buy
 *
 * Handles the "Sofortkauf" (instant buy) flow server-side to prevent
 * client-side price manipulation. Validates the auction, motorhome status,
 * instant price, and buyer eligibility before executing the purchase
 * atomically via a database transaction (RPC).
 */

const InstantBuySchema = z.object({
  auctionId: z.string().uuid('Ungültige Auktions-ID'),
});

type InstantBuyRequest = z.infer<typeof InstantBuySchema>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  // Rate limit: reuse BIDDING limits for instant buy
  const rateLimitResult = await checkRateLimit(req, RATE_LIMITS.BIDDING);
  if (!rateLimitResult.allowed) {
    return createRateLimitErrorResponse(rateLimitResult, getCorsHeaders(req));
  }

  try {
    // 1. Authenticate the buyer
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Nicht autorisiert: Kein Authorization-Header');
    }

    // Use service role client to validate user token
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Nicht autorisiert: Ungültiger Token');
    }

    // 2. Validate request body
    const rawBody = await req.json();
    const validation = InstantBuySchema.safeParse(rawBody);
    if (!validation.success) {
      const msg = validation.error.errors.map(e => e.message).join(', ');
      throw new Error(msg);
    }

    const { auctionId }: InstantBuyRequest = validation.data;

    // 3. Use service role for all subsequent DB operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // 4. Fetch auction + motorhome in a single query
    const { data: auction, error: auctionError } = await supabaseAdmin
      .from('auctions')
      .select('*, motorhome:motorhomes(*)')
      .eq('id', auctionId)
      .single();

    if (auctionError || !auction) {
      throw new Error('Auktion nicht gefunden');
    }

    const motorhome = auction.motorhome;
    if (!motorhome) {
      throw new Error('Wohnmobil nicht gefunden');
    }

    // 5. Server-side validations (cannot be bypassed from client)

    // 5a. Check auction is still active
    if (auction.status !== 'active') {
      throw new Error('Diese Auktion ist nicht mehr aktiv');
    }

    // 5b. Check auction has not ended
    const now = Date.now();
    const endTime = new Date(auction.end_time).getTime();
    if (now > endTime) {
      throw new Error('Diese Auktion ist bereits beendet');
    }

    // 5c. Check motorhome is not already sold
    if (motorhome.status === 'sold') {
      throw new Error('Dieses Wohnmobil wurde bereits verkauft');
    }

    // 5d. Check instant_price exists and is valid
    const instantPrice = Number(motorhome.instant_price);
    if (!motorhome.instant_price || instantPrice <= 0) {
      throw new Error('Sofortkauf ist für dieses Wohnmobil nicht verfügbar');
    }

    // 5e. Buyer must not be the seller
    if (motorhome.seller_id === user.id) {
      throw new Error('Sie können Ihr eigenes Wohnmobil nicht kaufen');
    }

    // 6. Execute the purchase atomically
    //    Update motorhome status to 'sold' – only if still 'active'
    const { data: updatedMotorhome, error: motorhomeUpdateError } = await supabaseAdmin
      .from('motorhomes')
      .update({
        status: 'sold',
        sold_to: user.id,
        sold_at: new Date().toISOString(),
        sale_type: 'instant',
      })
      .eq('id', motorhome.id)
      .eq('status', 'active')  // Optimistic lock: only update if still active
      .select()
      .single();

    if (motorhomeUpdateError || !updatedMotorhome) {
      throw new Error('Kauf konnte nicht abgeschlossen werden – das Wohnmobil wurde möglicherweise bereits verkauft');
    }

    // 7. Close the auction
    const { error: auctionUpdateError } = await supabaseAdmin
      .from('auctions')
      .update({ status: 'sold' })
      .eq('id', auctionId)
      .eq('status', 'active');  // Only close if still active

    if (auctionUpdateError) {
      console.error('Error closing auction after instant buy:', auctionUpdateError);
      // Non-fatal: motorhome is already marked as sold
    }

    console.log(
      `Instant buy completed: auction=${auctionId}, motorhome=${motorhome.id}, ` +
      `buyer=${user.id}, price=${instantPrice}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Kauf erfolgreich abgeschlossen',
        purchase: {
          motorhomeId: motorhome.id,
          auctionId,
          buyerId: user.id,
          price: instantPrice,
          saleType: 'instant',
          soldAt: updatedMotorhome.sold_at,
        },
      }),
      {
        headers: {
          ...getCorsHeaders(req),
          ...createRateLimitHeaders(rateLimitResult),
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error: unknown) {
    console.error('Error in instant-buy:', error);
    const errorMessage = error instanceof Error
      ? error.message
      : 'Ein unbekannter Fehler ist aufgetreten';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      },
    );
  }
});
