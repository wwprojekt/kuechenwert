/**
 * Brand-Konfiguration (Edge Functions)
 *
 * SPIEGEL von src/lib/brand/config.ts
 *
 * WICHTIG: Beide Dateien MUESSEN identische Werte haben. Bei Aenderung
 * IMMER beide Dateien anpassen.
 *
 * Zentrale Quelle fuer Brand-Metadaten, die in E-Mails, Log-Ausgaben,
 * Webhook-Signaturen und generierten PDFs (Rechnungen, Kaufvertraege,
 * Uebergabeprotokolle) verwendet werden.
 *
 * Domain-Strategie (Stand 2026-04-30):
 *   Primary:  kuechenwert24.de (ASCII, Umlaut-frei)
 *   Aliases:  kuechenwert24.de / küchenwert.de → 301 auf kuechenwert24.de
 *
 * Alle Email-Adressen, URLs und Links nutzen kuechenwert24.de, weil
 * Punycode-Umlaut-Domains mit Mail-Relays, SSL und Cookie-Scopes
 * inkompatibel sind.
 */

export const BRAND = {
  name: "KüchenWert",
  // Marke der WohnWert GmbH (dieselbe Firma betreibt auch CaravanWert).
  legalName: "WohnWert GmbH",
  tagline: "Küchen einfach verkaufen & kaufen",
  domain: "kuechenwert24.de",
  baseUrl: "https://kuechenwert24.de",
  supportEmail: "info@kuechenwert24.de",
  noReplyEmail: "noreply@kuechenwert24.de",
  social: {
    instagram: "https://instagram.com/kuechenwert",
    facebook: "https://facebook.com/kuechenwert",
  },
} as const;

export const BRAND_URLS = {
  home: BRAND.baseUrl,
  contact: `${BRAND.baseUrl}/kontakt`,
  imprint: `${BRAND.baseUrl}/impressum`,
  privacy: `${BRAND.baseUrl}/datenschutz`,
  terms: `${BRAND.baseUrl}/agb`,
} as const;

/**
 * Absolute Logo-URLs (fuer E-Mail-Templates und PDF-Header).
 * Der Storage-/CDN-Host wird aus BRAND.baseUrl abgeleitet.
 */
export const BRAND_LOGO_URLS = {
  primary: `${BRAND.baseUrl}/logo.webp`,
  email: `${BRAND.baseUrl}/logo-email.png`,
  white: `${BRAND.baseUrl}/logo-white.webp`,
  ogImage: `${BRAND.baseUrl}/og-image.webp`,
} as const;
