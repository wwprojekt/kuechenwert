import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Zod schema for autobid request validation
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
    return new Response(null, { headers: corsHeaders });
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Checking autobid for auction:', auctionId, 'new bid:', newBidAmount);

    // Get all active autobids for this auction, excluding the bidder who just placed a bid
    const { data: autobids, error: autobidsError } = await supabase
      .from('bids')
      .select('*')
      .eq('auction_id', auctionId)
      .eq('is_autobid', true)
      .neq('bidder_id', newBidderId)
      .order('max_autobid_amount', { ascending: false });

    if (autobidsError) {
      console.error('Error fetching autobids:', autobidsError);
      throw autobidsError;
    }

    if (!autobids || autobids.length === 0) {
      console.log('No active autobids found');
      return new Response(
        JSON.stringify({ success: true, message: 'No autobids to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auction details
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('*, motorhome:motorhomes(*)')
      .eq('id', auctionId)
      .single();

    if (auctionError) throw auctionError;

    // Find users who were outbid and have autobid enabled with max amount higher than current bid
    const outbidUsers = autobids.filter(
      (autobid) => Number(autobid.max_autobid_amount) > Number(newBidAmount)
    );

    if (outbidUsers.length === 0) {
      console.log('No users with sufficient autobid amounts');
      return new Response(
        JSON.stringify({ success: true, message: 'No autobids high enough to counter' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Take the user with highest max_autobid_amount
    const topAutobidder = outbidUsers[0];
    
    // Calculate new bid amount (current bid + minimum increment)
    const minIncrement = 50; // €50 minimum increment
    const counterBidAmount = Number(newBidAmount) + minIncrement;

    // Check if counter bid is within their max
    if (counterBidAmount > Number(topAutobidder.max_autobid_amount)) {
      console.log('Counter bid would exceed max autobid amount');
      return new Response(
        JSON.stringify({ success: true, message: 'Max autobid amount reached' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Placing autobid counter-bid:', counterBidAmount, 'for user:', topAutobidder.bidder_id);

    // Place the counter bid
    const { error: bidError } = await supabase.from('bids').insert({
      auction_id: auctionId,
      bidder_id: topAutobidder.bidder_id,
      amount: counterBidAmount,
      is_autobid: true,
      max_autobid_amount: topAutobidder.max_autobid_amount,
    });

    if (bidError) {
      console.error('Error placing autobid:', bidError);
      throw bidError;
    }

    // Update auction current bid
    const { error: updateError } = await supabase
      .from('auctions')
      .update({ current_bid: counterBidAmount })
      .eq('id', auctionId);

    if (updateError) throw updateError;

    // Check soft-close extension
    const now = new Date().getTime();
    const endTime = new Date(auction.end_time).getTime();
    const timeLeft = endTime - now;

    if (timeLeft < 5 * 60 * 1000 && timeLeft > 0) {
      const extensionMinutes = auction.soft_close_extension_minutes || 5;
      const newEndTime = new Date(endTime + extensionMinutes * 60 * 1000).toISOString();
      
      await supabase
        .from('auctions')
        .update({ end_time: newEndTime })
        .eq('id', auctionId);

      console.log('Auction extended by', extensionMinutes, 'minutes');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Autobid placed successfully',
        counterBidAmount,
        bidderId: topAutobidder.bidder_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in handle-autobid:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
