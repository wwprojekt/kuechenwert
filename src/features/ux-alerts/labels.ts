import type { UxAlertCategory, UxAlertSeverity } from "./api";

export const SEVERITY_LABELS: Record<UxAlertSeverity, { label: string; className: string }> = {
  high: { label: "Kritisch", className: "border-transparent bg-destructive text-destructive-foreground" },
  medium: { label: "Warnung", className: "border-warning/40 bg-warning/10 text-warning" },
  low: { label: "Hinweis", className: "border-border bg-muted text-muted-foreground" },
};

export const CATEGORY_LABELS: Record<UxAlertCategory, string> = {
  kaputt: "Kaputt",
  abbruch: "Abbruch",
  reibung: "Reibung",
};

export const FUNNEL_LABELS: Record<string, string> = {
  a: "Funnel A · Küchenangebote",
  b: "Funnel B · Unterbieten",
  c: "Funnel C · Traumküche",
};
