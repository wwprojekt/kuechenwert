/**
 * Brand-Konfiguration (Edge Functions)
 *
 * SPIEGEL von src/lib/brand/config.ts
 *
 * WICHTIG: Beide Dateien MUESSEN identische Werte haben. Bei Aenderung
 * IMMER beide Dateien anpassen (Muster wie marketing-config.ts).
 *
 * Zentrale Quelle fuer Brand-Metadaten, die in E-Mails, Log-Ausgaben,
 * Webhook-Signaturen und generierten PDFs (Rechnungen, Kaufvertraege,
 * Uebergabeprotokolle) verwendet werden.
 *
 * Stand der Werte: aktuell noch "CaravanWert"-Branding aus dem
 * Caravanwert-Fork. Phase 3 ersetzt diese Werte durch echte
 * KuechenWert-Werte.
 */

export const BRAND = {
  name: "CaravanWert",
  legalName: "CaravanWert GmbH",
  tagline: "Wohnmobile professionell verkaufen",
  domain: "caravanwert.de",
  baseUrl: "https://caravanwert.de",
  supportEmail: "hallo@caravanwert.de",
  noReplyEmail: "noreply@caravanwert.de",
  social: {
    instagram: "https://instagram.com/caravanwert",
    facebook: "https://facebook.com/caravanwert",
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
