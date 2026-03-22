import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  // Auth check: must be service_role (cron/internal) or authenticated admin
  const authHeader = req.headers.get('authorization') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const isServiceRole = authHeader.includes(serviceRoleKey);

  if (!isServiceRole) {
    // Use service role client to validate user token
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }
    const supabaseCheck = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: roles } = await supabaseCheck.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const { auctionId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Closing auction:', auctionId);

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
    if (auction.status === 'ended' || auction.status === 'sold' || auction.status === 'cancelled') {
      return new Response(
        JSON.stringify({ message: 'Auction already closed' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Check if auction has ended
    const now = new Date().getTime();
    const endTime = new Date(auction.end_time).getTime();

    if (now < endTime) {
      throw new Error('Auction has not ended yet');
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
    let soldTo = null;

    if (highestBid) {
      const reserveMet = auction.reserve_price
        ? Number(highestBid.amount) >= Number(auction.reserve_price)
        : true;

      if (reserveMet) {
        // Auction sold - reserve price met
        newStatus = 'sold';
        motorhomeStatus = 'sold';
        soldTo = highestBid.bidder_id;
        console.log('Auction sold to:', soldTo, 'for:', highestBid.amount);
      } else {
        // Reserve not met
        console.log('Reserve price not met. Highest bid:', highestBid.amount, 'Reserve:', auction.reserve_price);
      }
    } else {
      // No bids
      console.log('No bids placed on auction');
    }

    // Update auction status
    const { error: updateAuctionError } = await supabase
      .from('auctions')
      .update({ status: newStatus })
      .eq('id', auctionId);

    if (updateAuctionError) {
      console.error('Error updating auction status:', updateAuctionError);
      throw updateAuctionError;
    }

    // Update motorhome status if sold
    if (motorhomeStatus === 'sold' && soldTo) {
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
      }

      // Send winner notification
      try {
        await supabase.functions.invoke('notify-auction-winner', {
          body: {
            auctionId,
            winnerId: soldTo,
            amount: highestBid.amount,
          },
        });
      } catch (notifyError) {
        console.error('Error sending winner notification:', notifyError);
      }

      // Create invoice for the winning dealer
      try {
        const invoiceId = await supabase.rpc('create_auction_invoice', {
          auction_id_param: auctionId,
          dealer_id_param: soldTo
        });

        if (invoiceId) {
          // Send invoice email
          await supabase.functions.invoke('send-invoice-email', {
            body: { invoiceId: invoiceId }
          });
          
          console.log('Invoice created and sent for auction:', auctionId);
        }
      } catch (invoiceError) {
        console.error('Error creating/sending invoice:', invoiceError);
        // Don't fail the auction closure if invoice creation fails
      }
    }

    // ─── Notify losing bidders ───────────────────────────────────
    if (highestBid && auction.bids && auction.bids.length > 0) {
      const motorhomeName = `${auction.motorhome?.manufacturer || ''} ${auction.motorhome?.model || ''}`.trim();
      const auctionUrl = `https://caravanwert.de/auktion/${auctionId}`;

      // Get unique bidders who did NOT win
      const losingBidderIds = [...new Set(
        auction.bids
          .map((b: any) => b.bidder_id)
          .filter((id: string) => id !== soldTo)
      )];

      for (const loserId of losingBidderIds) {
        // Get the loser's highest bid
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
          }).catch((e) => console.error('Error sending loser notification:', e));
        }
      }
    }

    // ─── Notify seller about auction end ──────────────────────────
    if (auction.motorhome?.seller_id) {
      const motorhomeName = `${auction.motorhome?.manufacturer || ''} ${auction.motorhome?.model || ''}`.trim();
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('email, first_name')
        .eq('id', auction.motorhome.seller_id)
        .single();

      if (sellerProfile?.email) {
        const sellerType = newStatus === 'sold' ? 'won' : 'lost';
        supabase.functions.invoke('send-auction-notification', {
          body: {
            email: sellerProfile.email,
            name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
            type: sellerType,
            motorhomeModel: motorhomeName,
            auctionUrl: `https://caravanwert.de/auktion/${auctionId}`,
            currentBid: highestBid ? `€${Number(highestBid.amount).toLocaleString()}` : 'Keine Gebote',
          },
        }).catch((e) => console.error('Error sending seller end notification:', e));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        soldTo,
        amount: highestBid?.amount || null,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in close-auction:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
