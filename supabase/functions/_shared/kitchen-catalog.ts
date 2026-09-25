/**
 * Küchen-Konfigurator: gemeinsamer Katalog für Frontend (Vite) und Edge
 * Functions (Deno). Keine Imports, damit die Datei in beiden Runtimes
 * unverändert lädt.
 *
 * Jede Option trägt ihre deutsche Beschriftung, eine englische
 * Bildbeschreibung für die KI-Visualisierung und die Kennung, über die die
 * Preis-Engine (kitchen-pricing.ts) ihre Faktoren findet.
 */

export const PLANNER_SPEC_VERSION = 2;

export type KitchenFormId = "zeile" | "parallel" | "l" | "u" | "g" | "insel";
export type QualityLevel = "budget" | "mittel" | "premium" | "luxus";
export type StyleId =
  | "modern_grifflos"
  | "modern"
  | "skandinavisch"
  | "landhaus"
  | "industrial"
  | "klassisch";
export type FrontMaterialId =
  | "melamin"
  | "lack_matt"
  | "lack_hochglanz"
  | "fenix"
  | "furnier"
  | "massivholz"
  | "keramik"
  | "beton"
  | "glas";
export type HandleId = "grifflos" | "griffleiste" | "knopf" | "push";
export type WallCabinetsId = "oberschraenke" | "regale" | "keine";
export type WorktopId =
  | "laminat"
  | "compact"
  | "massivholz"
  | "quarzstein"
  | "granit"
  | "keramik"
  | "edelstahl";
export type ApplianceId =
  | "backofen"
  | "dampfgarer"
  | "mikrowelle"
  | "induktion"
  | "gas"
  | "kochfeldabzug"
  | "haube"
  | "geschirrspueler"
  | "kuehl"
  | "side_by_side"
  | "kaffee"
  | "weinkuehler"
  | "waermeschublade";
export type SinkId = "edelstahl" | "granit" | "keramik";
export type TapId = "standard" | "ausziehbar" | "kochendwasser";
export type ExtraId =
  | "led"
  | "innenorganisation"
  | "abfall"
  | "apothekerschrank"
  | "eckloesung"
  | "bar"
  | "nischenrueckwand";
export type ServiceId = "lieferung_montage" | "altkueche" | "elektro" | "wasser";

export interface OptionBase<Id extends string> {
  id: Id;
  label: string;
  hint?: string;
  prompt: string;
}

export interface ColorOption {
  id: string;
  label: string;
  hex: string;
  prompt: string;
  wood?: boolean;
}

export interface WallDefinition {
  key: string;
  label: string;
  defaultCm: number;
  optional?: boolean;
}

export interface KitchenFormOption extends OptionBase<KitchenFormId> {
  walls: WallDefinition[];
}

export const KITCHEN_FORMS: KitchenFormOption[] = [
  {
    id: "zeile",
    label: "Küchenzeile",
    hint: "Alles an einer Wand – ideal für kleine Räume",
    prompt: "a single straight kitchen run along one wall",
    walls: [{ key: "a", label: "Wand A", defaultCm: 300 }],
  },
  {
    id: "parallel",
    label: "Zweizeilig",
    hint: "Zwei gegenüberliegende Zeilen",
    prompt: "a galley kitchen with two parallel kitchen runs facing each other",
    walls: [
      { key: "a", label: "Zeile A", defaultCm: 280 },
      { key: "b", label: "Zeile B", defaultCm: 240 },
    ],
  },
  {
    id: "l",
    label: "L-Küche",
    hint: "Nutzt eine Raumecke, viel Arbeitsfläche",
    prompt: "an L-shaped kitchen using one corner of the room",
    walls: [
      { key: "a", label: "Wand A", defaultCm: 300 },
      { key: "b", label: "Wand B", defaultCm: 240 },
    ],
  },
  {
    id: "u",
    label: "U-Küche",
    hint: "Drei Wände, maximaler Stauraum",
    prompt: "a U-shaped kitchen along three walls",
    walls: [
      { key: "a", label: "Wand A", defaultCm: 260 },
      { key: "b", label: "Wand B", defaultCm: 320 },
      { key: "c", label: "Wand C", defaultCm: 260 },
    ],
  },
  {
    id: "g",
    label: "G-Küche",
    hint: "U-Form mit Halbinsel oder Theke",
    prompt: "a G-shaped kitchen: U-shaped runs plus a peninsula with a breakfast bar",
    walls: [
      { key: "a", label: "Wand A", defaultCm: 260 },
      { key: "b", label: "Wand B", defaultCm: 320 },
      { key: "c", label: "Wand C", defaultCm: 260 },
      { key: "d", label: "Halbinsel", defaultCm: 160 },
    ],
  },
  {
    id: "insel",
    label: "Mit Kochinsel",
    hint: "Offene Wohnküche mit freistehender Insel",
    prompt: "an open-plan kitchen with a back wall run and a freestanding kitchen island",
    walls: [
      { key: "a", label: "Rückwand", defaultCm: 360 },
      { key: "b", label: "Seitenwand (optional)", defaultCm: 0, optional: true },
      { key: "island", label: "Insel", defaultCm: 220 },
    ],
  },
];

