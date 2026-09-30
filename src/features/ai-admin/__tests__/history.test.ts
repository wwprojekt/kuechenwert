import { describe, expect, it } from "vitest";
import type { AiModelStats, DailyStats } from "../api";
import { aggregateHistory, describeChanges } from "../history";

const model = (over: Partial<AiModelStats>): AiModelStats => ({
  model: "fal-ai/nano-banana-pro/edit",
  mode: "edit",
  started: 10,
  first_try_success: 9,
  fell_back: 1,
  failed: 0,
  images: 10,
  as_fallback: 0,
  variants: 2,
  avg_ms: 30_000,
  p50_ms: 30_000,
  p90_ms: 40_000,
  cost_cents: 150,
  thumbs_up: 4,
  thumbs_down: 1,
  reasons: {},
  ...over,
});

const day = (date: string, models: AiModelStats[], sessions = 5, leads = 2): DailyStats => ({
  day: date,
  stats: {
    models,
    groups: [],
    reasons: {},
    funnel: { sessions, with_render: sessions, with_photo_render: sessions, leads, ai_training_consents: 0, cost_cents: models.reduce((s, m) => s + m.cost_cents, 0) },
  },
});

describe("aggregateHistory", () => {
  const days = [
    day("2026-09-28", [model({ images: 10, p50_ms: 20_000 })]),
    day("2026-09-30", [model({ images: 30, p50_ms: 40_000 }), model({ model: "fal-ai/flux-2-pro", mode: "text", images: 50, started: 50 })]),
    day("2026-10-05", [model({ model: "openai/gpt-image-2.5/sunburst/edit", images: 12 })]),
  ];

  it("fasst ISO-Wochen zusammen und nennt das Modell mit den meisten Fotobildern", () => {
    const rows = aggregateHistory(days, "week");
    expect(rows.map((r) => r.label)).toEqual(["KW 41/2026", "KW 40/2026"]);
    const kw40 = rows[1]!;
    expect(kw40.sessions).toBe(10);
    expect(kw40.images).toBe(90);
    expect(kw40.mainModel).toBe("fal-ai/nano-banana-pro/edit");
    expect(kw40.medianMs).toBe(Math.round((10 * 20_000 + 30 * 40_000 + 50 * 30_000) / 90));
  });

  it("fasst Monate zusammen", () => {
    const rows = aggregateHistory(days, "month");
    expect(rows.map((r) => r.key)).toEqual(["2026-10", "2026-09"]);
    expect(rows[0]!.label).toBe("Oktober 2026");
    expect(rows[1]!.leads).toBe(4);
  });
});

describe("describeChanges", () => {
  it("übersetzt Felder und Modelle in lesbare Zeilen", () => {
    const lines = describeChanges({
      changed_at: "2026-09-30T12:00:00Z",
      changes: {
        challenger_edit_model: { from: null, to: "openai/gpt-image-2.5/sunburst/edit" },
        challenger_share: { from: 0, to: 50 },
        price_calibration_enabled: { from: true, to: false },
      },
    });
    expect(lines).toEqual([
      "Vergleichsmodell: keins → GPT Image 2.5 Sunburst Edit",
      "Anteil Vergleich: 0 % → 50 %",
      "Marktabgleich: an → aus",
    ]);
  });
});
