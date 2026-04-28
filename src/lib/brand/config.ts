/**
 * Brand-Konfiguration (Frontend)
 *
 * Zentrale Quelle fuer alle Brand-spezifischen Texte, Domains, E-Mail-Adressen.
 * Bei einem Rebrand (Phase 3) muessen NUR die Werte in dieser Datei + dem
 * Spiegel-File supabase/functions/_shared/brand-config.ts angepasst werden,
 * plus der CSS-Variablen-Block in src/index.css.
 *
 * SPIEGEL von supabase/functions/_shared/brand-config.ts.
 * WICHTIG: Bei Aenderung IMMER beide Dateien anpassen (Muster siehe marketing-config.ts).
 *
 * Stand der Werte: aktuell noch "CaravanWert"-Branding aus dem Caravanwert-Fork.
 * Phase 3 ersetzt diese Werte durch echte KuechenWert-Werte.
 */

export const BRAND = {
  // Anzeigename. Wird in <title>, Footer, Emails, Headern verwendet.
  name: "CaravanWert",

  // Rechtlicher Firmenname (fuer Impressum / AGB-Verweise).
  legalName: "CaravanWert GmbH",

  // Produkt-Claim / Subline.
  tagline: "Wohnmobile professionell verkaufen",

  // Primaere Landing-Domain (ohne Protokoll).
  domain: "caravanwert.de",

  // URL-Base fuer absolute Links in E-Mails, Sitemap, OG-Tags.
  baseUrl: "https://caravanwert.de",

  // Support-Email (fuer sichtbare Kontaktmails, Footer, Impressum).
  supportEmail: "hallo@caravanwert.de",

  // Admin-/No-Reply-Absender fuer Transaktionsmails.
  noReplyEmail: "noreply@caravanwert.de",

  // Social-Media-Handles.
  social: {
    instagram: "https://instagram.com/caravanwert",
    facebook: "https://facebook.com/caravanwert",
  },
} as const;

/**
 * Haeufig genutzte abgeleitete Werte.
 */
export const BRAND_URLS = {
  /** Absoluter Link zur Startseite. */
  home: BRAND.baseUrl,
  /** Absoluter Link zur Kontakt-Seite. */
  contact: `${BRAND.baseUrl}/kontakt`,
  /** Absoluter Link zum Impressum. */
  imprint: `${BRAND.baseUrl}/impressum`,
  /** Absoluter Link zur Datenschutzerklaerung. */
  privacy: `${BRAND.baseUrl}/datenschutz`,
  /** Absoluter Link zu den AGB. */
  terms: `${BRAND.baseUrl}/agb`,
} as const;
