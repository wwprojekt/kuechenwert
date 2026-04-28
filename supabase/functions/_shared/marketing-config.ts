/**
 * Marketing-Phase Konfiguration (Edge-Functions)
 *
 * SINGLE SOURCE OF TRUTH für alle Marketing-Phase-Parameter im
 * Edge-Function-Layer. Spiegel im Frontend: src/lib/marketing-config.ts
 *
 * WICHTIG: Wenn du hier etwas änderst, prüfe ob der Frontend-Spiegel
 * auch angepasst werden muss. Die Werte MÜSSEN identisch sein.
 *
 * Phase 1 des Marketing-Phase-Rollouts (siehe Plan v2 in Chat).
 *
 * Juristische Verankerung:
 *   * AGB §6: 16-Tage Marketingphase Auktion (max 4 × 3 Tage + 24h
 *     Kaufchance pro Runde, mit -2 % Reserve-Reduktion pro Runde,
 *     max -6 % vom Initial-Wert)
 *   * AGB §6: 30-Tage Marketingphase Festpreis (10 × 3 Tage Verlängerung,
 *     -2 % pro Runde, -10 % Floor)
 *   * Verkäufer kann jederzeit per Toggle aussteigen (auto_relist=false
 *     bzw. dynamic_pricing=false), wodurch das Inserat zur ursprünglich
 *     vereinbarten Frist endet.
 */

export const MARKETING_CONFIG = {
  // ──────────────────────────────────────────────────────────────────
  // Auktion
  // ──────────────────────────────────────────────────────────────────
  /** Dauer einer einzelnen Auktionsrunde in Tagen (vorher 7) */
  AUCTION_DURATION_DAYS: 3,
  /** Dauer der Kaufchance-Phase in Stunden (vorher 72) */
  KAUFCHANCE_DURATION_HOURS: 24,
  /** Maximale Anzahl Auto-Relist-Runden pro Auktion (1 = original, 2-4 = relists) */
  AUCTION_MAX_ROUNDS: 4,
  /** Reserve-Reduktion pro Runde (Auktion) */
  AUCTION_REDUCTION_PER_ROUND: 0.02,
  /** Maximale Gesamt-Reduktion vom seller_initial_reserve (Auktion) */
  AUCTION_MAX_TOTAL_REDUCTION: 0.06,
  /** Default für dynamic_pricing bei neuen Auktionen */
  AUCTION_DYNAMIC_PRICING_DEFAULT: true,

  // ──────────────────────────────────────────────────────────────────
  // Festpreis
  // ──────────────────────────────────────────────────────────────────
  /** Dauer einer einzelnen Festpreis-Verlängerung in Tagen (vorher 7) */
  INSTANT_PRICE_DURATION_DAYS: 3,
  /** Maximale Gesamtdauer vom Festpreis-Inserat (vorher unbegrenzt) */
  INSTANT_PRICE_MAX_TOTAL_DAYS: 30,
  /** Preis-Reduktion pro Runde (Festpreis) */
  INSTANT_PRICE_REDUCTION_PER_ROUND: 0.02,
  /** Maximale Gesamt-Reduktion vom seller_initial_instant_price */
  INSTANT_PRICE_MAX_TOTAL_REDUCTION: 0.10,
  /** Default für dynamic_pricing bei neuen Festpreis-Inseraten (Opt-in!) */
  INSTANT_PRICE_DYNAMIC_PRICING_DEFAULT: false,

  // ──────────────────────────────────────────────────────────────────
  // Soft-Close (Hot-Bid Extension)
  // ──────────────────────────────────────────────────────────────────
  /** Window in Minuten vor end_time, in dem ein Bid die Auktion verlängert */
  SOFT_CLOSE_WINDOW_MINUTES: 5,
  /** Verlängerung in Minuten bei Trigger */
  SOFT_CLOSE_EXTENSION_MINUTES: 5,

  // ──────────────────────────────────────────────────────────────────
  // Bestand-Migration (siehe Phase 7)
  // ──────────────────────────────────────────────────────────────────
  /** Soft-Cap-Dauer in Tagen für Bestand-Inserate, die nicht opt-in haben */
  EXISTING_LISTINGS_GRACE_DAYS: 60,
  /** Soll Opt-in-Mail an aktive Bestand-Inserate gehen? */
  EXISTING_LISTINGS_OPT_IN_EMAIL: true,

  // ──────────────────────────────────────────────────────────────────
  // Email Anti-Spam
  // ──────────────────────────────────────────────────────────────────
  /** Cooldown in Tagen pro (User, Kitchen) für price_drop-Mails */
  PRICE_DROP_NOTIFICATION_COOLDOWN_DAYS_PER_FAVORITE: 7,
  /** Sollen Verlängerungen Favoriten-Notifications triggern? */
  EXTENSION_NOTIFICATIONS_TO_FAVORITES: false,
  /** "Stabil seit X Tagen"-Badge für Käufer-Sicht ab X Tagen ohne Reserve-Änderung */
  STABLE_PRICE_BADGE_AFTER_DAYS: 7,

  // ──────────────────────────────────────────────────────────────────
  // Soft-Brake / Reactivation Tokens
  // ──────────────────────────────────────────────────────────────────
  /** TTL für Reactivation-Tokens in Tagen (Soft-Brake-Mail-Buttons) */
  REACTIVATION_TOKEN_TTL_DAYS: 7,

  // ──────────────────────────────────────────────────────────────────
  // Random Starting-Bid
  // ──────────────────────────────────────────────────────────────────
  /** Untere Grenze des Random-Faktors (% vom Reserve-Preis) */
  STARTING_BID_MIN_FACTOR: 0.40,
  /** Obere Grenze des Random-Faktors (% vom Reserve-Preis) */
  STARTING_BID_MAX_FACTOR: 0.60,
} as const;

