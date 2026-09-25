/**
 * Funnel A („Küchenangebote einholen“): gemeinsamer Katalog für Funnel,
 * Projektseite, Studio-Portal (Vite) und Edge Functions (Deno).
 *
 * - Optionen mit IDs und Labels: eine Quelle für Anzeige und Validierung
 * - IDs aus Funnel A v1 (bis 09/2026) bleiben über die Normalisierung lesbar
 * - Abbildung auf den Konfigurator-Katalog für den Preisanker
 * - Anzeige der Angaben aus Funnel A und B (describeLeadSummary)
 *
 * Nur relative .ts-Imports, damit Deno und Vite die Datei unverändert laden.
 */

import {
  APPLIANCES,
  KITCHEN_FORMS,
  STYLES,
  defaultConfig,
  defaultRoom,
  formById,
  type ApplianceId,
  type KitchenFormId,
  type PlannerConfig,
  type RoomInput,
  type StyleId,
  type WorktopId,
} from "./kitchen-catalog.ts";
import { estimateKitchenPrice, type KitchenEstimate, type RateCard } from "./kitchen-pricing.ts";
import {
  APPLIANCE_BRANDS,
  APPLIANCE_CATEGORIES,
  DELIVERY_MODES,
  EXTRAS_OPTIONS,
  HANDLE_TYPES,
  KITCHEN_BRANDS,
  SINK_BRANDS,
  SINK_MATERIALS,
  TIMEFRAMES as FUNNEL_B_TIMEFRAMES,
  WORKTOP_MATERIALS,
} from "./funnel-b-catalog.ts";

export const FUNNEL_A_SCHEMA_VERSION = 2;
export const UNSURE = "unsicher";

export interface ChoiceOption<Id extends string = string> {
  id: Id;
  label: string;
  hint?: string;
}

export interface SwatchOption extends ChoiceOption {
  swatches: string[];
}

export interface HousingOption extends ChoiceOption {
  housingType: "rent" | "own" | "unknown";
}

export interface TimeframeOption extends ChoiceOption {
  months: number | null;
}

function unsure(label = "Weiß ich noch nicht", hint?: string): ChoiceOption {
  return { id: UNSURE, label, hint };
}

// ---------------------------------------------------------------------------
// Küche
// ---------------------------------------------------------------------------

export const FORM_OPTIONS: ChoiceOption[] = [
  ...KITCHEN_FORMS.map((f) => ({ id: f.id, label: f.label, hint: f.hint })),
  unsure("Steht noch nicht fest", "Das Studio berät Sie"),
];

export const ROOM_TYPE_OPTIONS: ChoiceOption[] = [
  { id: "offen", label: "Offen zum Wohnbereich", hint: "Wohnküche mit Blick ins Wohnzimmer" },
  { id: "geschlossen", label: "Eigener Küchenraum", hint: "Klassisch getrennt, mit Tür" },
  { id: "halboffen", label: "Halboffen", hint: "Durchgang oder Durchreiche" },
  { id: "planung", label: "Noch in Planung", hint: "Neubau oder Umbau" },
];

export const SIZE_OPTIONS: ChoiceOption[] = [
  { id: "klein", label: "Bis 8 m²", hint: "Kleine Küche" },
  { id: "mittel", label: "8 – 15 m²", hint: "Übliche Küchengröße" },
  { id: "gross", label: "15 – 25 m²", hint: "Große Küche" },
  { id: "xl", label: "Über 25 m²", hint: "Große Wohnküche" },
  unsure("Weiß ich nicht", "Noch nicht ausgemessen"),
];

const SIZE_FACTOR: Record<string, number> = { klein: 0.8, mittel: 1, gross: 1.2, xl: 1.4 };

export const STYLE_OPTIONS: ChoiceOption[] = [
  ...STYLES.map((s) => ({ id: s.id, label: s.label, hint: s.hint })),
  unsure("Bin noch offen", "Das Studio berät Sie"),
];

export const COLOR_OPTIONS: SwatchOption[] = [
  { id: "hell", label: "Hell", hint: "Weiß, Creme, Hellgrau", swatches: ["#F3F2EE", "#D9CCBA", "#C8CACB"] },
  { id: "holz", label: "Holztöne", hint: "Eiche, Nussbaum, natürlich", swatches: ["#C49A6C", "#A67B55", "#6B4A34"] },
  { id: "dunkel", label: "Dunkel", hint: "Anthrazit, Schwarz, Nachtblau", swatches: ["#3A3D41", "#25324A", "#1D1D1F"] },
  { id: "farbig", label: "Farbig", hint: "Salbei, Tannengrün, Blau", swatches: ["#A4B5A1", "#2F4A3A", "#5B7C99"] },
  { id: "mix", label: "Zweifarbig", hint: "z. B. Weiß mit Holz", swatches: ["#F3F2EE", "#C49A6C", "#3A3D41"] },
  { ...unsure(undefined, "Bin offen"), swatches: [] },
];

