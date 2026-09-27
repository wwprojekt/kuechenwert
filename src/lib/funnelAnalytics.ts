import { analyticsService } from "@/lib/analyticsService";

export type FunnelId = "a" | "b" | "c";

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

/** Fehlgeschlagenes Absenden, damit technische Abbrüche in der Auswertung sichtbar sind. */
export function trackFunnelSubmitError(funnel: FunnelId, reason: string): void {
  analyticsService.trackEvent("funnel_submit_error", {
    category: `funnel_${funnel}`,
    action: "error",
    label: reason.slice(0, 80),
    properties: { funnel },
  });
}
