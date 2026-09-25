import { describe, expect, it } from "vitest";
import {
  DEFAULT_RATE_CARD,
  computeLayout,
  defaultConfig,
  defaultRoom,
  estimateKitchenPrice,
  mergeRateCard,
  regionalFactor,
  sanitizeConfig,
  sanitizeRoom,
  type PlannerConfig,
} from "../core";
import { buildRenderPrompt } from "../../../../supabase/functions/_shared/kitchen-prompt.ts";

const midRangeL = (): PlannerConfig => ({
  ...defaultConfig(),
  quality: "mittel",
  front: "lack_matt",
  handle: "griffleiste",
  style: "modern",
  tallUnits: 2,
  worktop: "quarzstein",
  applianceLevel: "mittel",
  appliances: ["backofen", "induktion", "haube", "geschirrspueler", "kuehl"],
  extras: [],
  services: ["lieferung_montage"],
});

describe("computeLayout", () => {
  it("zählt die Ecke einer L-Küche nur einmal und zieht Hochschränke ab", () => {
    const layout = computeLayout({ form: "l", walls: { a: 300, b: 240 } }, 2);
    expect(layout.runCm).toBe(480);
    expect(layout.baseRunCm).toBe(360);
    expect(layout.worktopCm).toBe(360);
    expect(layout.corners).toBe(1);
  });

  it("rechnet die Insel als eigene Schrankzeile und Arbeitsfläche", () => {
    const layout = computeLayout({ form: "insel", walls: { a: 360, b: 0, island: 220 } }, 1);
    expect(layout.runCm).toBe(360);
    expect(layout.islandCm).toBe(220);
    expect(layout.worktopCm).toBe(300 + 220);
  });

  it("begrenzt Hochschränke, damit Unterschränke übrig bleiben", () => {
    const layout = computeLayout({ form: "zeile", walls: { a: 240 } }, 8);
    expect(layout.tallUnits).toBe(2);
    expect(layout.baseRunCm).toBeGreaterThanOrEqual(120);
  });
});

describe("estimateKitchenPrice", () => {
  it("liegt für eine Mittelklasse-L-Küche im realistischen Marktbereich", () => {
    const est = estimateKitchenPrice(midRangeL(), { form: "l", walls: { a: 300, b: 240 } }, { postalCode: "30159" });
    expect(est.min).toBeGreaterThan(10_000);
    expect(est.max).toBeLessThan(26_000);
    expect(est.min).toBeLessThan(est.mid);
    expect(est.mid).toBeLessThan(est.max);
    expect(est.min % 100).toBe(0);
  });

  it("steigt mit Qualitätsstufe, Insel und Premium-Geräten", () => {
    const room = { form: "insel" as const, walls: { a: 400, b: 0, island: 240 } };
    const mid = estimateKitchenPrice(midRangeL(), room);
    const lux = estimateKitchenPrice(
      { ...midRangeL(), quality: "luxus", applianceLevel: "luxus", worktop: "keramik", appliances: ["backofen", "dampfgarer", "kochfeldabzug", "geschirrspueler", "side_by_side", "kaffee"] },
      room,
    );
    expect(lux.min).toBeGreaterThan(mid.max);
    expect(lux.lines.some((l) => l.id === "insel")).toBe(true);
  });

  it("zählt bei Kochfeldabzug weder Haube noch separates Induktionskochfeld", () => {
    const est = estimateKitchenPrice(
      { ...midRangeL(), appliances: ["kochfeldabzug", "haube", "induktion"] },
      defaultRoom("zeile"),
    );
    expect(est.lines.some((l) => l.id === "geraet_haube")).toBe(false);
    expect(est.lines.some((l) => l.id === "geraet_induktion")).toBe(false);
    expect(est.lines.some((l) => l.id === "geraet_kochfeldabzug")).toBe(true);
  });

  it("wendet das regionale Preisniveau an", () => {
    expect(regionalFactor("80331")).toBeGreaterThan(regionalFactor("01067"));
    const munich = estimateKitchenPrice(midRangeL(), defaultRoom("l"), { postalCode: "80331" });
    const dresden = estimateKitchenPrice(midRangeL(), defaultRoom("l"), { postalCode: "01067" });
    expect(munich.mid).toBeGreaterThan(dresden.mid);
  });
});

describe("mergeRateCard", () => {
  it("übernimmt nur gültige, bekannte Overrides", () => {
    const card = mergeRateCard({
      cabinetsPerMeter: { mittel: [2000, 1000] },
      roundingStep: -5,
      unknownKey: 3,
    });
    expect(card.cabinetsPerMeter.mittel).toEqual([1000, 2000]);
    expect(card.cabinetsPerMeter.budget).toEqual(DEFAULT_RATE_CARD.cabinetsPerMeter.budget);
    expect(card.roundingStep).toBe(DEFAULT_RATE_CARD.roundingStep);
    expect("unknownKey" in card).toBe(false);
  });
});

describe("sanitize", () => {
  it("verwirft unbekannte Werte und begrenzt Maße", () => {
    const config = sanitizeConfig({ quality: "gold", appliances: ["backofen", "rakete", "backofen"], tallUnits: 99 });
    expect(config.quality).toBe("mittel");
    expect(config.appliances).toEqual(["backofen"]);
    expect(config.tallUnits).toBe(8);

    const room = sanitizeRoom({ form: "u", walls: { a: 5000, b: -10, c: "280" } });
    expect(room.walls).toEqual({ a: 1200, b: 60, c: 280 });
  });
});

describe("buildRenderPrompt", () => {
  it("fixiert im Foto-Modus Architektur und Perspektive", () => {
    const { prompt } = buildRenderPrompt(midRangeL(), defaultRoom("l"), { mode: "edit", variantHint: "mehr Holz" });
    expect(prompt).toContain("Keep the architecture exactly");
    expect(prompt).toContain("L-shaped");
    expect(prompt).toContain("mehr Holz");
  });

  it("entfernt Steuerzeichen und Klammern aus Freitext", () => {
    const { prompt } = buildRenderPrompt({ ...midRangeL(), wishes: "<script>{x}</script>" }, defaultRoom("zeile"), { mode: "text" });
    expect(prompt).not.toMatch(/[<>{}]/);
  });
});
