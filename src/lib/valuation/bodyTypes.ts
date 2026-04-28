/**
 * Body-Type Definitionen fuer Wertrechner.
 *
 * basePrice = Listenpreis Neufahrzeug Mittelklasse-Marke (Baseline fuer
 * Depreciation). Kalibriert 2026-04 anhand 284 Experten-Bewertungen.
 */
import { Bus, Caravan, Truck, CarFront, type LucideIcon } from "lucide-react";

export interface BodyType {
  value: string;
  label: string;
  icon: LucideIcon;
  description: string;
  basePrice: number;
}

export const WOHNMOBIL_BODY_TYPES: BodyType[] = [
  { value: "integriert", label: "Integriertes Wohnmobil", icon: Bus, description: "Vollintegriert mit Fahrerhaus", basePrice: 95000 },
  { value: "teilintegriert", label: "Teilintegriertes Wohnmobil", icon: Caravan, description: "Aufbau auf Fahrzeugbasis", basePrice: 75000 },
  { value: "alkoven", label: "Alkovenmobil", icon: Truck, description: "Mit Schlafbereich über dem Fahrerhaus", basePrice: 65000 },
  { value: "kastenwagen", label: "Kastenwagen / Van", icon: CarFront, description: "Kompakt und wendig", basePrice: 60000 },
  { value: "campingbus", label: "Campingbus", icon: CarFront, description: "Flexibel und alltagstauglich", basePrice: 55000 },
];

export const WOHNWAGEN_BODY_TYPES: BodyType[] = [
  { value: "wohnwagen", label: "Wohnwagen", icon: Caravan, description: "Klassischer Wohnwagen", basePrice: 25000 },
  { value: "faltcaravan", label: "Faltcaravan", icon: Caravan, description: "Zusammenfaltbar und leicht", basePrice: 8000 },
  { value: "mobilheim", label: "Mobilheim", icon: Truck, description: "Stationäres Wohnheim", basePrice: 35000 },
];

export const getBodyTypes = (vehicleType: string): BodyType[] =>
  vehicleType === "Wohnwagen" ? WOHNWAGEN_BODY_TYPES : WOHNMOBIL_BODY_TYPES;

export const getBasePrice = (vehicleType: string, bodyType: string): number => {
  const bodyTypes = getBodyTypes(vehicleType);
  const match = bodyTypes.find((b) => b.value === bodyType);
  if (match) return match.basePrice;
  return vehicleType === "Wohnwagen" ? 25000 : 80000;
};

/**
 * Mapping von internen Wertrechner-Werten zu den DB-Enums in `kitchens.body_type`.
 * Wird fuer Market-Comp-Queries gebraucht (KI + "aehnlich verkauft"-Widget).
 */
export const BODY_TYPE_TO_DB_ENUM: Record<string, string> = {
  integriert: "Vollintegriert",
  teilintegriert: "Teilintegriert",
  alkoven: "Alkoven",
  kastenwagen: "Kastenwagen",
  campingbus: "Campingbus",
  wohnwagen: "Wohnwagen",
  faltcaravan: "Faltcaravan",
  mobilheim: "Mobilheim",
};
