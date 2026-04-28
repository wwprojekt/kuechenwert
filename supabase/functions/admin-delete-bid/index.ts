import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import {
  buildEmailLayout,
  paragraph,
  greeting,
  infoBox,
  detailRow,
  warningBox,
} from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { edgeLogger, logEdgeError } from '../_shared/edgeLogger.ts';

/**
 * Edge Function: admin-delete-bid
 *
 * Atomic admin action that deletes a bid. The SQL RPC also removes the
 * matching `bid_confirmed`/`outbid` rows from `dealer_notifications` so the
 * deletion is invisible to all other parties — they will see the next
 * place_bid (or auction end) without any trace of the removed bid.
 *
 * Order of operations:
 *   1. Auth: caller must be admin
 *   2. Snapshot bid + auction + bidder profile + vehicle title BEFORE deletion
 *   3. Call SQL RPC `admin_delete_bid` (atomic with advisory lock,
 *      cleans up dealer_notifications, recomputes auction.current_bid +
 *      dealer_levels, writes audit_logs)
 *   4. Optionally send notification email to the affected bidder
 *      (DEFAULT: OFF — the typical flow is "dealer phoned us to undo, no
 *      email needed". Pass sendEmail: true to override.)
 *   5. Application-level audit_logs enrichment (admin user_id + email outcome)
 *
 * Body:
 *   { bidId: string,
 *     reason?: string,
 *     sendEmail?: boolean   // default false }
 *
 * Response codes:
 *   200 success
 *   400 BAD_REQUEST (missing bidId or invalid JSON)
 *   401 missing/invalid auth
 *   403 caller is not admin
 *   404 NOT_FOUND (bid deleted in the meantime)
 *   409 WRONG_STATUS (auction raced to ended/sold/kaufchance/cancelled)
 *   500 unexpected RPC error
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SITE_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://caravanwert.de';

interface RequestBody {
  bidId: string;
  reason?: string | null;
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
}

const fallbackSettings: SettingsLike = {
  site_name: 'CaravanWert',
  site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
  contact_email: 'info@caravanwert.de',
  support_phone: '+49 511 51532476',
};

function displayName(p: ProfileLite | null | undefined): string {
  if (!p) return '';
  return p.company_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.email?.split('@')[0] ?? '');
}

function formatEur(value: number | null | undefined): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

async function sendMail(
  recipientEmail: string,
  subject: string,
  html: string,
  settings: SettingsLike,
): Promise<{ ok: boolean; error: string | null; resendId: string | null }> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not configured', resendId: null };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settings.site_name} <info@caravanwert.de>`,
        to: [recipientEmail],
        subject,
        html,
        reply_to: 'info@caravanwert.de',
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `${res.status}: ${(await res.text()).slice(0, 200)}`, resendId: null };
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  // ─── Auth: admin only ──────────────────────────────────────────────────
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers });
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
    return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403, headers });
  }

  // ─── Parse + validate ──────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }
  const bidId = body.bidId?.trim();
  const reason = body.reason?.trim() || null;
  // Default: NO email. Real-world flow is "dealer calls in, asks us to undo a
  // bid he just placed" — sending him an automated 'your bid was removed by
  // an admin' email afterwards is noisy and confusing. Admin can opt-in
  // explicitly by passing sendEmail: true.
  const sendEmail = body.sendEmail === true;

  if (!bidId) {
    return new Response(
      JSON.stringify({ error: 'bidId ist erforderlich', code: 'BAD_REQUEST' }),
      { status: 400, headers },
    );
  }

  // ─── Step 1: snapshot bid + auction + vehicle BEFORE deletion ──────────
  const { data: bid, error: bidErr } = await supabaseAdmin
    .from('bids')
    .select(`
      id, amount, bidder_id, auction_id, created_at,
      auction:auctions(
        id, status, current_bid, starting_bid, end_time, kitchen_id,
        kitchen:kitchens(id, manufacturer, model, year)
      )
    `)
    .eq('id', bidId)
    .maybeSingle();

  if (bidErr || !bid) {
    return new Response(
      JSON.stringify({ error: 'Gebot nicht gefunden', details: bidErr?.message }),
      { status: 404, headers },
    );
  }

  const auctionInfo = (bid as unknown as {
    auction: {
      id: string;
      status: string;
      current_bid: number | null;
      starting_bid: number | null;
      end_time: string | null;
      kitchen_id: string | null;
      kitchen: { id: string; manufacturer: string | null; model: string | null; year: number | null } | null;
    } | null;
  }).auction;
  const kitchen = auctionInfo?.kitchen ?? null;
  const vehicleTitle = kitchen
    ? `${kitchen.manufacturer ?? ''} ${kitchen.model ?? ''}`.trim() || 'Fahrzeug'
    : 'Fahrzeug';
  const yearSuffix = kitchen?.year ? ` (${kitchen.year})` : '';

  const { data: bidder } = await supabaseAdmin
    .from('profiles')
    .select('id, email, first_name, last_name, company_name')
    .eq('id', bid.bidder_id)
    .maybeSingle();

  // ─── Step 2: call SQL RPC (atomic, with advisory lock) ─────────────────
  const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('admin_delete_bid', { p_bid_id: bidId });
  if (rpcErr) {
    edgeLogger.error('admin_delete_bid RPC failed', rpcErr);
    return new Response(
      JSON.stringify({ error: 'Gebot konnte nicht gelöscht werden', details: rpcErr.message }),
      { status: 500, headers },
    );
  }
  if (rpcData && rpcData.success === false) {
    // Map well-known RPC failure codes to specific HTTP statuses so the
    // frontend can react (e.g. invalidate the auction query when status
    // raced from 'active' to 'ended' between page load and click).
    const rpcCode: string | undefined = rpcData.code;
    const status =
      rpcCode === 'NOT_FOUND' ? 404 :
      rpcCode === 'WRONG_STATUS' ? 409 :
      400;
    return new Response(
      JSON.stringify({
        error: rpcData.error || 'Gebot konnte nicht gelöscht werden',
        code: rpcCode ?? 'RPC_FAILED',
        auctionStatus: rpcData.status ?? null,
      }),
      { status, headers },
    );
  }
  const wasHighest = !!rpcData?.was_highest;
  const newCurrentBid = rpcData?.new_current_bid ?? null;
  const notificationsRemoved = Number(rpcData?.notifications_removed ?? 0);

  // ─── Step 3: send notification email to affected bidder ────────────────
  let mailSent = false;
  let mailError: string | null = null;
  const recipientEmail = bidder?.email ?? null;

  if (sendEmail && recipientEmail) {
    const { data: settingsRow } = await supabaseAdmin.from('site_settings').select('*').single();
    const settings: SettingsLike = (settingsRow as SettingsLike | null) ?? fallbackSettings;
    const auctionUrl = `${SITE_URL}/auktion/${bid.auction_id}`;

    const subject = `Ihr Gebot wurde entfernt – ${vehicleTitle}`;
    const content = `
      ${greeting(displayName(bidder))}
      ${paragraph(`wir möchten Sie informieren, dass eines Ihrer Gebote bei der Auktion <strong>${vehicleTitle}${yearSuffix}</strong> von einem Administrator entfernt wurde.`)}
      ${infoBox('Entferntes Gebot', `
        ${detailRow('Fahrzeug', `${vehicleTitle}${yearSuffix}`)}
        ${detailRow('Gebotsbetrag', formatEur(bid.amount))}
        ${detailRow('Abgegeben am', new Date(bid.created_at).toLocaleString('de-DE'))}
        ${wasHighest ? detailRow('War Höchstgebot', 'Ja') : ''}
      `, 'warning')}
      ${wasHighest
        ? warningBox(`Da Ihr Gebot das Höchstgebot war, ist nun ${newCurrentBid ? `<strong>${formatEur(newCurrentBid)}</strong> das aktuelle Höchstgebot` : 'die Auktion wieder ohne Gebote'}. Sie können bei Interesse weiterhin mitbieten.`)
        : ''}
      ${reason ? infoBox('Grund', paragraph(reason), 'info') : infoBox('Hinweis', paragraph('Gebote werden in der Regel nur entfernt, wenn sie versehentlich abgegeben wurden, gegen unsere Regeln verstoßen, oder der Bieter darum gebeten hat.'), 'info')}
      ${paragraph(`<a href="${auctionUrl}" style="color:#1f8aa2;">Zur Auktion →</a>`)}
      ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settings.contact_email}" style="color:#1f8aa2;">${settings.contact_email}</a>.`)}
    `;

    const html = buildEmailLayout(settings, subject, content);
    const result = await sendMail(recipientEmail, subject, html, settings);
    mailSent = result.ok;
    mailError = result.error;

    if (result.ok) {
      try {
        await supabaseAdmin.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: settings.site_name,
          recipient_email: recipientEmail,
          recipient_name: displayName(bidder),
          recipient_id: bidder?.id ?? null,
          subject,
          body_html: html,
          body_text: html.replace(/<[^>]*>/g, ''),
          email_type: 'bid_deleted_by_admin',
          direction: 'outbound',
          status: 'sent',
          resend_id: result.resendId,
          sent_by: user.id,
          is_read: true,
        });
      } catch (e) {
        edgeLogger.error('admin_emails insert failed', e);
      }
    } else {
      await logEdgeError(supabaseAdmin, {
        component: 'admin-delete-bid',
        message: `Bid deleted but email failed: ${result.error}`,
        severity: 'high',
        category: 'email',
        userId: user.id,
        metadata: { bidId, auctionId: bid.auction_id, recipientEmail, error: result.error },
      });
    }
  }

  // ─── Step 4: audit-log enrichment ──────────────────────────────────────
  // The SQL RPC already inserts a basic 'bid_deleted' row. We add an
  // application-level entry that captures the email outcome + reason.
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'bid_deleted_by_admin',
      entity_type: 'bid',
      entity_id: bidId,
      details: {
        auction_id: bid.auction_id,
        bidder_id: bid.bidder_id,
        bidder_email: recipientEmail,
        amount: bid.amount,
        was_highest: wasHighest,
        new_current_bid: newCurrentBid,
        notifications_removed: notificationsRemoved,
        vehicle_title: vehicleTitle,
        reason,
        mail_sent: mailSent,
        mail_error: mailError,
        send_email_requested: sendEmail,
      },
    });
  } catch (e) {
    edgeLogger.error('audit_logs insert failed', e);
  }

  return new Response(
    JSON.stringify({
      success: true,
      bidId,
      auctionId: bid.auction_id,
      deletedAmount: Number(bid.amount),
      wasHighest,
      newCurrentBid,
      notificationsRemoved,
      mailSent,
      mailError,
      message: notificationsRemoved > 0
        ? `Gebot gelöscht – ${notificationsRemoved} Benachrichtigung(en) ebenfalls entfernt`
        : 'Gebot wurde gelöscht',
    }),
    { status: 200, headers },
  );
});
