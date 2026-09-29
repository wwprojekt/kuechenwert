import { analyticsService } from "@/lib/analyticsService";
import type { FunnelId } from "@/lib/funnelRoutes";

export type { FunnelId };

const lastStep = new Map<FunnelId, string>();

/**
 * Schrittaufruf für die Abbruchanalyse je Funnel. Landet in den eigenen
 * Analytics-Tabellen und in GA4 – beides nur mit Analyse-Einwilligung
 * (analyticsService prüft das). Derselbe Schritt zählt nicht doppelt.
 */
export function trackFunnelStep(funnel: FunnelId, step: string, index: number, total: number): void {
  const key = `${index}:${step}`;
  if (lastStep.get(funnel) === key) return;
  lastStep.set(funnel, key);
  analyticsService.trackEvent("funnel_step", {
    category: `funnel_${funnel}`,
    action: "view",
    label: step,
    properties: { funnel, step, step_number: index + 1, total_steps: total },
  });
}

/** Erste Antwort eines Durchlaufs: Startpunkt für die Abschlussquote in GA4. */
export function trackFunnelStart(funnel: FunnelId): void {
  analyticsService.trackEvent("funnel_start", {
    category: `funnel_${funnel}`,
    action: "start",
    label: funnel,
    properties: { funnel },
  });
}

/** Ergebnis einer KI-Visualisierung im Planer (Funnel C): Qualität und Ausfälle sichtbar machen. */
export function trackPlannerRender(result: {
  status: "success" | "failed";
  mode: "edit" | "text";
  variant: boolean;
  seconds: number | null;
}): void {
  analyticsService.trackEvent("planner_render", {
    category: "funnel_c",
    action: result.status,
    label: result.variant ? "variante" : result.mode === "edit" ? "foto" : "ohne_foto",
    value: result.seconds ?? undefined,
    properties: { funnel: "c", ...result },
  });
}

/** Bewertung einer Visualisierung (Daumen hoch/runter). */
export function trackPlannerFeedback(value: 1 | -1 | null, variant: boolean): void {
  analyticsService.trackEvent("planner_feedback", {
    category: "funnel_c",
    action: value === 1 ? "like" : value === -1 ? "dislike" : "reset",
    label: variant ? "variante" : "visualisierung",
    properties: { funnel: "c", value, variant },
  });
}

/** Fehlgeschlagenes Absenden, damit technische Abbrüche in der Auswertung sichtbar sind. */
export function trackFunnelSubmitError(funnel: FunnelId, reason: string): void {
  analyticsService.trackEvent("funnel_submit_error", {
    category: `funnel_${funnel}`,
    action: "error",
    label: reason.slice(0, 80),
    properties: { funnel },
  });
}
