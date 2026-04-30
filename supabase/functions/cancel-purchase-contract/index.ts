import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import {
  buildEmailLayout,
  paragraph,
  greeting,
  infoBox,
  detailRow,
} from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { edgeLogger, logEdgeError } from '../_shared/edgeLogger.ts';

/**
 * Edge Function: cancel-purchase-contract
 *
 * Atomic admin action: cancels a purchase contract and notifies BOTH buyer
 * and seller. Replaces the previous client-side flow which only flipped
 * the row to status='cancelled' and reset the kitchen — without telling
 * either party.
 *
 * Order of operations:
 *   1. Auth: caller must be admin
 *   2. Load contract + linked kitchen + buyer + seller profiles
 *   3. Validate (already cancelled / completed → reject)
 *   4. Update purchase_contracts (status, cancelled_at, cancellation_reason)
 *   5. Reset kitchen status if no other active contract exists
 *      (mirrors the previous client-side cleanup)
 *   6. Send cancellation email to buyer AND seller
 *   7. Audit log
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

interface RequestBody {
  contractId: string;
  reason: string;
  sendEmail?: boolean;
}

interface ProfileLite {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

interface SettingsLike {
  site_name: string;
  site_description: string;
  contact_email: string;
  support_phone: string;
  logo_url?: string;
  primary_color?: string;
}

function formatEur(value: number | null | undefined): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function displayName(p: ProfileLite | null | undefined, fallback?: string | null): string {
  if (!p) return fallback?.trim() || '';
  return (
    p.company_name ||
    `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() ||
    p.email?.split('@')[0] ||
    fallback?.trim() ||
    ''
  );
}

async function sendMail(
  recipientEmail: string,
  subject: string,
  html: string,
  settingsData: SettingsLike,
): Promise<{ ok: boolean; error: string | null; resendId: string | null }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
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
    if (!res.ok) {
      return {
        ok: false,
        error: `${res.status}: ${(await res.text()).slice(0, 200)}`,
        resendId: null,
      };
    }
    const json = await res.json();
    return { ok: true, error: null, resendId: json?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), resendId: null };
  }
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

  const contractId = body.contractId?.trim();
  const reason = body.reason?.trim() ?? '';
  const sendEmail = body.sendEmail !== false;

  if (!contractId) {
    return new Response(JSON.stringify({ error: 'contractId ist erforderlich' }), {
      status: 400,
      headers,
    });
  }
  if (!reason) {
    return new Response(JSON.stringify({ error: 'reason ist erforderlich' }), {
      status: 400,
      headers,
    });
  }

  // ─── Load contract + parties ───────────────────────────────────────────
  const { data: contract, error: contractErr } = await supabaseAdmin
    .from('purchase_contracts')
    .select(
      'id, contract_number, status, sale_price, vehicle_description, kitchen_id, buyer_id, seller_id, buyer_name, seller_name, created_at',
    )
    .eq('id', contractId)
    .single();

  if (contractErr || !contract) {
    return new Response(
      JSON.stringify({ error: 'Vertrag nicht gefunden', details: contractErr?.message }),
      { status: 404, headers },
    );
  }

  if (contract.status === 'cancelled') {
    return new Response(
      JSON.stringify({ error: 'Vertrag wurde bereits storniert' }),
      { status: 400, headers },
    );
  }

  // ─── Load profiles for both parties ────────────────────────────────────
  const partyIds = [contract.buyer_id, contract.seller_id].filter((x): x is string => !!x);
  let buyer: ProfileLite | null = null;
  let seller: ProfileLite | null = null;
  if (partyIds.length > 0) {
    const { data: profs } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name, company_name')
      .in('id', partyIds);
    buyer = (profs ?? []).find((p: ProfileLite) => p.id === contract.buyer_id) ?? null;
    seller = (profs ?? []).find((p: ProfileLite) => p.id === contract.seller_id) ?? null;
  }

  // ─── Step 1: cancel contract ───────────────────────────────────────────
  const { error: cancelErr } = await supabaseAdmin
    .from('purchase_contracts')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId);

  if (cancelErr) {
    edgeLogger.error('cancel contract update failed', cancelErr);
    return new Response(
      JSON.stringify({ error: 'Vertrag konnte nicht storniert werden', details: cancelErr.message }),
      { status: 500, headers },
    );
  }

  // ─── Step 2: reset kitchen status if no other active contract ────────
  let kitchenReset: 'pending' | 'active' | null = null;
  if (contract.kitchen_id) {
    try {
      const { data: otherActive } = await supabaseAdmin
        .from('purchase_contracts')
        .select('id')
        .eq('kitchen_id', contract.kitchen_id)
        .eq('status', 'active')
        .limit(1);

      if (!otherActive || otherActive.length === 0) {
        const { data: liveAuction } = await supabaseAdmin
          .from('auctions')
          .select('id, status')
          .eq('kitchen_id', contract.kitchen_id)
          .in('status', ['active', 'draft', 'kaufchance'])
          .limit(1);

        const newStatus: 'active' | 'pending' =
          liveAuction && liveAuction.length > 0 ? 'active' : 'pending';

        const { error: mhErr, data: updRows } = await supabaseAdmin
          .from('kitchens')
          .update({
            status: newStatus,
            sold_at: null,
            sold_to: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contract.kitchen_id)
          .eq('status', 'sold')
          .select('id');

        if (mhErr) {
          edgeLogger.error('kitchen reset failed', mhErr);
        } else if (updRows && updRows.length > 0) {
          kitchenReset = newStatus;
        }
      }
    } catch (e) {
      edgeLogger.error('kitchen reset block threw', e);
    }
  }

  // ─── Step 3: send emails ───────────────────────────────────────────────
  const { data: settings } = await supabaseAdmin.from('site_settings').select('*').single();
  const settingsData: SettingsLike = (settings as SettingsLike | null) ?? {
    site_name: 'KuechenWert',
    site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
    contact_email: 'info@kuechenwert24.de',
    support_phone: '+49 511 51532476',
  };

  const vehicleDesc = contract.vehicle_description?.trim() || 'das Fahrzeug';
  const buyerDisplay = displayName(buyer, contract.buyer_name);
  const sellerDisplay = displayName(seller, contract.seller_name);

  let buyerMailSent = false;
  let buyerMailError: string | null = null;
  let sellerMailSent = false;
  let sellerMailError: string | null = null;
  const emailErrors: Array<{ recipient: string; error: string }> = [];

  function buildHtml(forParty: 'buyer' | 'seller'): { subject: string; html: string } {
    const recipientName = forParty === 'buyer' ? buyerDisplay : sellerDisplay;
    const counterpartLabel = forParty === 'buyer' ? 'Verkäufer' : 'Käufer';
    const counterpartName =
      forParty === 'buyer'
        ? sellerDisplay || contract.seller_name || '—'
        : buyerDisplay || contract.buyer_name || '—';

    const subject = `Kaufvertrag ${contract.contract_number} wurde storniert`;
    const content = `
      ${greeting(recipientName)}
      ${paragraph(
        `wir möchten Sie informieren, dass der Kaufvertrag <strong>${contract.contract_number}</strong> über ${vehicleDesc} <strong>storniert</strong> wurde.`,
      )}
      ${infoBox(
        'Vertragsdetails',
        `
        ${detailRow('Vertragsnummer', contract.contract_number)}
        ${detailRow('Fahrzeug', vehicleDesc)}
        ${detailRow('Kaufpreis', formatEur(contract.sale_price))}
        ${detailRow(counterpartLabel, counterpartName)}
        ${detailRow('Status', 'Storniert')}
      `,
        'warning',
      )}
      ${infoBox('Grund der Stornierung', paragraph(reason), 'info')}
      ${paragraph(
        forParty === 'buyer'
          ? 'Falls Sie bereits eine Anzahlung oder den Kaufpreis überwiesen haben, melden Sie sich bitte umgehend bei uns – wir koordinieren die Rückabwicklung.'
          : 'Das Fahrzeug ist damit wieder frei. Falls Sie eine neue Auktion oder ein Festpreis-Angebot starten möchten, können Sie das im Verkäufer-Dashboard tun.',
      )}
      ${paragraph(
        `Bei Rückfragen erreichen Sie uns unter <a href="mailto:info@kuechenwert24.de" style="color:#1f8aa2;">info@kuechenwert24.de</a> oder telefonisch unter ${settingsData.support_phone}.`,
      )}
    `;
    return { subject, html: buildEmailLayout(settingsData, subject, content) };
  }

  if (sendEmail) {
    if (buyer?.email) {
      const { subject, html } = buildHtml('buyer');
      const result = await sendMail(buyer.email, subject, html, settingsData);
      buyerMailSent = result.ok;
      buyerMailError = result.error;
      if (result.ok) {
        try {
          await supabaseAdmin.from('admin_emails').insert({
            sender_email: 'info@kuechenwert24.de',
            sender_name: settingsData.site_name,
            recipient_email: buyer.email,
            recipient_name: buyerDisplay,
            recipient_id: buyer.id,
            subject,
            body_html: html,
            body_text: html.replace(/<[^>]*>/g, ''),
            email_type: 'contract_cancelled_buyer',
            direction: 'outbound',
            status: 'sent',
            resend_id: result.resendId,
            sent_by: user.id,
            is_read: true,
          });
        } catch (e) {
          edgeLogger.error('admin_emails insert failed (buyer)', e);
        }
      } else {
        emailErrors.push({ recipient: `buyer:${buyer.email}`, error: result.error ?? 'unknown' });
      }
    }

    if (seller?.email) {
      const { subject, html } = buildHtml('seller');
      const result = await sendMail(seller.email, subject, html, settingsData);
      sellerMailSent = result.ok;
      sellerMailError = result.error;
      if (result.ok) {
        try {
          await supabaseAdmin.from('admin_emails').insert({
            sender_email: 'info@kuechenwert24.de',
            sender_name: settingsData.site_name,
            recipient_email: seller.email,
            recipient_name: sellerDisplay,
            recipient_id: seller.id,
            subject,
            body_html: html,
            body_text: html.replace(/<[^>]*>/g, ''),
            email_type: 'contract_cancelled_seller',
            direction: 'outbound',
            status: 'sent',
            resend_id: result.resendId,
            sent_by: user.id,
            is_read: true,
          });
        } catch (e) {
          edgeLogger.error('admin_emails insert failed (seller)', e);
        }
      } else {
        emailErrors.push({ recipient: `seller:${seller.email}`, error: result.error ?? 'unknown' });
      }
    }

    if (emailErrors.length > 0) {
      await logEdgeError(supabaseAdmin, {
        component: 'cancel-purchase-contract',
        message: `Contract cancelled but ${emailErrors.length} email(s) failed`,
        severity: 'high',
        category: 'contract',
        userId: user.id,
        metadata: {
          contractId,
          contractNumber: contract.contract_number,
          emailErrors,
        },
      });
    }
  }

  // ─── Step 4: audit log ────────────────────────────────────────────────
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'cancel_purchase_contract',
      entity_type: 'purchase_contract',
      entity_id: contractId,
      details: {
        contract_number: contract.contract_number,
        sale_price: Number(contract.sale_price || 0),
        kitchen_id: contract.kitchen_id,
        buyer_id: contract.buyer_id,
        buyer_email: buyer?.email ?? null,
        seller_id: contract.seller_id,
        seller_email: seller?.email ?? null,
        reason,
        kitchen_reset_to: kitchenReset,
        buyer_mail_sent: buyerMailSent,
        buyer_mail_error: buyerMailError,
        seller_mail_sent: sellerMailSent,
        seller_mail_error: sellerMailError,
        send_email_requested: sendEmail,
      },
    });
  } catch (e) {
    edgeLogger.error('audit_logs insert failed', e);
  }

  return new Response(
    JSON.stringify({
      success: true,
      contractId,
      contractNumber: contract.contract_number,
      kitchenReset,
      buyerMailSent,
      buyerMailError,
      sellerMailSent,
      sellerMailError,
      emailErrors,
    }),
    { status: 200, headers },
  );
});
