/** 95-%-Wilson-Intervall eines Anteils: zeigt, wie wenig kleine Stichproben aussagen. */
export function wilsonInterval(successes: number, n: number): [number, number] | null {
  if (!(n > 0) || successes < 0 || successes > n) return null;
  const z = 1.96;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

export type AbVerdict = "control" | "challenger" | "open";

/** Besser ist eine Gruppe erst, wenn sich die Intervalle der positiven Bewertungen nicht mehr überlappen. */
export function abVerdict(
  control: { up: number; rated: number } | null,
  challenger: { up: number; rated: number } | null,
): AbVerdict {
  const a = control ? wilsonInterval(control.up, control.rated) : null;
  const b = challenger ? wilsonInterval(challenger.up, challenger.rated) : null;
  if (!a || !b) return "open";
  if (b[0] > a[1]) return "challenger";
  if (a[0] > b[1]) return "control";
  return "open";
}
