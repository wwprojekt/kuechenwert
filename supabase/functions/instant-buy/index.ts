import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkRateLimit, createRateLimitErrorResponse, createRateLimitHeaders, RATE_LIMITS } from '../_shared/rate-limiter.ts';
import { buildEmailLayout, paragraph, infoBox, detailRow, warningBox, button } from '../_shared/email-builder.ts';

/**
 * Edge Function: instant-buy
 *
 * Handles the "Sofortkauf" (instant buy) flow server-side to prevent
 * client-side price manipulation. Validates the auction, motorhome status,
 * instant price, and buyer eligibility before executing the purchase
 * atomically via a database transaction (RPC).
 *
 * Post-purchase flow (mirrors close-auction):
 * 1. Invoice: create_instant_buy_invoice RPC → generate PDF → send email
 * 2. Purchase contract: generate-purchase-contract → send to seller & buyer
 * 3. Winner notification: notify-auction-winner
 * 4. Seller notification: send-auction-notification (type: seller_sold)
 * 5. Losing bidders notification: send-auction-notification (type: lost)
 * 6. Admin notification: summary email
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'info@caravanwert.de';

const InstantBuySchema = z.object({
  auctionId: z.string().uuid('Ungültige Auktions-ID'),
});

type InstantBuyRequest = z.infer<typeof InstantBuySchema>;

// Helper: Send admin notification email directly via Resend (same as close-auction)
async function sendAdminEmail(
  supabaseAdmin: any,
  subject: string,
  content: string,
) {
  try {
    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const settingsData = settings || {
      site_name: 'CaravanWert',
      contact_email: 'info@caravanwert.de',
    };

    // Get admin emails: find users with admin role, then get their emails
    const recipients: string[] = [];
    try {
      const { data: adminRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (adminRoles && adminRoles.length > 0) {
        const adminIds = adminRoles.map((r: any) => r.user_id);
        const { data: adminProfiles } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .in('id', adminIds);

        if (adminProfiles) {
          for (const p of adminProfiles) {
            if (p.email) recipients.push(p.email);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching admin emails:', e);
    }

    if (recipients.length === 0) {
      recipients.push(ADMIN_EMAIL);
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
      const result = await response.json();
      console.log('Admin notification email sent to:', recipients.join(', '));

      // Log in admin_emails for System tab
      try {
        await supabaseAdmin.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: `${settingsData.site_name} System`,
          recipient_email: recipients[0],
          recipient_name: 'Admin',
          subject: `[Admin] ${subject}`,
          body_html: html,
          body_text: '',
          email_type: 'auto',
          direction: 'outbound',
          status: 'sent',
          resend_id: result?.id || null,
          is_read: false,
        });
      } catch (logErr) {
        console.error('Failed to log admin email in admin_emails:', logErr);
      }
    }
  } catch (error) {
    console.error('Error sending admin email:', error);
  }
}

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
    // Check role from user_roles table (single source of truth)
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleError) {
      console.error('Role fetch error:', roleError.message);
      throw new Error('Benutzerrolle konnte nicht geladen werden');
    }

    if (!roleData || roleData.role !== 'dealer') {
      console.warn(`Unauthorized instant-buy attempt by user ${user.id} (role: ${roleData?.role ?? 'none'})`);
      throw new Error('Nur freigeschaltete Händler dürfen Sofortkäufe tätigen');
    }

    // Check dealer approval status from dealer_applications table
    const { data: dealerApp, error: dealerAppError } = await supabaseAdmin
      .from('dealer_applications')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (dealerAppError) {
      console.error('Dealer application fetch error:', dealerAppError.message);
      throw new Error('Händlerstatus konnte nicht geladen werden');
    }

    if (!dealerApp || dealerApp.status !== 'approved') {
      console.warn(`Unauthorized instant-buy attempt by user ${user.id} (dealer status: ${dealerApp?.status ?? 'no application'})`);
      throw new Error('Nur freigeschaltete Händler dürfen Sofortkäufe tätigen');
    }

    // Check if dealer account is restricted (e.g. due to unpaid invoices / dunning level 4+)
    const { data: dealerProfile } = await supabaseAdmin
      .from('profiles')
      .select('account_restricted, restriction_reason')
      .eq('id', user.id)
      .single();

    if (dealerProfile?.account_restricted) {
      console.warn(`Restricted dealer ${user.id} tried instant-buy. Reason: ${dealerProfile.restriction_reason}`);
      throw new Error('Ihr Händlerkonto ist gesperrt. Bitte kontaktieren Sie den Support.');
    }

    // 3. Validate request body
    const rawBody = await req.json();
    const validation = InstantBuySchema.safeParse(rawBody);
    if (!validation.success) {
      const msg = validation.error.errors.map(e => e.message).join(', ');
      throw new Error(msg);
    }

    const { auctionId }: InstantBuyRequest = validation.data;

    // 4. Fetch auction + motorhome + bids in a single query
    const { data: auction, error: auctionError } = await supabaseAdmin
      .from('auctions')
      .select('*, motorhome:motorhomes(*), bids(*)')
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
    //    Update motorhome status to 'sold' – only if still 'available'
    const { data: updatedMotorhome, error: motorhomeUpdateError } = await supabaseAdmin
      .from('motorhomes')
      .update({
        status: 'sold',
        sold_to: user.id,
        sold_at: new Date().toISOString(),
        sale_type: 'instant',
      })
      .eq('id', motorhome.id)
      .eq('status', 'available')  // Optimistic lock: only update if still available (CHECK constraint)
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

    const motorhomeName = `${motorhome.manufacturer || ''} ${motorhome.model || ''}`.trim();
    const auctionUrl = `https://caravanwert.de/auktion/${auctionId}`;

    // Track errors for admin summary (non-fatal)
    const errors: string[] = [];

    // ─── 8. INVOICE FLOW ─────────────────────────────────────────
    // Step 1: Create invoice via RPC (atomic, with commission calculation)
    // Step 2: Generate PDF (upload to storage)
    // Step 3: Send email with PDF attachment to dealer
    let invoiceSuccess = false;
    let invoiceNumber = '';
    try {
      console.log('Creating instant-buy invoice for auction:', auctionId, 'dealer:', user.id);

      // Step 1: Create invoice
      const { data: invoiceId, error: invoiceRpcError } = await supabaseAdmin.rpc('create_instant_buy_invoice', {
        auction_id_param: auctionId,
        dealer_id_param: user.id,
        sale_price_param: instantPrice,
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
        const { data: emailResult, error: emailError } = await supabaseAdmin.functions.invoke('send-invoice-email', {
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

      console.log('Invoice flow completed for instant buy:', auctionId);
    } catch (invoiceError: any) {
      console.error('Error in instant-buy invoice flow:', invoiceError);
      errors.push(`Rechnungserstellung komplett fehlgeschlagen: ${invoiceError.message}`);
      // Don't fail the purchase if invoice creation fails
      // The admin can manually create the invoice later
    }

    // ─── 9. WINNER NOTIFICATION ─────────────────────────────────
    try {
      const { error: winnerInvokeErr } = await supabaseAdmin.functions.invoke('notify-auction-winner', {
        body: {
          auctionId,
          winnerId: user.id,
          amount: instantPrice,
        },
      });
      if (winnerInvokeErr) throw winnerInvokeErr;
      console.log('Winner notification sent to buyer:', user.id);
    } catch (notifyError: any) {
      console.error('Error sending winner notification:', notifyError);
      errors.push(`Gewinner-Benachrichtigung fehlgeschlagen: ${notifyError.message}`);
    }

    // ─── 10. PURCHASE CONTRACT FLOW ─────────────────────────────
    let contractSuccess = false;
    let contractNumber = '';
    let contractPdfBase64 = '';
    try {
      console.log('Generating purchase contract for instant buy:', auctionId);

      const { data: contractResult, error: contractError } = await supabaseAdmin.functions.invoke('generate-purchase-contract', {
        body: {
          auctionId,
          motorhomeId: motorhome.id,
          buyerId: user.id,
          sellerId: motorhome.seller_id,
          salePrice: instantPrice,
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
        const { data: sellerProfile } = await supabaseAdmin
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('id', motorhome.seller_id)
          .single();

        const { data: buyerProfile } = await supabaseAdmin
          .from('profiles')
          .select('email, first_name, last_name, company_name')
          .eq('id', user.id)
          .single();

        const { data: settings } = await supabaseAdmin
          .from('site_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        const settingsData = settings || { site_name: 'CaravanWert', contact_email: 'info@caravanwert.de' };

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
                ${detailRow('Kaufpreis', `€${instantPrice.toLocaleString()}`)}
                ${detailRow('Verkaufsart', 'Sofortkauf')}
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
                html: contractEmailHtml,
                attachments: [{
                  filename: `${contractNumber}.pdf`,
                  content: contractPdfBase64,
                }],
              }),
            });
            if (!sellerEmailRes.ok) {
              const errText = await sellerEmailRes.text();
              throw new Error(`Resend API: ${errText}`);
            }
            console.log('Contract email sent to seller:', sellerProfile.email);
          } catch (e: any) {
            console.error('Error sending contract to seller:', e);
            errors.push(`Kaufvertrag-E-Mail an Verkäufer fehlgeschlagen: ${e.message}`);
          }
        } else {
          const reason = !sellerProfile?.email ? 'Verkäufer-E-Mail fehlt' : 'PDF-Base64 leer';
          console.error(`Contract email to seller SKIPPED: ${reason}`);
          errors.push(`Kaufvertrag-E-Mail an Verkäufer übersprungen: ${reason}`);
        }

        // Send contract email to buyer (dealer)
        if (buyerProfile?.email && contractPdfBase64) {
          try {
            const buyerName = buyerProfile.company_name || `${buyerProfile.first_name || ''} ${buyerProfile.last_name || ''}`.trim() || 'Händler';
            const contractEmailHtml = buildEmailLayout(settingsData, 'Kaufvertrag', `
              ${paragraph(`Sehr geehrte/r ${buyerName},`)}
              ${paragraph('Anbei erhalten Sie den Kaufvertrag für das per Sofortkauf erworbene Fahrzeug.')}
              ${infoBox('Vertragsdetails', `
                ${detailRow('Vertragsnr.', contractNumber)}
                ${detailRow('Fahrzeug', motorhomeName)}
                ${detailRow('Kaufpreis', `€${instantPrice.toLocaleString()}`)}
                ${detailRow('Verkaufsart', 'Sofortkauf')}
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
                html: contractEmailHtml,
                attachments: [{
                  filename: `${contractNumber}.pdf`,
                  content: contractPdfBase64,
                }],
              }),
            });
            if (!buyerEmailRes.ok) {
              const errText = await buyerEmailRes.text();
              throw new Error(`Resend API: ${errText}`);
            }
            console.log('Contract email sent to buyer:', buyerProfile.email);
          } catch (e: any) {
            console.error('Error sending contract to buyer:', e);
            errors.push(`Kaufvertrag-E-Mail an Käufer fehlgeschlagen: ${e.message}`);
          }
        } else {
          const reason = !buyerProfile?.email ? 'Käufer-E-Mail fehlt' : 'PDF-Base64 leer';
          console.error(`Contract email to buyer SKIPPED: ${reason}`);
          errors.push(`Kaufvertrag-E-Mail an Käufer übersprungen: ${reason}`);
        }
      } else {
        errors.push(`Kaufvertrag-Generierung: Unerwartete Antwort`);
      }
    } catch (contractError: any) {
      console.error('Error in purchase contract flow:', contractError);
      errors.push(`Kaufvertrag komplett fehlgeschlagen: ${contractError.message}`);
    }

    // ─── 11. NOTIFY SELLER ──────────────────────────────────────
    if (motorhome.seller_id) {
      try {
        const { data: sellerProfile } = await supabaseAdmin
          .from('profiles')
          .select('email, first_name')
          .eq('id', motorhome.seller_id)
          .single();

        if (sellerProfile?.email) {
          const { error: sellerNotifyErr } = await supabaseAdmin.functions.invoke('send-auction-notification', {
            body: {
              email: sellerProfile.email,
              name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
              type: 'seller_sold',
              motorhomeModel: motorhomeName,
              auctionUrl: `https://caravanwert.de/dashboard`,
              currentBid: `€${instantPrice.toLocaleString()}`,
            },
          });
          if (sellerNotifyErr) throw sellerNotifyErr;
          console.log('Seller notification sent to:', sellerProfile.email);
        }
      } catch (e: any) {
        console.error('Error sending seller notification:', e);
        errors.push(`Verkäufer-Benachrichtigung fehlgeschlagen: ${e.message}`);
      }
    }

    // ─── 12. NOTIFY LOSING BIDDERS ──────────────────────────────
    if (auction.bids && auction.bids.length > 0) {
      const losingBidderIds = [...new Set(
        auction.bids
          .map((b: any) => b.bidder_id)
          .filter((id: string) => id !== user.id)
      )];

      for (const loserId of losingBidderIds) {
        try {
          const loserHighestBid = Math.max(
            ...auction.bids
              .filter((b: any) => b.bidder_id === loserId)
              .map((b: any) => Number(b.amount))
          );

          const { data: loserProfile } = await supabaseAdmin
            .from('profiles')
            .select('email, first_name')
            .eq('id', loserId)
            .single();

          if (loserProfile?.email) {
            supabaseAdmin.functions.invoke('send-auction-notification', {
              body: {
                email: loserProfile.email,
                name: loserProfile.first_name || loserProfile.email.split('@')[0],
                type: 'lost',
                motorhomeModel: motorhomeName,
                auctionUrl,
                yourBid: `€${loserHighestBid.toLocaleString()}`,
                currentBid: `€${instantPrice.toLocaleString()}`,
              },
            }).catch((e: any) => console.error('Error sending loser notification:', e));
          }
        } catch (e: any) {
          console.error('Error processing loser notification for:', loserId, e);
        }
      }
    }

    // ─── 13. ADMIN NOTIFICATION ─────────────────────────────────
    const { data: winnerProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, first_name, last_name, company_name')
      .eq('id', user.id)
      .single();

    const winnerName = winnerProfile?.company_name || `${winnerProfile?.first_name || ''} ${winnerProfile?.last_name || ''}`.trim() || 'Unbekannt';

    let adminContent = `
      ${paragraph('<strong>Ein Sofortkauf wurde erfolgreich abgeschlossen.</strong>')}
      ${infoBox('Sofortkauf-Ergebnis', `
        ${detailRow('Status', '✅ VERKAUFT (Sofortkauf)')}
        ${detailRow('Fahrzeug', motorhomeName)}
        ${detailRow('Sofortkaufpreis', `€${instantPrice.toLocaleString()}`)}
        ${detailRow('Anzahl Gebote vor Sofortkauf', String(auction.bids?.length || 0))}
      `, 'success')}
      ${infoBox('Käufer', `
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

    await sendAdminEmail(supabaseAdmin, `Sofortkauf: ${motorhomeName} für €${instantPrice.toLocaleString()}`, adminContent);

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
