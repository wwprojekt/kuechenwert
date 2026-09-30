/**
 * Entfernt Kontaktdaten aus Freitexten, die Küchenstudios vor dem
 * Kontaktkauf sehen (Wünsche, Hinweise, Bezeichnungen): E-Mail-Adressen,
 * Telefonnummern und Links. Sonst ließe sich der Kunde am Marktplatz vorbei
 * erreichen, und Kontaktdaten gingen ohne Einwilligung an Studios.
 *
 * Gemeinsam für Browser (Vite) und Edge Functions (Deno); keine Imports.
 */

export const REDACTED = "[entfernt]";

const EMAIL = /[A-Za-z0-9._%+-]+\s?(?:@|\(at\)|\[at\])\s?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/gi;
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
/** Mindestens sieben Ziffern, getrennt höchstens durch Leerzeichen, - / ( ) oder Punkte. */
const DIGIT_RUN = /(?:\+|\b00)?\d(?:[\s\-/().]{0,2}\d){6,}/g;
const DATE = /^\d{1,2}\.\d{1,2}\.(?:\d{2}|\d{4})$/;

/**
 * Rufnummern beginnen mit +, 00 oder 0 oder enthalten einen langen
 * Ziffernblock; Maßketten wie „300 240 180“ und Datumsangaben bleiben stehen.
 */
function looksLikePhone(match: string): boolean {
  const value = match.trim();
  if (DATE.test(value)) return false;
  return /^(?:\+|0)/.test(value) || /\d{5,}/.test(value);
}

export function redactContactData(text: string): string {
  return text
    .replace(EMAIL, REDACTED)
    .replace(LINK, REDACTED)
    .replace(DIGIT_RUN, (match) => (looksLikePhone(match) ? REDACTED : match));
}

/** Für optionale Felder: null bleibt null, leere Ergebnisse werden null. */
export function redactOptional(text: string | null | undefined): string | null {
  if (typeof text !== "string") return null;
  const cleaned = redactContactData(text).trim();
  return cleaned.length > 0 ? cleaned : null;
}
