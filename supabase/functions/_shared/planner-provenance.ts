/**
 * Funnel C: Welche Angaben einer Planung stammen vom Kunden? Der Planer startet
 * mit Standardwerten (Konfiguration und Beispielmaße), „Details überspringen“
 * übernimmt sie unverändert. Studios sollen sie nicht für Kundenwünsche halten.
 *
 * Gemeinsam für Planer (Vite) und Edge Functions (Deno); nur relative .ts-Imports.
 */

import { formById, type KitchenFormId, type RoomInput } from "./kitchen-catalog.ts";

/** Planer-Schritte, die Werte der Konfiguration setzen. */
export const PLANNER_CHOICE_STEPS = [
  "stil",
  "qualitaet",
  "fronten",
  "farbe",
  "griffe",
  "arbeitsplatte",
  "plattenfarbe",
  "schraenke",
  "spuele",
  "geraeteklasse",
  "kochen",
  "geraete",
  "extras",
  "leistungen",
] as const;

export type PlannerChoiceStep = (typeof PLANNER_CHOICE_STEPS)[number];

export interface PlannerProvenance {
  /** Schritte, die der Kunde beantwortet oder mit „Weiter“ bestätigt hat. */
  steps: PlannerChoiceStep[];
  /** Wände, deren Länge der Kunde selbst eingegeben hat. */
  walls: string[];
}

const CHOICE_STEPS: ReadonlySet<string> = new Set(PLANNER_CHOICE_STEPS);

export function isChoiceStep(step: unknown): step is PlannerChoiceStep {
  return typeof step === "string" && CHOICE_STEPS.has(step);
}

export function emptyProvenance(): PlannerProvenance {
  return { steps: [], walls: [] };
}

/** null heißt unbekannt (Planung aus einer älteren Version) und bleibt es. */
export function markStepAnswered(provenance: PlannerProvenance | null, step: unknown): PlannerProvenance | null {
  if (!provenance || !isChoiceStep(step) || provenance.steps.includes(step)) return provenance;
  return { ...provenance, steps: [...provenance.steps, step] };
}

export function markWallEdited(provenance: PlannerProvenance | null, key: string): PlannerProvenance | null {
  if (!provenance || provenance.walls.includes(key)) return provenance;
  return { ...provenance, walls: [...provenance.walls, key] };
}

/** Nach einem Wechsel der Küchenform zählen nur Wände, die die neue Form hat. */
export function keepWallsOf(provenance: PlannerProvenance | null, form: KitchenFormId): PlannerProvenance | null {
  if (!provenance) return null;
  const keys = new Set((formById(form)?.walls ?? []).map((w) => w.key));
  return { ...provenance, walls: provenance.walls.filter((key) => keys.has(key)) };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Bereinigt (untrusted) Angaben zur Küchenform; ohne Objekt null (ältere Clients senden nichts). */
export function sanitizeProvenance(input: unknown, room: Pick<RoomInput, "form">): PlannerProvenance | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const walls = new Set((formById(room.form)?.walls ?? []).map((w) => w.key));
  return {
    steps: Array.from(new Set(strings(raw.steps).filter(isChoiceStep))),
    walls: Array.from(new Set(strings(raw.walls).filter((key) => walls.has(key)))),
  };
}

/** Zeilen der Studio-Ansicht (summary.labels) und die Schritte, aus denen sie stammen. */
const LABEL_STEPS: Record<string, readonly PlannerChoiceStep[]> = {
  quality: ["qualitaet"],
  style: ["stil"],
  front: ["fronten", "farbe"],
  handle: ["griffe"],
  wall_cabinets: ["schraenke"],
  tall_units: ["schraenke"],
  worktop: ["arbeitsplatte", "plattenfarbe"],
  sink: ["spuele"],
  appliance_level: ["geraeteklasse"],
  appliances: ["kochen", "geraete"],
  extras: ["extras"],
  services: ["leistungen"],
};

/** "default": kein Schritt der Zeile beantwortet, "partial": nur ein Teil. */
export type ChoiceSource = "default" | "partial";

/** Zeilen, die ganz oder teilweise auf Standardwerten beruhen; beantwortete fehlen. */
export function labelDefaults(provenance: PlannerProvenance): Record<string, ChoiceSource> {
  const confirmed = new Set<string>(provenance.steps);
  const result: Record<string, ChoiceSource> = {};
  for (const [label, steps] of Object.entries(LABEL_STEPS)) {
    const answered = steps.filter((step) => confirmed.has(step)).length;
    if (answered < steps.length) result[label] = answered === 0 ? "default" : "partial";
  }
  return result;
}

export type DimensionsSource = "customer" | "partial" | "example";

/** Stammen die Wandlängen vom Kunden oder aus den Beispielwerten des Planers? */
export function dimensionsSource(provenance: PlannerProvenance, room: RoomInput): DimensionsSource {
  const used = (formById(room.form)?.walls ?? []).filter((w) => (room.walls[w.key] ?? 0) > 0).map((w) => w.key);
  const edited = used.filter((key) => provenance.walls.includes(key)).length;
  if (used.length > 0 && edited === used.length) return "customer";
  return edited > 0 ? "partial" : "example";
}
