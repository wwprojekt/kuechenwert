import { describe, expect, it } from "vitest";
import {
  CALIBRATION_LIMITS,
  calibrationFactor,
  calibrationFromRows,
  defaultConfig,
  defaultRoom,
  estimateKitchenPrice,
  type PlannerConfig,
} from "../core";
import { CALIBRATION_PRIOR, computeCalibration, type CalibrationObservation } from "../../../../supabase/functions/_shared/price-calibration.ts";

const obs = (ratio: number, extra: Partial<CalibrationObservation> = {}): CalibrationObservation => ({
  ratio,
  source: "c",
  quality: "mittel",
  postalCode: "30159",
  ...extra,
});
const factorOf = (rows: ReturnType<typeof computeCalibration>, segment: string) => rows.find((r) => r.segment === segment)!.factor;

describe("computeCalibration", () => {
  it("liefert ohne Angebote überall den Faktor 1", () => {
    const rows = computeCalibration([]);
    expect(rows).toHaveLength(1 + 2 + 4 + 10);
    expect(rows.every((r) => r.factor === 1 && r.sampleCount === 0 && r.observedRatio === null)).toBe(true);
  });

  it("schrumpft wenige Angebote stark zur 1 und folgt vielen Angeboten", () => {
    const one = factorOf(computeCalibration([obs(1.3)]), "global");
    expect(one).toBeGreaterThan(1);
    expect(one).toBeLessThan(1.04);
    const many = factorOf(computeCalibration(Array.from({ length: 80 }, () => obs(1.3))), "global");
    expect(many).toBeGreaterThan(1.25);
    expect(many).toBeLessThan(1.3);
    const n = 8;
    const half = factorOf(computeCalibration(Array.from({ length: n }, () => obs(1.3))), "global");
    expect(Math.log(half)).toBeCloseTo((Math.log(1.3) * n) / (n + CALIBRATION_PRIOR), 3);
  });

  it("verwirft unplausible Verhältnisse und dämpft Ausreißer", () => {
    expect(computeCalibration([obs(0.1), obs(7)])[0]!.sampleCount).toBe(0);
    const rows = computeCalibration(Array.from({ length: 50 }, () => obs(2.4)));
    expect(rows[0]!.observedRatio).toBeCloseTo(1.8, 3);
  });

  it("ordnet Abweichungen der Ebene zu, in der sie entstehen", () => {
    const data = [
      ...Array.from({ length: 40 }, () => obs(1.0, { quality: "mittel", postalCode: "30159" })),
      ...Array.from({ length: 40 }, () => obs(1.2, { quality: "premium", postalCode: "30159" })),
    ];
    const rows = computeCalibration(data);
    expect(factorOf(rows, "quality:premium")).toBeGreaterThan(factorOf(rows, "quality:mittel"));
    expect(factorOf(rows, "quality:budget")).toBe(1);
    expect(factorOf(rows, "region:3")).toBeCloseTo(1, 2);
  });

  it("wertet im Anfrageformular keine Qualitätsstufe aus", () => {
    const rows = computeCalibration(Array.from({ length: 30 }, () => obs(1.2, { source: "a", quality: "mittel" })));
    expect(rows.find((r) => r.segment === "quality:mittel")!.sampleCount).toBe(0);
    expect(factorOf(rows, "source:a")).toBeGreaterThan(1);
    expect(factorOf(rows, "source:c")).toBe(1);
  });
});

describe("calibrationFactor und Schätzung", () => {
  const config: PlannerConfig = { ...defaultConfig(), quality: "premium" };
  const room = defaultRoom("l");
  const calibration = calibrationFromRows([
    { segment: "global", factor: 1.1, sample_count: 42 },
    { segment: "source:c", factor: 1.02, sample_count: 30 },
    { segment: "quality:premium", factor: 0.95, sample_count: 12 },
    { segment: "region:8", factor: 1.05, sample_count: 9 },
  ]);

  it("multipliziert die Ebenen passend zur Schätzung", () => {
    expect(calibrationFactor(calibration, { source: "c", quality: "premium", postalCode: "80331" })).toBeCloseTo(1.1 * 1.02 * 0.95 * 1.05, 6);
    expect(calibrationFactor(calibration, { source: "a", quality: "premium", postalCode: "30159" })).toBeCloseTo(1.1, 6);
    expect(calibrationFactor(null, { source: "c", quality: "premium", postalCode: "80331" })).toBe(1);
  });

  it("begrenzt den Gesamtfaktor", () => {
    const extreme = calibrationFromRows([
      { segment: "global", factor: 2, sample_count: 500 },
      { segment: "source:c", factor: 2, sample_count: 500 },
    ]);
    expect(calibrationFactor(extreme, { source: "c", quality: null })).toBe(CALIBRATION_LIMITS.max);
  });

  it("skaliert alle Positionen, damit die Aufstellung zur Summe passt, und nennt den Abgleich", () => {
    const base = estimateKitchenPrice(config, room, { postalCode: "30159" });
    const calibrated = estimateKitchenPrice(config, room, { postalCode: "30159", calibration });
    const factor = 1.1 * 1.02 * 0.95;
    expect(calibrated.mid / base.mid).toBeCloseTo(factor, 1);
    expect(calibrated.calibrationFactor).toBeCloseTo(factor, 3);
    const lineSum = calibrated.lines.reduce((s, l) => s + l.min, 0);
    expect(Math.abs(lineSum - calibrated.min)).toBeLessThanOrEqual(50);
    expect(calibrated.assumptions.some((a) => a.includes("42 Ausschreibungen"))).toBe(true);
    expect(base.calibrationFactor).toBe(1);
  });
});
