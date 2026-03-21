import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

/**
 * Edge Function: handle-autobid
 *
 * Processes autobid counter-bids when a new bid is placed.
 * Uses a PostgreSQL advisory lock (via RPC) to prevent race conditions
 * when multiple bids arrive simultaneously. The entire read-check-write
 * cycle runs inside a single database transaction.
 *
 * Called by place-bid as "fire and forget" after a successful bid.
 */

const AutobidRequestSchema = z.object({
  auctionId: z.string().uuid('Ungültige Auktions-ID'),
  newBidAmount: z.number()
    .positive('Gebotsbetrag muss positiv sein')
    .max(100_000_000, 'Gebotsbetrag zu hoch'),
  newBidderId: z.string().uuid('Ungültige Bieter-ID'),
});

type AutobidRequest = z.infer<typeof AutobidRequestSchema>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  try {
    // Parse and validate request body with Zod
    const rawBody = await req.json();
    const validationResult = AutobidRequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map(e => e.message)
        .join(', ');
      throw new Error(errorMessage);
    }

    const { auctionId, newBidAmount, newBidderId }: AutobidRequest = validationResult.data;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Processing autobid for auction:', auctionId, 'trigger bid:', newBidAmount);

    // Execute the entire autobid logic inside a PostgreSQL function
    // that uses pg_advisory_xact_lock to serialize concurrent calls.
    // This prevents the race condition where two simultaneous bids
    // both trigger autobids that read the same state.
    const { data: result, error: rpcError } = await supabase.rpc(
      'handle_autobid_atomic',
      {
        p_auction_id: auctionId,
        p_new_bid_amount: newBidAmount,
        p_new_bidder_id: newBidderId,
        p_min_increment: 50,
      },
    );

    if (rpcError) {
      console.error('RPC handle_autobid_atomic error:', rpcError);
      throw rpcError;
    }

    // result is a JSON object returned by the RPC function
    const outcome = result as {
      success: boolean;
      message: string;
      counter_bid_amount?: number;
      bidder_id?: string;
      auction_extended?: boolean;
    };

    console.log('Autobid result:', outcome);

    return new Response(
      JSON.stringify(outcome),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    console.error('Error in handle-autobid:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      },
    );
  }
});
