/**
 * Marken-Tiers: klassifiziert Hersteller in Luxus/Premium/Mittelklasse/Economy.
 * Multiplikator wirkt auf den bodyType.basePrice.
 */

export type BrandTier = "luxus" | "premium" | "mittelklasse" | "economy";

export const TIER_MULTIPLIERS: Record<BrandTier, number> = {
  luxus: 2.0,
  premium: 1.2,
  mittelklasse: 1.0,
  economy: 0.82,
};

export const WOHNMOBIL_BRAND_TIERS: Record<string, BrandTier> = {
  Concorde: "luxus", Morelo: "luxus", Volkner: "luxus",
  Carthago: "premium", Hymer: "premium", "Niesmann+Bischoff": "premium",
  Frankia: "premium", "Eura Mobil": "premium", Rapido: "premium",
  "La Strada": "premium", Phoenix: "premium",
  Knaus: "mittelklasse", Bürstner: "mittelklasse", Dethleffs: "mittelklasse",
  Hobby: "mittelklasse", LMC: "mittelklasse", Chausson: "mittelklasse",
  Challenger: "mittelklasse", Pilote: "mittelklasse", Adria: "mittelklasse",
  Benimar: "mittelklasse", Laika: "mittelklasse", Elnagh: "mittelklasse",
  Globecar: "mittelklasse", Pössl: "mittelklasse", Malibu: "mittelklasse",
  Westfalia: "mittelklasse", Volkswagen: "mittelklasse", Fendt: "mittelklasse",
  Bavaria: "mittelklasse", "Mercedes-Benz": "mittelklasse", Ford: "mittelklasse",
  Fiat: "mittelklasse", Citroën: "mittelklasse",
  Sunlight: "economy", "Sun Living": "economy", Etrusco: "economy",
  Forster: "economy", "Roller Team": "economy", McLouis: "economy",
  Carado: "economy", Weinsberg: "economy", "Ahorn Camp": "economy",
};

export const WOHNWAGEN_BRAND_TIERS: Record<string, BrandTier> = {
  Kabe: "luxus",
  Tabbert: "premium", Fendt: "premium", Hobby: "premium", Hymer: "premium", Eriba: "premium",
  Bürstner: "mittelklasse", Dethleffs: "mittelklasse", Knaus: "mittelklasse",
  Adria: "mittelklasse", LMC: "mittelklasse", Wilk: "mittelklasse",
  Caravelair: "mittelklasse", Sterckeman: "mittelklasse", Swift: "mittelklasse",
  Elddis: "mittelklasse", "La Mancelle": "mittelklasse", Rapido: "mittelklasse",
  Weinsberg: "economy", Sunlight: "economy", "Sun Living": "economy",
  Carado: "economy", Cabby: "economy", TEC: "economy",
  Trigano: "economy", Niewiadow: "economy", Caretta: "economy",
  Soma: "economy", Wingamm: "economy", Beachy: "economy",
  Abbey: "economy", Eifelland: "economy",
};

export const getBrandTier = (vehicleType: string, manufacturer: string | undefined): BrandTier => {
  if (!manufacturer) return "mittelklasse";
  const tiers = vehicleType === "Wohnwagen" ? WOHNWAGEN_BRAND_TIERS : WOHNMOBIL_BRAND_TIERS;
  return tiers[manufacturer] ?? "mittelklasse";
};

export const isKnownManufacturer = (vehicleType: string, manufacturer: string | undefined): boolean => {
  if (!manufacturer) return false;
  const tiers = vehicleType === "Wohnwagen" ? WOHNWAGEN_BRAND_TIERS : WOHNMOBIL_BRAND_TIERS;
  return manufacturer in tiers;
};
