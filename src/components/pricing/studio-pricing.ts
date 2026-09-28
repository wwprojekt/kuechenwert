/**
 * Studio-Preise für /preise. Die Rechnung folgt den Datenbankfunktionen
 * calculate_lead_commission_cents und calculate_lead_price_cents, damit Seite
 * und Rechnung nie auseinanderlaufen: Staffelgrenzen gelten „ab min, unter
 * max“, der Prozentwert wird gerundet, dann greifen Mindest- und Höchstbetrag.
 */

export interface CommissionTier {
  order_value_min_cents: number;
  order_value_max_cents: number | null;
  percent: number;
  min_cents: number;
  max_cents: number | null;
}

export interface UnlockPriceRule {
  budget_min_cents: number;
  budget_max_cents: number | null;
  min_price_cents: number;
  max_price_cents: number | null;
  percent_of_budget: number;
}

export interface CommissionResult {
  tier: CommissionTier;
  commissionCents: number;
  minApplied: boolean;
  maxApplied: boolean;
}

export interface UnlockPriceBand {
  budgetMinCents: number;
  budgetMaxCents: number | null;
  lowCents: number;
  /** null = nach oben offen (kein Höchstpreis hinterlegt). */
  highCents: number | null;
}

function clamp(rawCents: number, minCents: number, maxCents: number | null): number {
  const floored = Math.max(rawCents, minCents);
  return maxCents == null ? floored : Math.min(floored, maxCents);
}

function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

export function findCommissionTier(tiers: CommissionTier[], orderValueCents: number): CommissionTier | null {
  let match: CommissionTier | null = null;
  for (const tier of tiers) {
    const inRange =
      tier.order_value_min_cents <= orderValueCents &&
      (tier.order_value_max_cents == null || tier.order_value_max_cents > orderValueCents);
    if (inRange && (!match || tier.order_value_min_cents > match.order_value_min_cents)) match = tier;
  }
  return match;
}

export function calculateCommission(tiers: CommissionTier[], orderValueCents: number): CommissionResult | null {
  if (!Number.isFinite(orderValueCents) || orderValueCents <= 0) return null;
  const tier = findCommissionTier(tiers, orderValueCents);
  if (!tier) return null;
  const raw = percentOf(orderValueCents, tier.percent);
  return {
    tier,
    commissionCents: clamp(raw, tier.min_cents, tier.max_cents),
    minApplied: raw < tier.min_cents,
    maxApplied: tier.max_cents != null && raw > tier.max_cents,
  };
}

/** Fasst die Regeln aller Anfrage-Stufen je Budget-Spanne zu einer Preisspanne zusammen. */
export function unlockPriceBands(rules: UnlockPriceRule[]): UnlockPriceBand[] {
  const bands = new Map<string, UnlockPriceBand>();
  for (const rule of rules) {
    const low = clamp(percentOf(rule.budget_min_cents, rule.percent_of_budget), rule.min_price_cents, rule.max_price_cents);
    const high =
      rule.budget_max_cents == null
        ? rule.max_price_cents
        : clamp(percentOf(rule.budget_max_cents, rule.percent_of_budget), rule.min_price_cents, rule.max_price_cents);
    const key = `${rule.budget_min_cents}:${rule.budget_max_cents ?? "open"}`;
    const band = bands.get(key);
    if (!band) {
      bands.set(key, {
        budgetMinCents: rule.budget_min_cents,
        budgetMaxCents: rule.budget_max_cents,
        lowCents: low,
        highCents: high,
      });
      continue;
    }
    band.lowCents = Math.min(band.lowCents, low);
    band.highCents = band.highCents == null || high == null ? null : Math.max(band.highCents, high);
  }
  return [...bands.values()].sort((a, b) => a.budgetMinCents - b.budgetMinCents);
}

function euro(cents: number, digits: 0 | 2): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Ganze Euro ohne Nachkommastellen, sonst mit Cent. */
export function formatEuro(cents: number): string {
  return euro(cents, cents % 100 === 0 ? 0 : 2);
}

export function formatEuroExact(cents: number): string {
  return euro(cents, 2);
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

/** Spanne mit exklusiver Obergrenze, wie sie die Datenbank auswertet. */
export function formatCentsRange(minCents: number, maxCents: number | null): string {
  if (maxCents == null) return `ab ${formatEuro(minCents)}`;
  if (minCents <= 0) return `unter ${formatEuro(maxCents)}`;
  return `${formatEuro(minCents)} bis unter ${formatEuro(maxCents)}`;
}

export function formatPriceSpan(lowCents: number, highCents: number | null): string {
  if (highCents == null) return `ab ${formatEuro(lowCents)}`;
  if (highCents <= lowCents) return formatEuro(lowCents);
  return `${formatEuro(lowCents)} – ${formatEuro(highCents)}`;
}
