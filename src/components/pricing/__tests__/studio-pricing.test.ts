import { describe, expect, it } from "vitest";
import {
  type CommissionTier,
  type UnlockPriceRule,
  calculateCommission,
  formatCentsRange,
  formatEuro,
  formatEuroExact,
  formatPercent,
  formatPriceSpan,
  unlockPriceBands,
} from "../studio-pricing";

const TIERS: CommissionTier[] = [
  { order_value_min_cents: 0, order_value_max_cents: 1_000_000, percent: 2, min_cents: 20_000, max_cents: null },
  { order_value_min_cents: 1_000_000, order_value_max_cents: 1_500_000, percent: 1.8, min_cents: 25_000, max_cents: null },
  { order_value_min_cents: 1_500_000, order_value_max_cents: 2_500_000, percent: 1.6, min_cents: 30_000, max_cents: null },
  { order_value_min_cents: 2_500_000, order_value_max_cents: 4_000_000, percent: 1.4, min_cents: 40_000, max_cents: null },
  { order_value_min_cents: 4_000_000, order_value_max_cents: null, percent: 1.2, min_cents: 60_000, max_cents: null },
];

const plain = (text: string) => text.replace(/\u00a0/g, " ");

describe("calculateCommission", () => {
  it("wendet den Mindestbetrag an, wenn der Prozentwert darunter liegt", () => {
    expect(calculateCommission(TIERS, 500_000)).toMatchObject({ commissionCents: 20_000, minApplied: true, maxApplied: false });
  });

  it("behandelt die Obergrenze einer Staffel als exklusiv", () => {
    const result = calculateCommission(TIERS, 1_000_000);
    expect(result?.tier.percent).toBe(1.8);
    expect(result?.commissionCents).toBe(25_000);
  });

  it("rechnet den Prozentwert, wenn er über dem Mindestbetrag liegt", () => {
    expect(calculateCommission(TIERS, 2_000_000)).toMatchObject({ commissionCents: 32_000, minApplied: false });
  });

  it("nutzt die offene oberste Staffel", () => {
    expect(calculateCommission(TIERS, 10_000_000)?.commissionCents).toBe(120_000);
  });

  it("deckelt auf den Höchstbetrag", () => {
    const capped: CommissionTier[] = [{ ...TIERS[4], order_value_min_cents: 0, max_cents: 50_000 }];
    expect(calculateCommission(capped, 10_000_000)).toMatchObject({ commissionCents: 50_000, maxApplied: true });
  });

  it("liefert null ohne Betrag oder ohne passende Staffel", () => {
    expect(calculateCommission(TIERS, 0)).toBeNull();
    expect(calculateCommission(TIERS, Number.NaN)).toBeNull();
    expect(calculateCommission([], 500_000)).toBeNull();
  });
});

describe("unlockPriceBands", () => {
  const rules: UnlockPriceRule[] = [
    { budget_min_cents: 0, budget_max_cents: 1_000_000, percent_of_budget: 1, min_price_cents: 3_500, max_price_cents: 8_000 },
    { budget_min_cents: 0, budget_max_cents: 1_000_000, percent_of_budget: 2, min_price_cents: 5_000, max_price_cents: 12_000 },
    { budget_min_cents: 1_000_000, budget_max_cents: null, percent_of_budget: 1, min_price_cents: 6_000, max_price_cents: 12_000 },
    { budget_min_cents: 1_000_000, budget_max_cents: null, percent_of_budget: 1.5, min_price_cents: 8_000, max_price_cents: 17_000 },
  ];

  it("fasst alle Anfrage-Stufen einer Budget-Spanne zusammen", () => {
    expect(unlockPriceBands(rules)).toEqual([
      { budgetMinCents: 0, budgetMaxCents: 1_000_000, lowCents: 3_500, highCents: 12_000 },
      { budgetMinCents: 1_000_000, budgetMaxCents: null, lowCents: 10_000, highCents: 17_000 },
    ]);
  });

  it("lässt die Spanne offen, wenn kein Höchstpreis hinterlegt ist", () => {
    const open = unlockPriceBands([{ ...rules[2], max_price_cents: null }]);
    expect(open[0].highCents).toBeNull();
  });
});

describe("Formatierung", () => {
  it("zeigt Euro ohne Cent nur bei ganzen Beträgen", () => {
    expect(plain(formatEuro(20_000))).toBe("200 €");
    expect(plain(formatEuro(15_124))).toBe("151,24 €");
    expect(plain(formatEuroExact(20_000))).toBe("200,00 €");
  });

  it("formatiert Prozent und Spannen", () => {
    expect(formatPercent(1.8)).toBe("1,8 %");
    expect(plain(formatCentsRange(0, 1_000_000))).toBe("unter 10.000 €");
    expect(plain(formatCentsRange(1_000_000, 1_500_000))).toBe("10.000 € bis unter 15.000 €");
    expect(plain(formatCentsRange(4_000_000, null))).toBe("ab 40.000 €");
    expect(plain(formatPriceSpan(3_500, 12_000))).toBe("35 € – 120 €");
    expect(plain(formatPriceSpan(3_500, null))).toBe("ab 35 €");
    expect(plain(formatPriceSpan(5_000, 5_000))).toBe("50 €");
  });
});
