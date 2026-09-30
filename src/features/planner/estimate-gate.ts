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
 * Die Preisschätzung ist der Lohn für die Kontaktdaten: Sie erscheint erst im
 * Ergebnis, nachdem Name, E-Mail und Telefon erfasst sind – vorher nirgends,
 * auch nicht als Zwischenstand.
 */
export function estimateVisible(unlocked: boolean): boolean {
  return unlocked;
}
