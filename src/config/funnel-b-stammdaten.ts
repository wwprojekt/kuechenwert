/**
 * Funnel B Stammdaten - Frontend-Konstanten.
 *
 * Diese Listen stimmen 1:1 mit den Seeds in
 * `supabase/migrations/002_funnel_b_pricing_stammdaten.sql` ueberein.
 *
 * Solange Admin keine Aenderungen vornimmt, kann das Frontend diese
 * Konstanten direkt rendern (ohne DB-Roundtrip). Sobald Admin
 * Stammdaten im Backend pflegt, sollte ein Server-Component die
 * Tabellen aus Supabase laden und an den Funnel weitergeben.
 */

export interface KitchenBrand {
  slug: string;
  name: string;
  segment?: "budget" | "mittel" | "premium" | "luxus";
}

export const KITCHEN_BRANDS: KitchenBrand[] = [
  { slug: "nobilia",        name: "Nobilia",        segment: "mittel" },
  { slug: "haecker",        name: "Häcker",         segment: "mittel" },
  { slug: "schueller",      name: "Schüller",       segment: "mittel" },
  { slug: "nolte",          name: "Nolte",          segment: "mittel" },
  { slug: "pino",           name: "Pino",           segment: "budget" },
  { slug: "bauformat",      name: "Bauformat",      segment: "budget" },
  { slug: "burger",         name: "Burger",         segment: "mittel" },
  { slug: "beckermann",     name: "Beckermann",     segment: "mittel" },
  { slug: "ballerina",      name: "Ballerina",      segment: "mittel" },
  { slug: "rotpunkt",       name: "Rotpunkt",       segment: "mittel" },
  { slug: "stoermer",       name: "Störmer",        segment: "mittel" },
  { slug: "rational",       name: "Rational",       segment: "premium" },
  { slug: "leicht",         name: "Leicht",         segment: "premium" },
  { slug: "siematic",       name: "SieMatic",       segment: "premium" },
  { slug: "bulthaup",       name: "Bulthaup",       segment: "luxus" },
  { slug: "poggenpohl",     name: "Poggenpohl",     segment: "luxus" },
  { slug: "eggersmann",     name: "Eggersmann",     segment: "luxus" },
  { slug: "next125",        name: "Next125",        segment: "premium" },
  { slug: "zeyko",          name: "Zeyko",          segment: "premium" },
  { slug: "allmilmoe",      name: "Allmilmö",       segment: "premium" },
  { slug: "sachsenkuechen", name: "Sachsenküchen",  segment: "mittel" },
  { slug: "express-kuechen", name: "Express Küchen", segment: "budget" },
  { slug: "sonstiger",      name: "Sonstiger / weiß ich nicht" },
];

export interface FrontMaterial {
  name: string;
  category: "kunststoff" | "lack" | "echtholz" | "glas" | "metall" | "beton" | "sonstiges";
  description?: string;
}

export const FRONT_MATERIALS: FrontMaterial[] = [
  { name: "Melamin / Schichtstoff",     category: "kunststoff", description: "Folierte Spanplatte" },
  { name: "Kunststoff (Polymer/PET)",   category: "kunststoff", description: "Hochwertige Beschichtung" },
  { name: "Acryl",                      category: "kunststoff", description: "Hochglanz-Kunststoff" },
  { name: "Lack matt",                  category: "lack" },
  { name: "Lack hochglanz",             category: "lack" },
  { name: "UV-Lack hochglanz",          category: "lack",       description: "UV-gehärtet, sehr widerstandsfähig" },
  { name: "UV-Lack matt",               category: "lack" },
  { name: "Lack-Soft (Anti-Fingerprint)", category: "lack" },
  { name: "Echtholz furniert",          category: "echtholz" },
  { name: "Massivholz",                 category: "echtholz" },
  { name: "Glas matt",                  category: "glas" },
  { name: "Glas hochglanz",             category: "glas" },
  { name: "Glas satiniert",             category: "glas" },
  { name: "Edelstahl",                  category: "metall" },
  { name: "Aluminium",                  category: "metall" },
  { name: "Beton-Optik",                category: "beton" },
  { name: "Keramik",                    category: "sonstiges" },
  { name: "Sonstige / weiß ich nicht",  category: "sonstiges" },
];

export const FRONT_CATEGORY_LABEL: Record<FrontMaterial["category"], string> = {
  kunststoff: "Kunststoff / Folie",
  lack: "Lack",
  echtholz: "Echtholz",
  glas: "Glas",
  metall: "Metall",
  beton: "Beton-Optik",
  sonstiges: "Sonstige",
};

export interface HandleType {
  slug: string;
  name: string;
  description?: string;
}

export const HANDLE_TYPES: HandleType[] = [
  { slug: "mit-griff",            name: "Mit aufgesetztem Griff", description: "Bügel, Knauf, Stange" },
  { slug: "grifflos-push",        name: "Grifflos (Push-to-Open)", description: "Komplett ohne Griff" },
  { slug: "grifflos-servo",       name: "Grifflos (elektrisch)", description: "Servo-elektrisch" },
  { slug: "pseudogrifflos-j",     name: "Pseudogrifflos (J-Profil)", description: "Griffleiste in der Front" },
  { slug: "pseudogrifflos-c",     name: "Pseudogrifflos (C-Profil)", description: "Horizontale Griffmulde" },
  { slug: "mischvariante",        name: "Mischvariante", description: "Kombiniert" },
];