export interface QualityOption extends OptionBase<QualityLevel> {
  brands: string;
}

export const QUALITY_LEVELS: QualityOption[] = [
  {
    id: "budget",
    label: "Einsteiger",
    hint: "Solide Basis, gutes Preis-Leistungs-Verhältnis",
    brands: "z. B. Einstiegsprogramme von Nobilia, Nolte, Impuls",
    prompt: "good-value kitchen furniture",
  },
  {
    id: "mittel",
    label: "Markenküche",
    hint: "Der Klassiker: langlebig, große Auswahl",
    brands: "z. B. Nobilia, Nolte, Schüller, Häcker classic",
    prompt: "quality German brand kitchen furniture",
  },
  {
    id: "premium",
    label: "Premium",
    hint: "Hochwertige Materialien, präzise Verarbeitung",
    brands: "z. B. Häcker systemat, next125, Leicht, Ballerina",
    prompt: "premium German kitchen furniture with precise detailing",
  },
  {
    id: "luxus",
    label: "Design & Manufaktur",
    hint: "Architektenküche, individuelle Maße",
    brands: "z. B. SieMatic, bulthaup, Poggenpohl, Warendorf",
    prompt: "luxury architectural designer kitchen with bespoke detailing",
  },
];

export const STYLES: OptionBase<StyleId>[] = [
  {
    id: "modern_grifflos",
    label: "Modern grifflos",
    hint: "Klare Linien, Griffmulden",
    prompt: "modern handleless design with integrated finger grooves and clean lines",
  },
  {
    id: "modern",
    label: "Modern mit Griff",
    hint: "Zeitlos, schlanke Stangengriffe",
    prompt: "contemporary design with slim metal bar handles",
  },
  {
    id: "skandinavisch",
    label: "Skandinavisch",
    hint: "Hell, natürlich, viel Holz",
    prompt: "Scandinavian style, light, airy and natural",
  },
  {
    id: "landhaus",
    label: "Modernes Landhaus",
    hint: "Rahmenfronten, warm und wohnlich",
    prompt: "modern country-house style with shaker-style framed fronts",
  },
  {
    id: "industrial",
    label: "Industrial",
    hint: "Dunkle Töne, Metall, Betonoptik",
    prompt: "industrial loft style with dark tones and black metal accents",
  },
  {
    id: "klassisch",
    label: "Klassisch elegant",
    hint: "Profilfronten, edle Details",
    prompt: "classic elegant style with profiled fronts and refined details",
  },
];

