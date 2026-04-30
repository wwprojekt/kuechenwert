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
 * Edge Function: cancel-auction-as-admin
 *
 * Atomic admin action: cancels an auction and notifies EVERYONE who is
 * affected — seller, classical bidders, post-auction-offer proposers and
 * Kaufchance-Invitees. Replaces the previous client-side flow which only
 * cancelled the row + emailed Festpreis-Anbieter.
 *
 * Order of operations:
 *   1. Auth: caller must be admin
 *   2. Load auction + kitchen + seller (need email + display title)
 *   3. Snapshot affected parties BEFORE any state change:
 *        - distinct bidder_ids from `bids`
 *        - distinct buyer_ids from open `post_auction_offers`
 *        - distinct bidder_ids from open `kaufchance_invitations`
 *   4. Update auction status='cancelled'
 *   5. Best-effort expire open offers + invitations (so the dashboards
 *      don't keep them visible as actionable)
 *   6. Best-effort send "auction cancelled" mail to:
 *        - seller (different copy: yours was cancelled by admin)
 *        - all unique bidders/proposers (you no longer need to act)
 *   7. Audit log entry with all counts
 *
 * Email failures are persisted to error_logs and reported in the response
 * (perAudienceEmailErrors) but never roll the cancellation back.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

interface RequestBody {
  auctionId: string;
  reason?: string | null;
  sendEmail?: boolean;
}

function formatEur(value: number | null | undefined): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

interface ProfileLite {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

function displayName(p: ProfileLite | null | undefined): string {
  if (!p) return '';
  return p.company_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.email?.split('@')[0] ?? '');
}

interface SettingsLike {
  site_name: string;
  site_description: string;
  contact_email: string;
  support_phone: string;
  logo_url?: string;
  primary_color?: string;
}

async function sendMail(
  recipientEmail: string,
  recipientName: string | null,
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

  const auctionId = body.auctionId?.trim();
  const reason = body.reason?.trim() || null;
  const sendEmail = body.sendEmail !== false;

  if (!auctionId) {
    return new Response(JSON.stringify({ error: 'auctionId ist erforderlich' }), {
      status: 400,
      headers,
    });
  }

  // ─── Load auction context ──────────────────────────────────────────────
  const { data: auction, error: auctionErr } = await supabaseAdmin
    .from('auctions')
    .select(
      'id, status, current_bid, starting_bid, end_time, kitchen_id, kitchen:kitchens(manufacturer, model, year, seller_id, seller:profiles!kitchens_seller_id_fkey(id, email, first_name, last_name, company_name))',
    )
    .eq('id', auctionId)
    .single();

  if (auctionErr || !auction) {
    return new Response(
      JSON.stringify({ error: 'Auktion nicht gefunden', details: auctionErr?.message }),
      { status: 404, headers },
    );
  }

  if (auction.status === 'cancelled') {
    return new Response(
      JSON.stringify({ error: 'Diese Auktion wurde bereits abgebrochen' }),
      { status: 400, headers },
    );
  }

  const kitchen = (auction as unknown as {
    kitchen: {
      manufacturer: string | null;
      model: string | null;
      year: number | null;
      seller_id: string | null;
      seller: ProfileLite | null;
    } | null;
  }).kitchen;
  const seller = kitchen?.seller ?? null;
  const vehicleTitle = kitchen
    ? `${kitchen.manufacturer ?? ''} ${kitchen.model ?? ''}`.trim() || 'Inserat'
    : 'Inserat';
  const yearSuffix = kitchen?.year ? ` (${kitchen.year})` : '';

  // ─── Snapshot affected parties BEFORE any change ───────────────────────
  const { data: bidsRows } = await supabaseAdmin
    .from('bids')
    .select('bidder_id, amount')
    .eq('auction_id', auctionId);

  const { data: openOffers } = await supabaseAdmin
    .from('post_auction_offers')
    .select('buyer_id, offer_amount')
    .eq('auction_id', auctionId)
    .in('status', ['pending', 'countered']);

  // kaufchance_invitations has no status column — every row is a live
  // invitation tied to the auction.
  const { data: openInvitations } = await supabaseAdmin
    .from('kaufchance_invitations')
    .select('bidder_id')
    .eq('auction_id', auctionId);

  // ─── Step 1: cancel the auction ────────────────────────────────────────
  const { error: cancelError } = await supabaseAdmin
    .from('auctions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', auctionId);

  if (cancelError) {
    edgeLogger.error('auction cancel update failed', cancelError);
    return new Response(
      JSON.stringify({ error: 'Auktion konnte nicht abgebrochen werden', details: cancelError.message }),
      { status: 500, headers },
    );
  }

  // ─── Step 2: best-effort expire open offers ───────────────────────────
  let expiredOffersCount = 0;
  if (openOffers && openOffers.length > 0) {
    try {
      const { error: expireErr, count } = await supabaseAdmin
        .from('post_auction_offers')
        .update(
          {
            status: 'expired',
            seller_response: 'Inserat wurde vom Administrator abgebrochen',
            updated_at: new Date().toISOString(),
          },
          { count: 'exact' },
        )
        .eq('auction_id', auctionId)
        .in('status', ['pending', 'countered']);
      if (expireErr) {
        edgeLogger.error('expire offers failed', expireErr);
      } else {
        expiredOffersCount = count ?? openOffers.length;
      }
    } catch (e) {
      edgeLogger.error('expire offers threw', e);
    }
  }

  // (kaufchance_invitations are tied to auction.status via RLS / UI logic;
  // setting auctions.status='cancelled' implicitly retires them. We just
  // include the bidders in the notification set below.)
  const invitationCount = openInvitations?.length ?? 0;

  // ─── Step 4: prepare email recipient set + load profiles ──────────────
  const bidderIds = new Set<string>();
  for (const b of bidsRows ?? []) {
    if (b?.bidder_id) bidderIds.add(b.bidder_id);
  }
  for (const o of openOffers ?? []) {
    if (o?.buyer_id) bidderIds.add(o.buyer_id);
  }
  for (const inv of openInvitations ?? []) {
    if (inv?.bidder_id) bidderIds.add(inv.bidder_id);
  }
  // Don't notify the seller via the bidder template
  if (kitchen?.seller_id) bidderIds.delete(kitchen.seller_id);

  let bidderProfiles: ProfileLite[] = [];
  if (bidderIds.size > 0) {
    const { data: profs } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name, company_name')
      .in('id', Array.from(bidderIds));
    bidderProfiles = (profs ?? []) as ProfileLite[];
  }

  // ─── Step 5: send emails ──────────────────────────────────────────────
  let bidderMailsSent = 0;
  let bidderMailsFailed = 0;
  let sellerMailSent = false;
  let sellerMailError: string | null = null;
  const emailErrors: Array<{ recipient: string; error: string }> = [];

  if (sendEmail) {
    const { data: settings } = await supabaseAdmin.from('site_settings').select('*').single();
    const settingsData: SettingsLike = (settings as SettingsLike | null) ?? {
      site_name: 'KuechenWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'info@kuechenwert24.de',
      support_phone: '+49 511 51532476',
    };

    // ── Seller mail ─────────────────────────────────────────────────────
    if (seller?.email) {
      const subject = `Ihre Auktion wurde abgebrochen – ${vehicleTitle}`;
      const content = `
        ${greeting(displayName(seller))}
        ${paragraph(
          `wir möchten Sie informieren, dass Ihre Auktion <strong>${vehicleTitle}${yearSuffix}</strong> von einem Administrator abgebrochen wurde.`,
        )}
        ${infoBox(
          'Details',
          `
          ${detailRow('Fahrzeug', `${vehicleTitle}${yearSuffix}`)}
          ${detailRow('Aktuelles Höchstgebot', formatEur(auction.current_bid))}
          ${detailRow('Anzahl Gebote', String(bidsRows?.length ?? 0))}
          ${detailRow('Offene Festpreis-Angebote', String(openOffers?.length ?? 0))}
          ${detailRow('Offene Kaufchance-Einladungen', String(invitationCount))}
        `,
          'warning',
        )}
        ${reason ? infoBox('Grund', paragraph(reason), 'info') : ''}
        ${paragraph(
          'Alle laufenden Festpreis-Angebote und Kaufchance-Einladungen wurden automatisch beendet. Die Bieter wurden separat informiert.',
        )}
        ${paragraph(
          'Falls Sie Ihr Fahrzeug erneut anbieten möchten, können Sie es im Verkäufer-Dashboard reaktivieren oder bei Fragen unter <a href="mailto:info@kuechenwert24.de" style="color:#1f8aa2;">info@kuechenwert24.de</a> auf uns zukommen.',
        )}
      `;
      const html = buildEmailLayout(settingsData, subject, content);
      const result = await sendMail(seller.email, displayName(seller), subject, html, settingsData);
      sellerMailSent = result.ok;
      sellerMailError = result.error;
      if (result.ok) {
        try {
          await supabaseAdmin.from('admin_emails').insert({
            sender_email: 'info@kuechenwert24.de',
            sender_name: settingsData.site_name,
            recipient_email: seller.email,
            recipient_name: displayName(seller),
            recipient_id: seller.id,
            subject,
            body_html: html,
            body_text: html.replace(/<[^>]*>/g, ''),
            email_type: 'auction_cancelled_seller',
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

    // ── Bidder mails ────────────────────────────────────────────────────
    for (const profile of bidderProfiles) {
      if (!profile.email) continue;
      const subject = `Auktion abgebrochen – ${vehicleTitle}`;
      const content = `
        ${greeting(displayName(profile))}
        ${paragraph(
          `wir möchten Sie informieren, dass die Auktion <strong>${vehicleTitle}${yearSuffix}</strong>, an der Sie sich beteiligt haben, von einem Administrator abgebrochen wurde.`,
        )}
        ${infoBox(
          'Was bedeutet das für Sie?',
          `
          ${paragraph('Es entstehen Ihnen <strong>keine Kosten</strong> und keine Verpflichtungen aus dieser Auktion. Alle Ihre Gebote, Festpreis-Angebote und Kaufchance-Einladungen sind hinfällig.')}
        `,
          'info',
        )}
        ${reason ? infoBox('Grund des Abbruchs', paragraph(reason), 'info') : ''}
        ${paragraph(
          'Schauen Sie sich gerne in unseren <a href="https://kuechenwert24.de/kaufen" style="color:#1f8aa2;">aktuellen Auktionen</a> nach einem ähnlichen Fahrzeug um.',
        )}
        ${paragraph(
          'Bei Rückfragen erreichen Sie uns unter <a href="mailto:info@kuechenwert24.de" style="color:#1f8aa2;">info@kuechenwert24.de</a>.',
        )}
      `;
      const html = buildEmailLayout(settingsData, subject, content);
      const result = await sendMail(profile.email, displayName(profile), subject, html, settingsData);
      if (result.ok) {
        bidderMailsSent += 1;
        try {
          await supabaseAdmin.from('admin_emails').insert({
            sender_email: 'info@kuechenwert24.de',
            sender_name: settingsData.site_name,
            recipient_email: profile.email,
            recipient_name: displayName(profile),
            recipient_id: profile.id,
            subject,
            body_html: html,
            body_text: html.replace(/<[^>]*>/g, ''),
            email_type: 'auction_cancelled_bidder',
            direction: 'outbound',
            status: 'sent',
            resend_id: result.resendId,
            sent_by: user.id,
            is_read: true,
          });
        } catch (e) {
          edgeLogger.error('admin_emails insert failed (bidder)', e);
        }
      } else {
        bidderMailsFailed += 1;
        emailErrors.push({ recipient: `bidder:${profile.email}`, error: result.error ?? 'unknown' });
      }
    }

    if (emailErrors.length > 0) {
      await logEdgeError(supabaseAdmin, {
        component: 'cancel-auction-as-admin',
        message: `Auction cancelled but ${emailErrors.length} email(s) failed`,
        severity: 'high',
        category: 'email',
        userId: user.id,
        metadata: { auctionId, vehicleTitle, emailErrors },
      });
    }
  }

  // ─── Step 6: audit log ────────────────────────────────────────────────
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'cancel_auction',
      entity_type: 'auction',
      entity_id: auctionId,
      details: {
        vehicle_title: vehicleTitle,
        kitchen_id: auction.kitchen_id,
        seller_id: kitchen?.seller_id ?? null,
        seller_email: seller?.email ?? null,
        previous_status: auction.status,
        current_bid: Number(auction.current_bid || 0),
        bid_count: bidsRows?.length ?? 0,
        offer_count: openOffers?.length ?? 0,
        invitation_count: invitationCount,
        expired_offers: expiredOffersCount,
        unique_bidders_to_notify: bidderProfiles.length,
        seller_mail_sent: sellerMailSent,
        seller_mail_error: sellerMailError,
        bidder_mails_sent: bidderMailsSent,
        bidder_mails_failed: bidderMailsFailed,
        reason,
        send_email_requested: sendEmail,
      },
    });
  } catch (e) {
    edgeLogger.error('audit_logs insert failed', e);
  }

  return new Response(
    JSON.stringify({
      success: true,
      auctionId,
      vehicleTitle,
      expiredOffersCount,
      invitationCount,
      uniqueBiddersNotified: bidderMailsSent,
      bidderMailsFailed,
      sellerMailSent,
      sellerMailError,
      emailErrors,
    }),
    { status: 200, headers },
  );
});
