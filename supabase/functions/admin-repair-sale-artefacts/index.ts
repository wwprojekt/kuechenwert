import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import {
  buildEmailLayout,
  paragraph,
  infoBox,
  detailRow,
  warningBox,
  button,
} from '../_shared/email-builder.ts';
import { sendContractSentNotification } from '../_shared/contract-notification.ts';
import { sendBlankHandoverProtocol } from '../_shared/sendBlankHandoverProtocol.ts';
import { invokeWithRetry } from '../_shared/invoke-with-retry.ts';

/**
 * Edge Function: admin-repair-sale-artefacts
 *
 * ADMIN-ONLY REPAIR FLOW.
 *
 * Purpose:
 *   When a sale has been committed to the database (motorhomes.status='sold',
 *   auctions.status='sold', optimistic lock consumed) but one or more
 *   downstream artefacts never materialised — invoice PDF missing, invoice
 *   email not sent, purchase_contracts row missing, seller/winner notification
 *   lost — this function fixes the state *without* re-running the optimistic
 *   locks in admin-sell-to-dealer / close-auction / instant-buy (which would
 *   conflict).
 *
 * Why this exists:
 *   admin-sell-to-dealer + instant-buy commit the sale early (step 5), then
 *   kick off 6..11 as individual Edge Function invocations. When the gateway /
 *   cold-start layer returns "non-2xx" on those sub-invocations, the caller
 *   collects them in an `errors[]` array and carries on. Before this function
 *   existed the admin could not re-trigger the missing steps because re-
 *   running the parent flow hit the `motorhome.status IN ('available','active',
 *   'not_sold')` guard and bailed out with a 409 Conflict.
 *
 * Behaviour:
 *   - Diagnose-only when `{ dryRun: true }`.
 *   - Otherwise: fill every missing artefact, idempotently. Each step detects
 *     whether its output already exists and skips if so.
 *   - Each sub-step uses invokeWithRetry (3× exponential backoff) so transient
 *     Supabase cold-start failures no longer leak into the repair.
 *   - Every action is logged to `audit_logs` with entity_type='auction'.
 *   - An admin summary email is sent at the end (mirrors admin-sell-to-dealer).
 *
 * Called by:
 *   - Admin UI "Verkauf reparieren" button (AdminAuctionDetail.tsx).
 *   - Manual one-shot scripts during incident recovery.
 *
 * Auth: service_role or admin JWT.
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'info@caravanwert.de';

const RequestSchema = z.object({
  auctionId: z.string().uuid('Ungültige Auktions-ID'),
  dryRun: z.boolean().optional(),
  /** Override: re-send contract emails even if we already logged them. Use
   *  carefully. Default false (idempotent). */
  forceResendContractEmails: z.boolean().optional(),
  /** Override: re-send invoice email even if invoice.sent_at is already set. */
  forceResendInvoiceEmail: z.boolean().optional(),
});

type RequestPayload = z.infer<typeof RequestSchema>;

interface StepReport {
  step: string;
  status: 'ok' | 'skipped' | 'repaired' | 'failed';
  detail: string;
  attempts?: number;
}

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

    const recipients: string[] = [];
    try {
      const { data: adminRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      if (adminRoles && adminRoles.length > 0) {
        const adminIds = adminRoles.map((r: { user_id: string }) => r.user_id);
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
    if (recipients.length === 0) recipients.push(ADMIN_EMAIL);

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
      return;
    }
    const result = await response.json();
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
  } catch (error) {
    console.error('Error sending admin email:', error);
  }
}

/** Probe admin_emails to detect whether a specific artefact email has already
 *  been delivered. Intentionally conservative — false negatives are acceptable
 *  (we would resend); false positives would swallow a missing email. */
