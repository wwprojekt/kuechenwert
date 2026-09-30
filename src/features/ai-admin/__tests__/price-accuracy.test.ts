import { describe, expect, it } from "vitest";
import { accuracySummary } from "../../../../supabase/functions/_shared/price-accuracy.ts";

describe("accuracySummary", () => {
  it("misst Abweichung, Trefferquote der Spanne und Richtung", () => {
    const s = accuracySummary([
      { observed: 20_000, min: 15_000, max: 22_000, mid: 18_000 },
      { observed: 30_000, min: 20_000, max: 28_000, mid: 24_000 },
      { observed: 10_000, min: 9_000, max: 12_000, mid: 10_000 },
    ]);
    expect(s.n).toBe(3);
    expect(s.mdape).toBeCloseTo(0.1, 4);
    expect(s.coverage).toBeCloseTo(2 / 3, 3);
    expect(s.bias).toBeCloseTo(20_000 / 18_000 - 1, 3);
  });

  it("ignoriert unbrauchbare Punkte und liefert ohne Daten nichts", () => {
    expect(accuracySummary([])).toEqual({ n: 0, mdape: null, coverage: null, bias: null });
    expect(accuracySummary([{ observed: 0, min: 1, max: 2, mid: 1 }, { observed: 5, min: 9, max: 3, mid: 4 }]).n).toBe(0);
  });
});
