import type { ExpertBriefing } from "./lead-details";

/** Formularstand des Experten-Check-Briefings (Zahl und Datum als Text). */
export interface BriefingDraft {
  kitchen_form: string;
  manufacturer: string;
  run_length_cm: string;
  offer_includes: string[];
  offer_valid_until: string;
  notes: string;
}

export function toBriefingDraft(expert: ExpertBriefing | null | undefined): BriefingDraft {
  return {
    kitchen_form: expert?.kitchen_form ?? "",
    manufacturer: expert?.manufacturer ?? "",
    run_length_cm: expert?.run_length_cm ? String(expert.run_length_cm) : "",
    offer_includes: expert?.offer_includes ?? [],
    offer_valid_until: expert?.offer_valid_until ?? "",
    notes: expert?.notes ?? "",
  };
}

/**
 * Vorschlag (etwa aus der KI-Auslesung der Planung) ins Formular: Nur leere
 * Felder werden gefüllt, damit nichts verloren geht, was das Team schon
 * eingetragen hat. Liefert den neuen Stand und die gefüllten Felder.
 */
export function fillBriefingDraft(draft: BriefingDraft, suggestion: ExpertBriefing): { draft: BriefingDraft; filled: (keyof BriefingDraft)[] } {
  const proposed = toBriefingDraft(suggestion);
  const next: BriefingDraft = { ...draft };
  const filled: (keyof BriefingDraft)[] = [];
  const isEmpty = (value: string | string[]) => (Array.isArray(value) ? value.length === 0 : value.trim() === "");
  for (const key of Object.keys(next) as (keyof BriefingDraft)[]) {
    if (isEmpty(next[key]) && !isEmpty(proposed[key])) {
      Object.assign(next, { [key]: proposed[key] });
      filled.push(key);
    }
  }
  return { draft: next, filled };
}
