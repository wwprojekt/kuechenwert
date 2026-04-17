/**
 * Shared helper for the admin "Auktion abbrechen" action.
 *
 * Calls the atomic `cancel-auction-as-admin` Edge Function which does in
 * one server-side request:
 *   1. Update the auction row to status='cancelled'
 *   2. Expire open post_auction_offers
 *   3. Notify the SELLER, all classical BIDDERS, all post-auction-offer
 *      proposers and all kaufchance-invitees via Resend
 *   4. Write an audit_log + persist any email failures to error_logs
 *
 * Pre-Refactor (April 17, 2026): The cancellation + offer expiry + bidder
 * notify ran in the browser. Tab close in the middle = stuck offers and no
 * email. Now everything lives on the server.
 */

import { invokeWithAuth } from "@/lib/sessionGuard";

export interface CancelAuctionResult {
  expiredOffersCount: number;
  invitationCount: number;
  uniqueBiddersNotified: number;
  bidderMailsFailed: number;
  sellerMailSent: boolean;
  sellerMailError: string | null;
  vehicleTitle: string;
}

export async function cancelAuctionAsAdmin(
  auctionId: string,
  reason?: string | null,
): Promise<CancelAuctionResult> {
  const { data, error } = await invokeWithAuth("cancel-auction-as-admin", {
    body: {
      auctionId,
      reason: reason ?? null,
      sendEmail: true,
    },
  });

  if (error) throw error;

  const result = data as {
    success?: boolean;
    expiredOffersCount?: number;
    invitationCount?: number;
    uniqueBiddersNotified?: number;
    bidderMailsFailed?: number;
    sellerMailSent?: boolean;
    sellerMailError?: string | null;
    vehicleTitle?: string;
  } | null;

  if (!result?.success) {
    throw new Error("Auktion konnte nicht abgebrochen werden");
  }

  return {
    expiredOffersCount: result.expiredOffersCount ?? 0,
    invitationCount: result.invitationCount ?? 0,
    uniqueBiddersNotified: result.uniqueBiddersNotified ?? 0,
    bidderMailsFailed: result.bidderMailsFailed ?? 0,
    sellerMailSent: !!result.sellerMailSent,
    sellerMailError: result.sellerMailError ?? null,
    vehicleTitle: result.vehicleTitle ?? "Inserat",
  };
}
