import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

/**
 * Edge Function: close-auction
 * 
 * Closes an auction after it has ended. Determines the outcome:
 * - Sold: Reserve price met → update motorhome, create invoice, send emails
 * - Ended: No bids or reserve not met → notify seller
 * 
 * Invoice flow (when sold):
 * 1. create_auction_invoice RPC → creates invoice + line items
 * 2. generate-invoice-pdf → generates PDF, uploads to storage, updates pdf_url
 * 3. send-invoice-email → sends email with PDF attachment to dealer
 * 
 * Auth: service_role (cron/internal) or admin
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  // Auth check: must be service_role (cron/internal) or authenticated admin
  const authHeader = req.headers.get('authorization') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const isServiceRole = authHeader.includes(serviceRoleKey);

  if (!isServiceRole) {
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
    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = roles?.some((r: any) => r.role === 'admin');
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
    let soldTo: string | null = null;

    if (highestBid) {
      const reserveMet = auction.reserve_price
        ? Number(highestBid.amount) >= Number(auction.reserve_price)
        : true;

      if (reserveMet) {
        newStatus = 'sold';
        motorhomeStatus = 'sold';
        soldTo = highestBid.bidder_id;
        console.log('Auction sold to:', soldTo, 'for:', highestBid.amount);
      } else {
        console.log('Reserve price not met. Highest bid:', highestBid.amount, 'Reserve:', auction.reserve_price);
      }
    } else {
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

    // ─── If sold: Update motorhome, create invoice, send emails ────
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
      }

      // Send winner notification
      try {
        await supabase.functions.invoke('notify-auction-winner', {
          body: {
            auctionId,
            winnerId: soldTo,
            amount: highestBid!.amount,
          },
        });
      } catch (notifyError) {
        console.error('Error sending winner notification:', notifyError);
      }

      // ─── INVOICE FLOW ─────────────────────────────────────────────
      // Step 1: Create invoice via RPC (atomic, with commission calculation)
      // Step 2: Generate PDF (upload to storage)
      // Step 3: Send email with PDF attachment
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
        try {
          const { data: pdfResult, error: pdfError } = await supabase.functions.invoke('generate-invoice-pdf', {
            body: { invoiceId }
          });
          
          if (pdfError) {
            console.error('PDF generation error:', pdfError);
          } else {
            console.log('Invoice PDF generated:', pdfResult?.invoiceNumber);
          }
        } catch (pdfError) {
          console.error('Error generating invoice PDF:', pdfError);
          // Continue - email can still be sent without PDF attachment
        }

        // Step 3: Send invoice email (with PDF attachment if available)
        try {
          const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-invoice-email', {
            body: { invoiceId }
          });
          
          if (emailError) {
            console.error('Invoice email error:', emailError);
          } else {
            console.log('Invoice email sent:', emailResult?.invoiceNumber, '→', emailResult?.sentTo);
          }
        } catch (emailError) {
          console.error('Error sending invoice email:', emailError);
        }

        console.log('Invoice flow completed for auction:', auctionId);
        
      } catch (invoiceError) {
        console.error('Error in invoice flow:', invoiceError);
        // Don't fail the auction closure if invoice creation fails
        // The admin can manually create the invoice later
      }
    }

    // ─── Notify losing bidders ───────────────────────────────────
    if (highestBid && auction.bids && auction.bids.length > 0) {
      const motorhomeName = `${auction.motorhome?.manufacturer || ''} ${auction.motorhome?.model || ''}`.trim();
      const auctionUrl = `https://caravanwert.de/auktion/${auctionId}`;

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
        }).catch((e: any) => console.error('Error sending seller end notification:', e));
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
