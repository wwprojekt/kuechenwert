/**
 * Treffsicherheit der Preisschätzung gegen den Median der Studio-Angebote
 * (kw-maintenance, Task price-calibration). Gemeinsam für Edge Function und
 * Admin-Panel, keine Imports.
 */

export interface AccuracyPoint {
  /** Median der Angebote einer Ausschreibung. */
  observed: number;
  min: number;
  max: number;
  mid: number;
}

export interface AccuracySummary {
  n: number;
  /** Median der relativen Abweichung |Angebot − Schätzung| / Angebot. */
  mdape: number | null;
  /** Anteil der Ausschreibungen, deren Angebotsmedian in der angezeigten Spanne liegt. */
  coverage: number | null;
  /** Median Angebot / Schätzung − 1: positiv = Schätzung zu niedrig. */
  bias: number | null;
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function accuracySummary(points: AccuracyPoint[]): AccuracySummary {
  const valid = points.filter(
    (p) => [p.observed, p.min, p.max, p.mid].every((v) => Number.isFinite(v) && v > 0) && p.min <= p.max,
  );
  if (valid.length === 0) return { n: 0, mdape: null, coverage: null, bias: null };
  const mdape = median(valid.map((p) => Math.abs(p.observed - p.mid) / p.observed));
  const bias = median(valid.map((p) => p.observed / p.mid));
  const inside = valid.filter((p) => p.observed >= p.min && p.observed <= p.max).length;
  return {
    n: valid.length,
    mdape: mdape === null ? null : round4(mdape),
    coverage: round4(inside / valid.length),
    bias: bias === null ? null : round4(bias - 1),
  };
}