export interface WorktopMaterial {
  slug: string;
  name: string;
  description?: string;
}

export const WORKTOP_MATERIALS: WorktopMaterial[] = [
  { slug: "schichtstoff",       name: "Schichtstoff / HPL", description: "Günstig + pflegeleicht" },
  { slug: "massivholz",         name: "Massivholz", description: "Eiche, Buche, Nussbaum, ..." },
  { slug: "granit",             name: "Naturstein - Granit" },
  { slug: "marmor",             name: "Naturstein - Marmor" },
  { slug: "quarzkomposit",      name: "Quarzkomposit", description: "Silestone, Caesarstone" },
  { slug: "keramik",            name: "Keramik (Sinterstein)", description: "Neolith, Dekton, Lapitec" },
  { slug: "edelstahl",          name: "Edelstahl" },
  { slug: "beton",              name: "Beton" },
  { slug: "glas",               name: "Glas" },
  { slug: "mineralwerkstoff",   name: "Kunststein (Mineralwerkstoff)", description: "Corian, Hi-Macs" },
];

export interface WorktopDesign {
  materialSlug: string;
  name: string;
  manufacturer?: string;
}

export const WORKTOP_DESIGNS: WorktopDesign[] = [
  { materialSlug: "keramik", name: "Calacatta Roma",       manufacturer: "Neolith" },
  { materialSlug: "keramik", name: "Calacatta Borghini",   manufacturer: "Neolith" },
  { materialSlug: "keramik", name: "Estatuario",           manufacturer: "Neolith" },
  { materialSlug: "keramik", name: "Iron Grey",            manufacturer: "Neolith" },
  { materialSlug: "keramik", name: "Aspen White",          manufacturer: "Dekton" },
  { materialSlug: "keramik", name: "Kelya",                manufacturer: "Dekton" },
  { materialSlug: "keramik", name: "Sirius",               manufacturer: "Dekton" },
  { materialSlug: "keramik", name: "Helena",               manufacturer: "Lapitec" },
  { materialSlug: "quarzkomposit", name: "Calacatta Gold",    manufacturer: "Silestone" },
  { materialSlug: "quarzkomposit", name: "Eternal Statuario", manufacturer: "Silestone" },
  { materialSlug: "quarzkomposit", name: "Lyra",              manufacturer: "Silestone" },
  { materialSlug: "quarzkomposit", name: "White Attica",      manufacturer: "Caesarstone" },
  { materialSlug: "quarzkomposit", name: "Calacatta Nuvo",    manufacturer: "Caesarstone" },
  { materialSlug: "granit",  name: "Star Galaxy" },
  { materialSlug: "granit",  name: "Nero Assoluto" },
  { materialSlug: "granit",  name: "Padang Cristallo TG-34" },
  { materialSlug: "granit",  name: "Black Pearl" },
  { materialSlug: "marmor",  name: "Carrara" },
  { materialSlug: "marmor",  name: "Calacatta" },
  { materialSlug: "marmor",  name: "Statuario" },
  { materialSlug: "mineralwerkstoff", name: "Solid Glacier White", manufacturer: "Corian" },
  { materialSlug: "mineralwerkstoff", name: "Designer White",      manufacturer: "Hi-Macs" },
  { materialSlug: "schichtstoff", name: "Beton Optik" },
  { materialSlug: "schichtstoff", name: "Eiche Sonoma" },
  { materialSlug: "schichtstoff", name: "Marmor Optik" },
];

export interface ApplianceCategory {
  slug: string;
  name: string;
}

export const APPLIANCE_CATEGORIES: ApplianceCategory[] = [
  { slug: "backofen",          name: "Backofen" },
  { slug: "kochfeld",          name: "Herd / Kochfeld" },
  { slug: "dunstabzug",        name: "Dunstabzugshaube" },
  { slug: "muldenlueftung",    name: "Muldenlüftung" },
  { slug: "geschirrspueler",   name: "Geschirrspüler" },
  { slug: "kuehlschrank",      name: "Kühlschrank" },
  { slug: "gefrierschrank",    name: "Gefrierschrank" },
  { slug: "mikrowelle",        name: "Mikrowelle" },
  { slug: "dampfgarer",        name: "Dampfgarer" },
  { slug: "kaffeevollautomat", name: "Kaffeevollautomat" },
  { slug: "weinkuehler",       name: "Weinkühlschrank" },
  { slug: "waermeschublade",   name: "Wärmeschublade" },
];

export interface ApplianceBrand {
  slug: string;
  name: string;
  segment?: "budget" | "mittel" | "premium" | "luxus";
}

