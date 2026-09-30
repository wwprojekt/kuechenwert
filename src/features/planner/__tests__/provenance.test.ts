import { describe, expect, it } from "vitest";
import {
  PLANNER_CHOICE_STEPS,
  defaultConfig,
  defaultRoom,
  dimensionsSource,
  emptyProvenance,
  estimateKitchenPrice,
  keepWallsOf,
  labelDefaults,
  markStepAnswered,
  markWallEdited,
  sanitizeProvenance,
} from "../core";
import { buildPlannerSummary } from "../../../../supabase/functions/_shared/planner-summary.ts";

describe("Herkunft der Planer-Angaben", () => {
  it("merkt beantwortete Konfigurationsschritte und eingegebene Wände", () => {
    let p = markStepAnswered(emptyProvenance(), "fronten");
    p = markStepAnswered(p, "fronten");
    p = markStepAnswered(p, "plz");
    p = markWallEdited(p, "a");
    expect(p).toEqual({ steps: ["fronten"], walls: ["a"] });
  });

  it("lässt eine unbekannte Herkunft unbekannt", () => {
    expect(markStepAnswered(null, "stil")).toBeNull();
    expect(markWallEdited(null, "a")).toBeNull();
    expect(keepWallsOf(null, "u")).toBeNull();
  });

  it("behält nach einem Formwechsel nur Wände der neuen Form", () => {
    expect(keepWallsOf({ steps: ["stil"], walls: ["a", "c"] }, "l")).toEqual({ steps: ["stil"], walls: ["a"] });
  });

  it("bereinigt Angaben aus dem Browser", () => {
    const room = defaultRoom("l");
    expect(sanitizeProvenance(null, room)).toBeNull();
    expect(sanitizeProvenance(["stil"], room)).toBeNull();
    expect(sanitizeProvenance({ steps: ["stil", "stil", "hack", 3], walls: ["a", "island", "b"] }, room)).toEqual({
      steps: ["stil"],
      walls: ["a", "b"],
    });
  });

  it("kennzeichnet übersprungene und halb beantwortete Zeilen", () => {
    const defaults = labelDefaults({ steps: ["stil", "qualitaet", "fronten", "kochen"], walls: [] });
    expect(defaults).not.toHaveProperty("style");
    expect(defaults).not.toHaveProperty("quality");
    expect(defaults.front).toBe("partial");
    expect(defaults.appliances).toBe("partial");
    expect(defaults.worktop).toBe("default");
    expect(defaults.sink).toBe("default");
    expect(defaults.services).toBe("default");
    expect(labelDefaults({ steps: [...PLANNER_CHOICE_STEPS], walls: [] })).toEqual({});
  });

  it("unterscheidet Kundenmaße von Beispielmaßen", () => {
    const room = defaultRoom("l");
    expect(dimensionsSource(emptyProvenance(), room)).toBe("example");
    expect(dimensionsSource({ steps: [], walls: ["a"] }, room)).toBe("partial");
    expect(dimensionsSource({ steps: [], walls: ["a", "b"] }, room)).toBe("customer");
    expect(dimensionsSource({ steps: [], walls: ["a", "island"] }, defaultRoom("insel"))).toBe("customer");
  });
});

describe("Studio-Zusammenfassung einer Planung", () => {
  const config = defaultConfig();
  const room = defaultRoom("l");
  const estimate = estimateKitchenPrice(config, room);
  const extra = {
    timeframeMonths: 3,
    budgetEur: null,
    budgetSource: null,
    purchaseReason: null,
    housing: null,
    housingType: "unknown",
    photoCount: 0,
    cover: null,
  };

  it("enthält Zeitrahmen, Spüle und Armatur", () => {
    const summary = buildPlannerSummary(config, room, estimate, { ...extra, provenance: null });
    expect(summary.labels).toMatchObject({ timeframe: "In 1–3 Monaten", sink: "Granit (Silgranit)", tap: "Mit Ausziehbrause" });
  });

  it("meldet keine Raumhöhe, die nicht gefragt wurde", () => {
    const summary = buildPlannerSummary(config, room, estimate, { ...extra, provenance: null });
    expect(summary.room).toMatchObject({ ceiling_height_cm: null });
  });

  it("kennzeichnet Standardwerte und Beispielmaße nur bei bekannter Herkunft", () => {
    const legacy = buildPlannerSummary(config, room, estimate, { ...extra, provenance: null });
    expect(legacy).not.toHaveProperty("defaults");
    expect(legacy.room).not.toHaveProperty("dimensions_source");

    const skipped = buildPlannerSummary(config, room, estimate, {
      ...extra,
      provenance: { steps: ["stil", "qualitaet"], walls: [] },
    });
    expect(skipped.room).toMatchObject({ dimensions_source: "example" });
    expect(skipped.defaults).toMatchObject({ front: "default", worktop: "default", sink: "default", services: "default" });
    expect(skipped.defaults).not.toHaveProperty("style");
  });

  it("gibt Budget, Anlass, Wohnsituation, Raumhöhe und Dunstabzug weiter", () => {
    const summary = buildPlannerSummary(config, { ...room, ceilingHeightCm: 245, ventilation: "umluft" }, estimate, {
      ...extra,
      provenance: null,
      budgetEur: 20_000,
      budgetSource: "slider",
      purchaseReason: "umzug",
      housing: "own_house",
      housingType: "own",
    });
    expect(summary).toMatchObject({ budget_eur: 20_000, budget_source: "slider", purchase_reason: "umzug", housing: "own_house", housing_type: "own" });
    expect(summary.room).toMatchObject({ ceiling_height_cm: 245, ventilation: "umluft" });
    expect(summary.labels).toMatchObject({ ventilation: "Nur Umluft" });
  });

  it("entfernt Kontaktdaten aus Wünschen und Studio-Hinweisen", () => {
    const summary = buildPlannerSummary(
      { ...config, wishes: "Große Insel, ruft an: 0170 1234567" },
      { ...room, notes: "Fragen an max@web.de" },
      estimate,
      { ...extra, provenance: null },
    );
    const text = JSON.stringify(summary);
    expect(text).not.toMatch(/0170|max@web\.de/);
    expect(summary.wishes).toBe("Große Insel, ruft an: [entfernt]");
  });
});
