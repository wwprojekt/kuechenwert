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
 * Domain-Strategie:
 *   Primary:  kuechenwert24.de (ASCII, Umlaut-frei)
 *   Alias:    küchenwert.de (xn--kchenwert-q9a.de) → 301 auf kuechenwert24.de
 *   ACHTUNG:  kuechenwert.de (ohne Umlaut) gehört NICHT uns – nie verwenden.
 *
 * Alle Email-Adressen, URLs und Links nutzen kuechenwert24.de, weil
 * Punycode-Umlaut-Domains mit Mail-Relays, SSL und Cookie-Scopes
 * inkompatibel sind.
 */

export const BRAND = {
  name: "KüchenWert",
  // Marke der WohnWert GmbH (dieselbe Firma betreibt auch CaravanWert).
  legalName: "WohnWert GmbH",
  tagline: "Traumküche planen & Angebote vergleichen",
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
 * Nur PNG/JPEG: Outlook und PDF-Bibliotheken koennen kein WebP.
 * Erzeugt von scripts/generate-logo-assets.mjs.
 *
 * Bei neuen Logo-Dateien ASSET_VERSION erhoehen: Cloudflare, Gmail-Proxy und
 * Mail-Clients cachen Bilder unter derselben URL sehr lange.
 */
const ASSET_VERSION = "2";

export const BRAND_LOGO_URLS = {
  /** Wortmarke dunkel auf hell, 964×260. */
  primary: `${BRAND.baseUrl}/logo-2x.png?v=${ASSET_VERSION}`,
  /** Wortmarke hell fuer den dunkelgruenen E-Mail-Header, 964×260. */
  email: `${BRAND.baseUrl}/logo-email.png?v=${ASSET_VERSION}`,
  /** Wortmarke hell auf dunkel, 482×130. */
  white: `${BRAND.baseUrl}/logo-white.png?v=${ASSET_VERSION}`,
  ogImage: `${BRAND.baseUrl}/og-image.jpg?v=${ASSET_VERSION}`,
} as const;
