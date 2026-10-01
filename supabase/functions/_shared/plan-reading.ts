/**
 * Planungen aus Funnel B automatisch auslesen (kw-plan-read, Mistral AI über
 * den EU-Endpunkt): Schema und Anweisung für das Modell, Prüfung der Antwort
 * und der Vorschlag fürs Briefing des Experten-Checks. Das Ergebnis ist ein
 * Vorschlag für das Team; Studios sehen nur, was das Team ins Briefing
 * übernimmt und speichert.
 *
 * Namen, Anschriften und Kontaktdaten von den Unterlagen speichern wir nicht,
 * nur ob welche darauf stehen (Schwärzen vor der Freigabe). Freitexte laufen
 * zusätzlich durch die Kontaktdaten-Bereinigung.
 *
 * Gemeinsam für Admin (Vite) und Edge Functions (Deno); nur relative .ts-Imports.
 */

import { redactContactData } from "./contact-redaction.ts";
import { formLabel, isoDateText, offerIncludesText, type DetailRow } from "./funnel-a-catalog.ts";
import { APPLIANCE_BRANDS, APPLIANCE_CATEGORIES, KITCHEN_BRANDS, OFFER_INCLUDES, plausibleOfferDate } from "./funnel-b-catalog.ts";
import { KITCHEN_FORMS, type KitchenFormId } from "./kitchen-catalog.ts";
import { DETAILS_NOTES_MAX, RUN_LENGTH_RANGE, type ExpertBriefing } from "./lead-details.ts";

export const PLAN_READING_MODELS = [
  { id: "mistral-medium-latest", label: "Mistral Medium (empfohlen)" },
  { id: "mistral-small-latest", label: "Mistral Small (günstiger)" },
] as const;

export const DEFAULT_PLAN_READING_MODEL: string = PLAN_READING_MODELS[0].id;

/** Unbekannte Modell-IDs (alte Einstellung, Tippfehler) laufen mit dem Standardmodell. */
export function planReadingModel(id: unknown): string {
  return PLAN_READING_MODELS.find((m) => m.id === id)?.id ?? DEFAULT_PLAN_READING_MODEL;
}

/** Planung und Angebot; Fotos vom Raum liest das Modell nicht. */
export const PLAN_READING_CATEGORIES = ["grundriss", "angebot"] as const;

/** Dateitypen, die das Modell lesen kann; HEIC-Fotos bleiben dem Team. */
export const PLAN_READING_TYPES: Readonly<Record<string, "document" | "image">> = {
  "application/pdf": "document",
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
};

export const PLAN_READING_MAX_FILES = 6;

/** Geschwärzte Fassungen lädt das Team hoch („… (geschwärzt).pdf“); sie bringen nichts Neues. */
export function isRedactedCopy(fileName: string | null | undefined): boolean {
  return /\(geschwärzt\)\.[a-z0-9]+$/i.test(fileName ?? "");
}

const UNKNOWN = "unknown";
const OTHER_APPLIANCE = "sonstiges";

const text = (description: string) => ({ type: "string", description });

/**
 * Antwortschema für Mistral (response_format json_schema, strict): jedes
 * Objekt mit allen Feldern als Pflicht und ohne Zusatzfelder. „Unbekannt“
 * heißt leere Zeichenkette, 0, leere Liste oder „unknown“, damit das Schema
 * ohne null-Typen auskommt.
 */