export const APPLIANCE_BRANDS: ApplianceBrand[] = [
  { slug: "bosch",         name: "Bosch",         segment: "mittel" },
  { slug: "siemens",       name: "Siemens",       segment: "mittel" },
  { slug: "neff",          name: "Neff",          segment: "mittel" },
  { slug: "miele",         name: "Miele",         segment: "premium" },
  { slug: "aeg",           name: "AEG",           segment: "mittel" },
  { slug: "bauknecht",     name: "Bauknecht",     segment: "budget" },
  { slug: "liebherr",      name: "Liebherr",      segment: "premium" },
  { slug: "gaggenau",      name: "Gaggenau",      segment: "luxus" },
  { slug: "v-zug",         name: "V-Zug",         segment: "premium" },
  { slug: "beko",          name: "Beko",          segment: "budget" },
  { slug: "privileg",      name: "Privileg",      segment: "budget" },
  { slug: "constructa",    name: "Constructa",    segment: "budget" },
  { slug: "whirlpool",     name: "Whirlpool",     segment: "budget" },
  { slug: "samsung",       name: "Samsung",       segment: "mittel" },
  { slug: "lg",            name: "LG",            segment: "mittel" },
  { slug: "smeg",          name: "Smeg",          segment: "premium" },
  { slug: "electrolux",    name: "Electrolux",    segment: "mittel" },
  { slug: "de-dietrich",   name: "De Dietrich",   segment: "premium" },
  { slug: "kueppersbusch", name: "Küppersbusch",  segment: "premium" },
  { slug: "sonstige",      name: "Sonstige" },
];

export const SINK_BRANDS = [
  { slug: "blanco",        name: "Blanco" },
  { slug: "franke",        name: "Franke" },
  { slug: "schock",        name: "Schock" },
  { slug: "villeroy-boch", name: "Villeroy & Boch" },
  { slug: "naber",         name: "Naber" },
  { slug: "reginox",       name: "Reginox" },
  { slug: "systemceram",   name: "Systemceram" },
  { slug: "pyramis",       name: "Pyramis" },
  { slug: "bosch-sink",    name: "Bosch" },
  { slug: "ikea-sink",     name: "IKEA" },
  { slug: "sonstige-sink", name: "Sonstige / weiß ich nicht" },
];

export const SINK_MATERIALS = [
  { slug: "edelstahl-sink",      name: "Edelstahl" },
  { slug: "granit-komposit",     name: "Granit-Komposit (Silgranit/Cristadur)" },
  { slug: "keramik-sink",        name: "Keramik" },
  { slug: "tectonite",           name: "Tectonite (Faser)" },
  { slug: "mineralguss",         name: "Mineralguss (Mineralwerkstoff)" },
  { slug: "kupfer",              name: "Kupfer / Messing" },
  { slug: "sonstige-sink-mat",   name: "Sonstige / weiß ich nicht" },
];

export const EXTRAS_OPTIONS = [
  { slug: "steckdosen",            name: "Steckdosen / USB-Buchsen", description: "Eingebaut in Arbeitsplatte oder Schubladen" },
  { slug: "besteckeinsatz",        name: "Besteckeinsatz" },
  { slug: "beleuchtung_unterboden", name: "Beleuchtung Unterboden", description: "LED unter Hängeschränken" },
  { slug: "beleuchtung_innen",     name: "Beleuchtung im Schrank" },
  { slug: "ausziehauszug",         name: "Apothekerschrank / Ausziehauszug" },
  { slug: "eckschrank-karussell",  name: "Eckschrank-Lösung (Karussell o.ä.)" },
  { slug: "abfallsystem",          name: "Abfallsystem (separat zu Müllfächern)" },
  { slug: "kraeuterregal",         name: "Kräuter- / Gewürzregal" },
  { slug: "rueckwand-glas",        name: "Glas-Rückwand / Spritzschutz" },
  { slug: "sockelschublade",       name: "Sockel-Schubladen" },
];

export const HOUSING_TYPES = [
  { slug: "own",  name: "Eigentum (Haus oder Wohnung)" },
  { slug: "rent", name: "Miete (Wohnung oder Haus)" },
  { slug: "unknown", name: "Sage ich nicht" },
];

export const TIMEFRAMES = [
  { slug: "0-3",  name: "So schnell wie möglich (0-3 Monate)", months: 2 },
  { slug: "3-6",  name: "In 3-6 Monaten", months: 5 },
  { slug: "6-12", name: "In 6-12 Monaten", months: 9 },
  { slug: "12+",  name: "Später als 12 Monate", months: 15 },
  { slug: "flexibel", name: "Flexibel / Bestes Angebot zaehlt", months: null as number | null },
];

export const DELIVERY_MODES = [
  { slug: "delivery_assembly", name: "Lieferung + Montage" },
  { slug: "delivery_only",     name: "Nur Lieferung" },
  { slug: "pickup",            name: "Selbstabholung" },
];

export const FINANCING_OPTIONS = [
  { slug: "none",          name: "Keine Finanzierung (Komplettzahlung)" },
  { slug: "zero_interest", name: "Zinsfreie Finanzierung (0 %)" },
  { slug: "with_interest", name: "Finanzierung mit Zinsen" },
];
