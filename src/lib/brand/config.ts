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
  name: "KüchenWert",

  // Rechtlicher Firmenname (fuer Impressum / AGB-Verweise).
  // KüchenWert ist eine Marke der WohnWert GmbH (dieselbe Firma betreibt auch
  // CaravanWert). Adresse: Hannoversche Str. 106, 30627 Hannover,
  // HRB 230114 Amtsgericht Hannover, Geschäftsführerin Mona Kareem-Ameen.
  legalName: "WohnWert GmbH",

  // Produkt-Claim / Subline.
  tagline: "Küchen einfach verkaufen & kaufen",

  // Primaere Landing-Domain (ohne Protokoll).
  // ASCII-safe (ohne Umlaut) weil Email / externe APIs Probleme mit Punycode
  // machen. kuechenwert.de leitet per 301-Redirect hierher um.
  domain: "kuechenwert24.de",

  // URL-Base fuer absolute Links in E-Mails, Sitemap, OG-Tags.
  baseUrl: "https://kuechenwert24.de",

  // Support-Email (fuer sichtbare Kontaktmails, Footer, Impressum).
  supportEmail: "info@kuechenwert.de",

  // Admin-/No-Reply-Absender fuer Transaktionsmails.
  noReplyEmail: "noreply@kuechenwert.de",

  // Social-Media-Handles. Platzhalter — Accounts ggf. noch anlegen.
  social: {
    instagram: "https://instagram.com/kuechenwert",
    facebook: "https://facebook.com/kuechenwert",
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
