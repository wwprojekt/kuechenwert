import { funnelProgressPercent } from "@/components/funnel/funnel-progress";

/**
 * Schritte von Funnel C: je eine Frage pro Bildschirm. Nach „Küche
 * visualisieren“ läuft die KI im Hintergrund, während der Kunde die
 * Lead-Schritte ausfüllt; Küche und Preis zeigt erst das Ergebnis.
 */
export type PlannerStep =
  | "form"
  | "masse"
  | "foto"
  | "stil"
  | "qualitaet"
  | "fronten"
  | "farbe"
  | "griffe"
  | "arbeitsplatte"
  | "plattenfarbe"
  | "schraenke"
  | "spuele"
  | "geraeteklasse"
  | "kochen"
  | "geraete"
  | "extras"
  | "leistungen"
  | "wuensche"
  | "plz"
  | "visualisierung"
  | "angebote"
  | "zeitrahmen"
  | "name"
  | "kontakt"
  | "ergebnis";

export interface PlannerStepDef {
  id: PlannerStep;
  label: string;
  kind: "plan" | "lead" | "result";
  /** Feinschliff mit guten Standardwerten: „Details überspringen“ springt zum Einbauort. */
  detail?: boolean;
}

export const PLANNER_STEPS: readonly PlannerStepDef[] = [
  { id: "form", label: "Küchenform", kind: "plan" },
  { id: "masse", label: "Maße", kind: "plan" },
  { id: "foto", label: "Raumfoto", kind: "plan" },
  { id: "stil", label: "Stil", kind: "plan" },
  { id: "qualitaet", label: "Qualität", kind: "plan" },
  { id: "fronten", label: "Fronten", kind: "plan", detail: true },
  { id: "farbe", label: "Frontfarbe", kind: "plan", detail: true },
  { id: "griffe", label: "Griffe", kind: "plan", detail: true },
  { id: "arbeitsplatte", label: "Arbeitsplatte", kind: "plan", detail: true },
  { id: "plattenfarbe", label: "Farbe der Arbeitsplatte", kind: "plan", detail: true },
  { id: "schraenke", label: "Schränke", kind: "plan", detail: true },
  { id: "spuele", label: "Spüle & Armatur", kind: "plan", detail: true },
  { id: "geraeteklasse", label: "Geräte-Klasse", kind: "plan", detail: true },
  { id: "kochen", label: "Kochen & Kühlen", kind: "plan", detail: true },
  { id: "geraete", label: "Weitere Geräte", kind: "plan", detail: true },
  { id: "extras", label: "Extras", kind: "plan", detail: true },
  { id: "leistungen", label: "Leistungen", kind: "plan", detail: true },
  { id: "wuensche", label: "Wünsche", kind: "plan", detail: true },
  { id: "plz", label: "Einbauort", kind: "plan" },
  { id: "visualisierung", label: "Visualisierung", kind: "lead" },
  { id: "angebote", label: "Angebote", kind: "lead" },
  { id: "zeitrahmen", label: "Zeitrahmen", kind: "lead" },
  { id: "name", label: "Name", kind: "lead" },
  { id: "kontakt", label: "Kontakt", kind: "lead" },
  { id: "ergebnis", label: "Ihre Küche", kind: "result" },
];

const STEP_IDS = new Set<string>(PLANNER_STEPS.map((s) => s.id));

/** Schritt-IDs bis 09/2026 (sechs lange Schritte) auf die neue Folge abbilden. */
const LEGACY_STEPS: Record<string, PlannerStep> = {
  raum: "form",
  ausstattung: "arbeitsplatte",
  kontakt: "angebote",
};

export function isPlannerStep(value: unknown): value is PlannerStep {
  return typeof value === "string" && STEP_IDS.has(value);
}

export function normalizePlannerStep(value: unknown): PlannerStep {
  if (typeof value === "string" && LEGACY_STEPS[value]) return LEGACY_STEPS[value]!;
  return isPlannerStep(value) ? value : "form";
}

export function stepDef(step: PlannerStep): PlannerStepDef {
  return PLANNER_STEPS.find((s) => s.id === step) ?? PLANNER_STEPS[0]!;
}

export interface FlowState {
  /** Kontakt erfasst: Lead-Schritte entfallen, Visualisieren führt direkt ins Ergebnis. */
  unlocked: boolean;
  /** Antwort auf „Möchten Sie auch Angebote?“; der Zeitrahmen folgt nur bei Ja. */
  wantsOffers: boolean | null;
}

/** Sichtbare Schritte in Reihenfolge. */
export function plannerFlow({ unlocked, wantsOffers }: FlowState): PlannerStep[] {
  return PLANNER_STEPS.filter((s) => {
    if (s.kind === "lead") return !unlocked && (s.id !== "zeitrahmen" || wantsOffers === true);
    if (s.kind === "result") return unlocked;
    return true;
  }).map((s) => s.id);
}

export function nextStep(step: PlannerStep, flow: FlowState): PlannerStep {
  const steps = plannerFlow(flow);
  const i = steps.indexOf(step);
  return steps[Math.min(i + 1, steps.length - 1)] ?? step;
}

export function previousStep(step: PlannerStep, flow: FlowState): PlannerStep | null {
  const steps = plannerFlow(flow);
  const i = steps.indexOf(step);
  return i > 0 ? steps[i - 1]! : null;
}

/** Fortschritt mit Vorsprung über alle Schritte bis zum Absenden; das Ergebnis ist 100 %. */
export function plannerProgress(step: PlannerStep, flow: FlowState): { current: number; total: number; percent: number } {
  const steps = plannerFlow(flow).filter((s) => s !== "ergebnis");
  const total = steps.length;
  if (step === "ergebnis") return { current: total, total: total + 1, percent: 100 };
  const current = Math.max(0, steps.indexOf(step));
  return { current, total, percent: funnelProgressPercent(current, total) };
}
