/**
 * Ergänzungen zu einer Anfrage nach dem Absenden (Tabelle kw_lead_details):
 * - customer: vom Kunden auf der Projektseite (Raum, Technik, Beratung, Hinweis)
 * - expert: vom KüchenWert-Team, etwa nach dem Experten-Check in Funnel B
 * Studios sehen beides ohne Kontaktdaten; Freitexte werden bereinigt, bevor
 * sie gespeichert werden. Die Antworten aus dem Funnel bleiben unverändert.
 *
 * Gemeinsam für Projektseite, Admin, Studio-Portal (Vite) und Edge Functions
 * (Deno); nur relative .ts-Imports.
 */

import { redactOptional } from "./contact-redaction.ts";
import { formLabel, isoDateText, offerIncludesText, type DetailGroup, type DetailRow } from "./funnel-a-catalog.ts";
import { OFFER_INCLUDES, OFFER_INCLUDES_UNKNOWN } from "./funnel-b-catalog.ts";
import { CEILING_HEIGHT_RANGE, KITCHEN_FORMS, VENTILATION_OPTIONS, formById, type KitchenFormId, type VentilationId } from "./kitchen-catalog.ts";

export const ROOM_FEATURES = [
  { id: "fenster", label: "Fenster an einer Küchenwand" },
  { id: "tuer", label: "Tür oder Durchgang an einer Küchenwand" },
  { id: "heizkoerper", label: "Heizkörper an einer Küchenwand" },
  { id: "dachschraege", label: "Dachschräge" },
  { id: "vorsprung", label: "Säule, Nische oder Vorsprung" },
] as const;

export const CONNECTION_OPTIONS = [
  { id: "bleiben", label: "Anschlüsse bleiben, wo sie sind" },
  { id: "versetzbar", label: "Anschlüsse dürfen versetzt werden" },
  { id: "unbekannt", label: "Weiß ich nicht" },
] as const;

export const CONSULTATION_OPTIONS = [
  { id: "studio", label: "Im Küchenstudio" },
  { id: "zuhause", label: "Bei mir zu Hause" },
  { id: "video", label: "Per Video" },
  { id: "telefon", label: "Am Telefon" },
] as const;

export const DETAILS_NOTES_MAX = 1000;
export const RUN_LENGTH_RANGE = { min: 60, max: 3000 } as const;
const WALL_RANGE = { min: 60, max: 1200 } as const;

export interface CustomerDetails {
  walls?: Record<string, number>;
  ceiling_height_cm?: number;
  room_features?: string[];
  ventilation?: VentilationId;
  connections?: string;
  consultation?: string[];
  notes?: string;
}

export interface ExpertBriefing {
  kitchen_form?: KitchenFormId;
  manufacturer?: string;
  run_length_cm?: number;
  offer_includes?: string[];
  offer_valid_until?: string;
  notes?: string;
}

export interface LeadDetails {
  customer?: CustomerDetails | null;
  customer_updated_at?: string | null;
  expert?: ExpertBriefing | null;
  expert_updated_at?: string | null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function intIn(value: unknown, min: number, max: number): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : undefined;
}

function oneOf<T extends string>(value: unknown, options: readonly { id: T }[]): T | undefined {
  return options.find((o) => o.id === value)?.id;
}

function manyOf(value: unknown, ids: readonly string[]): string[] | undefined {
  const list = Array.isArray(value) ? ids.filter((id) => value.includes(id)) : [];
  return list.length ? list : undefined;
}

function freeText(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? (redactOptional(value.slice(0, max)) ?? undefined) : undefined;
}

/** YYYY-MM-DD eines echten Kalendertags zwischen 2020 und 2100. */
function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  const year = Number(value.slice(0, 4));
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) && year >= 2020 && year <= 2100 ? value : undefined;
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/** Wandlängen nur für die Wände der bekannten Küchenform. */
function sanitizeWalls(value: unknown, kitchenForm: string | null | undefined): Record<string, number> | undefined {
  const form = kitchenForm ? formById(kitchenForm) : undefined;
  if (!form) return undefined;
  const raw = record(value);
  const walls: Record<string, number> = {};
  for (const w of form.walls) {
    const cm = intIn(raw[w.key], WALL_RANGE.min, WALL_RANGE.max);
    if (cm !== undefined) walls[w.key] = cm;
  }
  return Object.keys(walls).length ? walls : undefined;
}

export function sanitizeCustomerDetails(input: unknown, kitchenForm?: string | null): CustomerDetails {
  const raw = record(input);
  return compact({
    walls: sanitizeWalls(raw.walls, kitchenForm),
    ceiling_height_cm: intIn(raw.ceiling_height_cm, CEILING_HEIGHT_RANGE.min, CEILING_HEIGHT_RANGE.max),
    room_features: manyOf(raw.room_features, ROOM_FEATURES.map((o) => o.id)),
    ventilation: oneOf(raw.ventilation, VENTILATION_OPTIONS),
    connections: oneOf(raw.connections, CONNECTION_OPTIONS),
    consultation: manyOf(raw.consultation, CONSULTATION_OPTIONS.map((o) => o.id)),
    notes: freeText(raw.notes, DETAILS_NOTES_MAX),
  });
}

