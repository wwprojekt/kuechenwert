/**
 * Gründe, die Kund:innen bei „Gefällt mir nicht“ antippen können – gemeinsam
 * für kw-planner (Prüfung), den Planer (Beschriftung) und das Admin-Panel.
 * Neue IDs brauchen auch den CHECK planner_renders_feedback_reasons_check.
 */

export const RENDER_FEEDBACK_REASONS = [
  { id: "raum", label: "Raum verändert" },
  { id: "kueche", label: "Passt nicht zur Auswahl" },
  { id: "material", label: "Farben oder Material falsch" },
  { id: "proportionen", label: "Maße wirken falsch" },
  { id: "unecht", label: "Wirkt künstlich" },
] as const;

export type RenderFeedbackReason = (typeof RENDER_FEEDBACK_REASONS)[number]["id"];

const ALLOWED = new Set<string>(RENDER_FEEDBACK_REASONS.map((r) => r.id));

/** Nur bekannte Gründe, jeder höchstens einmal, in Katalog-Reihenfolge. */
export function sanitizeFeedbackReasons(value: unknown): RenderFeedbackReason[] {
  if (!Array.isArray(value)) return [];
  const picked = new Set(value.filter((v): v is string => typeof v === "string" && ALLOWED.has(v)));
  return RENDER_FEEDBACK_REASONS.map((r) => r.id).filter((id) => picked.has(id));
}

export function feedbackReasonLabel(id: string): string {
  return RENDER_FEEDBACK_REASONS.find((r) => r.id === id)?.label ?? id;
}