export const FRONT_MATERIALS: OptionBase<FrontMaterialId>[] = [
  { id: "melamin", label: "Melamin / Dekor", hint: "Robust und günstig", prompt: "smooth melamine fronts" },
  { id: "lack_matt", label: "Mattlack", hint: "Seidenmatt, sehr beliebt", prompt: "matte lacquered fronts" },
  { id: "lack_hochglanz", label: "Hochglanzlack", hint: "Spiegelnd, modern", prompt: "high-gloss lacquered fronts" },
  { id: "fenix", label: "Supermatt (FENIX)", hint: "Anti-Fingerprint", prompt: "super-matte anti-fingerprint fronts" },
  { id: "furnier", label: "Echtholzfurnier", hint: "Natürliche Maserung", prompt: "real wood veneer fronts" },
  { id: "massivholz", label: "Massivholz", hint: "Langlebig, warm", prompt: "solid wood fronts" },
  { id: "keramik", label: "Keramik", hint: "Steinoptik, extrem robust", prompt: "ceramic stone-look fronts" },
  { id: "beton", label: "Betonoptik", hint: "Urban, industriell", prompt: "concrete-look fronts" },
  { id: "glas", label: "Satinglas", hint: "Edel, leicht zu reinigen", prompt: "satin glass fronts" },
];

export const FRONT_COLORS: ColorOption[] = [
  { id: "weiss", label: "Weiß", hex: "#F3F2EE", prompt: "white" },
  { id: "kaschmir", label: "Kaschmir", hex: "#D9CCBA", prompt: "warm cashmere beige" },
  { id: "hellgrau", label: "Hellgrau", hex: "#C8CACB", prompt: "light grey" },
  { id: "salbei", label: "Salbei", hex: "#A4B5A1", prompt: "soft sage green" },
  { id: "tannengruen", label: "Tannengrün", hex: "#2F4A3A", prompt: "deep forest green" },
  { id: "nachtblau", label: "Nachtblau", hex: "#25324A", prompt: "midnight blue" },
  { id: "anthrazit", label: "Anthrazit", hex: "#3A3D41", prompt: "anthracite grey" },
  { id: "schwarz", label: "Schwarz", hex: "#1D1D1F", prompt: "matte black" },
  { id: "eiche", label: "Eiche natur", hex: "#C49A6C", prompt: "natural oak wood", wood: true },
  { id: "nussbaum", label: "Nussbaum", hex: "#6B4A34", prompt: "dark walnut wood", wood: true },
];

export const HANDLES: OptionBase<HandleId>[] = [
  { id: "grifflos", label: "Grifflos (Griffmulde)", prompt: "handleless fronts with recessed grip channels" },
  { id: "griffleiste", label: "Stangengriffe", prompt: "slim bar handles" },
  { id: "knopf", label: "Knöpfe / Muschelgriffe", prompt: "classic knob and cup handles" },
  { id: "push", label: "Push-to-open", prompt: "completely smooth fronts with push-to-open mechanism" },
];

export const WALL_CABINETS: OptionBase<WallCabinetsId>[] = [
  { id: "oberschraenke", label: "Oberschränke", hint: "Maximaler Stauraum", prompt: "full-height wall cabinets" },
  { id: "regale", label: "Offene Regale", hint: "Luftig, Deko-Fläche", prompt: "open floating wall shelves instead of wall cabinets" },
  { id: "keine", label: "Keine", hint: "Freie Wand, sehr clean", prompt: "no wall cabinets, clean open wall above the worktop" },
];

export const WORKTOPS: OptionBase<WorktopId>[] = [
  { id: "laminat", label: "Schichtstoff", hint: "Günstig, viele Dekore", prompt: "laminate worktop" },
  { id: "compact", label: "Compactplatte (HPL)", hint: "Schlank, sehr robust", prompt: "slim compact laminate worktop" },
  { id: "massivholz", label: "Massivholz", hint: "Warm, natürlich", prompt: "solid oak butcher-block worktop" },
  { id: "quarzstein", label: "Quarzstein", hint: "Pflegeleicht, beliebt", prompt: "quartz stone worktop" },
  { id: "granit", label: "Granit / Naturstein", hint: "Einzigartige Maserung", prompt: "natural granite worktop" },
  { id: "keramik", label: "Keramik", hint: "Hitze- und kratzfest", prompt: "thin ceramic worktop" },
  { id: "edelstahl", label: "Edelstahl", hint: "Profi-Look", prompt: "brushed stainless steel worktop" },
];

