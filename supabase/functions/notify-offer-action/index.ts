/**
 * notify-offer-action
 * 
 * Zentrale Edge Function für ALLE Benachrichtigungen im Kaufchance-/Nachauktions-Bereich.
 * Läuft serverseitig mit service_role, sodass alle Profile gelesen werden können (kein RLS-Problem).
 *
 * Unterstützte Aktionen:
 *   - new_offer:      Händler gibt ein Angebot ab → Verkäufer + Admin werden benachrichtigt
 *   - offer_rejected:  Verkäufer/Admin lehnt ab → Käufer wird benachrichtigt
 *   - counter_offer:   Verkäufer/Admin macht Gegenangebot → Käufer wird benachrichtigt
 *   - admin_offer:     Admin erstellt Angebot im Namen eines Händlers → Verkäufer wird benachrichtigt
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Service-role client – bypasses RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface NotifyRequest {
  action: 'new_offer' | 'offer_rejected' | 'counter_offer' | 'admin_offer';
  offerId?: string;
  auctionId: string;
  buyerId: string;
  offerAmount: number;
  counterAmount?: number;
  message?: string;
  sellerResponse?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  try {
    const body: NotifyRequest = await req.json();
    const { action, auctionId, buyerId, offerAmount, counterAmount, message, sellerResponse } = body;

    console.log(`[notify-offer-action] action=${action}, auctionId=${auctionId}, buyerId=${buyerId}`);

    // 1. Lade Auktions- und Fahrzeugdaten
    const { data: auctionData, error: auctionError } = await supabase
      .from('auctions')
      .select('id, current_bid, motorhome:motorhomes(id, seller_id, manufacturer, model)')
      .eq('id', auctionId)
      .single();

    if (auctionError || !auctionData?.motorhome) {
      console.error('[notify-offer-action] Auction/motorhome not found:', auctionError);
      return new Response(JSON.stringify({ success: false, error: 'Auction not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    }

    const sellerId = auctionData.motorhome.seller_id;
    const motorhomeName = `${auctionData.motorhome.manufacturer || ''} ${auctionData.motorhome.model || ''}`.trim();

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
        if (sellerProfile?.email) {
          notifications.push(
            supabase.functions.invoke('send-auction-notification', {
              body: {
                email: sellerProfile.email,
                name: sellerProfile.first_name || sellerProfile.email.split('@')[0],
                type: 'seller_new_offer',
                motorhomeModel: motorhomeName,
                auctionUrl: 'https://caravanwert.de/dashboard',
                offerAmount: formattedOffer,
                buyerName: buyerDisplayName,
                currentBid: currentBidFormatted,
              },
            })
          );
          console.log(`[notify-offer-action] → seller_new_offer to ${sellerProfile.email}`);
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
                auctionUrl: 'https://caravanwert.de/kaufen',
                offerAmount: formattedOffer,
                sellerResponse: sellerResponse || undefined,
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
                auctionUrl: 'https://caravanwert.de/kaufen',
                offerAmount: formattedOffer,
                counterAmount: formattedCounter,
                sellerResponse: sellerResponse || undefined,
              },
            })
          );
          console.log(`[notify-offer-action] → buyer_counter_offer to ${buyerProfile.email}`);
        }
        break;
      }
    }

    // Alle Benachrichtigungen parallel senden
    const results = await Promise.allSettled(notifications);
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.error('[notify-offer-action] Some notifications failed:', failed);
    }

    console.log(`[notify-offer-action] Done. Sent ${results.length - failed.length}/${results.length} notifications.`);

    return new Response(JSON.stringify({
      success: true,
      sent: results.length - failed.length,
      total: results.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    });

  } catch (error: any) {
    console.error('[notify-offer-action] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    });
  }
};

Deno.serve(handler);