export const WORKTOP_OPTIONS: ChoiceOption[] = [
  { id: "holz", label: "Holz", hint: "Massiv, warm, natürlich" },
  { id: "naturstein", label: "Naturstein", hint: "Granit, Schiefer, Marmor" },
  { id: "quarz", label: "Quarzstein", hint: "Pflegeleicht, sehr beliebt" },
  { id: "keramik", label: "Keramik", hint: "Hitze- und kratzfest" },
  { id: "schichtstoff", label: "Schichtstoff", hint: "Preiswert, viele Dekore" },
  unsure("Beratung gewünscht", "Das Studio empfiehlt"),
];

const WORKTOP_TO_PLANNER: Record<string, WorktopId> = {
  holz: "massivholz",
  naturstein: "granit",
  quarz: "quarzstein",
  keramik: "keramik",
  schichtstoff: "laminat",
  [UNSURE]: "quarzstein",
};

export const COOKTOP_OPTIONS: ChoiceOption[] = [
  { id: "induktion", label: "Induktion", hint: "Schnell, sicher, sparsam" },
  { id: "kochfeldabzug", label: "Induktion mit Abzug", hint: "Dunstabzug im Kochfeld, keine Haube" },
  { id: "ceran", label: "Ceran / Glaskeramik", hint: "Bewährter Klassiker" },
  { id: "gas", label: "Gas", hint: "Direkte, sichtbare Hitze" },
  unsure(),
];

const COOKTOP_TO_APPLIANCES: Record<string, ApplianceId[]> = {
  induktion: ["induktion", "haube"],
  kochfeldabzug: ["kochfeldabzug"],
  ceran: ["induktion", "haube"],
  gas: ["gas", "haube"],
  [UNSURE]: ["induktion", "haube"],
};

export const OVEN_OPTIONS: ChoiceOption[] = [
  { id: "unter-kochfeld", label: "Unter dem Kochfeld", hint: "Klassisch und platzsparend" },
  { id: "augenhoehe", label: "Auf Augenhöhe", hint: "Rückenschonend im Hochschrank" },
  { id: "doppelt", label: "Zwei Geräte", hint: "Backofen plus Dampfgarer o. ä." },
  unsure(),
];

export const COOLING_OPTIONS: ChoiceOption[] = [
  { id: "einbau", label: "Einbau-Kühlschrank", hint: "Hinter Möbelfronten" },
  { id: "kombi", label: "Einbau-Kühl-Gefrierkombi", hint: "Kühlen und Gefrieren integriert" },
  { id: "side_by_side", label: "Side-by-Side", hint: "Großer, freistehender Kühlschrank" },
  { id: "vorhanden", label: "Vorhandenes Gerät", hint: "Wird weiter genutzt" },
  unsure(),
];

const EXTRA_APPLIANCE_IDS: ApplianceId[] = [
  "geschirrspueler",
  "mikrowelle",
  "dampfgarer",
  "kaffee",
  "weinkuehler",
  "waermeschublade",
];

export const EXTRA_APPLIANCE_OPTIONS: ChoiceOption<ApplianceId>[] = EXTRA_APPLIANCE_IDS.map((id) => {
  const a = APPLIANCES.find((x) => x.id === id);
  return { id, label: a?.label ?? id };
});

export const DEFAULT_EXTRA_APPLIANCES: ApplianceId[] = ["geschirrspueler"];

export const COOKSTYLE_OPTIONS: ChoiceOption[] = [
  { id: "allein", label: "Ich koche allein", hint: "Praktisch und effizient" },
  { id: "paar", label: "Zu zweit", hint: "Gemütlich und regelmäßig" },
  { id: "familie", label: "Mit der Familie", hint: "Oft, auch mit Kindern" },
  { id: "freunde", label: "Mit Gästen", hint: "Gerne ausgiebig und offen" },
  { id: "selten", label: "Eher selten", hint: "Schnell und unkompliziert" },
  unsure(),
];

// ---------------------------------------------------------------------------
// Rahmen
// ---------------------------------------------------------------------------

