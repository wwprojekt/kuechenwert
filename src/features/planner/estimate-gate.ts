import { formById, type RoomInput } from "./core";

/** Gleiche Grenzen wie sanitizeRoom in _shared/kitchen-catalog.ts, das der Server beim Speichern anwendet. */
export const WALL_LIMITS_CM = { min: 60, max: 1200 } as const;

/** Fehlertext je Wand, die so nicht berechnet werden kann (leer, zu kurz, zu lang). */
export function roomWallIssues(room: RoomInput): Record<string, string> {
  const issues: Record<string, string> = {};
  for (const wall of formById(room.form)?.walls ?? []) {
    const cm = room.walls[wall.key] ?? 0;
    if (wall.optional && cm === 0) continue;
    if (cm > WALL_LIMITS_CM.max) issues[wall.key] = "Höchstens 1.200 cm";
    else if (cm === 0) issues[wall.key] = "Bitte Länge angeben";
    else if (cm < WALL_LIMITS_CM.min) issues[wall.key] = wall.optional ? "0 oder mindestens 60 cm" : "Mindestens 60 cm";
  }
  return issues;
}

/**
 * Die Schätzung erscheint erst, wenn Form und Maße feststehen, also nach dem
 * Raum-Schritt. Vorher wäre sie nur der Preis der vorbelegten Musterküche.
 */
export function estimateVisible(furthestIndex: number): boolean {
  return furthestIndex >= 1;
}

/** Hinweis, solange preisrelevante Schritte noch nicht besucht wurden. */
export function estimateNote(furthestIndex: number): string | null {
  if (furthestIndex <= 1) return "Wird mit Arbeitsplatte und Geräten noch genauer.";
  if (furthestIndex === 2) return "Wird mit Geräten und Extras noch genauer.";
  return null;
}
