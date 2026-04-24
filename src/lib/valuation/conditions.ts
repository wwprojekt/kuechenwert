export interface ConditionOption {
  value: string;
  label: string;
  description: string;
  emoji: string;
  factor: number;
}

export const CONDITIONS: ConditionOption[] = [
  { value: "new", label: "Neuwertig", description: "Keine Gebrauchsspuren, wie aus dem Werk", emoji: "✨", factor: 1.0 },
  { value: "excellent", label: "Sehr gepflegt", description: "Minimale Gebrauchsspuren, regelmäßig gewartet", emoji: "🌟", factor: 0.92 },
  { value: "good", label: "Gepflegt", description: "Normale Gebrauchsspuren, voll funktionsfähig", emoji: "👍", factor: 0.80 },
  { value: "fair", label: "Gebrauchsspuren", description: "Deutliche Gebrauchsspuren, funktionsfähig", emoji: "👌", factor: 0.65 },
  { value: "poor", label: "Reparaturbedürftig", description: "Mängel vorhanden, Reparaturen nötig", emoji: "🔧", factor: 0.45 },
];

export const getConditionFactor = (condition: string): number =>
  CONDITIONS.find((c) => c.value === condition)?.factor ?? 0.80;

export const getConditionLabel = (condition: string): string =>
  CONDITIONS.find((c) => c.value === condition)?.label ?? condition;