export const OCCASION_OPTIONS: ChoiceOption[] = [
  { id: "neukauf", label: "Neubau / Erstausstattung", hint: "Erste Küche in neuen Räumen" },
  { id: "renovierung", label: "Alte Küche ersetzen", hint: "Die bestehende Küche kommt raus" },
  { id: "umzug", label: "Umzug", hint: "Neue Wohnung oder neues Haus" },
  { id: "modernisierung", label: "Teilweise erneuern", hint: "Fronten, Geräte oder Arbeitsplatte" },
  unsure(undefined, "Ich informiere mich erst"),
];

export const HOUSING_OPTIONS: HousingOption[] = [
  { id: "rent_apartment", label: "Mietwohnung", housingType: "rent" },
  { id: "rent_house", label: "Haus zur Miete", housingType: "rent" },
  { id: "own_apartment", label: "Eigentumswohnung", housingType: "own" },
  { id: "own_house", label: "Eigenes Haus", housingType: "own" },
  { id: UNSURE, label: "Keine Angabe", housingType: "unknown" },
];

export const DECISION_OPTIONS: ChoiceOption[] = [
  { id: "allein", label: "Ich entscheide allein" },
  { id: "gemeinsam", label: "Gemeinsam mit Partner:in" },
  { id: "andere", label: "Jemand anderes entscheidet", hint: "z. B. Vermieter:in oder Familie" },
];

export const TIMEFRAME_OPTIONS: TimeframeOption[] = [
  { id: "asap", label: "So schnell wie möglich", months: 1 },
  { id: "1-3", label: "In 1 – 3 Monaten", months: 2 },
  { id: "4-6", label: "In 4 – 6 Monaten", months: 5 },
  { id: "7-12", label: "In 7 – 12 Monaten", months: 9 },
  { id: "spaeter", label: "Später als in einem Jahr", months: 18 },
  { id: "beratung", label: "Nur Beratung", hint: "Erst einmal informieren", months: null },
  { id: UNSURE, label: "Weiß ich noch nicht", months: 12 },
];

export const FUNNEL_A_BUDGET = { min: 3_000, max: 50_000, step: 500, default: 10_000 } as const;

// ---------------------------------------------------------------------------
// Antworten
// ---------------------------------------------------------------------------

export interface FunnelAAnswers {
  kitchen_form: string;
  room_type: string;
  kitchen_size: string;
  kitchen_style: string;
  color_preference: string;
  worktop_category: string;
  cooktop_type: string;
  oven_placement: string;
  cooling: string;
  extra_appliances: ApplianceId[];
  cooking_style: string;
  purchase_reason: string;
  housing: string;
  decision_maker: string;
  timeframe: string;
  /** Budget in Euro; null = „Weiß ich nicht, bitte beraten“. */
  budget_eur: number | null;
  postal_code: string;
}

/** Pflichtangaben, ohne die ein Studio kein Angebot erstellen kann. */
export const FUNNEL_A_REQUIRED: (keyof FunnelAAnswers)[] = ["kitchen_form", "timeframe", "postal_code"];

export function emptyFunnelAAnswers(): FunnelAAnswers {
  return {
    kitchen_form: "",
    room_type: "",
    kitchen_size: "",
    kitchen_style: "",
    color_preference: "",
    worktop_category: "",
    cooktop_type: "",
    oven_placement: "",
    cooling: "",
    extra_appliances: [...DEFAULT_EXTRA_APPLIANCES],
    cooking_style: "",
    purchase_reason: "",
    housing: "",
    decision_maker: "",
    timeframe: "",
    budget_eur: FUNNEL_A_BUDGET.default,
    postal_code: "",
  };
}

const LEGACY_FORMS: Record<string, string> = {
  "l-form": "l",
  "u-form": "u",
  zweizeilig: "parallel",
  kochinsel: "insel",
};

const LEGACY_STYLES: Record<string, string> = {
  minimalistisch: "modern_grifflos",
  individuell: UNSURE,
};

/** Bildet Formular-IDs aus Funnel A v1 auf den aktuellen Katalog ab. */
export function normalizeFormId(id: unknown): string {
  const v = typeof id === "string" ? id.trim() : "";
  return LEGACY_FORMS[v] ?? v;
}

export function normalizeStyleId(id: unknown): string {
  const v = typeof id === "string" ? id.trim() : "";
  return LEGACY_STYLES[v] ?? v;
}

