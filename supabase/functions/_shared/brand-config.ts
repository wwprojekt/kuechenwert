/**
 * Brand-Konfiguration (Edge Functions)
 *
 * SPIEGEL von src/lib/brand/config.ts
 *
 * WICHTIG: Beide Dateien MUESSEN identische Werte haben. Bei Aenderung
 * IMMER beide Dateien anpassen.
 *
 * Zentrale Quelle fuer Brand-Metadaten, die in E-Mails, Log-Ausgaben und
 * generierten PDFs (Rechnungen) verwendet werden.
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

import { BRAND_ASSET_PATHS } from "./brand-assets.ts";

export const BRAND = {
  name: "KüchenWert",
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

/**
 * Pflichtangaben der Betreiberin für Geschäftsbriefe (§ 35a GmbHG, also auch
 * E-Mails), Rechnungen (§ 14 UStG) und Impressum. Müssen mit dem
 * veröffentlichten Impressum (legal_pages, slug impressum) übereinstimmen.
 * Ausgefüllte Felder in site_settings haben Vorrang (siehe issuer-profile.ts).
 */
export const BRAND_LEGAL = {
  company: "WohnWert GmbH",
  street: "Hannoversche Str. 106",
  postalCode: "30627",
  city: "Hannover",
  country: "Deutschland",
  registerCourt: "Amtsgericht Hannover",
  registerNumber: "HRB 230114",
  managingDirector: "Mona Kareem-Ameen",
  vatId: "DE462042479",
  phone: "+49 511 51532476",
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
 * Pfade mit Inhalts-Hash aus brand-assets.ts (scripts/fingerprint-brand-assets.mjs).
 */
export const BRAND_LOGO_URLS = {
  /** Wortmarke dunkel auf hell, 964×260. */
  primary: `${BRAND.baseUrl}${BRAND_ASSET_PATHS.wordmark}`,
  /** Wortmarke hell fuer den dunkelgruenen E-Mail-Header, 964×260. */
  email: `${BRAND.baseUrl}${BRAND_ASSET_PATHS.email}`,
  /** Wortmarke hell auf dunkel, 482×130. */
  white: `${BRAND.baseUrl}${BRAND_ASSET_PATHS.wordmarkWhite}`,
  ogImage: `${BRAND.baseUrl}${BRAND_ASSET_PATHS.ogImage}`,
} as const;