export function sanitizeExpertBriefing(input: unknown): ExpertBriefing {
  const raw = record(input);
  const includes = Array.isArray(raw.offer_includes) && raw.offer_includes.includes(OFFER_INCLUDES_UNKNOWN)
    ? [OFFER_INCLUDES_UNKNOWN]
    : manyOf(raw.offer_includes, OFFER_INCLUDES.map((o) => o.slug));
  return compact({
    kitchen_form: oneOf(raw.kitchen_form, KITCHEN_FORMS),
    manufacturer: freeText(raw.manufacturer, 120),
    run_length_cm: intIn(raw.run_length_cm, RUN_LENGTH_RANGE.min, RUN_LENGTH_RANGE.max),
    offer_includes: includes,
    offer_valid_until: isoDate(raw.offer_valid_until),
    notes: freeText(raw.notes, DETAILS_NOTES_MAX),
  });
}

export function hasDetails(value: object | null | undefined): boolean {
  return !!value && Object.keys(value).length > 0;
}

const meters = (cm: number) => `${(cm / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} m`;

const labelsOf = (ids: unknown, options: readonly { id: string; label: string }[]) =>
  (Array.isArray(ids) ? options.filter((o) => ids.includes(o.id)).map((o) => o.label) : []).join(", ") || null;

const dateOf = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("de-DE") : null);

function wallsText(walls: unknown, kitchenForm: string | null | undefined): string | null {
  const form = kitchenForm ? formById(kitchenForm) : undefined;
  const raw = record(walls);
  if (!form) return null;
  const parts = form.walls
    .filter((w) => typeof raw[w.key] === "number")
    .map((w) => `${w.label.replace(" (optional)", "")} ${meters(raw[w.key] as number)}`);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Lesbare Ergänzungen: zuerst der Experten-Check, dann die Angaben des
 * Kunden. kitchenForm ist die Küchenform aus der Anfrage: Zu ihr hat der
 * Kunde die Wandlängen eingetragen, auch wenn der Experten-Check eine andere
 * Form nennt.
 */
export function describeLeadDetails(details: LeadDetails | null | undefined, kitchenForm?: string | null): DetailGroup[] {
  const expert = record(details?.expert);
  const customer = record(details?.customer);
  const row = (label: string, value: string | null | undefined): DetailRow | null => (value ? { label, value } : null);
  const clean = (rows: (DetailRow | null)[]) => rows.filter((r): r is DetailRow => r !== null);

  const expertRows = clean([
    row("Form", formLabel(expert.kitchen_form)),
    row("Hersteller & Programm", typeof expert.manufacturer === "string" ? expert.manufacturer : null),
    row("Laufmeter", typeof expert.run_length_cm === "number" ? `ca. ${meters(expert.run_length_cm)}` : null),
    row("Im Preis enthalten", offerIncludesText(expert.offer_includes)),
    row("Angebot gültig bis", isoDateText(expert.offer_valid_until)),
    row("Hinweis", typeof expert.notes === "string" ? expert.notes : null),
  ]);
  const customerRows = clean([
    row("Wandlängen", wallsText(customer.walls, kitchenForm)),
    row("Raumhöhe", typeof customer.ceiling_height_cm === "number" ? meters(customer.ceiling_height_cm) : null),
    row("Im Raum", labelsOf(customer.room_features, ROOM_FEATURES)),
    row("Dunstabzug", labelsOf(customer.ventilation ? [customer.ventilation] : [], VENTILATION_OPTIONS)),
    row("Anschlüsse", labelsOf(customer.connections ? [customer.connections] : [], CONNECTION_OPTIONS)),
    row("Beratung", labelsOf(customer.consultation, CONSULTATION_OPTIONS)),
    row("Hinweis", typeof customer.notes === "string" ? customer.notes : null),
  ]);

  const titled = (title: string, at: string | null | undefined) => {
    const day = dateOf(at);
    return day ? `${title} · ${day}` : title;
  };
  const groups: DetailGroup[] = [
    { title: titled("Aus dem Experten-Check", details?.expert_updated_at), rows: expertRows },
    { title: titled("Vom Kunden nachgetragen", details?.customer_updated_at), rows: customerRows },
  ];
  return groups.filter((g) => g.rows.length > 0);
}

/**
 * Raum für Grundriss-Skizze und DXF aus den Ergänzungen, wenn die Anfrage
 * keine Planung hat (Funnel A/B): Küchenform der Anfrage und alle ihre
 * Pflichtwände vom Kunden.
 */
export function detailsRoom(
  details: LeadDetails | null | undefined,
  kitchenForm: string | null | undefined,
): { form: KitchenFormId; walls: Record<string, number> } | null {
  const form = kitchenForm ? formById(kitchenForm) : undefined;
  const walls = record(record(details?.customer).walls);
  if (!form) return null;
  const complete = form.walls.every((w) => w.optional || typeof walls[w.key] === "number");
  if (!complete) return null;
  const result: Record<string, number> = {};
  for (const w of form.walls) result[w.key] = typeof walls[w.key] === "number" ? (walls[w.key] as number) : 0;
  return { form: form.id, walls: result };
}
