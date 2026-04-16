/**
 * Shared helper for the admin "Auktion abbrechen" action.
 *
 * Steps:
 *   1. Update the auction row to status = 'cancelled'
 *   2. Fetch still-open post_auction_offers (pending / countered)
 *   3. Mark those offers as 'expired' with a seller_response
 *   4. Best-effort notify each unique proposer via send-auction-notification
 *      (type: 'lost', listingEnded: true) so they don't see a phantom offer
 *      forever.
 *
 * The auction cancel step is authoritative — the offer cleanup + emails are
 * best-effort and never cause the mutation to fail.
 */

import { supabase } from "@/integrations/supabase/client";

export interface CancelAuctionResult {
  expiredOffersCount: number;
  notifiedProposers: number;
}

export async function cancelAuctionAsAdmin(auctionId: string): Promise<CancelAuctionResult> {
  // 1. Pre-fetch open offers so we can notify their proposers afterwards.
  const { data: openOffers } = await supabase
    .from("post_auction_offers")
    .select("buyer_id, offer_amount")
    .eq("auction_id", auctionId)
    .in("status", ["pending", "countered"]);

  // 2. Primary action: cancel the auction. This is the ONLY step we throw on.
  const { error: cancelError } = await supabase
    .from("auctions")
    .update({ status: "cancelled" })
    .eq("id", auctionId);
  if (cancelError) throw cancelError;

  let expiredOffersCount = 0;
  let notifiedProposers = 0;

  // 3. Best-effort: expire open offers.
  if (openOffers && openOffers.length > 0) {
    try {
      const { error: expireError, count } = await supabase
        .from("post_auction_offers")
        .update({
          status: "expired",
          seller_response: "Inserat wurde vom Administrator abgebrochen",
          updated_at: new Date().toISOString(),
        }, { count: "exact" })
        .eq("auction_id", auctionId)
        .in("status", ["pending", "countered"]);
      if (expireError) {
        console.error("[cancelAuctionAsAdmin] Failed to expire offers:", expireError);
      } else {
        expiredOffersCount = count ?? openOffers.length;
      }
    } catch (e) {
      console.error("[cancelAuctionAsAdmin] Expire offers threw:", e);
    }

    // 4. Best-effort: notify each unique proposer. We intentionally do NOT
    // await these in a way that blocks the UI thread on a slow SMTP.
    try {
      const uniqueBuyerIds = Array.from(
        new Set(openOffers.map((o: { buyer_id: string }) => o.buyer_id).filter(Boolean))
      );
      if (uniqueBuyerIds.length > 0) {
        const { data: motorhomeRow } = await supabase
          .from("auctions")
          .select("motorhome:motorhomes(manufacturer, model, year)")
          .eq("id", auctionId)
          .maybeSingle();
        const m = (motorhomeRow as any)?.motorhome;
        const motorhomeName = m
          ? `${m.manufacturer || ""} ${m.model || ""}`.trim()
          : "Inserat";

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, first_name, company_name")
          .in("id", uniqueBuyerIds);

        for (const buyerId of uniqueBuyerIds) {
          const profile = profiles?.find((p: any) => p.id === buyerId);
          if (!profile?.email) continue;
          const myOffers = openOffers.filter(
            (o: { buyer_id: string; offer_amount: number }) => o.buyer_id === buyerId
          );
          const highestOffer = myOffers.reduce(
            (max: number, o: { offer_amount: number }) =>
              Number(o.offer_amount) > max ? Number(o.offer_amount) : max,
            0
          );
          try {
            await supabase.functions.invoke("send-auction-notification", {
              body: {
                email: profile.email,
                name:
                  profile.company_name ||
                  profile.first_name ||
                  profile.email.split("@")[0],
                type: "lost",
                motorhomeModel: motorhomeName,
                auctionUrl: "https://caravanwert.de/kaufen",
                yourBid: `€${highestOffer.toLocaleString("de-DE")}`,
                currentBid: `€${highestOffer.toLocaleString("de-DE")}`,
                isFestpreis: true,
                listingEnded: true,
              },
            });
            notifiedProposers += 1;
          } catch (notifyErr) {
            console.error(
              `[cancelAuctionAsAdmin] Notify proposer ${buyerId} failed:`,
              notifyErr
            );
          }
        }
      }
    } catch (e) {
      console.error("[cancelAuctionAsAdmin] Notify proposers block threw:", e);
    }
  }

  return { expiredOffersCount, notifiedProposers };
}
