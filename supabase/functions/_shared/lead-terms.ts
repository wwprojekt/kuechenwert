/**
 * Abschluss aller Funnels (ab 30.09.2026): ein Pflicht-Haken „AGB akzeptiert,
 * Datenschutzerklärung gelesen“ statt einzelner Haken für Weitergabe und
 * Anrufe. Der Hinweis über dem Haken sagt, was zur Vermittlung gehört:
 * Studios sehen die Anfrage ohne Kontaktdaten, höchstens drei Studios erhalten
 * Name, E-Mail und Telefonnummer für Rückfragen zum Angebot.
 *
 * Browser und Edge Functions lesen Texte und Versionen aus dieser Datei: Was
 * im Einwilligungsprotokoll (lead_consents.text_version) steht, ist genau der
 * Text, den der Kunde gesehen hat. Text geändert = neue Version.
 *
 * Seiten aus der Zeit davor schicken accept_terms nicht mit; für sie gelten
 * die bisherigen Einwilligungen und Textversionen weiter.
 */

export const TERMS_LABEL = "Ich akzeptiere die AGB und habe die Datenschutzerklärung gelesen.";

export const TERMS_MISSING = "Bitte bestätigen Sie die AGB und die Datenschutzerklärung.";

/** Die Hinweise sind kurz, weil der Kontaktschritt auch auf 375 × 548 px ohne Scrollen passen muss (tests/e2e/funnel-fit.spec.ts). */
const CONTACT_SHARING = "Name, E-Mail und Telefon erhalten höchstens drei Studios für Rückfragen zu Ihrem Angebot.";

export const FUNNEL_TERMS = {
  a: {
    version: "kw-anfrage-2026-09-30",
    notice: `Kostenlos & unverbindlich. Studios aus Ihrer Region sehen Ihre Anfrage ohne Namen und können Ihnen Angebote machen. ${CONTACT_SHARING}`,
  },
  b: {
    version: "kw-unterbieten-2026-09-30",
    notice: `Nach einem kurzen Anruf zur Prüfung sehen Studios aus Ihrer Region Ihre Planung ohne Namen und können Ihren Preis 72 Stunden lang unterbieten. ${CONTACT_SHARING}`,
  },
  c: {
    version: "kw-projekt-2026-09-30c",
    notice: `Kostenlos & unverbindlich. Studios aus Ihrer Region sehen Ihre Planung ohne Namen und können Ihnen Angebote machen. ${CONTACT_SHARING}`,
  },
} as const;

/**
 * Funnel C ohne Ausschreibung (bis 30.09.2026 „nur Visualisierung“): Angebote
 * im Ergebnis oder auf der Projektseite nachfordern. Der Dialog hängt „Es gelten
 * unsere AGB und die Datenschutzerklärung.“ mit Links an.
 */
export const OFFERS_LATER_TERMS = {
  version: "kw-angebote-nachfordern-2026-09-30",
  notice: `Mit „Angebote anfordern“ sehen geprüfte Küchenstudios aus Ihrer Region Ihre Planung samt Bildern ohne Namen und können Ihnen Angebote machen. ${CONTACT_SHARING}`,
} as const;

/** Telefonnummer auf der Projektseite nachtragen. */
export const PHONE_LATER_TERMS = {
  version: "kw-telefon-2026-09-30",
  notice:
    "Ihre Nummer erhalten nur Studios, die Ihren Kontakt freischalten (höchstens drei), und das Studio, dessen Angebot Sie annehmen – für Rückfragen zu Ihrem Angebot.",
} as const;

/** Anrufe von Studios auf der Projektseite ein- oder ausschalten. */
export const CALLS_TERMS_VERSION = "kw-anrufe-2026-09-30";

export type TermsAnswer = "accepted" | "declined" | "legacy";

/** Ob der Browser die AGB-Bestätigung kennt und sie gegeben hat. */
export function termsAnswer(source: Record<string, unknown>, key = "accept_terms"): TermsAnswer {
  if (!(key in source)) return "legacy";
  return source[key] === true ? "accepted" : "declined";
}