/**
 * Berechnet das maximale Auktion-Cap-Datum ab Aktivierung.
 *
 * Formel: AUCTION_DURATION_DAYS × AUCTION_MAX_ROUNDS + 1 Kaufchance-Tag pro Runde
 * = 3 × 4 + 1 × 4 = 16 Tage
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
 * Berechnet die Reduktions-Floor (= seller_initial × (1 - max_reduction))
 * für Auktion oder Festpreis.
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
 * Berechnet den nächsten reduzierten Reserve-Preis für eine Runde.
 * Gibt NICHT unter den Floor.
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

// ─────────────────────────────────────────────────────────────────────────
// Kaufchance-driven Reserve-Reduktion (Phase 4 / Audit Round 5)
// ─────────────────────────────────────────────────────────────────────────
//
// Kontext: Wenn eine Kaufchance abläuft ohne Acceptance und die Auktion
// auto-relisted wird, war die alte Logik blind: einfach `currentReserve × 0,98`.
// Das ignoriert ein wertvolles Markt-Signal: die Counter-Offers, die der
// VERKÄUFER während der Kaufchance den Käufern gemacht hat (= "OK, ich würde
// XX € akzeptieren"). Wenn der Käufer diesen Counter abgelehnt hat, hat der
// Verkäufer SELBST signalisiert, was sein wahrer Schmerzpunkt ist.
//
// Neue Logik:
//   1. Suche das niedrigste counter_offer_amount der aktuellen Runde
//      (= Verkäufer hat selbst gesagt "das wäre für mich noch OK").
//   2. Wenn vorhanden UND < currentReserve: neuer Reserve = counter × 0,98
//   3. Floor-Schutz greift weiter (nie unter seller_initial × 0,94 für Auktion)
//   4. Wenn kein Counter existiert (Verkäufer hat nur abgelehnt): Fallback auf
//      computeNextReducedReserve(currentReserve, ...) — alte Logik.
//
// Anti-Vertrauensbruch: Wir benutzen NIEMALS das offer_amount (Käufer-Gebot)
// als Anker, weil der Verkäufer das ja explizit abgelehnt hat. Wir würden
// sonst gegen seinen ausdrücklichen Willen unter sein "Nein" gehen.
//
// Idempotenz: pure function, keine Side-Effects. Caller bringt die Daten
// (counter_offers) als Array mit, damit der Helper ohne Supabase-Client
// arbeitet und in beiden Edge Functions (check-expired-auctions UND
// end-kaufchance) wiederverwendbar ist.
// ─────────────────────────────────────────────────────────────────────────

export type KaufchanceRelistAnchorSource =
  | 'seller_counter_offer'  // Verkäufer-Counter war Anker
  | 'standard_minus_2pct'   // Fallback: alte -2% Logik (kein Counter, oder Counter ≥ Reserve)
  | 'no_change';            // dynamic_pricing OFF → Reserve bleibt

export interface KaufchanceRelistResult {
  /** Der neue Reserve-Preis nach Reduktion (Floor-respektiert) */
  newReserve: number;
  /** Welche Logik den Anker geliefert hat (für Logging/Audit) */
  source: KaufchanceRelistAnchorSource;
  /** Der Anker-Wert vor der ×0,98-Reduktion (für Debug-Logs); null wenn no_change */
  anchor: number | null;
}

