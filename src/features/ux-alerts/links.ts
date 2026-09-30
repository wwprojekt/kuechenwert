import type { FunnelId } from "@/lib/funnelRoutes";
import type { UxAlert } from "./api";

export interface UxAlertLink {
  label: string;
  to: string;
  /** Funnel-Seiten öffnen im neuen Tab, damit die Liste offen bleibt. */
  external?: boolean;
}

/** URL des betroffenen Schritts, so wie Besucher ihn sehen. */
export function funnelStepUrl(funnel: FunnelId | null, step: string | null, stepIndex: number | null): string | null {
  if (funnel === "a") return !step || step === "kuechenform" ? "/formular" : `/funnel/a/${step}`;
  if (funnel === "b") return stepIndex && stepIndex > 0 ? `/funnel/b?schritt=${stepIndex + 1}` : "/funnel/b";
  if (funnel === "c") return step ? `/funnel/c?schritt=${step}` : "/funnel/c";
  return null;
}

const KIND_LINKS: Record<string, UxAlertLink> = {
  error_log: { label: "Fehlerprotokoll", to: "/admin/error-logs" },
  render_failed: { label: "KI & Preis-Engine", to: "/admin/ki" },
  planner_no_request: { label: "Planungen ansehen", to: "/admin/planner-sessions" },
};

export function uxAlertLinks(alert: Pick<UxAlert, "kind" | "funnel" | "step" | "step_index">): UxAlertLink[] {
  const links: UxAlertLink[] = [];
  const stepUrl = funnelStepUrl(alert.funnel, alert.step, alert.step_index);
  if (stepUrl) links.push({ label: alert.step ? "Schritt ansehen" : "Funnel ansehen", to: stepUrl, external: true });
  const kindLink = KIND_LINKS[alert.kind];
  if (kindLink) links.push(kindLink);
  if (alert.funnel) links.push({ label: "Funnel-Auswertung", to: `/admin/analytics?tab=funnels&funnel=${alert.funnel}` });
  return links;
}