async function wasEmailSent(
  supabaseAdmin: any,
  opts: { recipientEmail: string; emailType: string; subjectLike?: string },
): Promise<boolean> {
  let query = supabaseAdmin
    .from('admin_emails')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_email', opts.recipientEmail)
    .eq('email_type', opts.emailType)
    .eq('direction', 'outbound')
    .eq('status', 'sent');
  if (opts.subjectLike) {
    query = query.ilike('subject', `%${opts.subjectLike}%`);
  }
  const { count, error } = await query;
  if (error) {
    console.warn('[wasEmailSent] query failed, assuming not sent:', error);
    return false;
  }
  return (count ?? 0) > 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const authResult = await checkServiceRoleOrAdmin(req, corsHeaders);
    if (!authResult.authorized) return authResult.response;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Resolve calling admin (for audit + summary email).
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

    const rawBody = await req.json();
    const validation = RequestSchema.safeParse(rawBody);
    if (!validation.success) {
      const msg = validation.error.errors.map((e) => e.message).join(', ');
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { auctionId, dryRun, forceResendContractEmails, forceResendInvoiceEmail }: RequestPayload = validation.data;

    // ─── 1. Load auction + motorhome + existing artefacts ───────────
    const { data: auction, error: auctionError } = await supabaseAdmin
      .from('auctions')
      .select('id, status, current_bid, motorhome_id')
      .eq('id', auctionId)
      .single();

    if (auctionError || !auction) {
      return new Response(JSON.stringify({ error: 'Auktion nicht gefunden' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: motorhome, error: motorhomeError } = await supabaseAdmin
      .from('motorhomes')
      .select('*')
      .eq('id', auction.motorhome_id)
      .single();

    if (motorhomeError || !motorhome) {
      return new Response(JSON.stringify({ error: 'Wohnmobil nicht gefunden' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Guardrails: repair is only meaningful for sold motorhomes with a buyer.
    if (motorhome.status !== 'sold' || !motorhome.sold_to) {
      return new Response(
        JSON.stringify({
          error: `Reparatur nicht sinnvoll: motorhome.status='${motorhome.status}', sold_to='${motorhome.sold_to ?? 'null'}'`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const buyerId: string = motorhome.sold_to;
    const sellerId: string | null = motorhome.seller_id;
    const salePrice: number = Number(auction.current_bid ?? 0);
    if (!salePrice || salePrice <= 0) {
      return new Response(
        JSON.stringify({ error: `Ungültiger Verkaufspreis auf Auktion: ${auction.current_bid}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const motorhomeName = `${motorhome.manufacturer || ''} ${motorhome.model || ''}`.trim();
    const auctionUrl = `https://caravanwert.de/auktion/${auctionId}`;

    // Existing invoice / contract rows.
    const { data: existingInvoices } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, status, payment_status, pdf_url, sent_at, dealer_id')
      .eq('auction_id', auctionId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    const { data: existingContracts } = await supabaseAdmin
      .from('purchase_contracts')
      .select('id, contract_number, status, contract_url, buyer_contract_url')
      .eq('auction_id', auctionId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    const activeInvoice = existingInvoices?.[0] ?? null;
    const activeContract = existingContracts?.[0] ?? null;

    const { data: buyerProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, first_name, last_name, company_name')
      .eq('id', buyerId)
      .maybeSingle();
    const { data: sellerProfile } = sellerId
      ? await supabaseAdmin
          .from('profiles')
          .select('email, first_name, last_name, company_name')
          .eq('id', sellerId)
          .maybeSingle()
      : { data: null };

    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    const settingsData = settings || {
      site_name: 'CaravanWert',
      contact_email: 'info@caravanwert.de',
    };

    const steps: StepReport[] = [];
    const errors: string[] = [];

    // ─── 2. DIAGNOSE ─────────────────────────────────────────────────
    const diagnosis = {
      motorhome: {
        id: motorhome.id,
        status: motorhome.status,
        sold_to: motorhome.sold_to,
        sold_at: motorhome.sold_at,
        sale_type: motorhome.sale_type,
        contract_number: motorhome.contract_number,
        contract_url: motorhome.contract_url ? 'set' : null,
      },
      auction: {
        id: auctionId,
        status: auction.status,
        current_bid: auction.current_bid,
      },
      invoice: activeInvoice
        ? {
            id: activeInvoice.id,
            invoice_number: activeInvoice.invoice_number,
            status: activeInvoice.status,
            payment_status: activeInvoice.payment_status,
            pdf_url: activeInvoice.pdf_url ? 'set' : null,
            sent_at: activeInvoice.sent_at,
          }
        : null,
      contract: activeContract
        ? {
            id: activeContract.id,
            contract_number: activeContract.contract_number,
            status: activeContract.status,
            contract_url: activeContract.contract_url ? 'set' : null,
          }
        : null,
      salePrice,
      buyerEmail: buyerProfile?.email ?? null,
      sellerEmail: sellerProfile?.email ?? null,
    };

    if (dryRun) {
      return new Response(
        JSON.stringify({ success: true, dryRun: true, diagnosis, steps: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ─── 3. REPAIR INVOICE ──────────────────────────────────────────
    let invoiceId: string | null = activeInvoice?.id ?? null;
    let invoiceNumber: string = activeInvoice?.invoice_number ?? '';
    let pdfBase64: string | undefined = undefined;

    if (!activeInvoice) {
      // No invoice at all: create one via the instant-buy RPC.
      const { data: rpcInvoiceId, error: rpcError } = await supabaseAdmin.rpc('create_instant_buy_invoice', {
        auction_id_param: auctionId,
        dealer_id_param: buyerId,
        sale_price_param: salePrice,
      });
      if (rpcError || !rpcInvoiceId) {
        const msg = `Rechnungserstellung (RPC) fehlgeschlagen: ${rpcError?.message ?? 'keine ID zurück'}`;
        steps.push({ step: 'invoice_create', status: 'failed', detail: msg });
        errors.push(msg);
      } else {
        invoiceId = rpcInvoiceId as string;
        steps.push({ step: 'invoice_create', status: 'repaired', detail: `Rechnung erstellt (id=${invoiceId})` });
      }
    } else {
      steps.push({
        step: 'invoice_create',
        status: 'skipped',
        detail: `Rechnung existiert bereits (${activeInvoice.invoice_number}, status=${activeInvoice.status})`,
      });
    }

    // Generate/refresh PDF if invoice exists but no pdf_url yet OR we just created it.
    if (invoiceId && (!activeInvoice?.pdf_url || !activeInvoice)) {
      const { data: pdfResult, error: pdfError, attempts } = await invokeWithRetry<{ pdfBase64?: string; invoiceNumber?: string }>(
        supabaseAdmin,
        'generate-invoice-pdf',
        { invoiceId },
        { label: 'generate-invoice-pdf' },
      );
      if (pdfError) {
        const msg = `Rechnungs-PDF-Generierung fehlgeschlagen nach ${attempts} Versuch(en): ${pdfError.message}`;
        steps.push({ step: 'invoice_pdf', status: 'failed', detail: msg, attempts });
        errors.push(msg);
      } else {
        pdfBase64 = pdfResult?.pdfBase64;
        if (pdfResult?.invoiceNumber) invoiceNumber = pdfResult.invoiceNumber;
        steps.push({
          step: 'invoice_pdf',
          status: 'repaired',
          detail: `Rechnungs-PDF (neu) generiert (invoice_number=${invoiceNumber || '?'})`,
          attempts,
        });
      }
    } else if (invoiceId && activeInvoice?.pdf_url) {
      steps.push({
        step: 'invoice_pdf',
        status: 'skipped',
        detail: `Rechnungs-PDF existiert bereits (${activeInvoice.invoice_number})`,
      });
    }

    // Send the invoice email if we have an invoice that has never been sent
    // (sent_at IS NULL) OR the caller forces a resend.
    // Re-read invoice state AFTER the PDF generation step because
    // generate-invoice-pdf updates `pdf_url` on the row.
    let invoiceAfterPdf = activeInvoice;
    if (invoiceId) {
      const { data: inv } = await supabaseAdmin
        .from('invoices')
        .select('id, invoice_number, status, sent_at, pdf_url, dealer_id')
        .eq('id', invoiceId)
        .maybeSingle();
      invoiceAfterPdf = inv ?? invoiceAfterPdf;
      if (invoiceAfterPdf?.invoice_number) invoiceNumber = invoiceAfterPdf.invoice_number;
    }

    const shouldSendInvoiceEmail =
      invoiceId && (forceResendInvoiceEmail || !invoiceAfterPdf?.sent_at);
    if (shouldSendInvoiceEmail) {
      const { data: emailResult, error: emailError, attempts } = await invokeWithRetry<{ invoiceNumber?: string; sentTo?: string }>(
        supabaseAdmin,
        'send-invoice-email',
        { invoiceId, pdfBase64 },
        { label: 'send-invoice-email' },
      );
      if (emailError) {
        const msg = `Rechnungs-E-Mail fehlgeschlagen nach ${attempts} Versuch(en): ${emailError.message}`;
        steps.push({ step: 'invoice_email', status: 'failed', detail: msg, attempts });
        errors.push(msg);
      } else {
        steps.push({
          step: 'invoice_email',
          status: 'repaired',
          detail: `Rechnungs-E-Mail versendet → ${emailResult?.sentTo ?? buyerProfile?.email ?? 'unbekannt'}`,
          attempts,
        });
      }
    } else if (invoiceId) {
      steps.push({
        step: 'invoice_email',
        status: 'skipped',
        detail: `Rechnungs-E-Mail bereits versendet am ${invoiceAfterPdf?.sent_at ?? '?'}`,
      });
    }

    // ─── 4. REPAIR PURCHASE CONTRACT ────────────────────────────────
    let contractNumber: string = activeContract?.contract_number ?? '';
    let contractPdfBase64: string = '';
    let contractSuccess = !!activeContract;
    let sellerContractUrl: string = activeContract?.contract_url ?? '';
    let buyerContractUrl: string = activeContract?.buyer_contract_url ?? activeContract?.contract_url ?? '';

    if (!activeContract) {
      const { data: contractResult, error: contractError, attempts } = await invokeWithRetry<{
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
          motorhomeId: motorhome.id,
          buyerId,
          sellerId,
          salePrice,
        },
        { label: 'generate-purchase-contract' },
      );
      if (contractError || !contractResult?.success) {
        const msg = `Kaufvertrag-Generierung fehlgeschlagen nach ${attempts} Versuch(en): ${contractError?.message ?? 'Unerwartete Antwort'}`;
        steps.push({ step: 'contract_create', status: 'failed', detail: msg, attempts });
        errors.push(msg);
      } else {
        contractNumber = contractResult.contractNumber ?? '';
        contractPdfBase64 = contractResult.pdfBase64 ?? '';
        sellerContractUrl = contractResult.contractUrl ?? '';
        buyerContractUrl = contractResult.buyerContractUrl ?? contractResult.contractUrl ?? '';
        contractSuccess = true;
        steps.push({
          step: 'contract_create',
          status: 'repaired',
          detail: `Kaufvertrag generiert (${contractNumber})`,
          attempts,
        });
      }
    } else {
      steps.push({
        step: 'contract_create',
        status: 'skipped',
        detail: `Kaufvertrag existiert bereits (${activeContract.contract_number})`,
      });
    }

    // Contract emails (seller + buyer).
    //  - If we just generated the contract, we already have the PDF in-memory.
    //  - If the contract existed but emails never went out (transient failure
    //    of Resend), we can't regenerate the PDF here. We fall back to sending
    //    the contract-sent notification (with download link) only; the signed
    //    URL on `purchase_contracts.contract_url` stays valid for decades.
    if (contractSuccess && contractNumber) {
      // ── 4a. Seller email ──
      if (sellerProfile?.email) {
        const sellerSubject = `Kaufvertrag ${contractNumber} – ${motorhomeName}`;
        const alreadySent = forceResendContractEmails
          ? false
          : await wasEmailSent(supabaseAdmin, {
              recipientEmail: sellerProfile.email,
              emailType: 'purchase_contract',
              subjectLike: contractNumber,
            });
        if (alreadySent) {
          steps.push({
            step: 'contract_email_seller',
            status: 'skipped',
            detail: `Vertrags-E-Mail an Verkäufer bereits gesendet`,
          });
        } else if (!RESEND_API_KEY) {
          steps.push({ step: 'contract_email_seller', status: 'failed', detail: 'RESEND_API_KEY fehlt' });
          errors.push('Vertrags-E-Mail an Verkäufer fehlgeschlagen: RESEND_API_KEY fehlt');
        } else {
          try {
            const sellerName =
              `${sellerProfile.first_name ?? ''} ${sellerProfile.last_name ?? ''}`.trim() || 'Kunde';
            const contractEmailHtml = buildEmailLayout(settingsData, 'Ihr Kaufvertrag', `
              ${paragraph(`Hallo ${sellerName},`)}
              ${paragraph('Anbei erhalten Sie den Kaufvertrag für Ihr verkauftes Fahrzeug. (Nachträglich versendet durch unser Admin-Team.)')}
              ${infoBox('Vertragsdetails', `
                ${detailRow('Vertragsnr.', contractNumber)}
                ${detailRow('Fahrzeug', motorhomeName)}
                ${detailRow('Kaufpreis', `€${salePrice.toLocaleString()}`)}
                ${detailRow('Verkaufsart', motorhome.sale_type === 'instant' ? 'Sofortkauf' : (motorhome.sale_type ?? 'Verkauf'))}
              `, 'success')}
              ${paragraph('Bitte prüfen Sie den Vertrag sorgfältig. Bei Fragen stehen wir Ihnen gerne zur Verfügung.')}
              ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${settingsData.site_name} Team`)}
            `);

            const attachments: Array<{ filename: string; content: string }> = [];
            if (contractPdfBase64) {
              attachments.push({ filename: `${contractNumber}.pdf`, content: contractPdfBase64 });
            }

            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: `${settingsData.site_name} <info@caravanwert.de>`,
                to: [sellerProfile.email],
                subject: sellerSubject,
                html: contractEmailHtml,
                ...(attachments.length > 0 ? { attachments } : {}),
              }),
            });
            if (!emailRes.ok) {
              const errText = await emailRes.text();
              throw new Error(`Resend API: ${errText}`);
            }
            const resendResult = await emailRes.json();
            try {
              await supabaseAdmin.from('admin_emails').insert({
                sender_email: 'info@caravanwert.de',
                sender_name: settingsData.site_name,
                recipient_email: sellerProfile.email,
                recipient_name: sellerName,
                subject: sellerSubject,
                body_html: contractEmailHtml,
                body_text: '',
                email_type: 'purchase_contract',
                direction: 'outbound',
                status: 'sent',
                resend_id: resendResult?.id || null,
                is_read: false,
              });
            } catch (logErr) {
              console.error('Failed to log seller contract email:', logErr);
            }

            if (sellerContractUrl) {
              await sendContractSentNotification({
                resendApiKey: RESEND_API_KEY,
                supabase: supabaseAdmin,
                settingsData,
                recipientEmail: sellerProfile.email,
                recipientName: sellerName,
                contractNumber,
                vehicleName: motorhomeName,
                salePrice,
                downloadUrl: sellerContractUrl,
                party: 'seller',
              });
            }
            steps.push({
              step: 'contract_email_seller',
              status: 'repaired',
              detail: `Vertrags-E-Mail an ${sellerProfile.email} gesendet`,
            });
          } catch (e: any) {
            const msg = `Vertrags-E-Mail an Verkäufer fehlgeschlagen: ${e.message}`;
            steps.push({ step: 'contract_email_seller', status: 'failed', detail: msg });
            errors.push(msg);
          }
        }
      } else {
        steps.push({ step: 'contract_email_seller', status: 'skipped', detail: 'Verkäufer-E-Mail fehlt' });
      }

      // ── 4b. Buyer email ──
      if (buyerProfile?.email) {
        const buyerSubject = `Kaufvertrag ${contractNumber} – ${motorhomeName}`;
        const alreadySent = forceResendContractEmails
          ? false
          : await wasEmailSent(supabaseAdmin, {
              recipientEmail: buyerProfile.email,
              emailType: 'purchase_contract',
              subjectLike: contractNumber,
            });
        if (alreadySent) {
          steps.push({
            step: 'contract_email_buyer',
            status: 'skipped',
            detail: `Vertrags-E-Mail an Käufer bereits gesendet`,
          });
        } else if (!RESEND_API_KEY) {
          steps.push({ step: 'contract_email_buyer', status: 'failed', detail: 'RESEND_API_KEY fehlt' });
          errors.push('Vertrags-E-Mail an Käufer fehlgeschlagen: RESEND_API_KEY fehlt');
        } else {
          try {
            const buyerName =
              buyerProfile.company_name ||
              `${buyerProfile.first_name ?? ''} ${buyerProfile.last_name ?? ''}`.trim() ||
              'Händler';
            const contractEmailHtml = buildEmailLayout(settingsData, 'Kaufvertrag', `
              ${paragraph(`Sehr geehrte/r ${buyerName},`)}
              ${paragraph('Anbei erhalten Sie den Kaufvertrag für das erworbene Fahrzeug. (Nachträglich versendet durch unser Admin-Team.)')}
              ${infoBox('Vertragsdetails', `
                ${detailRow('Vertragsnr.', contractNumber)}
                ${detailRow('Fahrzeug', motorhomeName)}
                ${detailRow('Kaufpreis', `€${salePrice.toLocaleString()}`)}
                ${detailRow('Verkaufsart', motorhome.sale_type === 'instant' ? 'Sofortkauf' : (motorhome.sale_type ?? 'Verkauf'))}
              `, 'success')}
              ${paragraph('Bitte prüfen Sie den Vertrag sorgfältig. Die Rechnung über die Vermittlungsprovision erhalten Sie separat.')}
              ${paragraph(`Mit freundlichen Grüßen,<br>Ihr ${settingsData.site_name} Team`)}
            `);

            const attachments: Array<{ filename: string; content: string }> = [];
            if (contractPdfBase64) {
              attachments.push({ filename: `${contractNumber}.pdf`, content: contractPdfBase64 });
            }

            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: `${settingsData.site_name} <info@caravanwert.de>`,
                to: [buyerProfile.email],
                subject: buyerSubject,
                html: contractEmailHtml,
                ...(attachments.length > 0 ? { attachments } : {}),
              }),
            });
            if (!emailRes.ok) {
              const errText = await emailRes.text();
              throw new Error(`Resend API: ${errText}`);
            }
            const resendResult = await emailRes.json();
            try {
              await supabaseAdmin.from('admin_emails').insert({
                sender_email: 'info@caravanwert.de',
                sender_name: settingsData.site_name,
                recipient_email: buyerProfile.email,
                recipient_name: buyerName,
                subject: buyerSubject,
                body_html: contractEmailHtml,
                body_text: '',
                email_type: 'purchase_contract',
                direction: 'outbound',
                status: 'sent',
                resend_id: resendResult?.id || null,
                is_read: false,
              });
            } catch (logErr) {
              console.error('Failed to log buyer contract email:', logErr);
            }

            if (buyerContractUrl) {
              await sendContractSentNotification({
                resendApiKey: RESEND_API_KEY,
                supabase: supabaseAdmin,
                settingsData,
                recipientEmail: buyerProfile.email,
                recipientName: buyerName,
                contractNumber,
                vehicleName: motorhomeName,
                salePrice,
                downloadUrl: buyerContractUrl,
                party: 'buyer',
              });
            }
            steps.push({
              step: 'contract_email_buyer',
              status: 'repaired',
              detail: `Vertrags-E-Mail an ${buyerProfile.email} gesendet`,
            });
          } catch (e: any) {
            const msg = `Vertrags-E-Mail an Käufer fehlgeschlagen: ${e.message}`;
            steps.push({ step: 'contract_email_buyer', status: 'failed', detail: msg });
            errors.push(msg);
          }
        }
      } else {
        steps.push({ step: 'contract_email_buyer', status: 'skipped', detail: 'Käufer-E-Mail fehlt' });
      }

      // ── 4c. Blank handover protocol (best-effort, isolated) ──
      if (RESEND_API_KEY && sellerId) {
        try {
          const alreadySentProto =
            sellerProfile?.email
              ? await wasEmailSent(supabaseAdmin, {
                  recipientEmail: sellerProfile.email,
                  emailType: 'handover_protocol_blank',
                })
              : false;
          if (alreadySentProto) {
            steps.push({ step: 'handover_protocol', status: 'skipped', detail: 'Übergabeprotokoll bereits versendet' });
          } else {
            const protoResult = await sendBlankHandoverProtocol({
              supabase: supabaseAdmin,
              resendApiKey: RESEND_API_KEY,
              settingsData,
              motorhomeId: motorhome.id,
              buyerId,
              sellerId,
              contractNumber,
              salePrice,
              vehicleName: motorhomeName,
              sellerProfile,
              buyerProfile,
              source: 'admin-repair-sale-artefacts',
            });
            steps.push({
              step: 'handover_protocol',
              status: 'repaired',
              detail: `Übergabeprotokoll: ${protoResult.info}`,
            });
          }
        } catch (e: any) {
          const msg = `Übergabeprotokoll fehlgeschlagen (non-fatal): ${e.message}`;
          console.warn(msg);
          steps.push({ step: 'handover_protocol', status: 'failed', detail: msg });
          // NOT pushed to errors[] — protocol is truly optional.
        }
      }
    }

    // ─── 5. REPAIR WINNER NOTIFICATION ──────────────────────────────
    if (buyerProfile?.email) {
      const alreadySent = await wasEmailSent(supabaseAdmin, {
        recipientEmail: buyerProfile.email,
        emailType: 'auction_winner',
      });
      if (alreadySent) {
        steps.push({ step: 'winner_notification', status: 'skipped', detail: 'Gewinn-Benachrichtigung bereits versendet' });
      } else {
        const { error: winErr, attempts } = await invokeWithRetry(
          supabaseAdmin,
          'notify-auction-winner',
          { auctionId, winnerId: buyerId, amount: salePrice },
          { label: 'notify-auction-winner' },
        );
        if (winErr) {
          const msg = `Gewinn-Benachrichtigung fehlgeschlagen nach ${attempts} Versuch(en): ${winErr.message}`;
          steps.push({ step: 'winner_notification', status: 'failed', detail: msg, attempts });
          errors.push(msg);
        } else {
          steps.push({
            step: 'winner_notification',
            status: 'repaired',
            detail: `Gewinn-Benachrichtigung an ${buyerProfile.email} versendet`,
            attempts,
          });
        }
      }
    }

    // ─── 6. REPAIR SELLER NOTIFICATION ──────────────────────────────
    if (sellerProfile?.email) {
      const alreadySent = await wasEmailSent(supabaseAdmin, {
        recipientEmail: sellerProfile.email,
        emailType: 'auction_seller_sold',
      });
      if (alreadySent) {
        steps.push({ step: 'seller_notification', status: 'skipped', detail: 'Verkäufer-Benachrichtigung bereits versendet' });
      } else {
        const { error: notifyErr, attempts } = await invokeWithRetry(
          supabaseAdmin,
          'send-auction-notification',
          {
            email: sellerProfile.email,
            name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
            type: 'seller_sold',
            motorhomeModel: motorhomeName,
            auctionUrl: `https://caravanwert.de/dashboard/listings/${motorhome.id}`,
            currentBid: `\u20ac${salePrice.toLocaleString()}`,
          },
          { label: 'send-auction-notification (seller_sold)' },
        );
        if (notifyErr) {
          const msg = `Verkäufer-Benachrichtigung fehlgeschlagen nach ${attempts} Versuch(en): ${notifyErr.message}`;
          steps.push({ step: 'seller_notification', status: 'failed', detail: msg, attempts });
          errors.push(msg);
        } else {
          steps.push({
            step: 'seller_notification',
            status: 'repaired',
            detail: `Verkäufer-Benachrichtigung an ${sellerProfile.email} versendet`,
            attempts,
          });
        }
      }
    }

    // ─── 7. AUDIT LOG ───────────────────────────────────────────────
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: adminUserId,
        action: 'sale_artefacts_repaired',
        entity_type: 'auction',
        entity_id: auctionId,
        details: {
          motorhomeId: motorhome.id,
          buyerId,
          sellerId,
          salePrice,
          steps,
          errorCount: errors.length,
          admin: adminDisplayName,
        },
      });
    } catch (e) {
      console.warn('audit_logs insert failed (non-fatal):', e);
    }

    // ─── 8. ADMIN SUMMARY EMAIL ─────────────────────────────────────
    const repaired = steps.filter((s) => s.status === 'repaired').length;
    const skipped = steps.filter((s) => s.status === 'skipped').length;
    const failed = steps.filter((s) => s.status === 'failed').length;

    const stepRows = steps
      .map((s) => {
        const icon =
          s.status === 'repaired' ? '\u2705' :
          s.status === 'skipped' ? '\u23ED\uFE0F' :
          s.status === 'failed' ? '\u274C' :
          '\u2139\uFE0F';
        return detailRow(s.step, `${icon} ${s.status} — ${s.detail}`);
      })
      .join('');

    let adminContent = `
      ${paragraph(`<strong>Reparatur fehlgeschlagener Folge-Aktionen durch Admin (${adminDisplayName}).</strong>`)}
      ${infoBox('Zusammenfassung', `
        ${detailRow('Fahrzeug', motorhomeName)}
        ${detailRow('Verkaufspreis', `\u20ac${salePrice.toLocaleString()}`)}
        ${detailRow('Repariert', String(repaired))}
        ${detailRow('Übersprungen (bereits OK)', String(skipped))}
        ${detailRow('Fehlgeschlagen', String(failed))}
      `, failed > 0 ? 'warning' : 'success')}
      ${infoBox('Schritte', stepRows, 'info')}
    `;

    if (errors.length > 0) {
      adminContent += warningBox(
        `<strong>\u26A0\uFE0F ${errors.length} Fehler aufgetreten:</strong><br>${errors
          .map((e) => `\u2022 ${e}`)
          .join('<br>')}`,
      );
    }
    adminContent += button('Im Admin-Dashboard ansehen', `https://caravanwert.de/admin/auctions/${auctionId}`);

    await sendAdminEmail(
      supabaseAdmin,
      `Reparatur abgeschlossen: ${motorhomeName} (${repaired} repariert, ${failed} offen)`,
      adminContent,
    );

    return new Response(
      JSON.stringify({
        success: true,
        auctionId,
        motorhomeId: motorhome.id,
        invoiceNumber: invoiceNumber || null,
        contractNumber: contractNumber || null,
        repairedCount: repaired,
        skippedCount: skipped,
        failedCount: failed,
        steps,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    console.error('Error in admin-repair-sale-artefacts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
