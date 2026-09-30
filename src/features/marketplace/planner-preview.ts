import { estimateKitchenPrice, sanitizeConfig, sanitizeProvenance, sanitizeRoom } from "@/features/planner/core";
import { buildPlannerSummary, storedLeadFrame } from "../../../supabase/functions/_shared/planner-summary.ts";
import type { ProjectSummary } from "./dealer-api";

export interface PlannerLeadRow {
  funnel_answers: unknown;
  timeframe_months: number | null;
  purchase_reason: string | null;
  housing_type: string | null;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * Studio-Zusammenfassung aus den gespeicherten Planer-Antworten eines Leads,
 * mit derselben Funktion wie die Ausschreibung (Vorschau im Admin, solange es
 * keine Ausschreibung gibt). Beträge sind die beim Abschluss gespeicherten, die
 * Standard-Preisliste liefert nur die Aufteilung (Schrankzeile, Arbeitsplatte).
 * Null für Leads ohne gespeicherte Planung.
 */
export function plannerSummaryFromLead(lead: PlannerLeadRow, photoCount: number): ProjectSummary | null {
  const answers = asRecord(lead.funnel_answers);
  if (!answers.config || !answers.room) return null;
  const config = sanitizeConfig(answers.config);
  const room = sanitizeRoom(answers.room);
  const stored = asRecord(answers.estimate);
  const amounts =
    typeof stored.min === "number" && typeof stored.max === "number" && typeof stored.mid === "number"
      ? { min: stored.min, max: stored.max, mid: stored.mid }
      : null;
  const summary = buildPlannerSummary(config, room, { ...estimateKitchenPrice(config, room), ...(amounts ?? {}) }, {
    ...storedLeadFrame(answers, {
      timeframeMonths: lead.timeframe_months,
      purchaseReason: lead.purchase_reason,
      housingType: lead.housing_type ?? "unknown",
    }),
    photoCount,
    cover: null,
    provenance: sanitizeProvenance(answers.provenance, room),
  }) as unknown as ProjectSummary;
  return amounts ? summary : { ...summary, estimate: undefined };
}
