import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { buildEmailLayout, paragraph, infoBox, detailRow, warningBox, button } from '../_shared/email-builder.ts';
import { logEdgeError } from '../_shared/edgeLogger.ts';
import { uploadSaleConversionToGoogleAds } from '../_shared/gads-sale-conversion.ts';

/**
 * Edge Function: accept-kaufchance-offer
 * 
 * Accepts a post-auction offer during the Kaufchance phase.
 * This triggers the full sale flow:
 * 1. Update offer status to 'accepted'
 * 2. Reject all other pending offers for this auction
 * 3. Update auction status to 'sold'
 * 4. Update motorhome status to 'sold'
 * 5. Create invoice
 * 6. Generate purchase contract
 * 7. Send notifications to all parties
 * 
 * Can be called by:
 * - Seller (accepting a buyer's offer)
 * - Admin (accepting on behalf of seller)
 * 
 * Race condition protection:
 * - Uses optimistic locking: checks auction is still in 'kaufchance' status
 * - Rejects if another offer was already accepted
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  // ─── Auth check: must be authenticated user (seller, buyer, or admin) ───
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Nicht autorisiert: Kein Authorization-Header' }),
      { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Nicht autorisiert: Ungültiger Token' }),
      { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }

  console.log(`accept-kaufchance-offer called by user: ${user.id}`);

  try {
    const { offerId } = await req.json();

    if (!offerId) {
      return new Response(
        JSON.stringify({ error: 'offerId is required' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const errors: string[] = [];

    // ─── 1. Load the offer with auction and motorhome data ───
    const { data: offer, error: offerError } = await supabase
      .from('post_auction_offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (offerError || !offer) {
      return new Response(
        JSON.stringify({ error: 'Offer not found' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    if (offer.status === 'accepted') {
      return new Response(
        JSON.stringify({ error: 'Offer already accepted' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    if (offer.status !== 'pending' && offer.status !== 'countered') {
      return new Response(
        JSON.stringify({ error: `Offer cannot be accepted (status: ${offer.status})` }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // ─── 2. Load auction and verify it's still in kaufchance ───
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select(`
        *,
        motorhome:motorhomes(*),
        bids(*)
      `)
      .eq('id', offer.auction_id)
      .single();

    if (auctionError || !auction) {
      return new Response(
        JSON.stringify({ error: 'Auction not found' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Determine if this is a Festpreis price proposal (active auction + instant_price)
    const isFestpreisProposal = auction.status === 'active' && auction.motorhome?.sale_channel === 'instant_price';

    // Guard: motorhome must not already be sold (prevents race with instant-buy)
    if (auction.motorhome?.status === 'sold') {
      return new Response(
        JSON.stringify({ error: 'Dieses Fahrzeug wurde bereits verkauft.' }),
        { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Race condition check: auction must be in kaufchance OR active Festpreis
    if (auction.status !== 'kaufchance' && !isFestpreisProposal) {
      return new Response(
        JSON.stringify({ error: `Auktion ist nicht in der Kaufchance-Phase oder aktiv (Status: ${auction.status})` }),
        { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Check if Kaufchance has expired (only relevant for kaufchance, not Festpreis proposals)
    if (!isFestpreisProposal && auction.kaufchance_expires_at) {
      const expiresAt = new Date(auction.kaufchance_expires_at).getTime();
      if (Date.now() > expiresAt) {
        return new Response(
          JSON.stringify({ error: 'Die Kaufchance-Frist ist abgelaufen. Angebote können nicht mehr angenommen werden.' }),
          { status: 410, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
    }

    // ─── Authorization check: only seller, buyer (for counter-offers), or admin can accept ───
    const isAdmin = await (async () => {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      return roleData?.role === 'admin';
    })();
    const isSeller = auction.motorhome?.seller_id === user.id;
    const isBuyer = offer.buyer_id === user.id;

    // Buyer can only accept counter-offers (seller made a counter, buyer accepts)
    if (!isAdmin && !isSeller && !(isBuyer && offer.status === 'countered')) {
      console.warn(`Unauthorized accept attempt by user ${user.id} (isAdmin: ${isAdmin}, isSeller: ${isSeller}, isBuyer: ${isBuyer}, offerStatus: ${offer.status})`);
      return new Response(
        JSON.stringify({ error: 'Nicht autorisiert: Sie d\u00fcrfen dieses Angebot nicht annehmen' }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Check if another offer was already accepted (double-check)
    const { data: existingAccepted } = await supabase
      .from('post_auction_offers')
      .select('id')
      .eq('auction_id', offer.auction_id)
      .eq('status', 'accepted')
      .maybeSingle();

    if (existingAccepted) {
      return new Response(
        JSON.stringify({ error: 'Another offer has already been accepted for this auction' }),
        { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Determine the final sale price
    // If there's a counter_offer_amount and the offer is in 'countered' status, use the counter amount
    // Otherwise use the original offer_amount
    const salePrice = offer.status === 'countered' && offer.counter_offer_amount
      ? Number(offer.counter_offer_amount)
      : Number(offer.offer_amount);

    // ─── kaufchance_min_price ist KEIN Hard-Block ───
    // Sinn der Nachverhandlung ist explizit, dass UNTER dem ursprünglichen
    // Wunschpreis verhandelt werden darf. Der Verkäufer (oder Admin in seinem
    // Namen) ist mündig: wenn er ein Angebot annimmt, das unter dem von ihm
    // gesetzten Mindestpreis liegt, ist das eine bewusste Entscheidung.
    // Wir loggen es nur informativ, blocken aber nicht.
    if (
      !isFestpreisProposal &&
      auction.kaufchance_min_price != null &&
      Number(auction.kaufchance_min_price) > 0 &&
      salePrice < Number(auction.kaufchance_min_price)
    ) {
      console.log(
        `[info] Acceptance below kaufchance_min_price (auction ${auction.id}): ` +
        `salePrice=€${salePrice}, minPrice=€${Number(auction.kaufchance_min_price)} ` +
        `(allowed — seller's discretion).`,
      );
    }

    const buyerId = offer.buyer_id;
    const motorhomeName = `${auction.motorhome?.manufacturer || ''} ${auction.motorhome?.model || ''}`.trim();
    const auctionUrl = `https://caravanwert.de/auktion/${auction.id}`;

    console.log(`Accepting Kaufchance offer: ${offerId}, buyer: ${buyerId}, price: €${salePrice}`);

    // ─── 3-6. Atomic DB transition (offer + other offers + auction + motorhome) ───
    // All four state changes happen in a single Postgres transaction. If any
    // step fails, everything is rolled back automatically — no more split-brain
    // states (auction sold but motorhome still available, etc.).
    const expectedStatus = isFestpreisProposal ? 'active' : 'kaufchance';
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'accept_kaufchance_offer_atomic',
      {
        p_offer_id: offerId,
        p_expected_auction_status: expectedStatus,
        p_user_id: user.id,
      },
    );

    if (rpcError) {
      console.error('RPC accept_kaufchance_offer_atomic failed:', rpcError);
      await logEdgeError(supabase, {
        component: 'accept-kaufchance-offer',
        message: `Atomare Annahme fehlgeschlagen (RPC-Fehler): ${rpcError.message}`,
        severity: 'high',
        category: 'kaufchance',
        originalError: rpcError,
        metadata: { offerId, auctionId: auction.id },
        userId: user.id,
      });
      return new Response(
        JSON.stringify({ error: 'Status-Update fehlgeschlagen. Bitte erneut versuchen.' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      );
    }

    const rpcResult = rpcData as {
      success: boolean;
      error?: string;
      offer_status?: string;
      auction_status?: string;
      sale_price?: number;
    };

    if (!rpcResult?.success) {
      console.warn('accept_kaufchance_offer_atomic returned failure:', rpcResult);
      // Map known DB errors to user-friendly messages + correct HTTP codes
      const code = rpcResult?.error || 'unknown';
      const map: Record<string, { status: number; msg: string }> = {
        offer_not_found:        { status: 404, msg: 'Angebot nicht gefunden.' },
        auction_not_found:      { status: 404, msg: 'Auktion nicht gefunden.' },
        motorhome_not_found:    { status: 404, msg: 'Fahrzeug nicht gefunden.' },
        offer_not_open:         { status: 409, msg: `Angebot kann nicht angenommen werden (Status: ${rpcResult.offer_status}).` },
        auction_status_mismatch:{ status: 409, msg: isFestpreisProposal ? 'Das Inserat ist nicht mehr aktiv.' : 'Die Auktion befindet sich nicht mehr in der Kaufchance-Phase.' },
        motorhome_already_sold: { status: 409, msg: 'Dieses Fahrzeug wurde bereits verkauft.' },
      };
      const mapped = map[code] || { status: 500, msg: `Annahme fehlgeschlagen: ${code}` };
      return new Response(
        JSON.stringify({ error: mapped.msg, code }),
        { status: mapped.status, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      );
    }

    // No "otherOfferIds" snapshot needed any more — rejection is part of the
    // atomic RPC. The variable is kept for downstream notification reuse below.
    const { data: rejectedAfter } = await supabase
      .from('post_auction_offers')
      .select('id, buyer_id, offer_amount')
      .eq('auction_id', offer.auction_id)
      .neq('id', offerId)
      .eq('status', 'rejected')
      .gte('updated_at', new Date(Date.now() - 60_000).toISOString());
    const otherOfferIds = (rejectedAfter || []).map((o) => o.id);

    // ─── 7. Create invoice ───
    let invoiceSuccess = false;
    let invoiceNumber = '';
    try {
      console.log('Creating invoice for Kaufchance sale:', auction.id, 'dealer:', buyerId);
      
      const { data: invoiceId, error: invoiceRpcError } = await supabase.rpc('create_auction_invoice', {
        auction_id_param: auction.id,
        dealer_id_param: buyerId,
      });

      if (invoiceRpcError) {
        console.error('Invoice RPC error:', invoiceRpcError);
        throw invoiceRpcError;
      }

      if (!invoiceId) {
        throw new Error('Invoice creation returned no ID');
      }

      console.log('Invoice created:', invoiceId);

      // Generate PDF
      let pdfBase64: string | undefined;
      try {
        const { data: pdfResult, error: pdfError } = await supabase.functions.invoke('generate-invoice-pdf', {
          body: { invoiceId },
        });

        if (pdfError) {
          errors.push(`Rechnungs-PDF fehlgeschlagen: ${pdfError.message || 'Unbekannter Fehler'}`);
        } else {
          pdfBase64 = pdfResult?.pdfBase64;
          invoiceNumber = pdfResult?.invoiceNumber || '';
        }
      } catch (pdfError: any) {
        errors.push(`Rechnungs-PDF fehlgeschlagen: ${pdfError.message}`);
      }

      // Send invoice email
      try {
        const { error: emailError } = await supabase.functions.invoke('send-invoice-email', {
          body: { invoiceId, pdfBase64 },
        });

        if (emailError) {
          errors.push(`Rechnungs-E-Mail fehlgeschlagen: ${emailError.message || 'Unbekannter Fehler'}`);
        } else {
          invoiceSuccess = true;
        }
      } catch (emailError: any) {
        errors.push(`Rechnungs-E-Mail fehlgeschlagen: ${emailError.message}`);
      }
    } catch (invoiceError: any) {
      console.error('Error in invoice flow:', invoiceError);
      errors.push(`Rechnungserstellung komplett fehlgeschlagen: ${invoiceError.message}`);
    }

    // ─── 7b. Google Ads sale conversion (only after invoice confirmed) ───
    if (invoiceSuccess) {
      const saleResult = await uploadSaleConversionToGoogleAds({
        supabase,
        source: 'accept-kaufchance-offer',
        auctionId: auction.id,
        motorhomeId: auction.motorhome.id,
        sellerId: auction.motorhome.seller_id,
        dealerId: buyerId,
        saleAmount: salePrice,
        clickIds: {
          gclid: auction.motorhome?.gclid,
          gbraid: auction.motorhome?.gbraid,
          wbraid: auction.motorhome?.wbraid,
        },
      });
      if (saleResult.attempted && !saleResult.success) {
        errors.push(`Google Ads Sale-Conversion: ${saleResult.error || 'Unbekannter Fehler'}`);
      }
    } else {
      console.log('[accept-kaufchance-offer] Invoice not created successfully, skipping Google Ads sale conversion');
    }

    // ─── 8. Generate purchase contract ───
    let contractSuccess = false;
    let contractNumber = '';
    let contractPdfBase64 = '';
    try {
      console.log('Generating purchase contract for Kaufchance sale:', auction.id);

      const { data: contractResult, error: contractError } = await supabase.functions.invoke('generate-purchase-contract', {
        body: {
          auctionId: auction.id,
          motorhomeId: auction.motorhome.id,
          buyerId: buyerId,
          sellerId: auction.motorhome.seller_id,
          salePrice: salePrice,
        },
      });

      if (contractError) {
        errors.push(`Kaufvertrag fehlgeschlagen: ${contractError.message || 'Unbekannter Fehler'}`);
      } else if (contractResult?.success) {
        contractSuccess = true;
        contractNumber = contractResult.contractNumber;
        contractPdfBase64 = contractResult.pdfBase64 || '';
        console.log('Purchase contract generated:', contractNumber);

        // Send contract to both parties
        const { data: sellerProfile } = await supabase
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('id', auction.motorhome.seller_id)
          .single();

        const { data: buyerProfile } = await supabase
          .from('profiles')
          .select('email, first_name, last_name, company_name')
          .eq('id', buyerId)
          .single();

        const { data: settings } = await supabase
          .from('site_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        const settingsData = settings || { site_name: 'CaravanWert', contact_email: 'info@caravanwert.de' };

        // Contract email to seller
        if (sellerProfile?.email && contractPdfBase64) {
          try {
            const sellerName = `${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`.trim() || 'Kunde';
            const html = buildEmailLayout(settingsData, isFestpreisProposal ? 'Ihr Kaufvertrag – Preisvorschlag angenommen' : 'Ihr Kaufvertrag – Kaufchance angenommen', `
              ${paragraph(`Hallo ${sellerName},`)}
              ${paragraph('Ein Kaufangebot für Ihr Fahrzeug wurde angenommen. Anbei erhalten Sie den Kaufvertrag.')}
              ${infoBox('Vertragsdetails', `
                ${detailRow('Vertragsnr.', contractNumber)}
                ${detailRow('Fahrzeug', motorhomeName)}
                ${detailRow('Kaufpreis', `€${salePrice.toLocaleString('de-DE')}`)}
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
                html,
                attachments: [{
                  filename: `${contractNumber}.pdf`,
                  content: contractPdfBase64,
                }],
              }),
            });
            if (!sellerEmailRes.ok) {
              const errText = await sellerEmailRes.text();
              throw new Error(`Resend API error: ${errText}`);
            }
            const sellerResendResult = await sellerEmailRes.json();
            console.log('Contract email sent to seller:', sellerProfile.email);

            await supabase.from('admin_emails').insert({
              sender_email: 'info@caravanwert.de',
              sender_name: settingsData.site_name,
              recipient_email: sellerProfile.email,
              recipient_name: sellerName,
              subject: `Kaufvertrag ${contractNumber} – ${motorhomeName}`,
              body_html: html,
              body_text: '',
              email_type: 'purchase_contract',
              direction: 'outbound',
              status: 'sent',
              resend_id: sellerResendResult?.id || null,
              is_read: false,
            }).catch((logErr: any) => console.error('Failed to log seller contract email:', logErr));
          } catch (e: any) {
            console.error('Error sending contract to seller:', e);
            errors.push(`Kaufvertrag-E-Mail an Verkäufer fehlgeschlagen: ${e.message}`);
          }
        } else {
          const reason = !sellerProfile?.email ? 'Verkäufer-E-Mail fehlt' : 'PDF-Base64 leer';
          console.error(`Contract email to seller SKIPPED: ${reason}`);
          errors.push(`Kaufvertrag-E-Mail an Verkäufer übersprungen: ${reason}`);
        }

        // Contract email to buyer
        if (buyerProfile?.email && contractPdfBase64) {
          try {
            const buyerName = buyerProfile.company_name || `${buyerProfile.first_name || ''} ${buyerProfile.last_name || ''}`.trim() || 'Händler';
            const html = buildEmailLayout(settingsData, 'Kaufvertrag – Ihr Angebot wurde angenommen', `
              ${paragraph(`Sehr geehrte/r ${buyerName},`)}
              ${paragraph('<strong>Ihr Kaufangebot wurde angenommen!</strong> Anbei erhalten Sie den Kaufvertrag.')}
              ${infoBox('Vertragsdetails', `
                ${detailRow('Vertragsnr.', contractNumber)}
                ${detailRow('Fahrzeug', motorhomeName)}
                ${detailRow('Kaufpreis', `€${salePrice.toLocaleString('de-DE')}`)}
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
                html,
                attachments: [{
                  filename: `${contractNumber}.pdf`,
                  content: contractPdfBase64,
                }],
              }),
            });
            if (!buyerEmailRes.ok) {
              const errText = await buyerEmailRes.text();
              throw new Error(`Resend API error: ${errText}`);
            }
            const buyerResendResult = await buyerEmailRes.json();
            console.log('Contract email sent to buyer:', buyerProfile.email);

            await supabase.from('admin_emails').insert({
              sender_email: 'info@caravanwert.de',
              sender_name: settingsData.site_name,
              recipient_email: buyerProfile.email,
              recipient_name: buyerName,
              subject: `Kaufvertrag ${contractNumber} – ${motorhomeName}`,
              body_html: html,
              body_text: '',
              email_type: 'purchase_contract',
              direction: 'outbound',
              status: 'sent',
              resend_id: buyerResendResult?.id || null,
              is_read: false,
            }).catch((logErr: any) => console.error('Failed to log buyer contract email:', logErr));
          } catch (e: any) {
            console.error('Error sending contract to buyer:', e);
            errors.push(`Kaufvertrag-E-Mail an Käufer fehlgeschlagen: ${e.message}`);
          }
        } else {
          const reason = !buyerProfile?.email ? 'Käufer-E-Mail fehlt' : 'PDF-Base64 leer';
          console.error(`Contract email to buyer SKIPPED: ${reason}`);
          errors.push(`Kaufvertrag-E-Mail an Käufer übersprungen: ${reason}`);
        }
      }
    } catch (contractError: any) {
      console.error('Error in purchase contract flow:', contractError);
      errors.push(`Kaufvertrag komplett fehlgeschlagen: ${contractError.message}`);
    }

    // ─── 9. Send notifications ───

    // Notify winner (buyer)
    try {
      const { error: winnerErr } = await supabase.functions.invoke('notify-auction-winner', {
        body: {
          auctionId: auction.id,
          winnerId: buyerId,
          amount: salePrice,
        },
      });
      if (winnerErr) throw winnerErr;
    } catch (e: any) {
      errors.push(`Gewinner-Benachrichtigung fehlgeschlagen: ${e.message}`);
    }

    // Notify seller about successful sale
    if (auction.motorhome?.seller_id) {
      try {
        const { data: sellerProfile } = await supabase
          .from('profiles')
          .select('email, first_name')
          .eq('id', auction.motorhome.seller_id)
          .single();

        if (sellerProfile?.email) {
          const { error: sellerErr } = await supabase.functions.invoke('send-auction-notification', {
            body: {
              email: sellerProfile.email,
              name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
              type: 'seller_sold',
              motorhomeModel: motorhomeName,
              auctionUrl: `https://caravanwert.de/dashboard/listings/${auction.motorhome?.id}`,
              currentBid: `€${salePrice.toLocaleString('de-DE')}`,
            },
          });
          if (sellerErr) throw sellerErr;
        }
      } catch (e: any) {
        errors.push(`Seller-Benachrichtigung fehlgeschlagen: ${e.message}`);
      }
    }

    // Notify other bidders/proposers that they lost
    try {
      const notifiedIds = new Set<string>();

      // For Kaufchance: notify invited bidders
      if (!isFestpreisProposal) {
        const { data: otherInvitations } = await supabase
          .from('kaufchance_invitations')
          .select('bidder_id, highest_bid')
          .eq('auction_id', auction.id)
          .neq('bidder_id', buyerId);

        if (otherInvitations) {
          for (const inv of otherInvitations) {
            if (notifiedIds.has(inv.bidder_id)) continue;
            notifiedIds.add(inv.bidder_id);
            const { data: profile } = await supabase
              .from('profiles')
              .select('email, first_name, company_name')
              .eq('id', inv.bidder_id)
              .single();

            if (profile?.email) {
              await supabase.functions.invoke('send-auction-notification', {
                body: {
                  email: profile.email,
                  name: profile.company_name || profile.first_name || profile.email.split('@')[0],
                  type: 'lost',
                  motorhomeModel: motorhomeName,
                  auctionUrl: 'https://caravanwert.de/kaufen',
                  yourBid: `€${Number(inv.highest_bid).toLocaleString('de-DE')}`,
                  currentBid: `€${salePrice.toLocaleString('de-DE')}`,
                  isFestpreis: isFestpreisProposal,
                },
              });
            }
          }
        }
      }

      // Notify other proposers whose offers were rejected (covers Festpreis + Kaufchance)
      if (otherOfferIds.length > 0) {
        const { data: rejectedOffers } = await supabase
          .from('post_auction_offers')
          .select('buyer_id, offer_amount')
          .in('id', otherOfferIds);

        if (rejectedOffers) {
          for (const ro of rejectedOffers) {
            if (notifiedIds.has(ro.buyer_id)) continue;
            notifiedIds.add(ro.buyer_id);
            const { data: profile } = await supabase
              .from('profiles')
              .select('email, first_name, company_name')
              .eq('id', ro.buyer_id)
              .single();

            if (profile?.email) {
              await supabase.functions.invoke('send-auction-notification', {
                body: {
                  email: profile.email,
                  name: profile.company_name || profile.first_name || profile.email.split('@')[0],
                  type: 'lost',
                  motorhomeModel: motorhomeName,
                  auctionUrl: 'https://caravanwert.de/kaufen',
                  yourBid: `€${Number(ro.offer_amount).toLocaleString('de-DE')}`,
                  currentBid: `€${salePrice.toLocaleString('de-DE')}`,
                  isFestpreis: isFestpreisProposal,
                },
              });
            }
          }
        }
      }
    } catch (e: any) {
      errors.push(`Verlierer-Benachrichtigung fehlgeschlagen: ${e.message}`);
    }

    // ─── 10. Admin notification ───
    try {
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name, company_name')
        .eq('id', buyerId)
        .single();

      const buyerName = buyerProfile?.company_name || `${buyerProfile?.first_name || ''} ${buyerProfile?.last_name || ''}`.trim() || 'Unbekannt';

      const { data: settings } = await supabase
        .from('site_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      const settingsData = settings || { site_name: 'CaravanWert', contact_email: 'info@caravanwert.de' };

      // Get admin emails
      const recipients: string[] = [];
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

      if (recipients.length === 0) {
        recipients.push('info@caravanwert.de');
      }

      const saleLabel = isFestpreisProposal ? 'Preisvorschlag' : 'Kaufchance';
      let adminContent = `
        ${paragraph(`<strong>Ein ${saleLabel}-Angebot wurde angenommen!</strong>`)}
        ${infoBox('Verkaufsdetails', `
          ${detailRow('Status', `✅ VERKAUFT (${saleLabel})`)}
          ${detailRow('Fahrzeug', motorhomeName)}
          ${detailRow('Verkaufspreis', `€${salePrice.toLocaleString('de-DE')}`)}
          ${isFestpreisProposal
            ? detailRow('Urspr. Festpreis', `€${Number(auction.motorhome?.instant_price || 0).toLocaleString('de-DE')}`)
            : detailRow('Urspr. Mindestgebot', `€${Number(auction.reserve_price || 0).toLocaleString('de-DE')}`)}
          ${!isFestpreisProposal ? detailRow('Höchstes Auktionsgebot', `€${Number(auction.current_bid || 0).toLocaleString('de-DE')}`) : ''}
        `, 'success')}
        ${infoBox('Käufer', `
          ${detailRow('Händler', buyerName)}
          ${detailRow('E-Mail', buyerProfile?.email || '–')}
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

      const adminSubject = `[Admin] ${saleLabel} angenommen: ${motorhomeName} für €${salePrice.toLocaleString('de-DE')}`;
      const html = buildEmailLayout(settingsData, `${saleLabel} angenommen: ${motorhomeName} für €${salePrice.toLocaleString('de-DE')}`, adminContent);

      if (RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${settingsData.site_name} System <info@caravanwert.de>`,
            to: recipients,
            subject: adminSubject,
            html,
          }),
        });
      }

      // Log admin email
      try {
        await supabase.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: `${settingsData.site_name} System`,
          recipient_email: recipients[0],
          recipient_name: 'Admin',
          subject: adminSubject,
          body_html: html,
          body_text: '',
          email_type: 'auto',
          direction: 'outbound',
          status: 'sent',
          is_read: false,
        });
      } catch (logErr) {
        console.error('Failed to log admin email:', logErr);
      }
    } catch (adminError: any) {
      console.error('Error sending admin notification:', adminError);
    }

    // ─── Persist any accumulated non-fatal errors so admins can see them ──
    if (errors.length > 0) {
      await logEdgeError(supabase, {
        component: 'accept-kaufchance-offer',
        message: `Verkauf abgeschlossen, aber ${errors.length} Folge-Fehler aufgetreten`,
        severity: errors.length >= 3 ? 'high' : 'medium',
        category: 'kaufchance',
        metadata: {
          offerId,
          auctionId: auction.id,
          buyerId,
          salePrice,
          invoiceSuccess,
          contractSuccess,
          errors,
        },
        userId: user.id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        offerId,
        buyerId,
        salePrice,
        invoiceSuccess,
        contractSuccess,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in accept-kaufchance-offer:', error);
    await logEdgeError(supabase, {
      component: 'accept-kaufchance-offer',
      message: `Unerwarteter Fehler: ${error?.message || 'unbekannt'}`,
      severity: 'high',
      category: 'kaufchance',
      originalError: error,
      userId: user.id,
    });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