export const WORKTOP_COLORS: ColorOption[] = [
  { id: "weiss", label: "Weiß", hex: "#F5F4F0", prompt: "white" },
  { id: "marmor", label: "Marmoroptik", hex: "#E7E3DC", prompt: "white marble-look with soft grey veining" },
  { id: "beton", label: "Betongrau", hex: "#9B9994", prompt: "concrete grey" },
  { id: "schwarz", label: "Schwarz", hex: "#232323", prompt: "black" },
  { id: "eiche", label: "Eiche", hex: "#B98B5E", prompt: "oak wood" },
];

export interface ApplianceOption extends OptionBase<ApplianceId> {
  group: "backen" | "kochen" | "abzug" | "spuelen" | "kuehlen" | "komfort";
  defaultOn?: boolean;
}

export const APPLIANCES: ApplianceOption[] = [
  { id: "backofen", label: "Backofen", group: "backen", defaultOn: true, prompt: "built-in oven at eye level in a tall unit" },
  { id: "dampfgarer", label: "Kombi-Dampfgarer", group: "backen", prompt: "a second built-in steam oven" },
  { id: "mikrowelle", label: "Mikrowelle / Kompaktgerät", group: "backen", prompt: "a built-in compact microwave" },
  { id: "induktion", label: "Induktionskochfeld", group: "kochen", defaultOn: true, prompt: "flush-mounted induction hob" },
  { id: "gas", label: "Gaskochfeld", group: "kochen", prompt: "gas hob" },
  { id: "kochfeldabzug", label: "Kochfeld mit Abzug", group: "abzug", prompt: "induction hob with integrated downdraft extractor and no hood" },
  { id: "haube", label: "Dunstabzugshaube", group: "abzug", defaultOn: true, prompt: "slim extractor hood" },
  { id: "geschirrspueler", label: "Geschirrspüler", group: "spuelen", defaultOn: true, prompt: "fully integrated dishwasher" },
  { id: "kuehl", label: "Kühl-Gefrierkombination", group: "kuehlen", defaultOn: true, prompt: "integrated fridge-freezer behind furniture fronts" },
  { id: "side_by_side", label: "Side-by-Side-Kühlschrank", group: "kuehlen", prompt: "large stainless steel side-by-side fridge" },
  { id: "kaffee", label: "Einbau-Kaffeevollautomat", group: "komfort", prompt: "built-in coffee machine in the tall unit" },
  { id: "weinkuehler", label: "Weinkühlschrank", group: "komfort", prompt: "glass-front wine cooler" },
  { id: "waermeschublade", label: "Wärmeschublade", group: "komfort", prompt: "warming drawer below the oven" },
];

export const APPLIANCE_LEVELS: QualityOption[] = [
  { id: "budget", label: "Basis", brands: "z. B. Beko, Amica, Bauknecht", prompt: "good-value appliances" },
  { id: "mittel", label: "Mittelklasse", brands: "z. B. Bosch, Siemens, AEG", prompt: "quality appliances" },
  { id: "premium", label: "Premium", brands: "z. B. NEFF, Miele", prompt: "premium appliances" },
  { id: "luxus", label: "Luxus", brands: "z. B. Gaggenau, Miele Generation 7000, Liebherr Monolith", prompt: "luxury professional-grade appliances" },
];

export const SINKS: OptionBase<SinkId>[] = [
  { id: "edelstahl", label: "Edelstahl", prompt: "stainless steel undermount sink" },
  { id: "granit", label: "Granit (Silgranit)", prompt: "granite composite sink" },
  { id: "keramik", label: "Keramik", prompt: "ceramic sink" },
];

export const TAPS: OptionBase<TapId>[] = [
  { id: "standard", label: "Standard-Armatur", prompt: "modern single-lever tap" },
  { id: "ausziehbar", label: "Mit Ausziehbrause", prompt: "pull-out spray tap" },
  { id: "kochendwasser", label: "Kochendwasser-Armatur", hint: "z. B. Quooker", prompt: "boiling-water tap" },
];

