/**
 * notify-offer-action
 * 
 * Zentrale Edge Function für ALLE Benachrichtigungen im Kaufchance-/Nachauktions-Bereich.
 * Läuft serverseitig mit service_role, sodass alle Profile gelesen werden können (kein RLS-Problem).
 *
 * Unterstützte Aktionen:
 *   - new_offer:            Händler gibt ein Angebot ab → Verkäufer + Admin werden benachrichtigt
 *   - offer_rejected:       Verkäufer/Admin lehnt ab → Käufer wird benachrichtigt
 *   - counter_offer:        Verkäufer/Admin macht Gegenangebot → Käufer wird benachrichtigt
 *   - admin_offer:          Admin erstellt Angebot im Namen eines Händlers → Verkäufer wird benachrichtigt
 *   - buyer_reject_counter: Käufer lehnt Gegenangebot ab → Verkäufer + Admin werden benachrichtigt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Service-role client – bypasses RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface NotifyRequest {
  action: 'new_offer' | 'offer_rejected' | 'counter_offer' | 'admin_offer' | 'buyer_reject_counter';
  offerId?: string;
  auctionId: string;
  buyerId: string;
  offerAmount: number;
  counterAmount?: number;
  message?: string;
  sellerResponse?: string;
}

type MotorhomeRow = { seller_id: string | null };

function getSellerIdFromAuction(auctionData: { motorhome: MotorhomeRow | MotorhomeRow[] | null } | null): string | null {
  const mh = auctionData?.motorhome;
  if (!mh) return null;
  return Array.isArray(mh) ? (mh[0]?.seller_id ?? null) : (mh.seller_id ?? null);
}

/**
 * Erlaubt Aufrufe von echten Beteiligten (Händler = Bieter, Verkäufer = seller_id),
 * nicht nur Admin/Service-Role. Vorher schlug jeder Händler-Aufruf mit 401 fehl → keine E-Mails.
 */
