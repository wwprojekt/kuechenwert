/**
 * Hersteller-Listen fuer den Wertrechner Schritt 3.
 * "Popular" = Fast-Select-Chips, "Manufacturers" = volle Combobox-Liste.
 *
 * Fuer Modell-Dropdowns pro Marke siehe vehicle-data.ts (manufacturerModels,
 * wohnwagenManufacturerModels). Die Listen hier sind bewusst kuerzer/kuratiert
 * fuer den schnelleren Wertrechner-Flow.
 */

export const WOHNMOBIL_MANUFACTURERS = [
  "Adria", "Ahorn Camp", "Bavaria", "Benimar", "Bürstner", "Carado", "Carthago",
  "Challenger", "Chausson", "Citroën", "Concorde", "Dethleffs", "Elnagh", "Etrusco",
  "Eura Mobil", "Fendt", "Fiat", "Ford", "Forster", "Frankia", "Globecar", "Hobby", "Hymer",
  "Knaus", "Laika", "LMC", "Malibu", "McLouis", "Mercedes-Benz", "Morelo", "Niesmann+Bischoff",
  "Pilote", "Pössl", "Rapido", "Roller Team", "Sunlight", "Sun Living",
  "Volkswagen", "Weinsberg", "Westfalia", "Andere",
];

export const WOHNWAGEN_MANUFACTURERS = [
  "Abbey", "Adria", "Beachy", "Bürstner", "Cabby", "Carado", "Caravelair",
  "Caretta", "Dethleffs", "Eifelland", "Elddis", "Eriba", "Fendt",
  "Hobby", "Hymer", "Kabe", "Knaus", "La Mancelle", "LMC", "Niewiadow",
  "Rapido", "Soma", "Sterckeman", "Sun Living", "Sunlight", "Swift",
  "Tabbert", "TEC", "Trigano", "Weinsberg", "Wilk", "Wingamm", "Andere",
];

export const POPULAR_WOHNMOBIL_WR = [
  "Hymer", "Hobby", "Bürstner", "Dethleffs", "Fendt",
  "Pössl", "Knaus", "Volkswagen", "Adria", "Weinsberg", "Carado", "Sunlight",
];

export const POPULAR_WOHNWAGEN_WR = [
  "Hobby", "Fendt", "Dethleffs", "Bürstner", "Knaus",
  "Tabbert", "Adria", "Weinsberg", "Eriba", "LMC",
];

export const getManufacturers = (vehicleType: string): string[] =>
  vehicleType === "Wohnwagen" ? WOHNWAGEN_MANUFACTURERS : WOHNMOBIL_MANUFACTURERS;

export const getPopularManufacturers = (vehicleType: string): string[] =>
  vehicleType === "Wohnwagen" ? POPULAR_WOHNWAGEN_WR : POPULAR_WOHNMOBIL_WR;
