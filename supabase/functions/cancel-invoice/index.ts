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
 * Edge Function: cancel-invoice
 *
 * Atomic admin action: cancels an invoice and notifies the dealer.
 *
 * Replaces the silent `cancelInvoiceMutation` in AdminFinancials, which
 * only flipped `invoices.status='cancelled'` without informing the dealer
 * – problematic for dealers who already received the original invoice and
 * now need to know they can ignore it / pull it from their accounting.
 *
 * What this function does (in order):
 *   1. Auth: caller must be admin
 *   2. Validate invoice can be cancelled (not paid, not already cancelled)
 *   3. Update invoices: status='cancelled', payment_status='cancelled' if not paid
 *   4. Send Storno email to dealer with reason (if provided)
 *   5. Insert audit_logs entry
 *
 * Note: This does NOT generate a separate Stornorechnung PDF (negative amount
 * invoice). For most KuechenWert use-cases (cancellation BEFORE the dealer
 * has booked the invoice in their accounting) the email + status change is
 * sufficient. A formal Stornorechnung PDF is a separate, larger feature.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

interface RequestBody {
  invoiceId: string;
  reason?: string | null;
  sendEmail?: boolean;
}

function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '–';
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
  const reason = body.reason?.trim() || null;
  const sendEmail = body.sendEmail !== false;

  if (!invoiceId) {
    return new Response(JSON.stringify({ error: 'invoiceId ist erforderlich' }), {
      status: 400,
      headers,
    });
  }

  // ─── Load invoice ──────────────────────────────────────────────────────
  const { data: invoice, error: invErr } = await supabaseAdmin
    .from('invoices')
    .select(
      'id, invoice_number, dealer_id, gross_amount, amount_paid, payment_status, status, invoice_type, invoice_date, due_date, dealer:profiles!invoices_dealer_id_fkey(email, first_name, last_name, company_name, customer_number)',
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
      JSON.stringify({ error: 'Diese Rechnung wurde bereits storniert' }),
      { status: 400, headers },
    );
  }

  if (invoice.payment_status === 'paid') {
    return new Response(
      JSON.stringify({ error: 'Bezahlte Rechnungen können nicht storniert werden' }),
      { status: 400, headers },
    );
  }

  // ─── Step 1: cancel invoice ────────────────────────────────────────────
  const { error: updErr } = await supabaseAdmin
    .from('invoices')
    .update({
      status: 'cancelled',
      payment_status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoice.id);

  if (updErr) {
    edgeLogger.error('invoice cancellation update failed', updErr);
    return new Response(
      JSON.stringify({
        error: 'Stornierung fehlgeschlagen',
        details: updErr.message,
      }),
      { status: 500, headers },
    );
  }

  // ─── Step 2: storno email ──────────────────────────────────────────────
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
        site_name: 'KÃ¼chenWert',
        site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
        contact_email: 'info@kuechenwert24.de',
        support_phone: '+49 511 51532476',
      };

      const subject = `Rechnung ${invoice.invoice_number} storniert`;

      const grossAmount = Number(invoice.gross_amount || 0);
      const amountPaid = Number(invoice.amount_paid || 0);
      const hadPartialPayment = amountPaid > 0;

      const content = `
        ${greeting(recipientName ?? undefined)}
        ${customerBadge(dealer?.customer_number ?? null)}
        ${paragraph(
          `wir möchten Sie informieren, dass die folgende Rechnung von uns storniert wurde. Sie müssen den Rechnungsbetrag <strong>nicht</strong> begleichen.`,
        )}
        ${infoBox(
          'Stornierte Rechnung',
          `
          ${detailRow('Rechnungsnummer', invoice.invoice_number)}
          ${detailRow('Rechnungsdatum', formatDate(invoice.invoice_date))}
          ${detailRow('Ursprünglicher Betrag', formatEur(grossAmount))}
          ${detailRow('Status', '<strong style="color:#991b1b;">Storniert</strong>')}
        `,
          'warning',
          settingsData,
        )}
        ${
          reason
            ? infoBox(
                'Grund der Stornierung',
                paragraph(reason),
                'info',
                settingsData,
              )
            : ''
        }
        ${
          hadPartialPayment
            ? infoBox(
                'Bereits gezahlter Betrag',
                paragraph(
                  `Sie haben bereits <strong>${formatEur(amountPaid)}</strong> auf diese Rechnung gezahlt. Der Betrag wird Ihnen separat erstattet – wir melden uns dazu in Kürze.`,
                ),
                'warning',
                settingsData,
              )
            : ''
        }
        ${paragraph(
          'Bitte verwenden Sie diese E-Mail als Beleg für Ihre Buchhaltung. Falls Sie die ursprüngliche Rechnung bereits gebucht haben, stornieren Sie den Vorgang bitte ebenfalls in Ihrer Buchhaltung.',
        )}
        ${paragraph(
          'Bei Rückfragen sind wir unter <a href="mailto:info@kuechenwert24.de" style="color:#1f8aa2;">info@kuechenwert24.de</a> für Sie da.',
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
          from: `${settingsData.site_name} <info@kuechenwert24.de>`,
          to: [recipientEmail],
          subject,
          html,
          reply_to: 'info@kuechenwert24.de',
        }),
      });

      if (!resendRes.ok) {
        emailError = `${resendRes.status}: ${(await resendRes.text()).slice(0, 200)}`;
      } else {
        const resendJson = await resendRes.json();
        emailSent = true;

        await supabaseAdmin.from('admin_emails').insert({
          sender_email: 'info@kuechenwert24.de',
          sender_name: settingsData.site_name,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          recipient_id: invoice.dealer_id,
          subject,
          body_html: html,
          body_text: html.replace(/<[^>]*>/g, ''),
          email_type: 'invoice_cancellation',
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
      edgeLogger.error('Storno email failed', emailError);
      await logEdgeError(supabaseAdmin, {
        component: 'cancel-invoice',
        message: 'Invoice cancelled but Storno email dispatch failed',
        severity: 'high',
        category: 'email',
        originalError: emailError,
        userId: user.id,
        metadata: {
          invoiceId,
          invoiceNumber: invoice.invoice_number,
          recipientEmail,
        },
      });
    }
  } else if (sendEmail && !recipientEmail) {
    emailError = 'Empfänger hat keine E-Mail-Adresse hinterlegt';
  }

  // ─── Step 3: audit log ─────────────────────────────────────────────────
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'cancel_invoice',
      entity_type: 'invoice',
      entity_id: invoice.id,
      details: {
        invoice_number: invoice.invoice_number,
        invoice_type: invoice.invoice_type,
        dealer_id: invoice.dealer_id,
        recipient_email: recipientEmail,
        gross_amount: Number(invoice.gross_amount || 0),
        amount_paid_at_cancel: Number(invoice.amount_paid || 0),
        reason,
        send_email_requested: sendEmail,
        email_sent: emailSent,
        email_error: emailError,
      },
    });
  } catch (e) {
    edgeLogger.error('audit_logs insert failed', e);
  }

  return new Response(
    JSON.stringify({
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      recipientEmail,
      emailSent,
      emailError,
    }),
    { status: 200, headers },
  );
});
