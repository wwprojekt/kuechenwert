import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import {
  buildEmailLayout,
  paragraph,
  greeting,
  infoBox,
  detailRow,
  button,
} from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { edgeLogger, logEdgeError } from '../_shared/edgeLogger.ts';
import { MARKETING_CONFIG, computeKaufchanceRelistReserve } from '../_shared/marketing-config.ts';

/**
 * Edge Function: end-kaufchance
 *
 * Atomic admin action that closes the Kaufchance phase of an auction.
 * Replaces the previous client-side flows in
 *   - AdminPostAuctionOffers.handleEndKaufchance     (mode='end_unsold')
 *   - AdminPostAuctionOffers.handleBackToAuction     (mode='restart_auction')
 * which both bulk-rejected open `post_auction_offers` and deleted
 * `kaufchance_invitations` without informing anyone.
 *
 * mode='end_unsold':
 *   - auction.status -> 'ended'
 *   - kitchen.status -> 'not_sold'
 *   - reject all open post_auction_offers
 *   - delete kaufchance_invitations
 *   - notify all bidders/proposers/invitees + seller
 *
 * mode='restart_auction':
 *   - auction.status -> 'active', new starting time, new end_time = +7d
 *   - kitchen.status -> 'active'
 *   - reset reserve_price, current_bid, kaufchance fields, increment auction_round
 *   - reject all open post_auction_offers, delete kaufchance_invitations and bids
 *   - notify all bidders/proposers/invitees (their offer is invalid; new auction
 *     starts) + seller (your auction is restarted)
 *
 * Body:
 *   { auctionId: string,
 *     mode: 'end_unsold' | 'restart_auction',
 *     reason?: string,
 *     newReservePrice?: number,    // restart_auction only
 *     durationDays?: number,       // restart_auction only (default 7)
 *     sendEmail?: boolean }
 *
 * Email failures persisted to error_logs but do not roll the action back.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SITE_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://caravanwert.de';

type Mode = 'end_unsold' | 'restart_auction';

interface RequestBody {
  auctionId: string;
  mode: Mode;
  reason?: string | null;
  newReservePrice?: number | null;
  durationDays?: number;
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
  const auctionId = body.auctionId?.trim();
  const mode: Mode = body.mode;
  const reason = body.reason?.trim() || null;
  const sendEmail = body.sendEmail !== false;
  // Phase 3: Default-Dauer auf MARKETING_CONFIG.AUCTION_DURATION_DAYS (3 Tage)
  // gesenkt — Admin kann via durationDays-Override aber 1-30 Tage wählen.
  const durationDays = Math.max(
    1,
    Math.min(30, Number(body.durationDays ?? MARKETING_CONFIG.AUCTION_DURATION_DAYS))
  );

  if (!auctionId) {
    return new Response(JSON.stringify({ error: 'auctionId ist erforderlich' }), { status: 400, headers });
  }
  if (mode !== 'end_unsold' && mode !== 'restart_auction') {
    return new Response(
      JSON.stringify({ error: "mode must be 'end_unsold' or 'restart_auction'" }),
      { status: 400, headers },
    );
  }

  // ─── Load auction context ──────────────────────────────────────────────
  const { data: auction, error: auctionErr } = await supabaseAdmin
    .from('auctions')
    .select(`
      id, status, current_bid, starting_bid, reserve_price, end_time, kitchen_id, auction_round,
      seller_initial_reserve, dynamic_pricing,
      kitchen:kitchens(
        id, manufacturer, model, year, postal_code, sale_channel, instant_price, reserve_price, seller_id,
        seller:profiles!kitchens_seller_id_fkey(id, email, first_name, last_name, company_name)
      )
    `)
    .eq('id', auctionId)
    .single();

  if (auctionErr || !auction) {
    return new Response(
      JSON.stringify({ error: 'Auktion nicht gefunden', details: auctionErr?.message }),
      { status: 404, headers },
    );
  }

  const kitchen = (auction as unknown as {
    kitchen: {
      id: string;
      manufacturer: string | null;
      model: string | null;
      year: number | null;
      postal_code: string | null;
      sale_channel: string | null;
      instant_price: number | null;
      reserve_price: number | null;
      seller_id: string | null;
      seller: ProfileLite | null;
    } | null;
  }).kitchen;
  const seller = kitchen?.seller ?? null;
  const vehicleTitle = kitchen
    ? `${kitchen.manufacturer ?? ''} ${kitchen.model ?? ''}`.trim() || 'Inserat'
    : 'Inserat';
  const yearSuffix = kitchen?.year ? ` (${kitchen.year})` : '';

  // restart_auction needs a postal_code (same precondition as normal activation)
  if (mode === 'restart_auction' && !kitchen?.postal_code) {
    return new Response(
      JSON.stringify({ error: 'Das Wohnmobil hat keine PLZ. Bitte zuerst die Fahrzeugdaten vervollständigen.' }),
      { status: 400, headers },
    );
  }

  // ─── Snapshot affected parties BEFORE state changes ────────────────────
  const { data: openOffers } = await supabaseAdmin
    .from('post_auction_offers')
    .select('buyer_id, offer_amount')
    .eq('auction_id', auctionId)
    .in('status', ['pending', 'countered']);

  const { data: openInvitations } = await supabaseAdmin
    .from('kaufchance_invitations')
    .select('bidder_id')
    .eq('auction_id', auctionId);

  const { data: bidsRows } = await supabaseAdmin
    .from('bids')
    .select('bidder_id, amount')
    .eq('auction_id', auctionId);

  // ─── Step 1: state mutation ────────────────────────────────────────────
  let restartEndTime: Date | null = null;
  let actualNewReserve: number | null = null;
  let reserveSourceForAudit: 'admin_override' | 'seller_counter_offer' | 'standard_minus_2pct' | 'no_change' | 'legacy_keep' | 'n/a' = 'n/a';
  if (mode === 'end_unsold') {
    const { error: aErr } = await supabaseAdmin
      .from('auctions')
      .update({ status: 'ended', updated_at: new Date().toISOString() })
      .eq('id', auctionId);
    if (aErr) {
      edgeLogger.error('end_unsold auction update failed', aErr);
      return new Response(
        JSON.stringify({ error: 'Auktion konnte nicht beendet werden', details: aErr.message }),
        { status: 500, headers },
      );
    }
    if (kitchen?.id) {
      await supabaseAdmin
        .from('kitchens')
        .update({ status: 'not_sold', updated_at: new Date().toISOString() })
        .eq('id', kitchen.id);
    }
  } else {
    // restart_auction
    const startTime = new Date();
    restartEndTime = new Date();
    restartEndTime.setDate(restartEndTime.getDate() + durationDays);

    // Reserve-Berechnung Priorität:
    //   1. Admin gibt newReservePrice manuell vor → übernehmen.
    //   2. Sonst (= Admin überlässt es dem System):
    //      Wenn das ein NEU-System-Inserat ist (seller_initial_reserve != NULL)
    //      → gleiche Logik wie der Cron-Auto-Relist: Verkäufer-Counter-Offer
    //        der CURRENT round als Anker × 0,98, Floor-respektiert.
    //      Wenn LEGACY-Inserat → einfach den letzten reserve_price beibehalten
    //        (alte Logik, keine Reduktion ohne explizite Marketingphase-Daten).
    const auctionLifecycle = auction as {
      seller_initial_reserve?: number | null;
      dynamic_pricing?: boolean | null;
      auction_round?: number | null;
    };
    const sellerInitialReserveNum = auctionLifecycle.seller_initial_reserve != null
      ? Number(auctionLifecycle.seller_initial_reserve)
      : null;
    const isNewSystemListing = sellerInitialReserveNum != null && sellerInitialReserveNum > 0;
    const dynamicPricing = auctionLifecycle.dynamic_pricing !== false;
    const currentRoundForOffers = Number(auctionLifecycle.auction_round ?? 1);
    const fallbackReserve = auction.reserve_price ?? kitchen?.reserve_price ?? null;

    let newReserve: number | null;

    if (body.newReservePrice && Number(body.newReservePrice) > 0) {
      newReserve = Number(body.newReservePrice);
      reserveSourceForAudit = 'admin_override';
    } else if (isNewSystemListing && fallbackReserve != null && Number(fallbackReserve) > 0) {
      const { data: sellerCountersThisRound } = await supabaseAdmin
        .from('post_auction_offers')
        .select('counter_offer_amount')
        .eq('auction_id', auctionId)
        .eq('auction_round', currentRoundForOffers)
        .not('counter_offer_amount', 'is', null);

      const counterAmounts = (sellerCountersThisRound ?? [])
        .map((r: { counter_offer_amount: unknown }) => Number(r.counter_offer_amount));

      const reduced = computeKaufchanceRelistReserve(
        Number(fallbackReserve),
        sellerInitialReserveNum!,
        dynamicPricing,
        counterAmounts,
      );
      newReserve = reduced.newReserve;
      reserveSourceForAudit = reduced.source;
      edgeLogger.info('end-kaufchance restart reserve computed', {
        auctionId,
        round: currentRoundForOffers,
        baseReserve: Number(fallbackReserve),
        newReserve,
        source: reduced.source,
        anchor: reduced.anchor,
      });
    } else {
      newReserve = fallbackReserve;
      reserveSourceForAudit = 'legacy_keep';
    }
    actualNewReserve = newReserve;

    // delete bids first so the new auction starts clean
    await supabaseAdmin.from('bids').delete().eq('auction_id', auctionId);

    // Phase 3: Random-Startgebot statt fixem Wert. Schützt vor
    // Reverse-Engineering der Reserve durch Händler über mehrere Runden.
    // Bei RPC-Fehler fallen wir auf den bestehenden starting_bid (oder 50)
    // zurück, damit Admin-Restarts nie hängen bleiben.
    let restartStartingBid = auction.starting_bid ?? 50;
    if (newReserve != null && Number(newReserve) > 0) {
      try {
        const { data: bidData, error: bidErr } = await supabaseAdmin.rpc('compute_random_starting_bid', {
          p_reserve_price: Number(newReserve),
        });
        if (!bidErr && typeof bidData === 'number' && bidData > 0) {
          restartStartingBid = bidData;
        } else if (bidErr) {
          edgeLogger.error('compute_random_starting_bid RPC error in end-kaufchance', bidErr);
        }
      } catch (e) {
        edgeLogger.error('compute_random_starting_bid threw in end-kaufchance', e);
      }
    }

    const { error: aErr } = await supabaseAdmin
      .from('auctions')
      .update({
        status: 'active',
        current_bid: null,
        reserve_price: newReserve,
        starting_bid: restartStartingBid,
        start_time: startTime.toISOString(),
        end_time: restartEndTime.toISOString(),
        kaufchance_expires_at: null,
        kaufchance_min_price: null,
        auction_round: ((auction.auction_round as number | null) ?? 1) + 1,
        auto_relist: true,
        // P4-Fix (BUG5): Beim Admin-Restart einer Auktion ist die "Stable
        // Price" Anzeige zurückzusetzen. Sonst würde der Käufer einen
        // missleadenden Badge "Preis stabil seit X Tagen" sehen, obwohl
        // die Auktion gerade neu gestartet wurde.
        last_price_reduction_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auctionId);

    if (aErr) {
      edgeLogger.error('restart_auction auction update failed', aErr);
      return new Response(
        JSON.stringify({ error: 'Auktion konnte nicht neu gestartet werden', details: aErr.message }),
        { status: 500, headers },
      );
    }
    if (kitchen?.id) {
      await supabaseAdmin
        .from('kitchens')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', kitchen.id);
    }
  }

  // ─── Step 2: reject open offers + delete invitations ───────────────────
  let rejectedOffers = 0;
  if (openOffers && openOffers.length > 0) {
    const sellerResponseText = mode === 'end_unsold'
      ? 'Kaufchance beendet durch Admin'
      : 'Kaufchance beendet – zurück in Auktion';
    const { error: rejErr, count } = await supabaseAdmin
      .from('post_auction_offers')
      .update(
        {
          status: 'rejected',
          seller_response: sellerResponseText,
          updated_at: new Date().toISOString(),
        },
        { count: 'exact' },
      )
      .eq('auction_id', auctionId)
      .in('status', ['pending', 'countered']);
    if (rejErr) {
      edgeLogger.error('reject offers failed', rejErr);
    } else {
      rejectedOffers = count ?? openOffers.length;
    }
  }

  let deletedInvitations = 0;
  if (openInvitations && openInvitations.length > 0) {
    const { error: delErr, count } = await supabaseAdmin
      .from('kaufchance_invitations')
      .delete({ count: 'exact' })
      .eq('auction_id', auctionId);
    if (delErr) {
      edgeLogger.error('delete invitations failed', delErr);
    } else {
      deletedInvitations = count ?? openInvitations.length;
    }
  }

  // ─── Step 3: gather notification recipients ────────────────────────────
  const recipientIds = new Set<string>();
  for (const o of openOffers ?? []) if (o?.buyer_id) recipientIds.add(o.buyer_id);
  for (const inv of openInvitations ?? []) if (inv?.bidder_id) recipientIds.add(inv.bidder_id);
  // restart_auction wipes all bidders too — they need to know
  if (mode === 'restart_auction') {
    for (const b of bidsRows ?? []) if (b?.bidder_id) recipientIds.add(b.bidder_id);
  }
  if (kitchen?.seller_id) recipientIds.delete(kitchen.seller_id);

  let recipientProfiles: ProfileLite[] = [];
  if (recipientIds.size > 0) {
    const { data: profs } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name, company_name')
      .in('id', Array.from(recipientIds));
    recipientProfiles = (profs ?? []) as ProfileLite[];
  }

  // ─── Step 4: send emails ───────────────────────────────────────────────
  let bidderMailsSent = 0;
  let bidderMailsFailed = 0;
  let sellerMailSent = false;
  let sellerMailError: string | null = null;
  const emailErrors: Array<{ recipient: string; error: string }> = [];

  if (sendEmail) {
    const { data: settingsRow } = await supabaseAdmin.from('site_settings').select('*').single();
    const settings: SettingsLike = (settingsRow as SettingsLike | null) ?? fallbackSettings;
    const auctionUrl = `${SITE_URL}/auktion/${auctionId}`;

    // ── Seller mail ─────────────────────────────────────────────────────
    if (seller?.email) {
      const subject = mode === 'end_unsold'
        ? `Kaufchance beendet – ${vehicleTitle}`
        : `Auktion neu gestartet – ${vehicleTitle}`;
      const sellerContent = mode === 'end_unsold'
        ? `
          ${greeting(displayName(seller))}
          ${paragraph(`die Kaufchance-Phase für Ihr Inserat <strong>${vehicleTitle}${yearSuffix}</strong> wurde von einem Administrator beendet. Das Fahrzeug wurde als <strong>nicht verkauft</strong> markiert.`)}
          ${infoBox('Was wurde beendet?', `
            ${detailRow('Offene Festpreis-Angebote (abgelehnt)', String(rejectedOffers))}
            ${detailRow('Kaufchance-Einladungen (entfernt)', String(deletedInvitations))}
          `, 'warning')}
          ${reason ? infoBox('Grund', paragraph(reason), 'info') : ''}
          ${paragraph('Sie können das Fahrzeug bei Bedarf neu inserieren oder einen anderen Verkaufsweg wählen. Bei Rückfragen melden Sie sich gerne bei uns.')}
        `
        : `
          ${greeting(displayName(seller))}
          ${paragraph(`Ihre Auktion <strong>${vehicleTitle}${yearSuffix}</strong> wurde von einem Administrator <strong>neu gestartet</strong>. Die Kaufchance-Phase wurde beendet, alle vorherigen Angebote sind abgelehnt.`)}
          ${infoBox('Neue Auktion', `
            ${detailRow('Status', 'Aktiv')}
            ${detailRow('Läuft bis', restartEndTime ? `${restartEndTime.toLocaleDateString('de-DE')} ${restartEndTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : '—')}
            ${detailRow('Neuer Mindestpreis', body.newReservePrice ? formatEur(Number(body.newReservePrice)) : (auction.reserve_price ? formatEur(auction.reserve_price) : 'unverändert'))}
          `, 'success')}
          ${button('Auktion ansehen', auctionUrl)}
          ${reason ? infoBox('Hinweis', paragraph(reason), 'info') : ''}
        `;
      const html = buildEmailLayout(settings, subject, sellerContent);
      const result = await sendMail(seller.email, subject, html, settings);
      sellerMailSent = result.ok;
      sellerMailError = result.error;
      if (result.ok) {
        try {
          await supabaseAdmin.from('admin_emails').insert({
            sender_email: 'info@caravanwert.de',
            sender_name: settings.site_name,
            recipient_email: seller.email,
            recipient_name: displayName(seller),
            recipient_id: seller.id,
            subject,
            body_html: html,
            body_text: html.replace(/<[^>]*>/g, ''),
            email_type: mode === 'end_unsold' ? 'kaufchance_ended_seller' : 'auction_restarted_seller',
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

    // ── Bidder/proposer mails ───────────────────────────────────────────
    for (const profile of recipientProfiles) {
      if (!profile.email) continue;
      const subject = mode === 'end_unsold'
        ? `Kaufchance beendet – ${vehicleTitle}`
        : `Auktion neu gestartet – ${vehicleTitle}`;
      const bidderContent = mode === 'end_unsold'
        ? `
          ${greeting(displayName(profile))}
          ${paragraph(`die Kaufchance-Phase für das Fahrzeug <strong>${vehicleTitle}${yearSuffix}</strong>, an der Sie sich beteiligt haben, wurde von einem Administrator beendet. Das Fahrzeug wurde als <strong>nicht verkauft</strong> markiert.`)}
          ${infoBox('Was bedeutet das für Sie?', paragraph('Es entstehen Ihnen <strong>keine Kosten</strong> und keine Verpflichtungen aus dieser Kaufchance. Ihr Festpreis-Angebot bzw. Ihre Einladung ist hinfällig.'), 'info')}
          ${reason ? infoBox('Grund', paragraph(reason), 'info') : ''}
          ${paragraph(`Schauen Sie sich gerne in unseren <a href="${SITE_URL}/kaufen" style="color:#1f8aa2;">aktuellen Auktionen</a> nach einem ähnlichen Fahrzeug um.`)}
        `
        : `
          ${greeting(displayName(profile))}
          ${paragraph(`die Kaufchance-Phase für das Fahrzeug <strong>${vehicleTitle}${yearSuffix}</strong> wurde beendet. Stattdessen wurde die Auktion <strong>neu gestartet</strong> – Sie können nun erneut mitbieten!`)}
          ${infoBox('Was bedeutet das für Sie?', `
            ${paragraph('Ihr bisheriges Festpreis-Angebot bzw. Ihre Einladung ist hinfällig. Sie können jetzt regulär in der neuen Auktionsrunde bieten.')}
            ${detailRow('Auktion läuft bis', restartEndTime ? `${restartEndTime.toLocaleDateString('de-DE')} ${restartEndTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : '—')}
          `, 'success')}
          ${button('Jetzt zur Auktion', auctionUrl)}
          ${reason ? infoBox('Hinweis', paragraph(reason), 'info') : ''}
        `;
      const html = buildEmailLayout(settings, subject, bidderContent);
      const result = await sendMail(profile.email, subject, html, settings);
      if (result.ok) {
        bidderMailsSent += 1;
        try {
          await supabaseAdmin.from('admin_emails').insert({
            sender_email: 'info@caravanwert.de',
            sender_name: settings.site_name,
            recipient_email: profile.email,
            recipient_name: displayName(profile),
            recipient_id: profile.id,
            subject,
            body_html: html,
            body_text: html.replace(/<[^>]*>/g, ''),
            email_type: mode === 'end_unsold' ? 'kaufchance_ended_bidder' : 'auction_restarted_bidder',
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
        component: 'end-kaufchance',
        message: `Kaufchance ${mode} succeeded but ${emailErrors.length} email(s) failed`,
        severity: 'high',
        category: 'email',
        userId: user.id,
        metadata: { auctionId, mode, vehicleTitle, emailErrors },
      });
    }
  }

  // ─── Step 5: audit log ─────────────────────────────────────────────────
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: mode === 'end_unsold' ? 'kaufchance_ended' : 'auction_restarted_from_kaufchance',
      entity_type: 'auction',
      entity_id: auctionId,
      details: {
        vehicle_title: vehicleTitle,
        kitchen_id: kitchen?.id ?? null,
        seller_id: kitchen?.seller_id ?? null,
        previous_status: auction.status,
        rejected_offers: rejectedOffers,
        deleted_invitations: deletedInvitations,
        deleted_bids: mode === 'restart_auction' ? (bidsRows?.length ?? 0) : 0,
        unique_recipients_to_notify: recipientProfiles.length,
        seller_mail_sent: sellerMailSent,
        seller_mail_error: sellerMailError,
        bidder_mails_sent: bidderMailsSent,
        bidder_mails_failed: bidderMailsFailed,
        new_reserve_price: mode === 'restart_auction' ? body.newReservePrice ?? null : null,
        actual_new_reserve_used: actualNewReserve,
        reserve_source: reserveSourceForAudit,
        new_end_time: restartEndTime?.toISOString() ?? null,
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
      mode,
      vehicleTitle,
      rejectedOffers,
      deletedInvitations,
      newEndTime: restartEndTime?.toISOString() ?? null,
      uniqueRecipientsNotified: bidderMailsSent,
      bidderMailsFailed,
      sellerMailSent,
      sellerMailError,
      emailErrors,
    }),
    { status: 200, headers },
  );
});
