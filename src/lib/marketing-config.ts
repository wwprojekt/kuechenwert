/**
 * Marketing-Phase Konfiguration (Frontend)
 *
 * SPIEGEL von supabase/functions/_shared/marketing-config.ts
 *
 * WICHTIG: Beide Dateien MÜSSEN identische Werte haben. Bei Änderung
 * IMMER beide Dateien anpassen.
 *
 * Phase 1 des Marketing-Phase-Rollouts.
 *
 * Wird genutzt von:
 *   - Wizard (SaleChannelStep) für Aufklärungsbox + Consent-Texte
 *   - Dashboard (ListingDetail) für Schedule-Card + Toggle-Texte
 *   - Admin (AuctionEditDialog, AdminPostAuctionOffers) für Default-Dauern
 *   - Käufer-View (AuctionDetail) für Stable-Price-Badge
 */

export const MARKETING_CONFIG = {
  // Auktion
  AUCTION_DURATION_DAYS: 3,
  KAUFCHANCE_DURATION_HOURS: 24,
  AUCTION_MAX_ROUNDS: 4,
  AUCTION_REDUCTION_PER_ROUND: 0.02,
  AUCTION_MAX_TOTAL_REDUCTION: 0.06,
  AUCTION_DYNAMIC_PRICING_DEFAULT: true,

  // Festpreis
  INSTANT_PRICE_DURATION_DAYS: 3,
  INSTANT_PRICE_MAX_TOTAL_DAYS: 30,
  INSTANT_PRICE_REDUCTION_PER_ROUND: 0.02,
  INSTANT_PRICE_MAX_TOTAL_REDUCTION: 0.10,
  INSTANT_PRICE_DYNAMIC_PRICING_DEFAULT: false,

  // Soft-Close
  SOFT_CLOSE_WINDOW_MINUTES: 5,
  SOFT_CLOSE_EXTENSION_MINUTES: 5,

  // Bestand
  EXISTING_LISTINGS_GRACE_DAYS: 60,
  EXISTING_LISTINGS_OPT_IN_EMAIL: true,

  // Email Anti-Spam
  PRICE_DROP_NOTIFICATION_COOLDOWN_DAYS_PER_FAVORITE: 7,
  EXTENSION_NOTIFICATIONS_TO_FAVORITES: false,
  STABLE_PRICE_BADGE_AFTER_DAYS: 7,

  // Soft-Brake / Reactivation
  REACTIVATION_TOKEN_TTL_DAYS: 7,

  // Random Starting-Bid (nur für Anti-Reverse-Engineering-Hinweise im Wizard)
  STARTING_BID_MIN_FACTOR: 0.40,
  STARTING_BID_MAX_FACTOR: 0.60,
} as const;

/**
 * Berechnet das maximale Auktion-Cap-Datum ab Aktivierung.
 */
export function computeAuctionMaxUntil(startedAt: Date = new Date()): Date {
  const ms =
    (MARKETING_CONFIG.AUCTION_DURATION_DAYS * MARKETING_CONFIG.AUCTION_MAX_ROUNDS +
      MARKETING_CONFIG.AUCTION_MAX_ROUNDS) *
    24 *
    60 *
    60 *
    1000;
  return new Date(startedAt.getTime() + ms);
}

/**
 * Berechnet das maximale Festpreis-Cap-Datum ab Aktivierung.
 */
export function computeInstantPriceMaxUntil(startedAt: Date = new Date()): Date {
  const ms = MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_DAYS * 24 * 60 * 60 * 1000;
  return new Date(startedAt.getTime() + ms);
}

/**
 * Reduktions-Floor (= seller_initial × (1 - max_reduction)).
 * Wird im Verkäufer-Dashboard als "Niedrigster automatischer Mindestpreis"
 * angezeigt, damit Verkäufer wissen, was schlimmstenfalls passieren kann.
 */
export function computeReserveFloor(
  sellerInitial: number,
  channel: 'auction' | 'instant_price',
): number {
  const reduction =
    channel === 'auction'
      ? MARKETING_CONFIG.AUCTION_MAX_TOTAL_REDUCTION
      : MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_REDUCTION;
  return Math.round(sellerInitial * (1 - reduction));
}

/**
 * Berechnet den nächsten reduzierten Reserve-Preis (für Schedule-Card-Vorschau).
 */
export function computeNextReducedReserve(
  currentReserve: number,
  sellerInitial: number,
  channel: 'auction' | 'instant_price',
): number {
  const perRound =
    channel === 'auction'
      ? MARKETING_CONFIG.AUCTION_REDUCTION_PER_ROUND
      : MARKETING_CONFIG.INSTANT_PRICE_REDUCTION_PER_ROUND;
  const floor = computeReserveFloor(sellerInitial, channel);
  const reduced = Math.round(currentReserve * (1 - perRound));
  return Math.max(reduced, floor);
}

/**
 * Formatiert eine Anzahl Tage in einen lesbaren deutschen Text
 * für die Aufklärungsbox im Wizard.
 */
export function formatMarketingDuration(channel: 'auction' | 'instant_price'): string {
  if (channel === 'auction') {
    const totalDays =
      MARKETING_CONFIG.AUCTION_DURATION_DAYS * MARKETING_CONFIG.AUCTION_MAX_ROUNDS +
      MARKETING_CONFIG.AUCTION_MAX_ROUNDS;
    return `${MARKETING_CONFIG.AUCTION_DURATION_DAYS} Tage Auktion + ${MARKETING_CONFIG.KAUFCHANCE_DURATION_HOURS}h Kaufchance, bis zu ${MARKETING_CONFIG.AUCTION_MAX_ROUNDS} Runden, max. ${totalDays} Tage Bindung`;
  }
  return `${MARKETING_CONFIG.INSTANT_PRICE_DURATION_DAYS} Tage Festpreis, automatische Verlängerung bis max. ${MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_DAYS} Tage`;
}
