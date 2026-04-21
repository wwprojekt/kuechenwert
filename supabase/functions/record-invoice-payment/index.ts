import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import {
  buildEmailLayout,
  paragraph,
  greeting,
  infoBox,
  detailRow,
  customerBadge,
} from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { edgeLogger, logEdgeError } from '../_shared/edgeLogger.ts';

/**
 * Edge Function: record-invoice-payment
 *
 * Atomic admin action: records a payment against an invoice and immediately
 * mails the dealer a Zahlungsbestätigung / Quittung.
 *
 * Replaces the previous browser-side flow where the admin's `RecordPaymentDialog`
 * inserted into `dealer_payment_history` and updated `invoices` in two
 * sequential client requests with no notification at all – the dealer never
 * found out their payment was booked.
 *
 * What this function does (in order):
 *   1. Auth: caller must be admin (user JWT, NOT service_role)
 *   2. Insert dealer_payment_history row
 *   3. Update invoices: amount_paid, payment_status (paid|partial), payment_method,
 *      payment_reference, paid_at when fully paid
 *   4. Send confirmation email via Resend, log into admin_emails
 *   5. Insert audit_logs entry (admin user_id, payment amount, status)
 *
 * Email failures DO NOT roll back the payment record – the money was received,
 * the booking must stand. The failure is persisted to error_logs and the
 * response includes emailSent=false so the UI can flag it for manual resend.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

interface RequestBody {
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  paymentReference?: string | null;
  notes?: string | null;
  sendEmail?: boolean;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Banküberweisung',
  cash: 'Barzahlung',
  paypal: 'PayPal',
  credit_card: 'Kreditkarte',
  direct_debit: 'Lastschrift',
  other: 'Sonstige',
};

function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightRequest(req);
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  // ─── Auth: admin only ──────────────────────────────────────────────────
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers,
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }
  const { data: roles } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  if (!roles?.some((r: { role: string }) => r.role === 'admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
      status: 403,
      headers,
    });
  }

  // ─── Parse + validate ──────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers,
    });
  }

  const invoiceId = body.invoiceId?.trim();
  const amount = Number(body.amount);
  const paymentMethod = body.paymentMethod?.trim();
  const paymentReference = body.paymentReference?.trim() || null;
  const notes = body.notes?.trim() || null;
  const sendEmail = body.sendEmail !== false;

  if (!invoiceId) {
    return new Response(JSON.stringify({ error: 'invoiceId ist erforderlich' }), {
      status: 400,
      headers,
    });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return new Response(JSON.stringify({ error: 'Ungültiger Betrag' }), {
      status: 400,
      headers,
    });
  }
  if (!paymentMethod) {
    return new Response(JSON.stringify({ error: 'paymentMethod ist erforderlich' }), {
      status: 400,
      headers,
    });
  }

  // ─── Load invoice (need dealer + current amount_paid + status) ─────────
  const { data: invoice, error: invErr } = await supabaseAdmin
    .from('invoices')
    .select(
      'id, invoice_number, dealer_id, gross_amount, amount_paid, payment_status, status, invoice_type, due_date, dealer:profiles!invoices_dealer_id_fkey(email, first_name, last_name, company_name, customer_number)',
    )
    .eq('id', invoiceId)
    .single();

  if (invErr || !invoice) {
    return new Response(
      JSON.stringify({ error: 'Rechnung nicht gefunden', details: invErr?.message }),
      { status: 404, headers },
    );
  }

  if (invoice.status === 'cancelled') {
    return new Response(
      JSON.stringify({ error: 'Diese Rechnung wurde storniert und kann keine Zahlung mehr aufnehmen' }),
      { status: 400, headers },
    );
  }

  const grossAmount = Number(invoice.gross_amount || 0);
  const currentPaid = Number(invoice.amount_paid || 0);
  const newAmountPaid = currentPaid + amount;
  const remaining = grossAmount - newAmountPaid;

  // Allow tiny rounding overage (1ct) but reject obvious overpayment
  if (newAmountPaid - grossAmount > 0.01) {
    return new Response(
      JSON.stringify({ error: 'Betrag übersteigt offenen Restbetrag' }),
      { status: 400, headers },
    );
  }

  const isFullyPaid = remaining <= 0.01;
  const newPaymentStatus = isFullyPaid ? 'paid' : 'partial';
  const paidAt = isFullyPaid ? new Date().toISOString() : null;

  // ─── Step 1: dealer_payment_history insert ─────────────────────────────
  const { error: histError } = await supabaseAdmin
    .from('dealer_payment_history')
    .insert({
      dealer_id: invoice.dealer_id,
      invoice_id: invoice.id,
      amount,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      notes,
      processed_by: user.id,
      status: 'completed',
    });

  if (histError) {
    edgeLogger.error('dealer_payment_history insert failed', histError);
    return new Response(
      JSON.stringify({
        error: 'Zahlungseintrag konnte nicht angelegt werden',
        details: histError.message,
      }),
      { status: 500, headers },
    );
  }

  // ─── Step 2: invoice update ────────────────────────────────────────────
  const invoiceUpdate: Record<string, unknown> = {
    amount_paid: newAmountPaid,
    payment_status: newPaymentStatus,
    payment_method: paymentMethod,
    payment_reference: paymentReference,
    updated_at: new Date().toISOString(),
  };
  if (paidAt) invoiceUpdate.paid_at = paidAt;

  const { error: updErr } = await supabaseAdmin
    .from('invoices')
    .update(invoiceUpdate)
    .eq('id', invoice.id);

  if (updErr) {
    edgeLogger.error('invoice update failed AFTER payment_history insert', updErr);
    await logEdgeError(supabaseAdmin, {
      component: 'record-invoice-payment',
      message: 'invoice update failed after payment_history insert (split-brain risk)',
      severity: 'critical',
      category: 'invoice',
      originalError: updErr,
      userId: user.id,
      metadata: { invoiceId, amount, paymentMethod },
    });
    return new Response(
      JSON.stringify({
        error: 'Zahlung gebucht, aber Rechnung konnte nicht aktualisiert werden – bitte Admin informieren',
        details: updErr.message,
      }),
      { status: 500, headers },
    );
  }

  // ─── Step 2.5: re-evaluate dealer restriction after payment ────────────
  //
  // Background: `process-dunning` flips `profiles.account_restricted = true`
  // once a dealer's overdue invoice reaches `dunning_restrict_at_level`.
  // Until this block existed, NOTHING ever flipped it back to `false` — not
  // even full payment of the invoice that triggered the restriction. The
  // dealer would stay locked out of `place-bid` and `instant-buy` forever
  // unless an admin manually edited the profile in the database.
  //
  // We lift the restriction here iff ALL of these hold:
  //   1. This invoice is now fully paid (`isFullyPaid`) — partial payments
  //      keep the dealer technically overdue, so we don't touch the flag.
  //   2. The invoice is a dealer invoice (NOT seller_penalty / private_penalty),
  //      mirroring `isDealerInvoice` in `process-dunning`. Penalty invoices
  //      never trigger restrictions in the first place, so receiving payment
  //      on one says nothing about restriction state.
  //   3. The dealer has NO other overdue dealer invoice still open (pending
  //      or partial). Otherwise the restriction is still warranted by another
  //      invoice and lifting it here would silently undo a valid lock.
  //
  // The actual UPDATE is guarded by `.eq('account_restricted', true)` so it
  // is idempotent — a no-op if the dealer was never restricted, no row
  // touched, no realtime event noise.
  //
  // Failure of this step does NOT roll back the payment. The money was
  // received and recorded, the lift is best-effort. Admins can lift
  // manually via the dealer profile screen.
  const isPenaltyInvoice =
    invoice.invoice_type === 'seller_penalty' ||
    invoice.invoice_type === 'private_penalty';

  let restrictionLifted = false;
  let restrictionLiftError: string | null = null;
  let restrictionLiftSkippedReason:
    | 'partial_payment'
    | 'penalty_invoice'
    | 'still_overdue_other_invoice'
    | null = null;

  if (!isFullyPaid) {
    restrictionLiftSkippedReason = 'partial_payment';
  } else if (isPenaltyInvoice) {
    restrictionLiftSkippedReason = 'penalty_invoice';
  } else {
    try {
      const nowIso = new Date().toISOString();

      // Look for ANY other overdue dealer invoice (limit 1 — we just need
      // to know whether at least one exists). We exclude the invoice we
      // just paid so the freshly-set payment_status='paid' on it doesn't
      // matter for the query, but also so partial-payment rounding edge
      // cases can't accidentally include it.
      const { data: stillOverdue, error: stillOverdueErr } = await supabaseAdmin
        .from('invoices')
        .select('id')
        .eq('dealer_id', invoice.dealer_id)
        .in('payment_status', ['pending', 'partial'])
        .lt('due_date', nowIso)
        .neq('status', 'cancelled')
        .neq('invoice_type', 'seller_penalty')
        .neq('invoice_type', 'private_penalty')
        .neq('id', invoice.id)
        .limit(1);

      if (stillOverdueErr) throw stillOverdueErr;

      if (!stillOverdue || stillOverdue.length === 0) {
        const { data: liftResult, error: liftErr } = await supabaseAdmin
          .from('profiles')
          .update({
            account_restricted: false,
            restriction_reason: null,
            restricted_at: null,
          })
          .eq('id', invoice.dealer_id)
          .eq('account_restricted', true)
          .select('id');

        if (liftErr) throw liftErr;

        // liftResult is the array of updated rows. Empty = dealer wasn't
        // restricted in the first place (idempotent no-op, the common case).
        if (liftResult && liftResult.length > 0) {
          restrictionLifted = true;
          edgeLogger.info(
            `Account restriction lifted for dealer ${invoice.dealer_id} after full payment of invoice ${invoice.invoice_number}`,
          );
        }
      } else {
        restrictionLiftSkippedReason = 'still_overdue_other_invoice';
      }
    } catch (e) {
      restrictionLiftError = e instanceof Error ? e.message : String(e);
      edgeLogger.error('Restriction auto-lift failed', restrictionLiftError);
      await logEdgeError(supabaseAdmin, {
        component: 'record-invoice-payment',
        message: 'Restriction auto-lift failed after payment',
        severity: 'high',
        category: 'invoice',
        originalError: restrictionLiftError,
        userId: user.id,
        metadata: { invoiceId, dealerId: invoice.dealer_id },
      });
      // Do NOT fail the request — payment is recorded, restriction lift
      // is best-effort. Admin can lift manually if needed.
    }
  }

  // ─── Step 3: confirmation email ────────────────────────────────────────
  const dealer = (invoice as unknown as {
    dealer: {
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      customer_number: string | null;
    } | null;
  }).dealer;
  const recipientEmail = dealer?.email?.trim() || null;
  const recipientName =
    dealer?.company_name ||
    `${dealer?.first_name ?? ''} ${dealer?.last_name ?? ''}`.trim() ||
    null;

  let emailSent = false;
  let emailError: string | null = null;

  if (sendEmail && recipientEmail) {
    try {
      const { data: settings } = await supabaseAdmin.from('site_settings').select('*').single();
      const settingsData = settings || {
        site_name: 'CaravanWert',
        site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
        contact_email: 'info@caravanwert.de',
        support_phone: '+49 511 51532476',
      };

      const subject = isFullyPaid
        ? `Zahlungsbestätigung – Rechnung ${invoice.invoice_number} vollständig beglichen`
        : `Teilzahlung erhalten – Rechnung ${invoice.invoice_number}`;

      const introText = isFullyPaid
        ? 'wir bestätigen den Eingang Ihrer Zahlung. Damit ist die folgende Rechnung vollständig beglichen.'
        : 'wir bestätigen den Eingang Ihrer Teilzahlung zur folgenden Rechnung.';

      const content = `
        ${greeting(recipientName ?? undefined)}
        ${customerBadge(dealer?.customer_number ?? null)}
        ${paragraph(introText)}
        ${infoBox(
          'Zahlungsdetails',
          `
          ${detailRow('Rechnungsnummer', invoice.invoice_number)}
          ${detailRow('Rechnungsbetrag', formatEur(grossAmount))}
          ${detailRow('Erhaltener Betrag', formatEur(amount))}
          ${detailRow('Zahlungsdatum', formatDate(new Date()))}
          ${detailRow('Zahlungsart', PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod)}
          ${paymentReference ? detailRow('Referenz', paymentReference) : ''}
        `,
          'success',
          settingsData,
        )}
        ${
          isFullyPaid
            ? infoBox(
                'Status',
                paragraph(
                  `Die Rechnung gilt als <strong>vollständig bezahlt</strong>. Vielen Dank!`,
                ),
                'info',
                settingsData,
              )
            : infoBox(
                'Offener Restbetrag',
                `
            ${detailRow('Bereits bezahlt', formatEur(newAmountPaid))}
            ${detailRow('Noch offen', `<strong style="color:#92400e;">${formatEur(Math.max(remaining, 0))}</strong>`)}
            ${detailRow('Fälligkeitsdatum', formatDate(invoice.due_date))}
          `,
                'warning',
                settingsData,
              )
        }
        ${paragraph(
          'Diese E-Mail dient als formlose Zahlungsbestätigung. Eine separate Quittung benötigen Sie steuerlich nicht – die ursprüngliche Rechnung gilt zusammen mit dieser Bestätigung als vollständiger Beleg.',
        )}
      `;

      const html = buildEmailLayout(settingsData, subject, content);

      const resendRes = await fetch('https://api.resend.com/emails', {
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
          reply_to: 'info@caravanwert.de',
        }),
      });

      if (!resendRes.ok) {
        emailError = `${resendRes.status}: ${(await resendRes.text()).slice(0, 200)}`;
      } else {
        const resendJson = await resendRes.json();
        emailSent = true;

        // log into admin_emails for the email center
        await supabaseAdmin.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: settingsData.site_name,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          recipient_id: invoice.dealer_id,
          subject,
          body_html: html,
          body_text: html.replace(/<[^>]*>/g, ''),
          email_type: 'payment_confirmation',
          direction: 'outbound',
          status: 'sent',
          resend_id: resendJson?.id ?? null,
          sent_by: user.id,
          is_read: true,
        });
      }
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e);
    }

    if (!emailSent) {
      edgeLogger.error('Payment confirmation email failed', emailError);
      await logEdgeError(supabaseAdmin, {
        component: 'record-invoice-payment',
        message: 'Payment booked but confirmation email dispatch failed',
        severity: 'high',
        category: 'email',
        originalError: emailError,
        userId: user.id,
        metadata: {
          invoiceId,
          invoiceNumber: invoice.invoice_number,
          recipientEmail,
          amount,
          paymentMethod,
        },
      });
    }
  } else if (sendEmail && !recipientEmail) {
    emailError = 'Empfänger hat keine E-Mail-Adresse hinterlegt';
  }

  // ─── Step 4: audit log ─────────────────────────────────────────────────
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'record_invoice_payment',
      entity_type: 'invoice',
      entity_id: invoice.id,
      details: {
        invoice_number: invoice.invoice_number,
        invoice_type: invoice.invoice_type,
        dealer_id: invoice.dealer_id,
        recipient_email: recipientEmail,
        amount,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        notes,
        new_amount_paid: newAmountPaid,
        gross_amount: grossAmount,
        new_payment_status: newPaymentStatus,
        fully_paid: isFullyPaid,
        send_email_requested: sendEmail,
        email_sent: emailSent,
        email_error: emailError,
        restriction_lifted: restrictionLifted,
        restriction_lift_skipped_reason: restrictionLiftSkippedReason,
        restriction_lift_error: restrictionLiftError,
      },
    });
  } catch (e) {
    edgeLogger.error('audit_logs insert failed', e);
  }

  // Separate, dedicated audit entry for the restriction lift — makes it
  // easy to grep / report on when restrictions came off and why. We only
  // log this when something actually changed; the no-op idempotent path
  // would otherwise spam audit_logs on every recorded payment.
  if (restrictionLifted) {
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: user.id,
        action: 'lift_account_restriction',
        entity_type: 'profile',
        entity_id: invoice.dealer_id,
        details: {
          reason: 'payment_received',
          triggered_by_invoice_id: invoice.id,
          triggered_by_invoice_number: invoice.invoice_number,
        },
      });
    } catch (e) {
      edgeLogger.error('audit_logs insert (restriction lift) failed', e);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      newAmountPaid,
      newPaymentStatus,
      fullyPaid: isFullyPaid,
      recipientEmail,
      emailSent,
      emailError,
      restrictionLifted,
      restrictionLiftSkippedReason,
      restrictionLiftError,
    }),
    { status: 200, headers },
  );
});