export const PLAN_READING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_kitchen_planning",
    "kitchen_form",
    "manufacturer",
    "program",
    "fronts",
    "worktop",
    "run_length_cm",
    "wall_lengths_cm",
    "ceiling_height_cm",
    "appliances",
    "sink",
    "extras",
    "offer_total_eur",
    "offer_includes",
    "offer_valid_until",
    "personal_data",
    "summary",
  ],
  properties: {
    is_kitchen_planning: { type: "boolean", description: "true, wenn die Unterlagen eine Küchenplanung oder ein Küchenangebot zeigen" },
    kitchen_form: { type: "string", enum: [...KITCHEN_FORMS.map((f) => f.id), UNKNOWN], description: "Form der geplanten Küche" },
    manufacturer: text("Küchenhersteller laut Unterlagen, z. B. Nobilia oder Häcker – nicht das Küchenstudio; leer, wenn nicht erkennbar"),
    program: text("Programm bzw. Frontserie des Herstellers, z. B. Touch 340; leer, wenn nicht erkennbar"),
    fronts: text("Fronten kurz: Farbe, Material, Oberfläche, Griffart; leer, wenn nicht erkennbar"),
    worktop: text("Arbeitsplatte kurz: Material, Dekor, Stärke; leer, wenn nicht erkennbar"),
    run_length_cm: { type: "integer", description: "Laufmeter der Unterschränke in Zentimetern (Summe aller Zeilen und Inseln); 0, wenn nicht ablesbar" },
    wall_lengths_cm: { type: "array", items: { type: "integer" }, description: "Längen der Küchenwände laut Grundriss in Zentimetern; leer, wenn nicht ablesbar" },
    ceiling_height_cm: { type: "integer", description: "Raumhöhe in Zentimetern; 0, wenn nicht angegeben" },
    appliances: {
      type: "array",
      description: "Elektrogeräte laut Planung, Geräteliste oder Angebot",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "brand", "model"],
        properties: {
          category: { type: "string", enum: [...APPLIANCE_CATEGORIES.map((c) => c.slug), OTHER_APPLIANCE] },
          brand: text("Marke, z. B. Siemens; leer, wenn nicht angegeben"),
          model: text("Typenbezeichnung, z. B. HB778G3B1; leer, wenn nicht angegeben"),
        },
      },
    },
    sink: text("Spüle und Armatur kurz: Marke, Modell, Material; leer, wenn nicht erkennbar"),
    extras: { type: "array", items: { type: "string" }, description: "Besondere Ausstattung, z. B. Apothekerauszug, LED-Beleuchtung, Mülltrennung" },
    offer_total_eur: { type: "number", description: "Gesamtpreis inkl. MwSt. laut Angebot in Euro; 0, wenn kein Preis in den Unterlagen steht" },
    offer_includes: {
      type: "array",
      items: { type: "string", enum: OFFER_INCLUDES.map((o) => o.slug) },
      description:
        "Im Preis enthaltene Leistungen: appliances = Elektrogeräte, delivery = Lieferung, assembly = Montage, sink = Spüle und Armatur, removal = Abbau und Entsorgung der Altküche, connection = Elektro- und Wasseranschluss, measurement = Aufmaß vor Ort",
    },
    offer_valid_until: text("Gültigkeit des Angebots als JJJJ-MM-TT; leer, wenn nicht angegeben"),
    personal_data: {
      type: "object",
      additionalProperties: false,
      required: ["customer_name", "customer_address", "customer_contact", "studio_identity"],
      properties: {
        customer_name: { type: "boolean", description: "Name der Kundin bzw. des Kunden ist zu sehen" },
        customer_address: { type: "boolean", description: "Anschrift der Kundin bzw. des Kunden ist zu sehen" },
        customer_contact: { type: "boolean", description: "Telefonnummer oder E-Mail-Adresse der Kundin bzw. des Kunden ist zu sehen" },
        studio_identity: { type: "boolean", description: "Name, Logo, Anschrift oder Kontaktdaten des Küchenstudios sind zu sehen" },
      },
    },
    summary: text(
      "2 bis 4 Sätze auf Deutsch für andere Küchenstudios: was geplant ist. Ohne Namen, Anschriften, Telefonnummern, E-Mail-Adressen, ohne Namen des Studios und ohne Preise.",
    ),
  },
} as const;

export const PLAN_READING_PROMPT = [
  "Du liest die Unterlagen eines Küchenstudios aus (Planung, Grundriss, Ansichten, Geräteliste oder Angebot), damit andere Küchenstudios dieselbe Küche anbieten können.",
  "Übernimm nur, was in den Unterlagen steht, und erfinde nichts: Was nicht erkennbar ist, bleibt leer, 0 oder „unknown“.",
  "Küchenform: zeile = alles an einer Wand; parallel = zwei gegenüberliegende Zeilen; l = L-Form über eine Ecke; u = U-Form über drei Wände; g = U-Form mit zusätzlicher Halbinsel oder Theke; insel = Wandzeile mit freistehender Kücheninsel.",
  "Maße in Zentimetern; Angaben in Millimetern oder Metern rechnest du um.",
  "Namen, Anschriften, Telefonnummern und E-Mail-Adressen von Personen oder vom Küchenstudio gibst du nie aus, in keinem Feld. Unter personal_data meldest du nur, ob solche Angaben auf den Unterlagen zu sehen sind.",
  "Antworte ausschließlich mit JSON nach dem vorgegebenen Schema.",
].join("\n");

