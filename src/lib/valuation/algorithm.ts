/**
 * Wertrechner-Algorithmus v2 (2026-04-24).
 *
 * Aenderungen gegenueber v1:
 * - Modell-Faktor (src/lib/valuation/modelFactors.ts) wird beruecksichtigt.
 * - Laengenfaktor (Wohnwagen groesser -> wertvoller).
 * - Oldtimer-Floor ab 30 Jahren (src/lib/valuation/depreciation.ts).
 * - Dynamische Konfidenz-Spanne: Alter, fehlende Angaben und unbekannte Marke
 *   vergroessern die Spanne.
 *
 * Alle Aenderungen sind rueckwaerts-kompatibel mit der v1-Kalibrierung (284
 * Experten-Bewertungen), weil unbekannte Modelle den Faktor 1.0 behalten.
 */
import { getBasePrice } from "./bodyTypes";
import { getBrandTier, isKnownManufacturer, TIER_MULTIPLIERS, type BrandTier } from "./tiers";
import { applyDepreciation, getDepreciationCurve, getMileageAdjustment } from "./depreciation";
import { getConditionFactor } from "./conditions";
import { getModelFactor } from "./modelFactors";

export interface ValuationInput {
  vehicleType: string; // "Wohnmobil" | "Wohnwagen"
  bodyType: string;
  year: number;
  mileage: number; // fuer Wohnwagen ignoriert (0 uebergeben)
  condition: string;
  manufacturer?: string;
  model?: string;
  lengthM?: number; // optional (Step 4 Wohnwagen/Wohnmobil)
}

export interface ValuationResult {
  min: number;
  max: number;
  brandTier: BrandTier;
  /** Relative Spannweite +/-, z.B. 0.12 = ±12%. */
  spread: number;
  /** Zentraler Wert (min+max)/2. */
  mid: number;
  /** Klartext-Gruende warum die Spanne breiter wurde (Debug / Admin-UI). */
  uncertaintyReasons: string[];
}

const BASE_SPREAD = 0.12;
const SPREAD_OLD_VEHICLE = 0.06; // >= 20 Jahre
const SPREAD_VERY_OLD = 0.10; // >= 30 Jahre
const SPREAD_NO_MODEL = 0.03;
const SPREAD_UNKNOWN_BRAND = 0.05;
const SPREAD_EXTREME_MILEAGE = 0.04;

export const calculateValue = (input: ValuationInput): ValuationResult => {
  const { vehicleType, bodyType, year, mileage, condition, manufacturer, model, lengthM } = input;
  const isWohnwagen = vehicleType === "Wohnwagen";
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - year);

  const basePrice = getBasePrice(vehicleType, bodyType);
  const brandTier = getBrandTier(vehicleType, manufacturer);
  const tierMult = TIER_MULTIPLIERS[brandTier];
  const modelFactor = getModelFactor(manufacturer, model);

  const adjustedBase = basePrice * tierMult * modelFactor;

  const curve = getDepreciationCurve(vehicleType, bodyType);
  const ageAdjusted = applyDepreciation(adjustedBase, age, curve);

  const kmFactor = isWohnwagen ? 1.0 : getMileageAdjustment(age, mileage);
  const kmAdjusted = ageAdjusted * kmFactor;

  let lengthFactor = 1.0;
  if (typeof lengthM === "number" && lengthM > 0) {
    if (isWohnwagen) {
      if (lengthM < 4.5) lengthFactor = 0.85;
      else if (lengthM < 6.0) lengthFactor = 1.0;
      else if (lengthM < 7.0) lengthFactor = 1.08;
      else lengthFactor = 1.15;
    } else {
      if (lengthM < 5.5) lengthFactor = 0.93;
      else if (lengthM < 7.0) lengthFactor = 1.0;
      else if (lengthM < 8.0) lengthFactor = 1.05;
      else lengthFactor = 1.10;
    }
  }

  const sized = kmAdjusted * lengthFactor;
  const finalValue = sized * getConditionFactor(condition);

  let spread = BASE_SPREAD;
  const reasons: string[] = [];

  if (age >= 30) { spread += SPREAD_VERY_OLD; reasons.push("Fahrzeug > 30 Jahre alt"); }
  else if (age >= 20) { spread += SPREAD_OLD_VEHICLE; reasons.push("Fahrzeug > 20 Jahre alt"); }

  if (!model || !model.trim()) { spread += SPREAD_NO_MODEL; reasons.push("Modell nicht angegeben"); }
  if (!isKnownManufacturer(vehicleType, manufacturer)) {
    spread += SPREAD_UNKNOWN_BRAND;
    reasons.push("Hersteller nicht im Katalog");
  }
  if (!isWohnwagen && age > 0) {
    const expected = age * 10000;
    if (mileage > expected * 2 || (mileage > 0 && mileage < expected * 0.3)) {
      spread += SPREAD_EXTREME_MILEAGE;
      reasons.push("Ungewoehnlicher Kilometerstand");
    }
  }

  spread = Math.min(spread, 0.35);

  const rawMin = finalValue * (1 - spread);
  const rawMax = finalValue * (1 + spread);
  const minFloor = isWohnwagen ? 500 : 2000;
  const maxFloor = isWohnwagen ? 1000 : 3500;

  const min = Math.max(Math.round(rawMin), minFloor);
  const max = Math.max(Math.round(rawMax), maxFloor);

  return {
    min,
    max,
    brandTier,
    spread,
    mid: Math.round(finalValue),
    uncertaintyReasons: reasons,
  };
};
