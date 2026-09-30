import { sanitizeConfig, sanitizeRoom, type PlannerConfig, type RoomInput } from "./core";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, stable(record[key])]));
  }
  return value;
}

/**
 * Schlüssel der Planung, die eine Visualisierung zeigt. Angaben nur für die
 * Studios (Wünsche, Raumnotizen, Dunstabzug) gehören nicht dazu: Wer sie
 * ergänzt, soll nicht zum Neu-Visualisieren aufgefordert werden.
 */
export function plannerRenderKey(
  config: Partial<PlannerConfig> | null | undefined,
  room: Partial<RoomInput> | null | undefined,
  photoPath: string | null | undefined,
): string {
  const { wishes: _wishes, ...look } = sanitizeConfig(config);
  const { notes: _notes, ventilation: _ventilation, ...space } = sanitizeRoom(room);
  return JSON.stringify(stable({ look, space, photo: photoPath ?? null }));
}