const idSet = (list: { id: string }[]) => new Set(list.map((o) => o.id));
const FORM_IDS = idSet(FORM_OPTIONS);
const ROOM_IDS = idSet(ROOM_TYPE_OPTIONS);
const SIZE_IDS = idSet(SIZE_OPTIONS);
const STYLE_IDS = idSet(STYLE_OPTIONS);
const COLOR_IDS = idSet(COLOR_OPTIONS);
const WORKTOP_IDS = idSet(WORKTOP_OPTIONS);
const COOKTOP_IDS = idSet(COOKTOP_OPTIONS);
const OVEN_IDS = idSet(OVEN_OPTIONS);
const COOLING_IDS = idSet(COOLING_OPTIONS);
const EXTRA_IDS = idSet(EXTRA_APPLIANCE_OPTIONS);
const COOKSTYLE_IDS = idSet(COOKSTYLE_OPTIONS);
const OCCASION_IDS = idSet(OCCASION_OPTIONS);
const HOUSING_IDS = idSet(HOUSING_OPTIONS);
const DECISION_IDS = idSet(DECISION_OPTIONS);
const TIMEFRAME_IDS = idSet(TIMEFRAME_OPTIONS);

function pickId(value: unknown, allowed: Set<string>): string {
  return typeof value === "string" && allowed.has(value) ? value : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function clampBudget(value: unknown): number | null {
  if (value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return FUNNEL_A_BUDGET.default;
  const stepped = Math.round(n / FUNNEL_A_BUDGET.step) * FUNNEL_A_BUDGET.step;
  return Math.min(FUNNEL_A_BUDGET.max, Math.max(FUNNEL_A_BUDGET.min, stepped));
}

/** Bereinigt (untrusted) Antworten auf gültige Katalogwerte. */
export function sanitizeFunnelAAnswers(input: unknown): FunnelAAnswers {
  const raw = asRecord(input);
  const extras = Array.isArray(raw.extra_appliances)
    ? Array.from(new Set(raw.extra_appliances.filter((v): v is ApplianceId => typeof v === "string" && EXTRA_IDS.has(v))))
    : [];
  const plz = typeof raw.postal_code === "string" ? raw.postal_code.trim() : "";
  return {
    kitchen_form: pickId(normalizeFormId(raw.kitchen_form), FORM_IDS),
    room_type: pickId(raw.room_type, ROOM_IDS),
    kitchen_size: pickId(raw.kitchen_size, SIZE_IDS),
    kitchen_style: pickId(normalizeStyleId(raw.kitchen_style), STYLE_IDS),
    color_preference: pickId(raw.color_preference, COLOR_IDS),
    worktop_category: pickId(raw.worktop_category, WORKTOP_IDS),
    cooktop_type: pickId(raw.cooktop_type, COOKTOP_IDS),
    oven_placement: pickId(raw.oven_placement, OVEN_IDS),
    cooling: pickId(raw.cooling, COOLING_IDS),
    extra_appliances: extras,
    cooking_style: pickId(raw.cooking_style, COOKSTYLE_IDS),
    purchase_reason: pickId(raw.purchase_reason, OCCASION_IDS),
    housing: pickId(raw.housing, HOUSING_IDS),
    decision_maker: pickId(raw.decision_maker, DECISION_IDS),
    timeframe: pickId(raw.timeframe, TIMEFRAME_IDS),
    budget_eur: "budget_eur" in raw ? clampBudget(raw.budget_eur) : FUNNEL_A_BUDGET.default,
    postal_code: /^\d{5}$/.test(plz) ? plz : "",
  };
}

export function missingRequired(a: FunnelAAnswers): (keyof FunnelAAnswers)[] {
  return FUNNEL_A_REQUIRED.filter((key) => !a[key]);
}

export function timeframeMonths(id: string): number | null {
  const t = TIMEFRAME_OPTIONS.find((o) => o.id === id);
  return t ? t.months : null;
}

export function housingType(id: string): "rent" | "own" | "unknown" {
  return HOUSING_OPTIONS.find((o) => o.id === id)?.housingType ?? "unknown";
}

// ---------------------------------------------------------------------------
// Preisanker: Abbildung auf den Konfigurator
// ---------------------------------------------------------------------------

function isFormId(id: string): id is KitchenFormId {
  return KITCHEN_FORMS.some((f) => f.id === id);
}

function isStyleId(id: string): id is StyleId {
  return STYLES.some((s) => s.id === id);
}

/**
 * Leitet Raum und Konfiguration für die Preis-Engine ab. Qualität und
 * Geräteklasse bleiben bewusst auf „Markenküche/Mittelklasse“: Der Anker soll
 * zeigen, was die gewählte Küche typischerweise kostet – unabhängig vom
 * Budget, das im selben Schritt abgefragt wird.
 */
export function funnelAPlannerInput(a: FunnelAAnswers): { config: PlannerConfig; room: RoomInput } {
  const form: KitchenFormId = isFormId(a.kitchen_form) ? a.kitchen_form : "l";
  const base = defaultRoom(form);
  const factor = SIZE_FACTOR[a.kitchen_size] ?? 1;
  const walls: Record<string, number> = {};
  for (const w of formById(form)?.walls ?? []) {
    const cm = base.walls[w.key] ?? 0;
    walls[w.key] = cm === 0 ? 0 : Math.max(60, Math.round((cm * factor) / 10) * 10);
  }

  const appliances = new Set<ApplianceId>(["backofen"]);
  for (const id of COOKTOP_TO_APPLIANCES[a.cooktop_type] ?? COOKTOP_TO_APPLIANCES[UNSURE]!) appliances.add(id);
  if (a.oven_placement === "doppelt") appliances.add("dampfgarer");
  if (a.cooling === "side_by_side") appliances.add("side_by_side");
  else if (a.cooling !== "vorhanden") appliances.add("kuehl");
  for (const id of a.extra_appliances) appliances.add(id);

  const fridgeTall = a.cooling === "einbau" || a.cooling === "kombi" || a.cooling === UNSURE || a.cooling === "" ? 1 : 0;
  const ovenTall = a.oven_placement === "unter-kochfeld" ? 0 : 1;
  const pantryTall = a.kitchen_size === "xl" ? 1 : 0;

  const d = defaultConfig();
  return {
    room: { form, walls, ceilingHeightCm: 250, notes: null },
    config: {
      ...d,
      style: isStyleId(a.kitchen_style) ? a.kitchen_style : d.style,
      worktop: WORKTOP_TO_PLANNER[a.worktop_category] ?? d.worktop,
      tallUnits: fridgeTall + ovenTall + pantryTall,
      appliances: [...appliances],
      quality: "mittel",
      applianceLevel: "mittel",
    },
  };
}

export function estimateFunnelA(
  a: FunnelAAnswers,
  options: { card?: RateCard; postalCode?: string | null; rateCardVersion?: number | null } = {},
): KitchenEstimate {
  const { config, room } = funnelAPlannerInput(a);
  return estimateKitchenPrice(config, room, { ...options, postalCode: options.postalCode ?? (a.postal_code || null) });
}

/** Was in leads.funnel_answers landet (Spalten wie kitchen_form separat). */
export function toStoredAnswers(
  a: FunnelAAnswers,
  extra: { salutation: string | null; estimate: { min: number; max: number; mid: number } | null },
): Record<string, unknown> {
  return {
    version: FUNNEL_A_SCHEMA_VERSION,
    salutation: extra.salutation,
    room_type: a.room_type || null,
    kitchen_size: a.kitchen_size || null,
    color_preference: a.color_preference || null,
    worktop_category: a.worktop_category || null,
    cooktop_type: a.cooktop_type || null,
    oven_placement: a.oven_placement || null,
    cooling: a.cooling || null,
    extra_appliances: a.extra_appliances,
    cooking_style: a.cooking_style || null,
    housing: a.housing || null,
    decision_maker: a.decision_maker || null,
    timeframe: a.timeframe || null,
    budget_source: a.budget_eur === null ? "unknown" : "slider",
    estimate: extra.estimate,
  };
}

// ---------------------------------------------------------------------------
// Anzeige (Projektseite, Studio-Portal, E-Mails)
// ---------------------------------------------------------------------------

export interface DetailRow {
  label: string;
  value: string;
}

export interface DetailGroup {
  title: string;
  rows: DetailRow[];
}

function labelIn(list: ChoiceOption[], id: unknown): string | null {
  if (typeof id !== "string" || !id) return null;
  return list.find((o) => o.id === id)?.label ?? null;
}

export function formLabel(id: unknown): string | null {
  const v = normalizeFormId(id);
  return v === UNSURE ? null : labelIn(FORM_OPTIONS, v);
}

export function styleLabel(id: unknown): string | null {
  const v = normalizeStyleId(id);
  return v === UNSURE ? null : labelIn(STYLE_OPTIONS, v);
}

const eur = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
}

/**
 * Lesbare Angaben eines Funnel-A-Projekts, gruppiert nach Küche, Geräte und
 * Rahmen. Nimmt die öffentliche Zusammenfassung einer Ausschreibung
 * (kw_lead_public_summary) oder eine vergleichbar aufgebaute Struktur.
 * „Weiß nicht“-Antworten werden zu einer Zeile „Beratung gewünscht zu …“
 * zusammengefasst, damit Studios sehen, wo sie beraten sollen.
 */
export function describeFunnelA(summary: unknown): DetailGroup[] {
  const s = asRecord(summary);
  const a = asRecord(s.answers);
  const openTopics: string[] = [];

  /**
   * onUnsure: "advise" sammelt das Thema unter „Beratung gewünscht zu“,
   * "skip" lässt die Zeile weg, jeder andere Text wird als Wert angezeigt.
   */
  const pick = (topic: string, list: ChoiceOption[], id: unknown, onUnsure = "advise"): DetailRow | null => {
    if (typeof id !== "string" || !id) return null;
    if (id === UNSURE) {
      if (onUnsure === "advise") openTopics.push(topic);
      return onUnsure === "advise" || onUnsure === "skip" ? null : { label: topic, value: onUnsure };
    }
    const label = labelIn(list, id);
    return label ? { label: topic, value: label } : null;
  };

  const kitchen: (DetailRow | null)[] = [
    pick("Form", FORM_OPTIONS, normalizeFormId(s.kitchen_form)),
    pick("Raum", ROOM_TYPE_OPTIONS, a.room_type),
    pick("Größe", SIZE_OPTIONS, a.kitchen_size, "Noch nicht ausgemessen"),
    pick("Stil", STYLE_OPTIONS, normalizeStyleId(s.kitchen_style)),
    pick("Farbwelt", COLOR_OPTIONS, a.color_preference),
    pick("Arbeitsplatte", WORKTOP_OPTIONS, a.worktop_category),
    pick("Kochstil", COOKSTYLE_OPTIONS, a.cooking_style, "skip"),
  ];
  const fronts = stringList(a.front_material_names);
  if (fronts.length) kitchen.push({ label: "Fronten", value: fronts.join(", ") });

  const extras = stringList(a.extra_appliances)
    .map((id) => labelIn(EXTRA_APPLIANCE_OPTIONS, id))
    .filter((v): v is string => !!v);
  const brands = stringList(a.appliance_brand_names);
  const devices: (DetailRow | null)[] = [
    pick("Kochfeld", COOKTOP_OPTIONS, a.cooktop_type),
    pick("Backofen", OVEN_OPTIONS, a.oven_placement),
    pick("Kühlen", COOLING_OPTIONS, a.cooling),
    extras.length ? { label: "Weitere Geräte", value: extras.join(", ") } : null,
    brands.length ? { label: "Wunschmarken", value: brands.join(", ") } : null,
  ];

  const housing =
    a.housing === UNSURE
      ? null
      : (labelIn(HOUSING_OPTIONS, a.housing) ??
        (s.housing_type === "own" ? "Eigentum" : s.housing_type === "rent" ? "Miete" : null));
  const timeframe =
    a.timeframe === UNSURE
      ? "Noch offen"
      : (labelIn(TIMEFRAME_OPTIONS, a.timeframe) ??
        (typeof s.timeframe_months === "number" ? `In ca. ${s.timeframe_months} Monaten` : null));
  const budget =
    a.budget_source === "unknown"
      ? "Beratung gewünscht"
      : typeof s.budget_eur === "number" && s.budget_eur > 0
        ? `ca. ${eur(s.budget_eur)}`
        : null;

  const frame: (DetailRow | null)[] = [
    pick("Anlass", OCCASION_OPTIONS, s.purchase_reason, "skip"),
    housing ? { label: "Wohnsituation", value: housing } : null,
    pick("Entscheidung", DECISION_OPTIONS, a.decision_maker),
    timeframe ? { label: "Zeitraum", value: timeframe } : null,
    budget ? { label: "Budget", value: budget } : null,
  ];

  const clean = (rows: (DetailRow | null)[]) => rows.filter((r): r is DetailRow => r !== null);
  const groups: DetailGroup[] = [
    { title: "Küche", rows: clean(kitchen) },
    { title: "Geräte", rows: clean(devices) },
    { title: "Rahmen", rows: clean(frame) },
  ];
  if (openTopics.length) {
    groups[groups.length - 1]!.rows.push({ label: "Beratung gewünscht zu", value: openTopics.join(", ") });
  }
  return groups.filter((g) => g.rows.length > 0);
}

type SlugOption = { slug: string; name: string };

/** „Sonstige / weiß ich nicht“ zeigen wir Studios nicht als Angabe an. */
const FUNNEL_B_UNKNOWN = new Set(["sonstiger", "sonstige", "sonstige-sink", "sonstige-sink-mat", "Sonstige / weiß ich nicht"]);

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Name zum Slug; unbekannte Slugs älterer Einträge erscheinen im Klartext. */
function slugName(list: readonly SlugOption[], value: unknown): string | null {
  const v = text(value);
  if (!v || FUNNEL_B_UNKNOWN.has(v)) return null;
  return list.find((o) => o.slug === v)?.name ?? v;
}

function applianceRows(value: unknown): DetailRow[] {
  const byCategory = new Map<string, string[]>();
  for (const item of Array.isArray(value) ? value : []) {
    const x = asRecord(item);
    const category = slugName(APPLIANCE_CATEGORIES, x.categorySlug);
    if (!category) continue;
    const detail = [slugName(APPLIANCE_BRANDS, x.brandSlug), text(x.model)].filter(Boolean).join(" ");
    byCategory.set(category, [...(byCategory.get(category) ?? []), detail || "enthalten"]);
  }
  return [...byCategory].map(([label, values]) => ({ label, value: values.join(", ") }));
}

/** Lesbare Angaben eines Funnel-B-Projekts (vorhandenes Studio-Angebot). */
export function describeFunnelB(summary: unknown): DetailGroup[] {
  const s = asRecord(summary);
  const a = asRecord(s.answers);
  const row = (label: string, value: string | null | undefined): DetailRow | null => (value ? { label, value } : null);

  const brand = text(a.brand) === "sonstiger" ? text(a.brandCustom) : (slugName(KITCHEN_BRANDS, a.brand) ?? text(a.brandCustom));
  const sink = [slugName(SINK_BRANDS, a.sinkBrand), text(a.sinkDesignation)].filter(Boolean).join(" ");
  const offer: (DetailRow | null)[] = [
    typeof s.existing_offer_eur === "number" && s.existing_offer_eur > 0 ? row("Vorhandenes Angebot", eur(s.existing_offer_eur)) : null,
    row("Form", formLabel(s.kitchen_form)),
    row("Küchenmarke", brand),
    row("Front", text(a.frontName)),
    row("Frontmaterial", FUNNEL_B_UNKNOWN.has(text(a.frontMaterialName) ?? "") ? null : text(a.frontMaterialName)),
    row("Griffe", slugName(HANDLE_TYPES, a.handleType)),
    row("Arbeitsplatte", slugName(WORKTOP_MATERIALS, a.worktopMaterial)),
    row("Dekor", text(a.worktopDesignCustom) ?? text(a.worktopDesign)),
    row("Spüle", sink || null),
    row("Spülenmaterial", slugName(SINK_MATERIALS, a.sinkMaterial)),
  ];

  const extras = stringList(s.special_wishes)
    .map((slug) => slugName(EXTRAS_OPTIONS, slug))
    .filter((v): v is string => !!v);
  const timeframe =
    slugName(FUNNEL_B_TIMEFRAMES, a.timeframeSlug) ??
    (typeof s.timeframe_months === "number" ? `In ca. ${s.timeframe_months} Monaten` : null);
  const frame: (DetailRow | null)[] = [
    row("Zeitraum", timeframe),
    row("Lieferung", slugName(DELIVERY_MODES, s.delivery_mode)),
    row("Extras", extras.join(", ") || null),
    row("Hinweise", text(a.extrasNotes)),
  ];

  const clean = (rows: (DetailRow | null)[]) => rows.filter((r): r is DetailRow => r !== null);
  const groups: DetailGroup[] = [
    { title: "Vorhandenes Angebot", rows: clean(offer) },
    { title: "Geräte", rows: applianceRows(a.appliances) },
    { title: "Rahmen", rows: clean(frame) },
  ];
  return groups.filter((g) => g.rows.length > 0);
}

export interface LeadSummaryRow {
  funnel_type: string;
  kitchen_form: string | null;
  kitchen_style: string | null;
  budget_midpoint: number | null;
  has_existing_offer: boolean | null;
  existing_offer_price_cents: number | null;
  timeframe_months: number | null;
  housing_type: string | null;
  purchase_reason: string | null;
  special_wishes: string[] | null;
  delivery_mode: string | null;
  funnel_answers: unknown;
}

/** Wie kw_lead_public_summary (SQL), aber aus einer leads-Zeile – z. B. für die Admin-Ansicht. */
export function leadSummaryFromRow(lead: LeadSummaryRow): Record<string, unknown> {
  const answers = { ...asRecord(lead.funnel_answers) };
  delete answers.salutation;
  const estimate = asRecord(answers.estimate);
  return {
    source: lead.funnel_type,
    kitchen_form: lead.kitchen_form,
    kitchen_style: lead.kitchen_style,
    budget_eur: lead.budget_midpoint,
    existing_offer_eur:
      lead.has_existing_offer && lead.existing_offer_price_cents !== null ? Math.round(lead.existing_offer_price_cents / 100) : null,
    timeframe_months: lead.timeframe_months,
    housing_type: lead.housing_type,
    purchase_reason: lead.purchase_reason,
    special_wishes: lead.special_wishes,
    delivery_mode: lead.delivery_mode,
    estimate: typeof estimate.min === "number" && typeof estimate.max === "number" ? estimate : null,
    answers,
  };
}

/** Anzeige je Herkunft: A = Anfrage, B = Unterbieten; C nutzt summary.labels. */
export function describeLeadSummary(summary: unknown): DetailGroup[] {
  const source = asRecord(summary).source;
  if (source === "b") return describeFunnelB(summary);
  if (source === "a") return describeFunnelA(summary);
  return [];
}

// ---------------------------------------------------------------------------
// Region (PLZ-Leitbereiche, zweistellig)
// ---------------------------------------------------------------------------

const PLZ2_REGIONS: Record<string, string> = {
  "01": "Dresden", "02": "Bautzen & Görlitz", "03": "Cottbus", "04": "Leipzig", "06": "Halle (Saale)",
  "07": "Gera & Jena", "08": "Zwickau & Plauen", "09": "Chemnitz",
  "10": "Berlin", "12": "Berlin", "13": "Berlin", "14": "Potsdam", "15": "Frankfurt (Oder)",
  "16": "Oranienburg & Eberswalde", "17": "Neubrandenburg & Greifswald", "18": "Rostock", "19": "Schwerin",
  "20": "Hamburg", "21": "Hamburg & Lüneburg", "22": "Hamburg", "23": "Lübeck", "24": "Kiel",
  "25": "Schleswig-Holstein West", "26": "Oldenburg & Ostfriesland", "27": "Bremerhaven & Cuxhaven",
  "28": "Bremen", "29": "Celle & Lüneburger Heide",
  "30": "Hannover", "31": "Hildesheim & Hameln", "32": "Herford & Minden", "33": "Bielefeld & Paderborn",
  "34": "Kassel", "35": "Gießen & Marburg", "36": "Fulda", "37": "Göttingen", "38": "Braunschweig",
  "39": "Magdeburg",
  "40": "Düsseldorf", "41": "Mönchengladbach & Neuss", "42": "Wuppertal & Solingen", "44": "Dortmund & Bochum",
  "45": "Essen", "46": "Oberhausen & Bottrop", "47": "Duisburg & Krefeld", "48": "Münster", "49": "Osnabrück",
  "50": "Köln", "51": "Köln & Bergisches Land", "52": "Aachen", "53": "Bonn", "54": "Trier", "55": "Mainz",
  "56": "Koblenz", "57": "Siegen", "58": "Hagen & Sauerland", "59": "Hamm & Soest",
  "60": "Frankfurt am Main", "61": "Taunus & Wetterau", "63": "Offenbach & Hanau", "64": "Darmstadt",
  "65": "Wiesbaden", "66": "Saarbrücken", "67": "Ludwigshafen & Kaiserslautern", "68": "Mannheim",
  "69": "Heidelberg",
  "70": "Stuttgart", "71": "Böblingen & Ludwigsburg", "72": "Tübingen & Reutlingen", "73": "Esslingen & Göppingen",
  "74": "Heilbronn", "75": "Pforzheim", "76": "Karlsruhe", "77": "Offenburg", "78": "Schwarzwald & Konstanz",
  "79": "Freiburg",
  "80": "München", "81": "München", "82": "München Umland", "83": "Rosenheim & Traunstein", "84": "Landshut",
  "85": "Ingolstadt & Freising", "86": "Augsburg", "87": "Allgäu", "88": "Bodensee & Oberschwaben", "89": "Ulm",
  "90": "Nürnberg", "91": "Erlangen & Ansbach", "92": "Amberg & Weiden", "93": "Regensburg", "94": "Passau",
  "95": "Bayreuth & Hof", "96": "Bamberg & Coburg", "97": "Würzburg", "98": "Suhl & Ilmenau", "99": "Erfurt",
};

/** Regionsname zum PLZ-Leitbereich, z. B. 30159 → „Hannover“. */
export function regionForPostalCode(plz: string): string | null {
  if (!/^\d{5}$/.test(plz)) return null;
  return PLZ2_REGIONS[plz.slice(0, 2)] ?? null;
}