export const EXTRAS: OptionBase<ExtraId>[] = [
  { id: "led", label: "LED-Beleuchtung", hint: "Unter Oberschränken & in Nischen", prompt: "warm LED under-cabinet lighting" },
  { id: "innenorganisation", label: "Innenorganisation", hint: "Besteck-, Topf- und Innenauszüge", prompt: "" },
  { id: "abfall", label: "Abfalltrennsystem", hint: "Mehrfach-Mülltrennung im Auszug", prompt: "" },
  { id: "apothekerschrank", label: "Apothekerauszug", hint: "Hoher Vorratsauszug", prompt: "a tall pull-out pantry unit" },
  { id: "eckloesung", label: "Eck-Lösung", hint: "Karussell / LeMans statt totem Eck", prompt: "" },
  { id: "bar", label: "Theke / Sitzplatz", hint: "Überstand zum Sitzen", prompt: "a breakfast bar overhang with bar stools" },
  { id: "nischenrueckwand", label: "Nischenrückwand", hint: "Glas oder Stein statt Fliesen", prompt: "a seamless backsplash panel matching the worktop" },
];

export const SERVICES: OptionBase<ServiceId>[] = [
  { id: "lieferung_montage", label: "Lieferung & Montage", hint: "Durch das Küchenstudio", prompt: "" },
  { id: "altkueche", label: "Altküche abbauen & entsorgen", prompt: "" },
  { id: "elektro", label: "Elektroanschlüsse", hint: "Herd, Geräte, Beleuchtung", prompt: "" },
  { id: "wasser", label: "Wasser- & Abwasseranschluss", prompt: "" },
];

export interface RoomInput {
  form: KitchenFormId;
  /** Wandlängen in cm, Schlüssel gemäß KITCHEN_FORMS[].walls[].key */
  walls: Record<string, number>;
  ceilingHeightCm?: number | null;
  notes?: string | null;
}

export interface PlannerConfig {
  version: typeof PLANNER_SPEC_VERSION;
  quality: QualityLevel;
  style: StyleId;
  front: FrontMaterialId;
  frontColor: string;
  handle: HandleId;
  wallCabinets: WallCabinetsId;
  tallUnits: number;
  worktop: WorktopId;
  worktopColor: string;
  applianceLevel: QualityLevel;
  appliances: ApplianceId[];
  sink: SinkId;
  tap: TapId;
  extras: ExtraId[];
  services: ServiceId[];
  wishes?: string | null;
}

export function formById(id: string): KitchenFormOption | undefined {
  return KITCHEN_FORMS.find((f) => f.id === id);
}

export function defaultRoom(form: KitchenFormId = "l"): RoomInput {
  const def = formById(form) ?? KITCHEN_FORMS[2]!;
  const walls: Record<string, number> = {};
  for (const w of def.walls) walls[w.key] = w.defaultCm;
  return { form: def.id, walls, ceilingHeightCm: 250, notes: null };
}

export function defaultConfig(): PlannerConfig {
  return {
    version: PLANNER_SPEC_VERSION,
    quality: "mittel",
    style: "modern_grifflos",
    front: "lack_matt",
    frontColor: "weiss",
    handle: "grifflos",
    wallCabinets: "oberschraenke",
    tallUnits: 2,
    worktop: "quarzstein",
    worktopColor: "marmor",
    applianceLevel: "mittel",
    appliances: APPLIANCES.filter((a) => a.defaultOn).map((a) => a.id),
    sink: "granit",
    tap: "ausziehbar",
    extras: ["led", "abfall"],
    services: ["lieferung_montage"],
    wishes: null,
  };
}

