/**
 * Abschreibungskurven + KM-Anpassung + Oldtimer-Floor.
 *
 * Kalibriert 2026-04 anhand 284 Experten-Bewertungen. Alte Kurven (3% ab Jahr 5)
 * fuehrten zu 74-183% Ueberschaetzung bei >15 Jahren. Neue Kurven haben steilere
 * Abschreibung ab Jahr 5.
 *
 * Oldtimer-Handling (neu 2026-04-24): ab Jahr 20 flacht die Abschreibung ab,
 * ab Jahr 30 ist ein "Liebhaber-Floor" von 15% des Neupreises x Tier aktiv.
 * Das verhindert unrealistisch niedrige Werte bei klassischen Bullis / Oldtimern.
 */

export const WOHNMOBIL_DEPRECIATION_CURVES: Record<string, number[]> = {
  campingbus:     [0.15, 0.07, 0.06, 0.05, 0.04, 0.04, 0.04, 0.04, 0.04, 0.05, 0.05, 0.06, 0.06, 0.05, 0.04, 0.03, 0.03, 0.02, 0.02, 0.01],
  kastenwagen:    [0.15, 0.07, 0.06, 0.05, 0.04, 0.04, 0.04, 0.04, 0.04, 0.05, 0.05, 0.06, 0.06, 0.05, 0.04, 0.03, 0.03, 0.02, 0.02, 0.01],
  alkoven:        [0.16, 0.08, 0.07, 0.06, 0.05, 0.05, 0.05, 0.05, 0.05, 0.06, 0.06, 0.07, 0.07, 0.05, 0.04, 0.03, 0.03, 0.02, 0.02, 0.01],
  teilintegriert: [0.16, 0.08, 0.07, 0.06, 0.05, 0.05, 0.05, 0.05, 0.05, 0.06, 0.06, 0.07, 0.07, 0.05, 0.04, 0.03, 0.03, 0.02, 0.02, 0.01],
  integriert:     [0.17, 0.08, 0.07, 0.06, 0.05, 0.05, 0.05, 0.05, 0.05, 0.06, 0.06, 0.07, 0.07, 0.05, 0.04, 0.03, 0.03, 0.02, 0.02, 0.01],
};

export const WOHNWAGEN_DEPRECIATION_CURVES: Record<string, number[]> = {
  wohnwagen:   [0.14, 0.07, 0.06, 0.05, 0.04, 0.04, 0.04, 0.04, 0.05, 0.05, 0.06, 0.06, 0.07, 0.05, 0.04, 0.03, 0.02, 0.02, 0.01, 0.01],
  faltcaravan: [0.16, 0.08, 0.06, 0.05, 0.04, 0.04, 0.04, 0.05, 0.05, 0.06, 0.06, 0.07, 0.07, 0.05, 0.04, 0.03, 0.02, 0.02, 0.01, 0.01],
  mobilheim:   [0.10, 0.06, 0.05, 0.04, 0.03, 0.03, 0.03, 0.03, 0.04, 0.04, 0.05, 0.05, 0.06, 0.04, 0.03, 0.02, 0.02, 0.01, 0.01, 0.01],
};

const OLDTIMER_FLOOR_RATIO = 0.15;
const OLDTIMER_MIN_AGE = 30;

export const getDepreciationCurve = (vehicleType: string, bodyType: string): number[] => {
  const isWohnwagen = vehicleType === "Wohnwagen";
  const curves = isWohnwagen ? WOHNWAGEN_DEPRECIATION_CURVES : WOHNMOBIL_DEPRECIATION_CURVES;
  return curves[bodyType] ?? (isWohnwagen
    ? [0.14, 0.06, 0.05, 0.04, 0.03, 0.03, 0.03, 0.03, 0.04, 0.04, 0.05, 0.05, 0.06, 0.04, 0.03, 0.02, 0.02, 0.01, 0.01, 0.01]
    : [0.16, 0.07, 0.06, 0.04, 0.03, 0.03, 0.03, 0.03, 0.03, 0.04, 0.04, 0.05, 0.05, 0.04, 0.03, 0.02, 0.02, 0.01, 0.01, 0.01]);
};

export const applyDepreciation = (baseValue: number, age: number, curve: number[]): number => {
  if (age <= 0) return baseValue;

  let remaining = 1.0;
  for (let y = 0; y < age; y++) {
    const rate = y < curve.length ? curve[y] : 0.01;
    remaining *= 1 - rate;
  }

  if (age >= OLDTIMER_MIN_AGE) {
    remaining = Math.max(remaining, OLDTIMER_FLOOR_RATIO);
  }

  return baseValue * remaining;
};

/**
 * Kilometer-Anpassung: gibt Multiplikator zwischen 0.80 (stark gefahren) und
 * 1.10 (sehr wenig) zurueck. Baseline = 10.000 km/Jahr.
 * Nur fuer Wohnmobile relevant (Wohnwagen haben keinen Motor).
 */
export const getMileageAdjustment = (age: number, mileage: number): number => {
  if (age <= 0) return 1.0;
  const expectedKm = age * 10000;
  const ratio = expectedKm > 0 ? mileage / expectedKm : 1.0;
  if (ratio <= 0.5) return 1.10;
  if (ratio <= 0.8) return 1.05;
  if (ratio <= 1.2) return 1.0;
  if (ratio <= 1.5) return 0.95;
  if (ratio <= 2.0) return 0.90;
  if (ratio <= 3.0) return 0.85;
  return 0.80;
};
