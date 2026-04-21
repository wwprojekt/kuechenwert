import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import {
  buildEmailLayout,
  paragraph,
  infoBox,
  detailRow,
} from '../_shared/email-builder.ts';

/**
 * Edge Function: admin-correct-sale
 *
 * Admin-only single-shot correction tool for an already-sold auction whose
 * sale price is wrong (e.g. wrong post-auction offer accidentally accepted).
 *
 * Workflow (atomic where possible, idempotent inside this single invocation):
 *  1. Cancel all existing `purchase_contracts` for the auction (status = cancelled)
 *     + delete the corresponding seller/buyer PDF files from the
 *     `purchase-contracts` storage bucket.
 *  2. Cancel all existing `invoices` for the auction (status = cancelled)
 *     + delete the corresponding PDF files from the `invoices` storage bucket.
 *  3. Update `auctions.current_bid` to the new sale price.
 *  4. Update the accepted `post_auction_offers` row (offer_amount + message
 *     that documents the correction).
 *  5. Insert a NEW invoice with EXPLICITLY-PROVIDED amounts. Skips the buggy
 *     `create_auction_invoice` RPC (which would compute commission off the
 *     dealer's auction bid instead of the actual post-auction sale price).
 *  6. Generate the new invoice PDF via `generate-invoice-pdf`.
 *  7. Send the new invoice email to the dealer via `send-invoice-email`.
 *  8. Generate the new purchase contract PDF via `generate-purchase-contract`.
 *  9. Send the new contract by e-mail to seller + buyer (inline, mirrors the
 *     `close-auction` behaviour).
 * 10. Return a JSON summary of every step with collected errors.
 *
 * Auth: service_role or admin (admin allowed because this is run from the
 * Supabase SQL editor / MCP / admin tooling, not from public frontends).
 */

interface CorrectSaleRequest {
  auctionId: string;
  newSalePrice: number;
  reason: string;
  // Explicit invoice amounts (so we don't trip the create_auction_invoice bug)
  newInvoiceNet: number;
  newInvoiceTaxRate: number;
  newInvoiceTaxAmount: number;
  newInvoiceGross: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightRequest(req);

  const corsHeaders = getCorsHeaders(req);
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