const ids = <T extends { id: string }>(list: T[]) => new Set(list.map((o) => o.id));
const FORM_IDS = ids(KITCHEN_FORMS);
const QUALITY_IDS = ids(QUALITY_LEVELS);
const STYLE_IDS = ids(STYLES);
const FRONT_IDS = ids(FRONT_MATERIALS);
const FRONT_COLOR_IDS = ids(FRONT_COLORS);
const HANDLE_IDS = ids(HANDLES);
const WALL_CAB_IDS = ids(WALL_CABINETS);
const WORKTOP_IDS = ids(WORKTOPS);
const WORKTOP_COLOR_IDS = ids(WORKTOP_COLORS);
const APPLIANCE_IDS = ids(APPLIANCES);
const SINK_IDS = ids(SINKS);
const TAP_IDS = ids(TAPS);
const EXTRA_IDS = ids(EXTRAS);
const SERVICE_IDS = ids(SERVICES);

function pick<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  return typeof value === "string" && allowed.has(value) ? (value as T) : fallback;
}

function pickMany<T extends string>(value: unknown, allowed: Set<string>): T[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((v): v is T => typeof v === "string" && allowed.has(v))));
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Bereinigt eine (untrusted) Konfiguration auf gültige Katalogwerte. */
export function sanitizeConfig(input: unknown): PlannerConfig {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = defaultConfig();
  const wishes = typeof raw.wishes === "string" ? raw.wishes.trim().slice(0, 500) : null;
  return {
    version: PLANNER_SPEC_VERSION,
    quality: pick(raw.quality, QUALITY_IDS, d.quality),
    style: pick(raw.style, STYLE_IDS, d.style),
    front: pick(raw.front, FRONT_IDS, d.front),
    frontColor: pick(raw.frontColor, FRONT_COLOR_IDS, d.frontColor),
    handle: pick(raw.handle, HANDLE_IDS, d.handle),
    wallCabinets: pick(raw.wallCabinets, WALL_CAB_IDS, d.wallCabinets),
    tallUnits: clampInt(raw.tallUnits, 0, 8, d.tallUnits),
    worktop: pick(raw.worktop, WORKTOP_IDS, d.worktop),
    worktopColor: pick(raw.worktopColor, WORKTOP_COLOR_IDS, d.worktopColor),
    applianceLevel: pick(raw.applianceLevel, QUALITY_IDS, d.applianceLevel),
    appliances: pickMany(raw.appliances, APPLIANCE_IDS),
    sink: pick(raw.sink, SINK_IDS, d.sink),
    tap: pick(raw.tap, TAP_IDS, d.tap),
    extras: pickMany(raw.extras, EXTRA_IDS),
    services: pickMany(raw.services, SERVICE_IDS),
    wishes: wishes && wishes.length > 0 ? wishes : null,
  };
}

/** Bereinigt Raum-Angaben (Wände 0–1200 cm, Deckenhöhe 200–400 cm). */
export function sanitizeRoom(input: unknown): RoomInput {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const form = pick<KitchenFormId>(raw.form, FORM_IDS, "l");
  const def = formById(form)!;
  const rawWalls = (raw.walls && typeof raw.walls === "object" ? raw.walls : {}) as Record<string, unknown>;
  const walls: Record<string, number> = {};
  for (const w of def.walls) {
    const min = w.optional ? 0 : 60;
    walls[w.key] = clampInt(rawWalls[w.key], min, 1200, w.defaultCm);
  }
  const notes = typeof raw.notes === "string" ? raw.notes.trim().slice(0, 500) : null;
  return {
    form,
    walls,
    ceilingHeightCm: raw.ceilingHeightCm == null ? null : clampInt(raw.ceilingHeightCm, 200, 400, 250),
    notes: notes && notes.length > 0 ? notes : null,
  };
}

/**
 * Ein Kochfeld mit integriertem Abzug ersetzt Kochfeld und Haube; beide
 * werden dann weder berechnet noch visualisiert.
 */
export function effectiveAppliances(appliances: ApplianceId[]): ApplianceId[] {
  if (!appliances.includes("kochfeldabzug")) return appliances;
  return appliances.filter((id) => id !== "haube" && id !== "induktion");
}

export function labelOf<T extends { id: string; label: string }>(list: T[], id: string): string {
  return list.find((o) => o.id === id)?.label ?? id;
}