export interface PlanReadingFile {
  kind: "document" | "image";
  url: string;
}

/** Anfrage an /v1/chat/completions: alle Dateien in einer Nachricht, Antwort strikt nach Schema. */
export function buildPlanReadingRequest(model: string, files: readonly PlanReadingFile[]): Record<string, unknown> {
  return {
    model: planReadingModel(model),
    temperature: 0,
    max_tokens: 2500,
    messages: [
      { role: "system", content: PLAN_READING_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Hier sind die Unterlagen der Kundin bzw. des Kunden aus dem Küchenstudio." },
          ...files.map((f) => (f.kind === "document" ? { type: "document_url", document_url: f.url } : { type: "image_url", image_url: f.url })),
        ],
      },
    ],
    response_format: { type: "json_schema", json_schema: { name: "kuechenplanung", strict: true, schema: PLAN_READING_SCHEMA } },
  };
}

export interface PlanReadingResponse {
  content: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** Antwort von /v1/chat/completions: Inhalt als JSON (Text oder Text-Bausteine) und Tokenzahlen. */
export function parsePlanReadingResponse(body: string): PlanReadingResponse {
  const data = record(JSON.parse(body));
  const message = record(record((Array.isArray(data.choices) ? data.choices[0] : null) as unknown).message);
  const raw = message.content;
  const textContent =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.map((chunk) => (typeof record(chunk).text === "string" ? (record(chunk).text as string) : "")).join("")
        : "";
  if (!textContent.trim()) throw new Error("Antwort ohne Inhalt");
  const usage = record(data.usage);
  const tokens = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return { content: JSON.parse(textContent), inputTokens: tokens(usage.prompt_tokens), outputTokens: tokens(usage.completion_tokens) };
}

/** Fehlermeldung von Mistral ohne Anfrageinhalte (nur das Feld message, gekürzt). */
export function mistralErrorText(body: string): string {
  try {
    const message = record(JSON.parse(body)).message;
    if (typeof message === "string") return message.slice(0, 200);
    if (message && typeof message === "object") return JSON.stringify(message).slice(0, 200);
  } catch {
    // keine JSON-Antwort
  }
  return body.replace(/\s+/g, " ").slice(0, 120);
}

export interface PlanAppliance {
  category: string;
  brand: string | null;
  model: string | null;
}

export interface PlanPersonalData {
  customer_name: boolean;
  customer_address: boolean;
  customer_contact: boolean;
  studio_identity: boolean;
}

export interface PlanReading {
  is_kitchen_planning: boolean;
  kitchen_form: KitchenFormId | null;
  manufacturer: string | null;
  program: string | null;
  fronts: string | null;
  worktop: string | null;
  run_length_cm: number | null;
  wall_lengths_cm: number[];
  ceiling_height_cm: number | null;
  appliances: PlanAppliance[];
  sink: string | null;
  extras: string[];
  offer_total_eur: number | null;
  offer_includes: string[];
  offer_valid_until: string | null;
  personal_data: PlanPersonalData;
  summary: string | null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

const PLACEHOLDER = /^(unknown|unbekannt|keine angabe|n\/a|-+|\?+)$/i;

/** Freitext ohne Steuerzeichen und Kontaktdaten; Platzhalter wie „unbekannt“ werden null. */
function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex -- Steuerzeichen aus Modellantworten entfernen
  const flat = value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  const result = redactContactData(flat).slice(0, max).trim();
  return result && !PLACEHOLDER.test(result) ? result : null;
}

function intIn(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? Math.round(value) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Bekannte Marke in kanonischer Schreibweise („nobilia-Werke“ → „Nobilia“), sonst der bereinigte Text. */
function brandName(value: unknown, brands: readonly { slug: string; name: string }[], max: number): string | null {
  const cleaned = clean(value, max);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  const known = brands.find(
    (b) => !/^sonstig/.test(b.slug) && new RegExp(`(^|[^\\p{L}])${escapeRegExp(b.name.toLowerCase())}($|[^\\p{L}])`, "u").test(lower),
  );
  return known?.name ?? cleaned;
}

const FORM_IDS = new Set<string>(KITCHEN_FORMS.map((f) => f.id));
const APPLIANCE_SLUGS = new Set<string>([...APPLIANCE_CATEGORIES.map((c) => c.slug), OTHER_APPLIANCE]);
const INCLUDE_SLUGS = OFFER_INCLUDES.map((o) => o.slug);

/** Modellantwort prüfen: nur bekannte Werte, plausible Maße und Preise, Freitexte ohne Kontaktdaten. */
export function normalizePlanReading(raw: unknown): PlanReading {
  const r = record(raw);
  const pd = record(r.personal_data);
  const appliances = (Array.isArray(r.appliances) ? r.appliances : [])
    .map((item) => {
      const a = record(item);
      const category = typeof a.category === "string" && APPLIANCE_SLUGS.has(a.category) ? a.category : OTHER_APPLIANCE;
      return { category, brand: brandName(a.brand, APPLIANCE_BRANDS, 40), model: clean(a.model, 60) };
    })
    .filter((a) => a.brand || a.model || a.category !== OTHER_APPLIANCE)
    .slice(0, 20);
  const includes = Array.isArray(r.offer_includes) ? INCLUDE_SLUGS.filter((slug) => (r.offer_includes as unknown[]).includes(slug)) : [];
  return {
    is_kitchen_planning: r.is_kitchen_planning === true,
    kitchen_form: typeof r.kitchen_form === "string" && FORM_IDS.has(r.kitchen_form) ? (r.kitchen_form as KitchenFormId) : null,
    manufacturer: brandName(r.manufacturer, KITCHEN_BRANDS, 60),
    program: clean(r.program, 60),
    fronts: clean(r.fronts, 160),
    worktop: clean(r.worktop, 160),
    run_length_cm: intIn(r.run_length_cm, RUN_LENGTH_RANGE.min, RUN_LENGTH_RANGE.max),
    wall_lengths_cm: (Array.isArray(r.wall_lengths_cm) ? r.wall_lengths_cm : [])
      .map((v) => intIn(v, 60, 1200))
      .filter((v): v is number => v !== null)
      .slice(0, 8),
    ceiling_height_cm: intIn(r.ceiling_height_cm, 200, 400),
    appliances,
    sink: clean(r.sink, 120),
    extras: (Array.isArray(r.extras) ? r.extras : [])
      .map((v) => clean(v, 60))
      .filter((v): v is string => !!v)
      .slice(0, 12),
    offer_total_eur: intIn(r.offer_total_eur, 500, 500_000),
    offer_includes: includes,
    offer_valid_until: plausibleOfferDate(r.offer_valid_until),
    personal_data: {
      customer_name: pd.customer_name === true,
      customer_address: pd.customer_address === true,
      customer_contact: pd.customer_contact === true,
      studio_identity: pd.studio_identity === true,
    },
    summary: clean(r.summary, 600),
  };
}

const categoryName = (slug: string) => APPLIANCE_CATEGORIES.find((c) => c.slug === slug)?.name ?? "Weiteres Gerät";

/** „Backofen: Siemens HB778G3B1; Kochfeld: Siemens“ – je Geräteart zusammengefasst. */
export function appliancesText(appliances: readonly PlanAppliance[]): string | null {
  const byCategory = new Map<string, string[]>();
  for (const a of appliances) {
    const name = categoryName(a.category);
    const detail = [a.brand, a.model].filter(Boolean).join(" ") || "enthalten";
    byCategory.set(name, [...(byCategory.get(name) ?? []), detail]);
  }
  return byCategory.size ? [...byCategory].map(([name, details]) => `${name}: ${details.join(", ")}`).join("; ") : null;
}

const meters = (cm: number) => `${(cm / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} m`;
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Kurzer Text fürs Briefing: Zusammenfassung und Ausstattung, höchstens DETAILS_NOTES_MAX Zeichen. */
export function planReadingNotes(r: PlanReading): string | null {
  const parts = [
    r.summary,
    r.fronts && `Fronten: ${r.fronts}`,
    r.worktop && `Arbeitsplatte: ${r.worktop}`,
    r.wall_lengths_cm.length > 0 && `Wände: ${r.wall_lengths_cm.map(meters).join(" · ")}`,
    r.ceiling_height_cm && `Raumhöhe: ${meters(r.ceiling_height_cm)}`,
    appliancesText(r.appliances) && `Geräte: ${appliancesText(r.appliances)}`,
    r.sink && `Spüle: ${r.sink}`,
    r.extras.length > 0 && `Ausstattung: ${r.extras.join(", ")}`,
  ]
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .map((p) => p.replace(/[.\s]+$/, ""));
  if (parts.length === 0) return null;
  const joined = `${parts.join(". ")}.`;
  if (joined.length <= DETAILS_NOTES_MAX) return joined;
  const cut = joined.slice(0, DETAILS_NOTES_MAX - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), DETAILS_NOTES_MAX - 40))}…`;
}

/** Vorschlag fürs Briefing des Experten-Checks (nur erkannte Felder). */
export function briefingFromPlanReading(r: PlanReading): ExpertBriefing {
  const manufacturer = [r.manufacturer, r.program].filter(Boolean).join(" ").slice(0, 120);
  const briefing: ExpertBriefing = {};
  if (r.kitchen_form) briefing.kitchen_form = r.kitchen_form;
  if (manufacturer) briefing.manufacturer = manufacturer;
  if (r.run_length_cm) briefing.run_length_cm = r.run_length_cm;
  if (r.offer_includes.length) briefing.offer_includes = r.offer_includes;
  if (r.offer_valid_until) briefing.offer_valid_until = r.offer_valid_until;
  const notes = planReadingNotes(r);
  if (notes) briefing.notes = notes;
  return briefing;
}

/** Zeilen für die Admin-Ansicht; nur, was erkannt wurde. */
export function describePlanReading(r: PlanReading): DetailRow[] {
  const rows: [string, string | null][] = [
    ["Küchenform", formLabel(r.kitchen_form)],
    ["Hersteller & Programm", [r.manufacturer, r.program].filter(Boolean).join(" ") || null],
    ["Fronten", r.fronts],
    ["Arbeitsplatte", r.worktop],
    ["Laufmeter", r.run_length_cm ? `ca. ${meters(r.run_length_cm)}` : null],
    ["Wandlängen", r.wall_lengths_cm.length ? r.wall_lengths_cm.map(meters).join(" · ") : null],
    ["Raumhöhe", r.ceiling_height_cm ? meters(r.ceiling_height_cm) : null],
    ["Geräte", appliancesText(r.appliances)],
    ["Spüle", r.sink],
    ["Ausstattung", r.extras.join(", ") || null],
    ["Preis laut Angebot", r.offer_total_eur ? euro(r.offer_total_eur) : null],
    ["Im Preis enthalten", offerIncludesText(r.offer_includes)],
    ["Gültig bis", isoDateText(r.offer_valid_until)],
    ["Zusammenfassung", r.summary],
  ];
  return rows.filter((row): row is [string, string] => !!row[1]).map(([label, value]) => ({ label, value }));
}

/**
 * Hinweise fürs Team: keine Küchenplanung erkannt, personenbezogene Angaben
 * auf den Unterlagen (vor der Freigabe schwärzen) und ein Angebotspreis, der
 * deutlich vom genannten Preis abweicht.
 */
export function planReadingWarnings(r: PlanReading, statedPriceEur?: number | null): string[] {
  const warnings: string[] = [];
  if (!r.is_kitchen_planning) warnings.push("Die Unterlagen sehen nicht nach einer Küchenplanung aus – bitte selbst ansehen.");
  const pd = r.personal_data;
  const visible = [pd.customer_name && "Name", pd.customer_address && "Anschrift", pd.customer_contact && "Telefon oder E-Mail"].filter(Boolean) as string[];
  if (visible.length || pd.studio_identity) {
    const who = [
      visible.length ? `${visible.join(", ")} der Kundin bzw. des Kunden` : null,
      pd.studio_identity ? "Name oder Logo des Studios" : null,
    ].filter(Boolean);
    warnings.push(`Auf den Unterlagen stehen vermutlich ${who.join(" sowie ")} – vor einer Freigabe für Studios schwärzen.`);
  }
  if (r.offer_total_eur && statedPriceEur && statedPriceEur > 0 && Math.abs(r.offer_total_eur - statedPriceEur) / statedPriceEur > 0.05) {
    warnings.push(`Im Angebot stehen ${euro(r.offer_total_eur)}, genannt wurden ${euro(statedPriceEur)} – im Experten-Check klären.`);
  }
  return warnings;
}