  const authResult = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!authResult.authorized) return authResult.response;

  const errors: string[] = [];
  const summary: Record<string, unknown> = {};

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: CorrectSaleRequest = await req.json();
    const {
      auctionId,
      newSalePrice,
      reason,
      newInvoiceNet,
      newInvoiceTaxRate,
      newInvoiceTaxAmount,
      newInvoiceGross,
    } = body;

    if (!auctionId || !newSalePrice || !reason) {
      throw new Error('auctionId, newSalePrice and reason are required');
    }
    if (
      newInvoiceNet === undefined ||
      newInvoiceTaxRate === undefined ||
      newInvoiceTaxAmount === undefined ||
      newInvoiceGross === undefined
    ) {
      throw new Error('newInvoiceNet, newInvoiceTaxRate, newInvoiceTaxAmount, newInvoiceGross are required');
    }

    // ─── 0. Lade Auction + Motorhome + Käufer (sold_to) ───────────
    const { data: auction, error: auctionErr } = await supabase
      .from('auctions')
      .select('id, motorhome_id, current_bid')
      .eq('id', auctionId)
      .single();
    if (auctionErr || !auction) throw new Error(`Auction not found: ${auctionErr?.message}`);

    const { data: motorhome, error: mhErr } = await supabase
      .from('motorhomes')
      .select('id, manufacturer, model, seller_id, sold_to')
      .eq('id', auction.motorhome_id)
      .single();
    if (mhErr || !motorhome) throw new Error(`Motorhome not found: ${mhErr?.message}`);

    const buyerId = motorhome.sold_to;
    const sellerId = motorhome.seller_id;
    if (!buyerId || !sellerId) {
      throw new Error('Motorhome has no sold_to or seller_id set');
    }
    summary.auction = { auctionId, motorhomeId: motorhome.id, buyerId, sellerId };

    const motorhomeName = `${motorhome.manufacturer ?? ''} ${motorhome.model ?? ''}`.trim();

    // ─── 1. Alte Verträge canceln + PDFs aus Storage löschen ────
    const { data: oldContracts } = await supabase
      .from('purchase_contracts')
      .select('id, contract_number, storage_path, buyer_storage_path, status')
      .eq('auction_id', auctionId)
      .neq('status', 'cancelled');

    const cancelledContracts: string[] = [];
    if (oldContracts && oldContracts.length > 0) {
      const pathsToDelete: string[] = [];
      for (const c of oldContracts) {
        if (c.storage_path) pathsToDelete.push(c.storage_path);
        if (c.buyer_storage_path) pathsToDelete.push(c.buyer_storage_path);
        cancelledContracts.push(c.contract_number);
      }
      if (pathsToDelete.length > 0) {
        const { error: rmErr } = await supabase.storage
          .from('purchase-contracts')
          .remove(pathsToDelete);
        if (rmErr) errors.push(`Storage-Löschen alter Verträge: ${rmErr.message}`);
      }
      const { error: updErr } = await supabase
        .from('purchase_contracts')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
        })
        .eq('auction_id', auctionId)
        .neq('status', 'cancelled');
      if (updErr) errors.push(`Vertrag-Status-Update: ${updErr.message}`);
    }
    summary.cancelledContracts = cancelledContracts;

    // ─── 2. Alte Rechnungen canceln + PDFs aus Storage löschen ──
    const { data: oldInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, dealer_id, pdf_url, status')
      .eq('auction_id', auctionId)
      .neq('status', 'cancelled');

    const cancelledInvoices: string[] = [];
    if (oldInvoices && oldInvoices.length > 0) {
      const pathsToDelete: string[] = [];
      for (const inv of oldInvoices) {
        const safe = inv.invoice_number.replace(/[^a-zA-Z0-9-]/g, '_');
        pathsToDelete.push(`${inv.dealer_id}/${safe}.pdf`);
        cancelledInvoices.push(inv.invoice_number);
      }
      const { error: rmInvErr } = await supabase.storage
        .from('invoices')
        .remove(pathsToDelete);
      if (rmInvErr) errors.push(`Storage-Löschen alter Rechnungen: ${rmInvErr.message}`);

      const { error: invUpdErr } = await supabase
        .from('invoices')
        .update({
          status: 'cancelled',
          notes: `STORNIERT (${new Date().toISOString().slice(0, 10)}): ${reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('auction_id', auctionId)
        .neq('status', 'cancelled');
      if (invUpdErr) errors.push(`Rechnung-Status-Update: ${invUpdErr.message}`);
    }
    summary.cancelledInvoices = cancelledInvoices;

    // ─── 3. Auction current_bid anpassen ────────────────────────
    const { error: aucUpdErr } = await supabase
      .from('auctions')
      .update({ current_bid: newSalePrice, updated_at: new Date().toISOString() })
      .eq('id', auctionId);
    if (aucUpdErr) errors.push(`Auction-Update: ${aucUpdErr.message}`);
    summary.auctionPriceUpdated = { from: Number(auction.current_bid), to: newSalePrice };

    // ─── 4. Akzeptiertes Post-Auction-Angebot korrigieren ───────
    const { data: acceptedOffers } = await supabase
      .from('post_auction_offers')
      .select('id, offer_amount, message')
      .eq('auction_id', auctionId)
      .eq('status', 'accepted')
      .order('responded_at', { ascending: false });

    if (acceptedOffers && acceptedOffers.length > 0) {
      const o = acceptedOffers[0];
      const newMsg = `[KORREKTUR ${new Date().toISOString().slice(0, 10)}] urspr. ${Number(
        o.offer_amount,
      ).toLocaleString('de-DE')} € → ${newSalePrice.toLocaleString('de-DE')} €. Grund: ${reason}${
        o.message ? ` | Vorherige Notiz: ${o.message}` : ''
      }`;
      const { error: offerErr } = await supabase
        .from('post_auction_offers')
        .update({
          offer_amount: newSalePrice,
          message: newMsg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', o.id);
      if (offerErr) errors.push(`Offer-Update: ${offerErr.message}`);
      summary.updatedOfferId = o.id;
    }

    // ─── 5. Neue Rechnung MANUELL anlegen (umgeht create_auction_invoice-Bug)
    const { data: dealerProfile } = await supabase
      .from('profiles')
      .select('customer_number, company_country')
      .eq('id', buyerId)
      .single();

    const { data: settings } = await supabase
      .from('site_settings')
      .select('invoice_payment_terms_days, site_name, contact_email, support_phone, site_description')
      .limit(1)
      .maybeSingle();
    const payTerms = settings?.invoice_payment_terms_days ?? 14;

    const { data: invoiceNumberData, error: invNumErr } = await supabase.rpc('generate_invoice_number');
    if (invNumErr || !invoiceNumberData) throw new Error(`generate_invoice_number: ${invNumErr?.message}`);
    const newInvoiceNumber = invoiceNumberData as string;

    const dealerCountry = dealerProfile?.company_country ?? 'DE';
    const isReverseCharge = dealerCountry !== 'DE' && newInvoiceTaxRate === 0;

    const { data: insertedInvoice, error: insErr } = await supabase
      .from('invoices')
      .insert({
        invoice_number: newInvoiceNumber,
        dealer_id: buyerId,
        auction_id: auctionId,
        customer_number: dealerProfile?.customer_number ?? null,
        status: 'draft',
        net_amount: newInvoiceNet,
        tax_rate: newInvoiceTaxRate,
        tax_amount: newInvoiceTaxAmount,
        gross_amount: newInvoiceGross,
        payment_terms_days: payTerms,
        due_date: new Date(Date.now() + payTerms * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        invoice_date: new Date().toISOString().slice(0, 10),
        notes: `${isReverseCharge ? 'Reverse Charge (§13b UStG): ' : 'Provision: '}${motorhomeName} (Korrektur ${reason})`,
        reverse_charge: isReverseCharge,
        dealer_country: dealerCountry,
        invoice_type: 'commission',
      })
      .select('id')
      .single();
    if (insErr || !insertedInvoice) throw new Error(`Invoice-Insert: ${insErr?.message}`);
    const newInvoiceId = insertedInvoice.id;

    const { error: itemErr } = await supabase.from('invoice_items').insert({
      invoice_id: newInvoiceId,
      description: `Vermittlungsprovision - ${motorhomeName}`,
      quantity: 1,
      unit_price: newInvoiceNet,
      net_amount: newInvoiceNet,
      tax_rate: newInvoiceTaxRate,
      tax_amount: newInvoiceTaxAmount,
      gross_amount: newInvoiceGross,
    });
    if (itemErr) errors.push(`InvoiceItem-Insert: ${itemErr.message}`);
    summary.newInvoice = { id: newInvoiceId, invoice_number: newInvoiceNumber };

    // ─── 6. PDF für neue Rechnung erzeugen ───────────────────────
    let invoicePdfBase64: string | undefined;
    try {
      const { data: pdfRes, error: pdfErr } = await supabase.functions.invoke('generate-invoice-pdf', {
        body: { invoiceId: newInvoiceId },
      });
      if (pdfErr) errors.push(`generate-invoice-pdf: ${pdfErr.message}`);
      else invoicePdfBase64 = pdfRes?.pdfBase64;
    } catch (e) {
      errors.push(`generate-invoice-pdf throw: ${(e as Error).message}`);
    }

    // ─── 7. Rechnung an Händler mailen ──────────────────────────
    try {
      const { error: emailErr } = await supabase.functions.invoke('send-invoice-email', {
        body: { invoiceId: newInvoiceId, pdfBase64: invoicePdfBase64 },
      });
      if (emailErr) errors.push(`send-invoice-email: ${emailErr.message}`);
      else summary.invoiceEmailSent = true;
    } catch (e) {
      errors.push(`send-invoice-email throw: ${(e as Error).message}`);
    }

    // ─── 8. Neuen Kaufvertrag erzeugen ───────────────────────────
    let contractNumber = '';
    let contractPdfBase64 = '';
    try {
      const { data: contractRes, error: contractErr } = await supabase.functions.invoke(
        'generate-purchase-contract',
        {
          body: {
            auctionId,
            motorhomeId: motorhome.id,
            buyerId,
            sellerId,
            salePrice: newSalePrice,
          },
        },
      );
      if (contractErr) {
        errors.push(`generate-purchase-contract: ${contractErr.message}`);
      } else if (contractRes?.success) {
        contractNumber = contractRes.contractNumber;
        contractPdfBase64 = contractRes.pdfBase64 ?? '';
        summary.newContract = { contractNumber };
      } else {
        errors.push('generate-purchase-contract: kein success in response');
      }
    } catch (e) {
      errors.push(`generate-purchase-contract throw: ${(e as Error).message}`);
    }

    // Der Vertrags-Generator setzt motorhomes.contract_url + contract_number selbst.

    // ─── 9. Vertrag an Verkäufer + Käufer mailen ────────────────
    if (contractPdfBase64 && contractNumber && RESEND_API_KEY) {
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', sellerId)
        .single();
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name, company_name')
        .eq('id', buyerId)
        .single();

      const settingsData = {
        site_name: settings?.site_name ?? 'CaravanWert',
        site_description: settings?.site_description ?? 'Deutschlands führende Wohnmobil-Handelsplattform',
        contact_email: settings?.contact_email ?? 'info@caravanwert.de',
        support_phone: settings?.support_phone ?? '',
      };

      const sendContractEmail = async (
        recipientEmail: string,
        recipientName: string,
        isSeller: boolean,
      ) => {
        const html = buildEmailLayout(
          settingsData,
          isSeller ? 'Korrigierter Kaufvertrag' : 'Korrigierter Kaufvertrag',
          `
            ${paragraph(`${isSeller ? 'Hallo' : 'Sehr geehrte/r'} ${recipientName},`)}
            ${paragraph(
              `wir mussten den Kaufvertrag für ${motorhomeName} korrigieren. Anbei erhalten Sie den neuen, gültigen Kaufvertrag. Frühere Versionen sind hiermit ungültig.`,
            )}
            ${infoBox(
              'Korrigierte Vertragsdetails',
              `
                ${detailRow('Neuer Kaufpreis', `€${Number(newSalePrice).toLocaleString('de-DE')}`)}
                ${detailRow('Neue Vertragsnr.', contractNumber)}
                ${detailRow('Fahrzeug', motorhomeName)}
                ${detailRow('Grund der Korrektur', reason)}
              `,
              'success',
            )}
            ${paragraph(
              isSeller
                ? 'Bitte prüfen Sie den Vertrag sorgfältig. Bei Fragen stehen wir Ihnen gerne zur Verfügung.'
                : 'Bitte prüfen Sie den Vertrag sorgfältig. Die korrigierte Provisionsrechnung erhalten Sie in einer separaten E-Mail.',
            )}
            ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${settingsData.site_name} Team`)}
          `,
        );
        const subject = `Korrigierter Kaufvertrag ${contractNumber} – ${motorhomeName}`;
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${settingsData.site_name} <info@caravanwert.de>`,
            to: [recipientEmail],
            subject,
            html,
            attachments: [{ filename: `${contractNumber}.pdf`, content: contractPdfBase64 }],
          }),
        });
        if (!res.ok) {
          throw new Error(`Resend API: ${await res.text()}`);
        }
        const result = await res.json();
        await supabase.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: settingsData.site_name,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          subject,
          body_html: html,
          body_text: '',
          email_type: 'purchase_contract',
          direction: 'outbound',
          status: 'sent',
          resend_id: result?.id ?? null,
          is_read: false,
        });
      };

      if (sellerProfile?.email) {
        try {
          const sellerName =
            `${sellerProfile.first_name ?? ''} ${sellerProfile.last_name ?? ''}`.trim() || 'Kunde';
          await sendContractEmail(sellerProfile.email, sellerName, true);
          summary.sellerContractEmailSent = sellerProfile.email;
        } catch (e) {
          errors.push(`Seller-Vertrag-Mail: ${(e as Error).message}`);
        }
      } else {
        errors.push('Seller-Email fehlt');
      }

      if (buyerProfile?.email) {
        try {
          const buyerName =
            buyerProfile.company_name ||
            `${buyerProfile.first_name ?? ''} ${buyerProfile.last_name ?? ''}`.trim() ||
            'Händler';
          await sendContractEmail(buyerProfile.email, buyerName, false);
          summary.buyerContractEmailSent = buyerProfile.email;
        } catch (e) {
          errors.push(`Buyer-Vertrag-Mail: ${(e as Error).message}`);
        }
      } else {
        errors.push('Buyer-Email fehlt');
      }
    } else if (!contractPdfBase64) {
      errors.push('Vertrags-PDF Base64 leer — Mails an Parteien übersprungen');
    }

    return new Response(
      JSON.stringify({ success: errors.length === 0, summary, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('admin-correct-sale error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, errors, summary }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
