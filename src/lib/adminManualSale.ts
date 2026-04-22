/**
 * Helper for the admin "An Händler verkaufen" action.
 *
 * Calls the `admin-sell-to-dealer` Edge Function which mirrors the full
 * `instant-buy` flow (motorhome+auction state change, invoice, purchase
 * contract, winner/seller/loser notifications, Google Ads conversion,
 * admin summary email) but with admin-supplied buyer + price.
 *
 * Used from `AdminManualSellDialog.tsx` on `AdminAuctionDetail.tsx` for
 * deals negotiated outside the platform that should still produce all the
 * normal artefacts so the dealer dashboard / admin financials / Google Ads
 * reporting look identical to a regular sofortkauf.
 */

import { invokeWithAuth } from "@/lib/sessionGuard";

export interface AdminManualSaleInput {
  auctionId: string;
  buyerId: string;
  salePrice: number;
}

export interface AdminManualSaleResult {
  motorhomeId: string;
  auctionId: string;
  buyerId: string;
  price: number;
  saleType: "instant";
  soldAt: string;
  invoiceNumber: string | null;
  contractNumber: string | null;
  errors: string[];
}

export async function adminSellToDealer(
  input: AdminManualSaleInput,
): Promise<AdminManualSaleResult> {
  const { data, error } = await invokeWithAuth("admin-sell-to-dealer", {
    body: input as unknown as Record<string, unknown>,
  });

  if (error) throw error;

  const payload = data as {
    success?: boolean;
    sale?: AdminManualSaleResult;
    error?: string;
  } | null;

  if (!payload?.success || !payload.sale) {
    throw new Error(payload?.error || "Manueller Verkauf fehlgeschlagen");
  }

  return payload.sale;
}