/**
 * Berechnet den neuen Reserve für einen Kaufchance-Auto-Relist.
 *
 * @param currentReserve  Reserve vor dem Relist (= kaufchance_min_price)
 * @param sellerInitial   seller_initial_reserve (für Floor-Berechnung)
 * @param dynamicPricing  Verkäufer-Opt-in. Wenn false → kein Reduce, source='no_change'
 * @param sellerCounterOffersThisRound  Array von counter_offer_amount-Werten der
 *                                      aktuellen Runde (NUR Verkäufer-Counter, nicht
 *                                      Käufer-Offer). Caller filtert vorher auf
 *                                      auction_round = currentRound + status sinnvoll.
 *                                      Null/undefined/leer ist erlaubt → Fallback.
 */
export function computeKaufchanceRelistReserve(
  currentReserve: number,
  sellerInitial: number,
  dynamicPricing: boolean,
  sellerCounterOffersThisRound: ReadonlyArray<number | null | undefined> | null | undefined,
): KaufchanceRelistResult {
  if (!dynamicPricing) {
    return { newReserve: currentReserve, source: 'no_change', anchor: null };
  }

  const validCounters = (sellerCounterOffersThisRound ?? [])
    .map((v) => (v == null ? NaN : Number(v)))
    .filter((v) => Number.isFinite(v) && v > 0);

  const floor = computeReserveFloor(sellerInitial, 'auction');

  if (validCounters.length > 0) {
    const lowestCounter = Math.min(...validCounters);

    // Sanity: nur als Anker nehmen, wenn Counter < currentReserve.
    // Sonst hätte der Verkäufer effektiv hochgekontert (ein höherer Counter
    // wäre eine Erhöhung des Wunschpreises) → würden wir den als Anker × 0,98
    // nehmen, käme evtl. ein höherer oder gleicher Reserve raus → kontra-
    // produktiv, dann lieber Fallback auf -2% von currentReserve.
    if (lowestCounter < currentReserve) {
      const reducedFromCounter = Math.round(lowestCounter * (1 - MARKETING_CONFIG.AUCTION_REDUCTION_PER_ROUND));
      const newReserve = Math.max(reducedFromCounter, floor);
      return { newReserve, source: 'seller_counter_offer', anchor: lowestCounter };
    }
  }

  // Fallback: standard -2 % von currentReserve, Floor-respektiert.
  const standard = computeNextReducedReserve(currentReserve, sellerInitial, 'auction');
  return { newReserve: standard, source: 'standard_minus_2pct', anchor: currentReserve };
}
