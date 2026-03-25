import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { buildEmailLayout, paragraph, infoBox, detailRow, amountDisplay, warningBox, button } from '../_shared/email-builder.ts';

/**
 * Edge Function: close-auction
 * 
 * Closes an auction after it has ended. Determines the outcome:
 * - Sold: Reserve price met → update motorhome, create invoice, generate purchase contract, send emails
 * - Ended: No bids or reserve not met → notify seller
 * 
 * Invoice flow (when sold):
 * 1. create_auction_invoice RPC → creates invoice + line items
 * 2. generate-invoice-pdf → generates PDF, uploads to storage, updates pdf_url
 * 3. send-invoice-email → sends email with PDF attachment to dealer
 * 
 * Purchase contract flow (when sold):
 * 4. generate-purchase-contract → generates Kaufvertrag PDF between seller and buyer
 * 5. Send contract to both parties via email
 * 
 * Notifications:
 * - Winner dealer: notify-auction-winner
 * - Losing dealers: send-auction-notification (type: 'lost')
 * - Seller (sold): send-auction-notification (type: 'seller_sold')
 * - Seller (not sold): send-auction-notification (type: 'seller_not_sold')
 * - Admin: summary email with all results and any errors
 * 
 * Auth: service_role (cron/internal) or admin
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Helper: Send admin notification email directly via Resend
async function sendAdminEmail(
  supabase: any,
  subject: string,
  content: string,
) {
  try {
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const settingsData = settings || {
      site_name: 'CaravanWert',
      contact_email: 'kontakt@caravanwert.de',
    };

    // Get admin emails from admin_emails table or fall back to contact_email
    const { data: adminEmails } = await supabase
      .from('admin_emails')
      .select('email')
      .eq('is_active', true);

    const recipients: string[] = adminEmails?.map((e: any) => e.email) || [];
    if (recipients.length === 0) {
      recipients.push(settingsData.contact_email || 'kontakt@caravanwert.de');
    }

    const html = buildEmailLayout(settingsData, subject, content);

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not set, cannot send admin email');
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} System <info@caravanwert.de>`,
        to: recipients,
        subject: `[Admin] ${subject}`,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send admin email:', errorText);
    } else {
      console.log('Admin notification email sent to:', recipients.join(', '));
    }
  } catch (error) {
    console.error('Error sending admin email:', error);
  }
}

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

    // Track errors for admin summary
    const errors: string[] = [];

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

    const motorhomeName = `${auction.motorhome?.manufacturer || ''} ${auction.motorhome?.model || ''}`.trim();
    const auctionUrl = `https://caravanwert.de/auktion/${auctionId}`;

    // ─── If sold: Update motorhome, create invoice, generate contract, send emails ────
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
        errors.push(`Motorhome-Status-Update fehlgeschlagen: ${updateMotorhomeError.message}`);
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
      } catch (notifyError: any) {
        console.error('Error sending winner notification:', notifyError);
        errors.push(`Gewinner-Benachrichtigung fehlgeschlagen: ${notifyError.message}`);
      }

      // ─── INVOICE FLOW ─────────────────────────────────────────────
      let invoiceSuccess = false;
      let invoiceNumber = '';
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
        let pdfBase64: string | undefined;
        try {
          const { data: pdfResult, error: pdfError } = await supabase.functions.invoke('generate-invoice-pdf', {
            body: { invoiceId }
          });
          
          if (pdfError) {
            console.error('PDF generation error:', pdfError);
            errors.push(`Rechnungs-PDF-Generierung fehlgeschlagen: ${pdfError.message || 'Unbekannter Fehler'}`);
          } else {
            console.log('Invoice PDF generated:', pdfResult?.invoiceNumber);
            pdfBase64 = pdfResult?.pdfBase64;
            invoiceNumber = pdfResult?.invoiceNumber || '';
          }
        } catch (pdfError: any) {
          console.error('Error generating invoice PDF:', pdfError);
          errors.push(`Rechnungs-PDF-Generierung fehlgeschlagen: ${pdfError.message}`);
        }

        // Step 3: Send invoice email (with PDF attachment if available)
        try {
          const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-invoice-email', {
            body: { invoiceId, pdfBase64 }
          });
          
          if (emailError) {
            console.error('Invoice email error:', emailError);
            errors.push(`Rechnungs-E-Mail fehlgeschlagen: ${emailError.message || 'Unbekannter Fehler'}`);
          } else {
            console.log('Invoice email sent:', emailResult?.invoiceNumber, '→', emailResult?.sentTo);
            invoiceSuccess = true;
          }
        } catch (emailError: any) {
          console.error('Error sending invoice email:', emailError);
          errors.push(`Rechnungs-E-Mail fehlgeschlagen: ${emailError.message}`);
        }

        console.log('Invoice flow completed for auction:', auctionId);
        
      } catch (invoiceError: any) {
        console.error('Error in invoice flow:', invoiceError);
        errors.push(`Rechnungserstellung komplett fehlgeschlagen: ${invoiceError.message}`);
      }

      // ─── PURCHASE CONTRACT FLOW ───────────────────────────────────
      let contractSuccess = false;
      let contractNumber = '';
      let contractPdfBase64 = '';
      try {
        console.log('Generating purchase contract for auction:', auctionId);

        const { data: contractResult, error: contractError } = await supabase.functions.invoke('generate-purchase-contract', {
          body: {
            auctionId,
            motorhomeId: auction.motorhome.id,
            buyerId: soldTo,
            sellerId: auction.motorhome.seller_id,
            salePrice: Number(highestBid!.amount),
          },
        });

        if (contractError) {
          console.error('Purchase contract error:', contractError);
          errors.push(`Kaufvertrag-Generierung fehlgeschlagen: ${contractError.message || 'Unbekannter Fehler'}`);
        } else if (contractResult?.success) {
          contractSuccess = true;
          contractNumber = contractResult.contractNumber;
          contractPdfBase64 = contractResult.pdfBase64 || '';
          console.log('Purchase contract generated:', contractNumber);

          // Send contract to both parties via email
          const { data: sellerProfile } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('id', auction.motorhome.seller_id)
            .single();

          const { data: buyerProfile } = await supabase
            .from('profiles')
            .select('email, first_name, last_name, company_name')
            .eq('id', soldTo)
            .single();

          const { data: settings } = await supabase
            .from('site_settings')
            .select('*')
            .limit(1)
            .maybeSingle();

          const settingsData = settings || { site_name: 'CaravanWert', contact_email: 'kontakt@caravanwert.de' };

          // Send contract email to seller
          if (sellerProfile?.email && contractPdfBase64) {
            try {
              const sellerName = `${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`.trim() || 'Kunde';
              const contractEmailHtml = buildEmailLayout(settingsData, 'Ihr Kaufvertrag', `
                ${paragraph(`Hallo ${sellerName},`)}
                ${paragraph('Anbei erhalten Sie den Kaufvertrag für Ihr verkauftes Fahrzeug.')}
                ${infoBox('Vertragsdetails', `
                  ${detailRow('Vertragsnr.', contractNumber)}
                  ${detailRow('Fahrzeug', motorhomeName)}
                  ${detailRow('Kaufpreis', `€${Number(highestBid!.amount).toLocaleString()}`)}
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
                  html: contractEmailHtml,
                  attachments: [{
                    filename: `${contractNumber}.pdf`,
                    content: contractPdfBase64,
                  }],
                }),
              });
              console.log('Contract email sent to seller:', sellerProfile.email);
            } catch (e: any) {
              console.error('Error sending contract to seller:', e);
              errors.push(`Kaufvertrag-E-Mail an Verkäufer fehlgeschlagen: ${e.message}`);
            }
          }

          // Send contract email to buyer (dealer)
          if (buyerProfile?.email && contractPdfBase64) {
            try {
              const buyerName = buyerProfile.company_name || `${buyerProfile.first_name || ''} ${buyerProfile.last_name || ''}`.trim() || 'Händler';
              const contractEmailHtml = buildEmailLayout(settingsData, 'Kaufvertrag', `
                ${paragraph(`Sehr geehrte/r ${buyerName},`)}
                ${paragraph('Anbei erhalten Sie den Kaufvertrag für das ersteigerte Fahrzeug.')}
                ${infoBox('Vertragsdetails', `
                  ${detailRow('Vertragsnr.', contractNumber)}
                  ${detailRow('Fahrzeug', motorhomeName)}
                  ${detailRow('Kaufpreis', `€${Number(highestBid!.amount).toLocaleString()}`)}
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
                  html: contractEmailHtml,
                  attachments: [{
                    filename: `${contractNumber}.pdf`,
                    content: contractPdfBase64,
                  }],
                }),
              });
              console.log('Contract email sent to buyer:', buyerProfile.email);
            } catch (e: any) {
              console.error('Error sending contract to buyer:', e);
              errors.push(`Kaufvertrag-E-Mail an Käufer fehlgeschlagen: ${e.message}`);
            }
          }
        } else {
          errors.push(`Kaufvertrag-Generierung: Unerwartete Antwort`);
        }
      } catch (contractError: any) {
        console.error('Error in purchase contract flow:', contractError);
        errors.push(`Kaufvertrag komplett fehlgeschlagen: ${contractError.message}`);
      }

      // ─── ADMIN NOTIFICATION (SOLD) ────────────────────────────────
      const { data: winnerProfile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name, company_name')
        .eq('id', soldTo)
        .single();

      const winnerName = winnerProfile?.company_name || `${winnerProfile?.first_name || ''} ${winnerProfile?.last_name || ''}`.trim() || 'Unbekannt';

      let adminContent = `
        ${paragraph('<strong>Eine Auktion wurde erfolgreich abgeschlossen.</strong>')}
        ${infoBox('Auktionsergebnis', `
          ${detailRow('Status', '✅ VERKAUFT')}
          ${detailRow('Fahrzeug', motorhomeName)}
          ${detailRow('Zuschlagspreis', `€${Number(highestBid!.amount).toLocaleString()}`)}
          ${detailRow('Mindestgebot', auction.reserve_price ? `€${Number(auction.reserve_price).toLocaleString()}` : 'Keines')}
          ${detailRow('Anzahl Gebote', String(auction.bids?.length || 0))}
        `, 'success')}
        ${infoBox('Gewinner (Käufer)', `
          ${detailRow('Händler', winnerName)}
          ${detailRow('E-Mail', winnerProfile?.email || '–')}
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

      await sendAdminEmail(supabase, `Auktion verkauft: ${motorhomeName} für €${Number(highestBid!.amount).toLocaleString()}`, adminContent);
    }

    // ─── Notify losing bidders ───────────────────────────────────
    if (highestBid && auction.bids && auction.bids.length > 0) {
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

    // ─── Notify seller about auction end (FIXED: correct templates) ──
    if (auction.motorhome?.seller_id) {
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('email, first_name')
        .eq('id', auction.motorhome.seller_id)
        .single();

      if (sellerProfile?.email) {
        // Use correct seller-specific templates instead of dealer templates
        const sellerType = newStatus === 'sold' ? 'seller_sold' : 'seller_not_sold';
        supabase.functions.invoke('send-auction-notification', {
          body: {
            email: sellerProfile.email,
            name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
            type: sellerType,
            motorhomeModel: motorhomeName,
            auctionUrl: `https://caravanwert.de/dashboard`,
            currentBid: highestBid ? `€${Number(highestBid.amount).toLocaleString()}` : undefined,
          },
        }).catch((e: any) => console.error('Error sending seller end notification:', e));
      }
    }

    // ─── ADMIN NOTIFICATION (NOT SOLD) ──────────────────────────────
    if (newStatus === 'ended') {
      let adminContent = `
        ${paragraph('<strong>Eine Auktion ist ohne Verkauf beendet worden.</strong>')}
        ${infoBox('Auktionsergebnis', `
          ${detailRow('Status', '⚠️ NICHT VERKAUFT')}
          ${detailRow('Fahrzeug', motorhomeName)}
          ${detailRow('Mindestgebot', auction.reserve_price ? `€${Number(auction.reserve_price).toLocaleString()}` : 'Keines')}
          ${detailRow('Höchstes Gebot', highestBid ? `€${Number(highestBid.amount).toLocaleString()}` : 'Keine Gebote')}
          ${detailRow('Anzahl Gebote', String(auction.bids?.length || 0))}
        `, 'warning')}
        ${paragraph(highestBid 
          ? `Das Mindestgebot von €${Number(auction.reserve_price).toLocaleString()} wurde nicht erreicht. Das höchste Gebot lag bei €${Number(highestBid.amount).toLocaleString()}.`
          : 'Es wurden keine Gebote auf diese Auktion abgegeben.'
        )}
        ${paragraph('<strong>Empfohlene nächste Schritte:</strong><br>• Kontakt mit dem Verkäufer aufnehmen<br>• Mindestgebot anpassen und erneut einstellen<br>• Alternativ Direktverkauf anbieten')}
      `;
      adminContent += button('Im Admin-Dashboard ansehen', `https://caravanwert.de/admin/auctions`);

      await sendAdminEmail(supabase, `Auktion beendet ohne Verkauf: ${motorhomeName}`, adminContent);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        soldTo,
        amount: highestBid?.amount || null,
        errors: errors.length > 0 ? errors : undefined,
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
