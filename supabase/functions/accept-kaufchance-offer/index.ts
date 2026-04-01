import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { buildEmailLayout, paragraph, infoBox, detailRow, warningBox, button } from '../_shared/email-builder.ts';

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

    // Race condition check: auction must still be in kaufchance
    if (auction.status !== 'kaufchance') {
      return new Response(
        JSON.stringify({ error: `Auction is no longer in kaufchance phase (status: ${auction.status})` }),
        { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
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

    const buyerId = offer.buyer_id;
    const motorhomeName = `${auction.motorhome?.manufacturer || ''} ${auction.motorhome?.model || ''}`.trim();
    const auctionUrl = `https://caravanwert.de/auktion/${auction.id}`;

    console.log(`Accepting Kaufchance offer: ${offerId}, buyer: ${buyerId}, price: €${salePrice}`);

    // ─── 3. Update offer status to 'accepted' ───
    const { error: updateOfferError } = await supabase
      .from('post_auction_offers')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', offerId);

    if (updateOfferError) {
      console.error('Error updating offer status:', updateOfferError);
      return new Response(
        JSON.stringify({ error: 'Failed to update offer status' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // ─── 4. Reject all other pending/countered offers for this auction ───
    try {
      const { error: rejectError } = await supabase
        .from('post_auction_offers')
        .update({
          status: 'rejected',
          seller_response: 'Ein anderes Angebot wurde angenommen.',
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('auction_id', offer.auction_id)
        .neq('id', offerId)
        .in('status', ['pending', 'countered']);

      if (rejectError) {
        console.error('Error rejecting other offers:', rejectError);
        errors.push(`Andere Angebote ablehnen fehlgeschlagen: ${rejectError.message}`);
      }
    } catch (e: any) {
      console.error('Error rejecting other offers:', e);
      errors.push(`Andere Angebote ablehnen fehlgeschlagen: ${e.message}`);
    }

    // ─── 5. Update auction status to 'sold' ───
    const { error: updateAuctionError } = await supabase
      .from('auctions')
      .update({
        status: 'sold',
        current_bid: salePrice,
      })
      .eq('id', auction.id)
      .eq('status', 'kaufchance'); // Optimistic lock

    if (updateAuctionError) {
      console.error('Error updating auction status:', updateAuctionError);
      errors.push(`Auktions-Status-Update fehlgeschlagen: ${updateAuctionError.message}`);
    }

    // ─── 6. Update motorhome status to 'sold' ───
    const { error: updateMotorhomeError } = await supabase
      .from('motorhomes')
      .update({
        status: 'sold',
        sold_to: buyerId,
        sold_at: new Date().toISOString(),
        sale_type: 'kaufchance',
      })
      .eq('id', auction.motorhome.id);

    if (updateMotorhomeError) {
      console.error('Error updating motorhome status:', updateMotorhomeError);
      errors.push(`Motorhome-Status-Update fehlgeschlagen: ${updateMotorhomeError.message}`);
    }

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

        const settingsData = settings || { site_name: 'CaravanWert', contact_email: 'kontakt@caravanwert.de' };

        // Contract email to seller
        if (sellerProfile?.email && contractPdfBase64) {
          try {
            const sellerName = `${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`.trim() || 'Kunde';
            const html = buildEmailLayout(settingsData, 'Ihr Kaufvertrag – Kaufchance angenommen', `
              ${paragraph(`Hallo ${sellerName},`)}
              ${paragraph('Ein Kaufangebot für Ihr Fahrzeug wurde angenommen. Anbei erhalten Sie den Kaufvertrag.')}
              ${infoBox('Vertragsdetails', `
                ${detailRow('Vertragsnr.', contractNumber)}
                ${detailRow('Fahrzeug', motorhomeName)}
                ${detailRow('Kaufpreis', `€${salePrice.toLocaleString()}`)}
              `, 'success')}
              ${paragraph('Bitte prüfen Sie den Vertrag sorgfältig. Bei Fragen stehen wir Ihnen gerne zur Verfügung.')}
              ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${settingsData.site_name} Team`)}
            `);

            await fetch('https://api.resend.com/emails', {
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
          } catch (e: any) {
            errors.push(`Kaufvertrag-E-Mail an Verkäufer fehlgeschlagen: ${e.message}`);
          }
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
                ${detailRow('Kaufpreis', `€${salePrice.toLocaleString()}`)}
              `, 'success')}
              ${paragraph('Bitte prüfen Sie den Vertrag sorgfältig. Die Rechnung über die Vermittlungsprovision erhalten Sie in einer separaten E-Mail.')}
              ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${settingsData.site_name} Team`)}
            `);

            await fetch('https://api.resend.com/emails', {
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
          } catch (e: any) {
            errors.push(`Kaufvertrag-E-Mail an Käufer fehlgeschlagen: ${e.message}`);
          }
        }
      }
    } catch (contractError: any) {
      console.error('Error in purchase contract flow:', contractError);
      errors.push(`Kaufvertrag komplett fehlgeschlagen: ${contractError.message}`);
    }

    // ─── 9. Send notifications ───

    // Notify winner (buyer)
    try {
      await supabase.functions.invoke('notify-auction-winner', {
        body: {
          auctionId: auction.id,
          winnerId: buyerId,
          amount: salePrice,
        },
      });
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
          await supabase.functions.invoke('send-auction-notification', {
            body: {
              email: sellerProfile.email,
              name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
              type: 'seller_sold',
              motorhomeModel: motorhomeName,
              auctionUrl: `https://caravanwert.de/dashboard`,
              currentBid: `€${salePrice.toLocaleString()}`,
            },
          });
        }
      } catch (e: any) {
        errors.push(`Seller-Benachrichtigung fehlgeschlagen: ${e.message}`);
      }
    }

    // Notify other invited bidders that they lost
    try {
      const { data: otherInvitations } = await supabase
        .from('kaufchance_invitations')
        .select('bidder_id, highest_bid')
        .eq('auction_id', auction.id)
        .neq('bidder_id', buyerId);

      if (otherInvitations) {
        for (const inv of otherInvitations) {
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
                yourBid: `€${Number(inv.highest_bid).toLocaleString()}`,
                currentBid: `€${salePrice.toLocaleString()}`,
              },
            });
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

      const settingsData = settings || { site_name: 'CaravanWert', contact_email: 'kontakt@caravanwert.de' };

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
        recipients.push('kontakt@caravanwert.de');
      }

      let adminContent = `
        ${paragraph('<strong>Ein Kaufchance-Angebot wurde angenommen!</strong>')}
        ${infoBox('Verkaufsdetails', `
          ${detailRow('Status', '✅ VERKAUFT (Kaufchance)')}
          ${detailRow('Fahrzeug', motorhomeName)}
          ${detailRow('Verkaufspreis', `€${salePrice.toLocaleString()}`)}
          ${detailRow('Urspr. Mindestgebot', `€${Number(auction.reserve_price || 0).toLocaleString()}`)}
          ${detailRow('Höchstes Auktionsgebot', `€${Number(auction.current_bid || 0).toLocaleString()}`)}
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

      const html = buildEmailLayout(settingsData, `Kaufchance angenommen: ${motorhomeName} für €${salePrice.toLocaleString()}`, adminContent);

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
            subject: `[Admin] Kaufchance angenommen: ${motorhomeName} für €${salePrice.toLocaleString()}`,
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
          subject: `[Admin] Kaufchance angenommen: ${motorhomeName}`,
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
