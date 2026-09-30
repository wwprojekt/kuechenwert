/**
 * Lernende Preis-Engine: gleicht die Schätzung mit den Angeboten ab, die
 * Studios auf KüchenWert abgeben (kw-maintenance, Task price-calibration).
 *
 * Jede Ausschreibung mit Angeboten liefert ein Verhältnis
 * Median(Angebote) / Schätzung, gerechnet mit der aktuellen Engine und
 * Rate-Card (ohne bisherigen Abgleich), damit sich Korrekturen nicht
 * aufschaukeln. Die Faktoren entstehen hierarchisch auf der Log-Skala –
 * global, dann Formular (a/c), Qualitätsstufe (nur Konfigurator) und
 * PLZ-Region jeweils auf den Rest der Ebene davor – und werden zur 1
 * geschrumpft: Mit wenigen Angeboten bleibt die Schätzung fast unverändert,
 * mit vielen folgt sie dem Markt. Jede Ausschreibung zählt mit ihrem Gewicht
 * (observationWeight): ältere und solche mit nur einem Angebot weniger.
 */

import { QUALITY_LEVELS, type QualityLevel } from "./kitchen-catalog.ts";
import type { EstimateSource } from "./kitchen-pricing.ts";

export interface CalibrationObservation {
  /** Median der Angebote / Schätzung der aktuellen Engine. */
  ratio: number;
  source: EstimateSource;
  quality: QualityLevel | null;
  postalCode: string | null;
  /** 0–1, ohne Angabe 1. */
  weight?: number;
}

/** Küchenpreise steigen: ein Angebot von vor einem Jahr zählt halb so viel wie ein heutiges. */
export const RECENCY_HALF_LIFE_DAYS = 365;

/**
 * Gewicht einer Ausschreibung: Zeitverfall mal n/(n+1) für n Angebote. Ein
 * einzelnes Angebot ist ein unsicherer Marktpreis (und ließe ein einzelnes
 * Studio die Schätzung seiner Region verschieben), mehrere zählen fast voll.
 */
export function observationWeight(opts: { ageDays: number; offers: number }): number {
  const age = Number.isFinite(opts.ageDays) ? Math.max(0, opts.ageDays) : 0;
  const offers = Number.isFinite(opts.offers) ? Math.max(1, Math.floor(opts.offers)) : 1;
  return Math.pow(0.5, age / RECENCY_HALF_LIFE_DAYS) * (offers / (offers + 1));
}

export interface CalibrationRow {
  segment: string;
  factor: number;
  sampleCount: number;
  /** Ungeschrumpftes geometrisches Mittel des Rests dieser Ebene; null ohne Daten. */
  observedRatio: number | null;
}

export const CALIBRATION_PRIOR = 8;
/** Verhältnisse außerhalb gelten als Datenfehler (Teilangebot, Tippfehler). */
const VALID_RATIO = { min: 0.4, max: 2.5 } as const;
/** Einzelne Ausreißer zählen höchstens wie ±80 %. */
const MAX_ABS_LOG = Math.log(1.8);

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

interface Point {
  y: number;
  w: number;
  source: EstimateSource;
  quality: QualityLevel | null;
  region: string | null;
}

function level(points: Point[], residual: (p: Point) => number, prior: number) {
  const weight = points.reduce((s, p) => s + p.w, 0);
  const sum = points.reduce((s, p) => s + p.w * residual(p), 0);
  return {
    offset: weight > 0 ? sum / (weight + prior) : 0,
    observed: weight > 0 ? Math.exp(sum / weight) : null,
    n: points.length,
  };
}

export function computeCalibration(observations: CalibrationObservation[], prior = CALIBRATION_PRIOR): CalibrationRow[] {
  const points: Point[] = observations
    .filter((o) => Number.isFinite(o.ratio) && o.ratio >= VALID_RATIO.min && o.ratio <= VALID_RATIO.max)
    .map((o) => {
      const digit = (o.postalCode ?? "").trim().charAt(0);
      const w = o.weight === undefined ? 1 : Number(o.weight);
      return {
        y: Math.max(-MAX_ABS_LOG, Math.min(MAX_ABS_LOG, Math.log(o.ratio))),
        w: Number.isFinite(w) ? Math.min(1, Math.max(0, w)) : 1,
        source: o.source,
        quality: o.source === "c" ? o.quality : null,
        region: /^\d$/.test(digit) ? digit : null,
      };
    });

  const rows: CalibrationRow[] = [];
  const push = (segment: string, l: ReturnType<typeof level>) =>
    rows.push({
      segment,
      factor: round4(Math.exp(l.offset)),
      sampleCount: l.n,
      observedRatio: l.observed === null ? null : round4(l.observed),
    });

  const global = level(points, (p) => p.y, prior);
  push("global", global);

  const sourceOffset: Record<EstimateSource, number> = { a: 0, c: 0 };
  for (const source of ["a", "c"] as const) {
    const l = level(points.filter((p) => p.source === source), (p) => p.y - global.offset, prior);
    sourceOffset[source] = l.offset;
    push(`source:${source}`, l);
  }

  const qualityOffset: Partial<Record<QualityLevel, number>> = {};
  for (const { id } of QUALITY_LEVELS) {
    const l = level(
      points.filter((p) => p.quality === id),
      (p) => p.y - global.offset - sourceOffset[p.source],
      prior,
    );
    qualityOffset[id] = l.offset;
    push(`quality:${id}`, l);
  }

  for (let d = 0; d <= 9; d++) {
    const digit = String(d);
    const l = level(
      points.filter((p) => p.region === digit),
      (p) => p.y - global.offset - sourceOffset[p.source] - (p.quality ? (qualityOffset[p.quality] ?? 0) : 0),
      prior,
    );
    push(`region:${digit}`, l);
  }

  return rows;
}
