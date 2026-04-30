import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import { buildEmailLayout, paragraph, infoBox, detailRow, warningBox, button } from '../_shared/email-builder.ts';
import { uploadSaleConversionToGoogleAds } from '../_shared/gads-sale-conversion.ts';
import { uploadSaleConversionToBingAds } from '../_shared/bing-sale-conversion.ts';
import { sendContractSentNotification } from '../_shared/contract-notification.ts';
import { sendBlankHandoverProtocol } from '../_shared/sendBlankHandoverProtocol.ts';
import { invokeWithRetry } from '../_shared/invoke-with-retry.ts';

/**
 * Edge Function: admin-sell-to-dealer
 *
 * ADMIN-ONLY: Lets an admin manually sell a running auction to a dealer at a
 * freely chosen sale price, mirroring the instant-buy flow exactly. Used
 * when a deal is negotiated outside the platform but the auction is still
 * active or in kaufchance phase and we want all downstream artefacts
 * (invoice, contract, emails, dealer dashboard, etc.) to be created the
 * same way as a normal instant buy.
 *
 * Differences vs. instant-buy:
 *   - Auth: checkServiceRoleOrAdmin (admin JWT or service-role) instead of
 *     dealer-JWT
 *   - Buyer: explicit `buyerId` from body (re-validated as approved dealer)
 *   - Sale price: explicit `salePrice` from body (admin override; can be
 *     below the current highest bid – we trust the admin)
 *   - Auction may be in 'active', 'kaufchance', 'draft', 'ended' OR
 *     'cancelled' status (admin needs to be able to finalise off-platform
 *     deals regardless of where the auction lifecycle currently stands)
 *   - End-time is NOT enforced (admin may finalise even if auction "ended")
 *
 * Everything after the DB writes (invoice, PDF, emails, contract, losing
 * bidder notifications, admin summary, Google Ads conversion) is identical
 * to instant-buy so the resulting state is indistinguishable from a normal
 * Sofortkauf for every downstream system.
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'info@kuechenwert24.de';

const RequestSchema = z.object({
  auctionId: z.string().uuid('Ungültige Auktions-ID'),
  buyerId: z.string().uuid('Ungültige Händler-ID'),
  salePrice: z.number().positive('Verkaufspreis muss > 0 sein').max(9_999_999, 'Verkaufspreis unrealistisch hoch'),
});

type RequestPayload = z.infer<typeof RequestSchema>;

// Helper: send admin summary mail directly via Resend (mirrors instant-buy)
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
      site_name: 'KuechenWert',
      contact_email: 'info@kuechenwert24.de',
    };

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
        from: `${settingsData.site_name} System <info@kuechenwert24.de>`,
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

      try {
        await supabaseAdmin.from('admin_emails').insert({
          sender_email: 'info@kuechenwert24.de',
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

  const corsHeaders = getCorsHeaders(req);

  try {
    // 1. Auth: admin or service-role only
    const authResult = await checkServiceRoleOrAdmin(req, corsHeaders);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // 1b. Best-effort identification of the calling admin (for the audit
    // summary email). Service-role calls have no user; that is fine.
    let adminUserId: string | null = null;
    let adminDisplayName = 'System';
    try {
      const authHeader = req.headers.get('authorization') ?? '';
      const token = authHeader.replace('Bearer ', '').trim();
      if (token && token !== (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')) {
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user) {
          adminUserId = user.id;
          const { data: adminProfile } = await supabaseAdmin
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', user.id)
            .maybeSingle();
          adminDisplayName =
            `${adminProfile?.first_name ?? ''} ${adminProfile?.last_name ?? ''}`.trim() ||
            adminProfile?.email ||
            'Admin';
        }
      }
    } catch (e) {
      console.warn('Could not resolve admin identity (non-fatal):', e);
    }

    // 2. Validate request body
    const rawBody = await req.json();
    const validation = RequestSchema.safeParse(rawBody);
    if (!validation.success) {
      const msg = validation.error.errors.map((e) => e.message).join(', ');
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { auctionId, buyerId, salePrice }: RequestPayload = validation.data;

    // 3. Load auction + kitchen + bids
    const { data: auction, error: auctionError } = await supabaseAdmin
      .from('auctions')
      .select('*, kitchen:kitchens(*), bids(*)')
      .eq('id', auctionId)
      .single();

    if (auctionError || !auction) {
      return new Response(JSON.stringify({ error: 'Auktion nicht gefunden' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const kitchen = auction.kitchen;
    if (!kitchen) {
      return new Response(JSON.stringify({ error: 'Wohnmobil nicht gefunden' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Server-side validations
    // 4a. Auction must still be sellable. Allowed status set covers every
    //     state where the vehicle is NOT yet finalised as sold:
    //       - active     → normale Live-Auktion
    //       - kaufchance → Auktion in Nachverhandlungs-Phase
    //       - draft      → Inserat noch nicht veröffentlicht
    //       - ended      → Auktion lief aus (kein Zuschlag) — kann nachträglich verkauft werden
    //       - cancelled  → Auktion wurde abgebrochen (z. B. Stornierung) — Reaktivierung als Verkauf möglich
    //     Status 'sold' wird hier (und beim Kitchen-Check unten) explizit ausgeschlossen.
    const SELLABLE_AUCTION_STATUSES = ['active', 'kaufchance', 'draft', 'ended', 'cancelled'] as const;
    if (!SELLABLE_AUCTION_STATUSES.includes(auction.status as typeof SELLABLE_AUCTION_STATUSES[number])) {
      return new Response(
        JSON.stringify({
          error: `Manueller Verkauf nicht m\u00f6glich \u2013 Auktion bereits abgeschlossen (Status: ${auction.status})`,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4b. Kitchen must not already be sold.
    //
    // Idempotency note: If the kitchen is already sold to the SAME buyer at
    // the SAME price, the caller is almost certainly retrying after a
    // half-failed sell (e.g. Edge Function gateway returned non-2xx during
    // downstream invoicing/contract/email steps but the DB writes in step 5
    // succeeded). Instead of hard-erroring with 409 — which left operators
    // without any recovery path — we return a structured 409 hint telling the
    // caller to use the dedicated repair flow (`admin-repair-sale-artefacts`).
    // We intentionally do NOT re-run the parent flow here because it consumes
    // optimistic locks (place_bid_atomic / kitchen.updated_at) that are
    // already resolved for a sold vehicle.
    if (kitchen.status === 'sold') {
      const alreadySameBuyer = kitchen.sold_to === buyerId;
      return new Response(
        JSON.stringify({
          error: 'Dieses Wohnmobil wurde bereits verkauft',
          code: 'ALREADY_SOLD',
          alreadySoldTo: kitchen.sold_to,
          sameBuyer: alreadySameBuyer,
          hint: alreadySameBuyer
            ? 'Nutzen Sie den "Verkauf reparieren"-Button, um fehlende Artefakte (Vertrag, Rechnung, E-Mails) nachzureichen.'
            : 'Das Wohnmobil wurde an einen anderen Käufer verkauft. Eine erneute Verkaufsabwicklung ist nicht möglich.',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4c. Buyer must be an approved dealer (use array query: a user can have
    // multiple roles, e.g. admin + dealer — maybeSingle() would 406 here)
    const { data: buyerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', buyerId);

    const isDealer = Array.isArray(buyerRoles) && buyerRoles.some((r: { role: string }) => r.role === 'dealer');
    if (!isDealer) {
      return new Response(
        JSON.stringify({ error: 'Der ausgew\u00e4hlte Nutzer ist kein H\u00e4ndler' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: buyerApp } = await supabaseAdmin
      .from('dealer_applications')
      .select('status')
      .eq('user_id', buyerId)
      .maybeSingle();

    if (!buyerApp || buyerApp.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Der ausgew\u00e4hlte H\u00e4ndler ist nicht freigeschaltet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4d. Buyer must not be the seller
    if (kitchen.seller_id && kitchen.seller_id === buyerId) {
      return new Response(
        JSON.stringify({ error: 'Der H\u00e4ndler kann nicht sein eigenes Fahrzeug kaufen' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4e. Soft-warn (logged only) if buyer's dealer account is restricted
    const { data: buyerProfileGuard } = await supabaseAdmin
      .from('profiles')
      .select('account_restricted, restriction_reason')
      .eq('id', buyerId)
      .maybeSingle();
    if (buyerProfileGuard?.account_restricted) {
      console.warn(
        `[admin-sell-to-dealer] Admin override: selling to restricted dealer ${buyerId} (reason: ${buyerProfileGuard.restriction_reason})`,
      );
    }

    // 5. Atomic-ish DB writes (mirror instant-buy step 6/7)

    // 5a. Update kitchen with optimistic lock. Allowed pre-states map to
    //     the auction statuses we now accept (sync_kitchen_status_from_auction
    //     trigger maps active/kaufchance→active, ended/cancelled→not_sold,
    //     draft→ no sync, kitchen stays 'available').
    //     'sold' / 'reserved' / 'pending' are intentionally excluded so we
    //     never re-sell something that already has a buyer attached.
    const { data: updatedKitchen, error: kitchenUpdateError } = await supabaseAdmin
      .from('kitchens')
      .update({
        status: 'sold',
        sold_to: buyerId,
        sold_at: new Date().toISOString(),
        sale_type: 'instant', // ensures notify-auction-winner uses Sofortkauf wording + downstream filters treat it as instant buy
      })
      .eq('id', kitchen.id)
      .in('status', ['available', 'active', 'not_sold'])
      .select()
      .single();

    if (kitchenUpdateError || !updatedKitchen) {
      return new Response(
        JSON.stringify({
          error:
            'Verkauf konnte nicht abgeschlossen werden \u2013 das Wohnmobil wurde m\u00f6glicherweise bereits verkauft',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 5b. Close auction + record sale price. Optimistic lock guards against
    //     a concurrent transition to 'sold' between our load and write.
    //     We allow ALL sellable statuses here so admin-sales from draft /
    //     ended / cancelled also close cleanly.
    const { error: auctionUpdateError } = await supabaseAdmin
      .from('auctions')
      .update({ status: 'sold', current_bid: salePrice })
      .eq('id', auctionId)
      .in('status', SELLABLE_AUCTION_STATUSES as unknown as string[]);

    if (auctionUpdateError) {
      console.error('Error closing auction after admin manual sale:', auctionUpdateError);
    }

    // 5c. Expire pending price proposals + capture proposers for notify
    const { data: expiredOffers } = await supabaseAdmin
      .from('post_auction_offers')
      .select('buyer_id, offer_amount')
      .eq('auction_id', auctionId)
      .in('status', ['pending', 'countered']);

    const { error: expireOffersErr } = await supabaseAdmin
      .from('post_auction_offers')
      .update({
        status: 'expired',
        seller_response: 'Fahrzeug wurde manuell durch Admin an einen H\u00e4ndler verkauft',
        updated_at: new Date().toISOString(),
      })
      .eq('auction_id', auctionId)
      .in('status', ['pending', 'countered']);
    if (expireOffersErr) console.error('Failed to expire offers after admin manual sale:', expireOffersErr);

    console.log(
      `Admin manual sale completed: auction=${auctionId}, kitchen=${kitchen.id}, ` +
        `buyer=${buyerId}, price=${salePrice}, admin=${adminUserId ?? 'service-role'}`,
    );

    const kitchenName = `${kitchen.manufacturer || ''} ${kitchen.model || ''}`.trim();
    const auctionUrl = `https://kuechenwert24.de/auktion/${auctionId}`;

    // Track non-fatal errors for the admin summary
    const errors: string[] = [];

    // ─── 6. INVOICE FLOW ─────────────────────────────────────────
    let invoiceSuccess = false;
    let invoiceNumber = '';
    try {
      console.log('Creating instant-buy invoice (admin manual sale) for auction:', auctionId, 'dealer:', buyerId);

      const { data: invoiceId, error: invoiceRpcError } = await supabaseAdmin.rpc('create_instant_buy_invoice', {
        auction_id_param: auctionId,
        dealer_id_param: buyerId,
        sale_price_param: salePrice,
      });

      if (invoiceRpcError) {
        console.error('Invoice RPC error:', invoiceRpcError);
        throw invoiceRpcError;
      }
      if (!invoiceId) {
        throw new Error('Invoice creation returned no ID');
      }

      let pdfBase64: string | undefined;
      try {
        const { data: pdfResult, error: pdfError, attempts } = await invokeWithRetry<{ pdfBase64?: string; invoiceNumber?: string }>(
          supabaseAdmin,
          'generate-invoice-pdf',
          { invoiceId },
          { label: 'generate-invoice-pdf' },
        );
        if (pdfError) {
          console.error(`PDF generation error after ${attempts} attempt(s):`, pdfError);
          errors.push(`Rechnungs-PDF-Generierung fehlgeschlagen nach ${attempts} Versuch(en): ${pdfError.message || 'Unbekannter Fehler'}`);
        } else {
          pdfBase64 = pdfResult?.pdfBase64;
          invoiceNumber = pdfResult?.invoiceNumber || '';
        }
      } catch (pdfError: any) {
        console.error('Error generating invoice PDF:', pdfError);
        errors.push(`Rechnungs-PDF-Generierung fehlgeschlagen: ${pdfError.message}`);
      }

      try {
        const { data: emailResult, error: emailError, attempts } = await invokeWithRetry<{ invoiceNumber?: string; sentTo?: string }>(
          supabaseAdmin,
          'send-invoice-email',
          { invoiceId, pdfBase64 },
          { label: 'send-invoice-email' },
        );
        if (emailError) {
          console.error(`Invoice email error after ${attempts} attempt(s):`, emailError);
          errors.push(`Rechnungs-E-Mail fehlgeschlagen nach ${attempts} Versuch(en): ${emailError.message || 'Unbekannter Fehler'}`);
        } else {
          console.log('Invoice email sent:', emailResult?.invoiceNumber, '\u2192', emailResult?.sentTo);
          invoiceSuccess = true;
        }
      } catch (emailError: any) {
        console.error('Error sending invoice email:', emailError);
        errors.push(`Rechnungs-E-Mail fehlgeschlagen: ${emailError.message}`);
      }
    } catch (invoiceError: any) {
      console.error('Error in admin manual sale invoice flow:', invoiceError);
      errors.push(`Rechnungserstellung komplett fehlgeschlagen: ${invoiceError.message}`);
    }

    // ─── 6b. GOOGLE + BING ADS SALE CONVERSION (only after invoice confirmed) ──
    if (invoiceSuccess) {
      const saleResult = await uploadSaleConversionToGoogleAds({
        supabase: supabaseAdmin,
        source: 'admin-sell-to-dealer',
        auctionId,
        kitchenId: kitchen.id,
        sellerId: kitchen.seller_id,
        dealerId: buyerId,
        saleAmount: salePrice,
        clickIds: {
          gclid: kitchen.gclid,
          gbraid: kitchen.gbraid,
          wbraid: kitchen.wbraid,
          msclkid: kitchen.msclkid,
        },
      });
      if (saleResult.attempted && !saleResult.success) {
        errors.push(`Google Ads Sale-Conversion: ${saleResult.error || 'Unbekannter Fehler'}`);
      }

      // Phase 2: Bing Ads server-side Offline Conversion (parallel zu Google).
      // Skipt sauber wenn msclkid oder Secrets fehlen — wirft NIE in den Sale-Flow.
      const bingResult = await uploadSaleConversionToBingAds({
        supabase: supabaseAdmin,
        source: 'admin-sell-to-dealer',
        auctionId,
        kitchenId: kitchen.id,
        kitchenCreatedAt: kitchen.created_at,
        sellerId: kitchen.seller_id,
        dealerId: buyerId,
        saleAmount: salePrice,
        clickIds: {
          msclkid: kitchen.msclkid,
        },
      });
      if (bingResult.attempted && !bingResult.success) {
        errors.push(`Bing Ads Sale-Conversion: ${bingResult.error || 'Unbekannter Fehler'}`);
      }
    } else {
      console.log('[admin-sell-to-dealer] Invoice not created successfully, skipping Google + Bing Ads sale conversions');
    }

    // ─── 7. WINNER NOTIFICATION ──────────────────────────────────
    try {
      const { error: winnerInvokeErr, attempts: winnerAttempts } = await invokeWithRetry(
        supabaseAdmin,
        'notify-auction-winner',
        { auctionId, winnerId: buyerId, amount: salePrice },
        { label: 'notify-auction-winner' },
      );
      if (winnerInvokeErr) throw new Error(`${winnerInvokeErr.message} (after ${winnerAttempts} attempts)`);
      console.log('Winner notification sent to buyer:', buyerId);
    } catch (notifyError: any) {
      console.error('Error sending winner notification:', notifyError);
      errors.push(`Gewinner-Benachrichtigung fehlgeschlagen: ${notifyError.message}`);
    }

    // ─── 8. PURCHASE CONTRACT FLOW ───────────────────────────────
    let contractSuccess = false;
    let contractNumber = '';
    let contractPdfBase64 = '';
    try {
      const { data: contractResult, error: contractError, attempts: contractAttempts } = await invokeWithRetry<{
        success?: boolean;
        contractNumber?: string;
        contractUrl?: string;
        buyerContractUrl?: string;
        pdfBase64?: string;
      }>(
        supabaseAdmin,
        'generate-purchase-contract',
        {
          auctionId,
          kitchenId: kitchen.id,
          buyerId,
          sellerId: kitchen.seller_id,
          salePrice,
        },
        { label: 'generate-purchase-contract' },
      );

      if (contractError) {
        console.error(`Purchase contract error after ${contractAttempts} attempt(s):`, contractError);
        errors.push(`Kaufvertrag-Generierung fehlgeschlagen nach ${contractAttempts} Versuch(en): ${contractError.message || 'Unbekannter Fehler'}`);
      } else if (contractResult?.success) {
        contractSuccess = true;
        contractNumber = contractResult.contractNumber;
        contractPdfBase64 = contractResult.pdfBase64 || '';
        const sellerContractUrl: string = contractResult.contractUrl || '';
        const buyerContractUrl: string = contractResult.buyerContractUrl || contractResult.contractUrl || '';

        const { data: sellerProfile } = await supabaseAdmin
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('id', kitchen.seller_id)
          .single();

        const { data: buyerProfile } = await supabaseAdmin
          .from('profiles')
          .select('email, first_name, last_name, company_name')
          .eq('id', buyerId)
          .single();

        const { data: settings } = await supabaseAdmin
          .from('site_settings')
          .select('*')
          .limit(1)
          .maybeSingle();
        const settingsData = settings || { site_name: 'KuechenWert', contact_email: 'info@kuechenwert24.de' };

        // Send contract email to seller
        if (sellerProfile?.email && contractPdfBase64) {
          try {
            const sellerName = `${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`.trim() || 'Kunde';
            const contractEmailHtml = buildEmailLayout(settingsData, 'Ihr Kaufvertrag', `
              ${paragraph(`Hallo ${sellerName},`)}
              ${paragraph('Anbei erhalten Sie den Kaufvertrag für Ihr verkauftes Fahrzeug.')}
              ${infoBox('Vertragsdetails', `
                ${detailRow('Vertragsnr.', contractNumber)}
                ${detailRow('Fahrzeug', kitchenName)}
                ${detailRow('Kaufpreis', `€${salePrice.toLocaleString()}`)}
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
                from: `${settingsData.site_name} <info@kuechenwert24.de>`,
                to: [sellerProfile.email],
                subject: `Kaufvertrag ${contractNumber} – ${kitchenName}`,
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
            const sellerResendResult = await sellerEmailRes.json();

            try {
              await supabaseAdmin.from('admin_emails').insert({
                sender_email: 'info@kuechenwert24.de',
                sender_name: settingsData.site_name,
                recipient_email: sellerProfile.email,
                recipient_name: sellerName,
                subject: `Kaufvertrag ${contractNumber} – ${kitchenName}`,
                body_html: contractEmailHtml,
                body_text: '',
                email_type: 'purchase_contract',
                direction: 'outbound',
                status: 'sent',
                resend_id: sellerResendResult?.id || null,
                is_read: false,
              });
            } catch (logErr) {
              console.error('Failed to log seller contract email:', logErr);
            }

            if (RESEND_API_KEY && sellerContractUrl) {
              await sendContractSentNotification({
                resendApiKey: RESEND_API_KEY,
                supabase: supabaseAdmin,
                settingsData,
                recipientEmail: sellerProfile.email,
                recipientName: sellerName,
                contractNumber,
                vehicleName: kitchenName,
                salePrice,
                downloadUrl: sellerContractUrl,
                party: 'seller',
              });
            }
          } catch (e: any) {
            console.error('Error sending contract to seller:', e);
            errors.push(`Kaufvertrag-E-Mail an Verk\u00e4ufer fehlgeschlagen: ${e.message}`);
          }
        } else {
          const reason = !sellerProfile?.email ? 'Verk\u00e4ufer-E-Mail fehlt' : 'PDF-Base64 leer';
          errors.push(`Kaufvertrag-E-Mail an Verk\u00e4ufer \u00fcbersprungen: ${reason}`);
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
                ${detailRow('Fahrzeug', kitchenName)}
                ${detailRow('Kaufpreis', `€${salePrice.toLocaleString()}`)}
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
                from: `${settingsData.site_name} <info@kuechenwert24.de>`,
                to: [buyerProfile.email],
                subject: `Kaufvertrag ${contractNumber} – ${kitchenName}`,
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
            const buyerResendResult = await buyerEmailRes.json();

            try {
              await supabaseAdmin.from('admin_emails').insert({
                sender_email: 'info@kuechenwert24.de',
                sender_name: settingsData.site_name,
                recipient_email: buyerProfile.email,
                recipient_name: buyerName,
                subject: `Kaufvertrag ${contractNumber} – ${kitchenName}`,
                body_html: contractEmailHtml,
                body_text: '',
                email_type: 'purchase_contract',
                direction: 'outbound',
                status: 'sent',
                resend_id: buyerResendResult?.id || null,
                is_read: false,
              });
            } catch (logErr) {
              console.error('Failed to log buyer contract email:', logErr);
            }

            if (RESEND_API_KEY && buyerContractUrl) {
              await sendContractSentNotification({
                resendApiKey: RESEND_API_KEY,
                supabase: supabaseAdmin,
                settingsData,
                recipientEmail: buyerProfile.email,
                recipientName: buyerName,
                contractNumber,
                vehicleName: kitchenName,
                salePrice,
                downloadUrl: buyerContractUrl,
                party: 'buyer',
              });
            }
          } catch (e: any) {
            console.error('Error sending contract to buyer:', e);
            errors.push(`Kaufvertrag-E-Mail an K\u00e4ufer fehlgeschlagen: ${e.message}`);
          }
        } else {
          const reason = !buyerProfile?.email ? 'K\u00e4ufer-E-Mail fehlt' : 'PDF-Base64 leer';
          errors.push(`Kaufvertrag-E-Mail an K\u00e4ufer \u00fcbersprungen: ${reason}`);
        }
      } else {
        errors.push('Kaufvertrag-Generierung: Unerwartete Antwort');
      }
    } catch (contractError: any) {
      console.error('Error in purchase contract flow:', contractError);
      errors.push(`Kaufvertrag komplett fehlgeschlagen: ${contractError.message}`);
    }

    // ─── 8b. BLANK HANDOVER PROTOCOL FLOW (best-effort, isolated) ─
    if (contractSuccess && RESEND_API_KEY) {
      try {
        const { data: sellerProfile2 } = await supabaseAdmin
          .from('profiles')
          .select('email, first_name, last_name, company_name')
          .eq('id', kitchen.seller_id)
          .maybeSingle();
        const { data: buyerProfile2 } = await supabaseAdmin
          .from('profiles')
          .select('email, first_name, last_name, company_name')
          .eq('id', buyerId)
          .maybeSingle();
        const { data: settings2 } = await supabaseAdmin
          .from('site_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        const protoResult = await sendBlankHandoverProtocol({
          supabase: supabaseAdmin,
          resendApiKey: RESEND_API_KEY,
          settingsData: settings2 || { site_name: 'KuechenWert', contact_email: 'info@kuechenwert24.de' },
          kitchenId: kitchen.id,
          buyerId,
          sellerId: kitchen.seller_id,
          contractNumber,
          salePrice,
          vehicleName: kitchenName,
          sellerProfile: sellerProfile2,
          buyerProfile: buyerProfile2,
          source: 'admin-sell-to-dealer',
        });
        console.log('[admin-sell-to-dealer] blank handover protocol:', protoResult.info);
      } catch (e) {
        console.error('[admin-sell-to-dealer] blank handover protocol exception (non-fatal):', e);
      }
    }

    // ─── 9. NOTIFY SELLER ────────────────────────────────────────
    if (kitchen.seller_id) {
      try {
        const { data: sellerProfile } = await supabaseAdmin
          .from('profiles')
          .select('email, first_name')
          .eq('id', kitchen.seller_id)
          .single();

        if (sellerProfile?.email) {
          const { error: sellerNotifyErr, attempts: sellerAttempts } = await invokeWithRetry(
            supabaseAdmin,
            'send-auction-notification',
            {
              email: sellerProfile.email,
              name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
              type: 'seller_sold',
              kitchenModel: kitchenName,
              auctionUrl: `https://kuechenwert24.de/dashboard/listings/${kitchen.id}`,
              currentBid: `\u20ac${salePrice.toLocaleString()}`,
            },
            { label: 'send-auction-notification (seller_sold)' },
          );
          if (sellerNotifyErr) throw new Error(`${sellerNotifyErr.message} (after ${sellerAttempts} attempts)`);
        }
      } catch (e: any) {
        console.error('Error sending seller notification:', e);
        errors.push(`Verk\u00e4ufer-Benachrichtigung fehlgeschlagen: ${e.message}`);
      }
    }

    // ─── 10. NOTIFY LOSING BIDDERS ───────────────────────────────
    // Re-fetch bids AFTER closing the auction so we don't miss any bid that
    // raced in between our initial auction load (line ~202) and the kitchen
    // update (line ~291). place_bid_atomic guards on kitchen.status='sold'
    // so no new bids will appear after this point.
    const { data: finalBids } = await supabaseAdmin
      .from('bids')
      .select('bidder_id, amount')
      .eq('auction_id', auctionId);
    const allBids = finalBids ?? auction.bids ?? [];

    if (allBids.length > 0) {
      const losingBidderIds = [...new Set(
        allBids
          .map((b: any) => b.bidder_id)
          .filter((id: string) => id !== buyerId),
      )];

      for (const loserId of losingBidderIds) {
        try {
          const loserHighestBid = Math.max(
            ...allBids
              .filter((b: any) => b.bidder_id === loserId)
              .map((b: any) => Number(b.amount)),
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
                kitchenModel: kitchenName,
                auctionUrl,
                yourBid: `\u20ac${loserHighestBid.toLocaleString()}`,
                currentBid: `\u20ac${salePrice.toLocaleString()}`,
                isFestpreis: kitchen.sale_channel === 'instant_price',
              },
            }).catch((e: any) => console.error('Error sending loser notification:', e));
          }
        } catch (e: any) {
          console.error('Error processing loser notification for:', loserId, e);
        }
      }
    }

    // ─── 10b. NOTIFY OPEN PROPOSERS (Festpreis price proposals) ───
    if (expiredOffers && expiredOffers.length > 0) {
      for (const eo of expiredOffers) {
        if (eo.buyer_id === buyerId) continue;
        try {
          const { data: proposerProfile } = await supabaseAdmin
            .from('profiles')
            .select('email, first_name, company_name')
            .eq('id', eo.buyer_id)
            .single();

          if (proposerProfile?.email) {
            supabaseAdmin.functions.invoke('send-auction-notification', {
              body: {
                email: proposerProfile.email,
                name: proposerProfile.company_name || proposerProfile.first_name || proposerProfile.email.split('@')[0],
                type: 'lost',
                kitchenModel: kitchenName,
                auctionUrl: 'https://kuechenwert24.de/kaufen',
                yourBid: `\u20ac${Number(eo.offer_amount).toLocaleString('de-DE')}`,
                currentBid: `\u20ac${Number(salePrice).toLocaleString('de-DE')}`,
                isFestpreis: true,
              },
            }).catch((e: any) => console.error('Error sending proposer lost notification:', e));
          }
        } catch (e: any) {
          console.error('Error processing proposer notification for:', eo.buyer_id, e);
        }
      }
    }

    // ─── 11. ADMIN SUMMARY EMAIL ─────────────────────────────────
    const { data: winnerProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, first_name, last_name, company_name')
      .eq('id', buyerId)
      .single();
    const winnerName =
      winnerProfile?.company_name ||
      `${winnerProfile?.first_name || ''} ${winnerProfile?.last_name || ''}`.trim() ||
      'Unbekannt';

    let adminContent = `
      ${paragraph(`<strong>Manueller Verkauf durch Admin (${adminDisplayName}) abgeschlossen.</strong>`)}
      ${infoBox('Verkaufs-Ergebnis', `
        ${detailRow('Status', '\u2705 VERKAUFT (Manueller Admin-Verkauf)')}
        ${detailRow('Fahrzeug', kitchenName)}
        ${detailRow('Verkaufspreis', `\u20ac${salePrice.toLocaleString()}`)}
        ${detailRow('Anzahl Gebote vor Verkauf', String(allBids.length || 0))}
        ${detailRow('Auktions-Status vorher', String(auction.status))}
      `, 'success')}
      ${infoBox('K\u00e4ufer (H\u00e4ndler)', `
        ${detailRow('H\u00e4ndler', winnerName)}
        ${detailRow('E-Mail', winnerProfile?.email || '\u2013')}
        ${detailRow('Kontogesperrt', buyerProfileGuard?.account_restricted ? '\u26a0\ufe0f Ja \u2013 Override durch Admin' : 'Nein')}
      `, buyerProfileGuard?.account_restricted ? 'warning' : 'info')}
      ${infoBox('Dokumente', `
        ${detailRow('Rechnung', invoiceSuccess ? `\u2705 Erstellt${invoiceNumber ? ` (${invoiceNumber})` : ''}` : '\u274c Fehlgeschlagen')}
        ${detailRow('Kaufvertrag', contractSuccess ? `\u2705 Erstellt${contractNumber ? ` (${contractNumber})` : ''}` : '\u274c Fehlgeschlagen')}
      `, invoiceSuccess && contractSuccess ? 'success' : 'warning')}
    `;

    if (errors.length > 0) {
      adminContent += warningBox(`<strong>\u26a0\ufe0f ${errors.length} Fehler aufgetreten:</strong><br>${errors.map((e) => `\u2022 ${e}`).join('<br>')}`);
    }

    adminContent += button('Im Admin-Dashboard ansehen', `https://kuechenwert24.de/admin/auctions/${auctionId}`);

    await sendAdminEmail(
      supabaseAdmin,
      `Manueller Verkauf: ${kitchenName} f\u00fcr \u20ac${salePrice.toLocaleString()}`,
      adminContent,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Manueller Verkauf erfolgreich abgeschlossen',
        sale: {
          kitchenId: kitchen.id,
          auctionId,
          buyerId,
          price: salePrice,
          saleType: 'instant',
          soldAt: updatedKitchen.sold_at,
          invoiceNumber: invoiceNumber || null,
          contractNumber: contractNumber || null,
          errors,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    console.error('Error in admin-sell-to-dealer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
