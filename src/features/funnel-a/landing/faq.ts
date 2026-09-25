import { FAQ_ITEMS, type FaqItem } from "@/data/faq";

/** Auswahl per Fragetext – ändert sich eine Frage in src/data/faq.ts, schlägt der Test an. */
export const LANDING_FAQ_QUESTIONS = [
  "Was kostet mich KüchenWert?",
  "Wie läuft die Angebotsphase ab?",
  "Bin ich zu einem Kauf verpflichtet?",
  "Was passiert mit meinen Daten?",
];

export function landingFaqItems(items: FaqItem[] = FAQ_ITEMS): FaqItem[] {
  return LANDING_FAQ_QUESTIONS.map((question) => items.find((item) => item.question === question)).filter(
    (item): item is FaqItem => item !== undefined,
  );
}