async function authorizeNotifyOfferRequest(
  req: Request,
  body: NotifyRequest,
  corsHeaders: Record<string, string>,
): Promise<{ authorized: true } | { authorized: false; response: Response }> {
  const base = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (base.authorized) return base;

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return base;

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser(token);
  if (userErr || !user) return base;

  // Nur Admins dürfen admin_offer auslösen (Händler täuscht sonst fremde IDs vor)
  if (body.action === 'admin_offer') {
    return base;
  }

  const { data: auctionRow } = await supabase
    .from('auctions')
    .select('motorhome:motorhomes(seller_id)')
    .eq('id', body.auctionId)
    .maybeSingle();

  const sellerId = getSellerIdFromAuction(auctionRow as { motorhome: MotorhomeRow | MotorhomeRow[] | null } | null);

  if (body.action === 'new_offer') {
    if (user.id !== body.buyerId) return base;

    // For Festpreis listings, any authenticated dealer can make a proposal (no invitation needed)
    const { data: auctionCheck } = await supabase
      .from('auctions')
      .select('status, motorhome:motorhomes(sale_channel)')
      .eq('id', body.auctionId)
      .maybeSingle();
    const saleChannel = Array.isArray(auctionCheck?.motorhome)
      ? auctionCheck.motorhome[0]?.sale_channel
      : (auctionCheck?.motorhome as any)?.sale_channel;

    if (saleChannel === 'instant_price' && auctionCheck?.status === 'active') {
      // Prevent seller from proposing on own listing
      if (sellerId && user.id === sellerId) return base;
      // Festpreis: verify user is a dealer
      const { data: dealerRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['dealer', 'admin'])
        .maybeSingle();
      if (dealerRole) return { authorized: true };
      return base;
    }

    // Regular Kaufchance: require invitation
    const { data: inv } = await supabase
      .from('kaufchance_invitations')
      .select('id')
      .eq('auction_id', body.auctionId)
      .eq('bidder_id', body.buyerId)
      .maybeSingle();
    if (!inv) return base;
    const { data: offer } = await supabase
      .from('post_auction_offers')
      .select('id')
      .eq('auction_id', body.auctionId)
      .eq('buyer_id', body.buyerId)
      .in('status', ['pending', 'countered'])
      .maybeSingle();
    if (!offer) return base;
    return { authorized: true };
  }

  if (body.action === 'buyer_reject_counter') {
    if (user.id !== body.buyerId) return base;
    const { data: offer } = await supabase
      .from('post_auction_offers')
      .select('id')
      .eq('auction_id', body.auctionId)
      .eq('buyer_id', body.buyerId)
      .maybeSingle();
    if (!offer) return base;
    return { authorized: true };
  }

  if (body.action === 'offer_rejected' || body.action === 'counter_offer') {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const isAdmin = roles?.some((r: { role: string }) => r.role === 'admin');
    if (isAdmin) return { authorized: true };
    if (sellerId && user.id === sellerId) return { authorized: true };
    return base;
  }

  return base;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);

  let body: NotifyRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const authResult = await authorizeNotifyOfferRequest(req, body, corsHeaders);
  if (!authResult.authorized) return authResult.response;

  try {
    const { action, auctionId, buyerId, offerAmount, counterAmount, message, sellerResponse } = body;

    console.log(`[notify-offer-action] action=${action}, auctionId=${auctionId}, buyerId=${buyerId}`);

    // 1. Lade Auktions- und Fahrzeugdaten
    const { data: auctionData, error: auctionError } = await supabase
      .from('auctions')
      .select('id, current_bid, status, motorhome:motorhomes(id, seller_id, manufacturer, model, sale_channel)')
      .eq('id', auctionId)
      .single();

    const mhJoined = auctionData?.motorhome;
    const mh = Array.isArray(mhJoined) ? mhJoined[0] : mhJoined;

    if (auctionError || !auctionData || !mh) {
      console.error('[notify-offer-action] Auction/motorhome not found:', auctionError);
      return new Response(JSON.stringify({ success: false, error: 'Auction not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const sellerId = mh.seller_id;
    const motorhomeName = `${mh.manufacturer || ''} ${mh.model || ''}`.trim();
    const isFestpreis = (mh as any).sale_channel === 'instant_price';

    // 2. Lade Käufer-Profil (service_role → kein RLS)
    const { data: buyerProfile } = await supabase
      .from('profiles')
      .select('email, first_name, last_name, company_name, customer_number')
      .eq('id', buyerId)
      .single();

    // 3. Lade Verkäufer-Profil (service_role → kein RLS)
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('email, first_name, last_name, company_name, customer_number')
      .eq('id', sellerId)
      .single();

    const buyerDisplayName = buyerProfile?.company_name
      || `${buyerProfile?.first_name || ''} ${buyerProfile?.last_name || ''}`.trim()
      || 'Ein Händler';
    const sellerDisplayName = sellerProfile?.company_name
      || `${sellerProfile?.first_name || ''} ${sellerProfile?.last_name || ''}`.trim()
      || 'Verkäufer';

    const formattedOffer = `${offerAmount.toLocaleString('de-DE')} €`;
    const formattedCounter = counterAmount ? `${counterAmount.toLocaleString('de-DE')} €` : undefined;
    const currentBidFormatted = auctionData.current_bid
      ? `${Number(auctionData.current_bid).toLocaleString('de-DE')} €`
      : undefined;

    // 4. Sende die passenden E-Mails je nach Aktion
    const notifications: Promise<any>[] = [];

    switch (action) {
      case 'new_offer':
      case 'admin_offer': {
        // Verkäufer benachrichtigen: Neues Angebot eingegangen
        // WICHTIG: buyerName wird NICHT an Verkäufer gesendet (Anonymität bis Kaufvertrag)
        if (sellerProfile?.email) {
          notifications.push(
            supabase.functions.invoke('send-auction-notification', {
              body: {
                email: sellerProfile.email,
                name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
                type: 'seller_new_offer',
                motorhomeModel: motorhomeName,
                auctionUrl: `https://caravanwert.de/dashboard/listings/${mh.id}`,
                offerAmount: formattedOffer,
                currentBid: currentBidFormatted,
                isFestpreis,
              },
            })
          );
          console.log(`[notify-offer-action] → seller_new_offer to ${sellerProfile.email} (buyer anonymized)`);
        }

        // Admin-CC: Nur Admins sehen den echten Händlernamen (admin_new_offer statt seller_new_offer)
        try {
          const { data: adminRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin');

          if (adminRoles && adminRoles.length > 0) {
            const adminIds = adminRoles.map((r: { user_id: string }) => r.user_id);
            const { data: adminProfiles } = await supabase
              .from('profiles')
              .select('email, first_name')
              .in('id', adminIds);

            if (adminProfiles) {
              for (const admin of adminProfiles) {
                if (admin.email && admin.email !== sellerProfile?.email) {
                  notifications.push(
                    supabase.functions.invoke('send-auction-notification', {
                      body: {
                        email: admin.email,
                        name: admin.first_name || 'Admin',
                        type: 'admin_new_offer',
                        motorhomeModel: motorhomeName,
                        auctionUrl: 'https://caravanwert.de/admin/offers',
                        offerAmount: formattedOffer,
                        buyerName: buyerDisplayName,
                        currentBid: currentBidFormatted,
                        isFestpreis,
                      },
                    })
                  );
                  console.log(`[notify-offer-action] → admin CC new_offer to ${admin.email}`);
                }
              }
            }
          }
        } catch (adminErr) {
          console.error('[notify-offer-action] Failed to send admin CC:', adminErr);
        }
        break;
      }

      case 'offer_rejected': {
        // Käufer benachrichtigen: Angebot abgelehnt
        if (buyerProfile?.email) {
          notifications.push(
            supabase.functions.invoke('send-auction-notification', {
              body: {
                email: buyerProfile.email,
                name: buyerDisplayName,
                type: 'buyer_offer_rejected',
                motorhomeModel: motorhomeName,
                auctionUrl: `https://caravanwert.de/auktion/${auctionId}`,
                offerAmount: formattedOffer,
                sellerResponse: sellerResponse || undefined,
                isFestpreis,
              },
            })
          );
          console.log(`[notify-offer-action] → buyer_offer_rejected to ${buyerProfile.email}`);
        }
        break;
      }

      case 'counter_offer': {
        // Käufer benachrichtigen: Gegenangebot erhalten
        if (buyerProfile?.email) {
          notifications.push(
            supabase.functions.invoke('send-auction-notification', {
              body: {
                email: buyerProfile.email,
                name: buyerDisplayName,
                type: 'buyer_counter_offer',
                motorhomeModel: motorhomeName,
                auctionUrl: `https://caravanwert.de/auktion/${auctionId}`,
                offerAmount: formattedOffer,
                counterAmount: formattedCounter,
                sellerResponse: sellerResponse || undefined,
                isFestpreis,
              },
            })
          );
          console.log(`[notify-offer-action] → buyer_counter_offer to ${buyerProfile.email}`);
        }
        break;
      }

      case 'buyer_reject_counter': {
        // Verkäufer benachrichtigen: Käufer hat Gegenangebot abgelehnt
        if (sellerProfile?.email) {
          notifications.push(
            supabase.functions.invoke('send-auction-notification', {
              body: {
                email: sellerProfile.email,
                name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
                type: 'seller_buyer_rejected',
                motorhomeModel: motorhomeName,
                auctionUrl: `https://caravanwert.de/dashboard/listings/${mh.id}`,
                offerAmount: formattedOffer,
                counterAmount: formattedCounter,
                isFestpreis,
              },
            })
          );
          console.log(`[notify-offer-action] → seller_buyer_rejected to ${sellerProfile.email}`);
        }

        // Admin-CC
        try {
          const { data: adminRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin');

          if (adminRoles && adminRoles.length > 0) {
            const adminIds = adminRoles.map((r: { user_id: string }) => r.user_id);
            const { data: adminProfiles } = await supabase
              .from('profiles')
              .select('email, first_name')
              .in('id', adminIds);

            if (adminProfiles) {
              for (const admin of adminProfiles) {
                if (admin.email && admin.email !== sellerProfile?.email) {
                  notifications.push(
                    supabase.functions.invoke('send-auction-notification', {
                      body: {
                        email: admin.email,
                        name: admin.first_name || 'Admin',
                        type: 'seller_buyer_rejected',
                        motorhomeModel: motorhomeName,
                        auctionUrl: 'https://caravanwert.de/admin/offers',
                        offerAmount: formattedOffer,
                        counterAmount: formattedCounter,
                        buyerName: buyerDisplayName,
                      },
                    })
                  );
                  console.log(`[notify-offer-action] → admin CC buyer_reject_counter to ${admin.email}`);
                }
              }
            }
          }
        } catch (adminErr) {
          console.error('[notify-offer-action] Failed to send admin CC:', adminErr);
        }
        break;
      }
    }

    // Alle Benachrichtigungen parallel senden
    const results = await Promise.allSettled(notifications);
    let failed = 0;
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[notify-offer-action] Notification rejected:', r.reason);
        failed++;
      } else if (r.status === 'fulfilled' && r.value?.error) {
        console.error('[notify-offer-action] Notification invoke error:', r.value.error);
        failed++;
      }
    }
    if (failed > 0) {
      console.error(`[notify-offer-action] ${failed}/${results.length} notifications failed`);
    }

    console.log(`[notify-offer-action] Done. Sent ${results.length - failed}/${results.length} notifications.`);

    return new Response(JSON.stringify({
      success: true,
      sent: results.length - failed,
      total: results.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('[notify-offer-action] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

Deno.serve(handler);
