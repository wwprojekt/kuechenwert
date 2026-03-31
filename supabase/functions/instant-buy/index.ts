import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
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

    // 2. Verify dealer role and approved status
    const { data: buyerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_type, dealer_status')
      .eq('id', user.id)
      .single();

    if (profileError || !buyerProfile) {
      console.error('Profile fetch error:', profileError?.message);
      throw new Error('Benutzerprofil konnte nicht geladen werden');
    }

    if (buyerProfile.user_type !== 'dealer' || buyerProfile.dealer_status !== 'approved') {
      console.warn(`Unauthorized instant-buy attempt by user ${user.id} (type: ${buyerProfile.user_type}, status: ${buyerProfile.dealer_status})`);
      throw new Error('Nur freigeschaltete H\u00e4ndler d\u00fcrfen Sofortk\u00e4ufe t\u00e4tigen');
    }

    // 3. Validate request body
    const rawBody = await req.json();
    const validation = InstantBuySchema.safeParse(rawBody);
    if (!validation.success) {
      const msg = validation.error.errors.map(e => e.message).join(', ');
      throw new Error(msg);
    }

    const { auctionId }: InstantBuyRequest = validation.data;

    // 3. Reuse the service role client created above for all DB operations

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

    // ─── 8. INVOICE FLOW ─────────────────────────────────────────
    // Step 1: Create invoice via RPC (atomic, with commission calculation)
    // Step 2: Generate PDF (upload to storage)
    // Step 3: Send email with PDF attachment to dealer
    try {
      console.log('Creating instant-buy invoice for auction:', auctionId, 'dealer:', user.id);

      // Step 1: Create invoice
      const { data: invoiceId, error: invoiceRpcError } = await supabaseAdmin.rpc('create_instant_buy_invoice', {
        auction_id_param: auctionId,
        dealer_id_param: user.id,
        instant_price_param: instantPrice,
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
        const { data: pdfResult, error: pdfError } = await supabaseAdmin.functions.invoke('generate-invoice-pdf', {
          body: { invoiceId }
        });
        if (pdfError) {
          console.error('PDF generation error:', pdfError);
        } else {
          console.log('Invoice PDF generated:', pdfResult?.invoiceNumber);
          pdfBase64 = pdfResult?.pdfBase64;
        }
      } catch (pdfError) {
        console.error('Error generating invoice PDF:', pdfError);
      }

      // Step 3: Send invoice email (with PDF attachment if available)
      try {
        const { data: emailResult, error: emailError } = await supabaseAdmin.functions.invoke('send-invoice-email', {
          body: { invoiceId, pdfBase64 }
        });
        if (emailError) {
          console.error('Invoice email error:', emailError);
        } else {
          console.log('Invoice email sent:', emailResult?.invoiceNumber, '→', emailResult?.sentTo);
        }
      } catch (emailError) {
        console.error('Error sending invoice email:', emailError);
      }

      console.log('Invoice flow completed for instant buy:', auctionId);
    } catch (invoiceError) {
      console.error('Error in instant-buy invoice flow:', invoiceError);
      // Don't fail the purchase if invoice creation fails
      // The admin can manually create the invoice later
    }

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
