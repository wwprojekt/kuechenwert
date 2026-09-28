/**
 * Rechnungsaussteller (§ 14 Abs. 4 UStG): Werte aus site_settings, sonst die
 * Pflichtangaben aus brand-config.ts. Genutzt von generate-invoice-pdf,
 * send-invoice-email und kw-market-worker, damit PDF, Mail und automatische
 * Ausstellung dieselben Daten und dieselbe Vollständigkeitsprüfung verwenden.
 */
import { BRAND, BRAND_LEGAL } from "./brand-config.ts";

export interface IssuerProfile {
  company: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  managingDirector: string;
  registerEntry: string;
  vatId: string;
  taxNumber: string;
  iban: string;
  bic: string;
  bankName: string;
  accountHolder: string;
  email: string;
  phone: string;
}

export type IssuerSettings = Record<string, unknown> | null | undefined;

/** Spalten, die issuerProfile aus site_settings liest. */
export const ISSUER_SETTINGS_COLUMNS =
  "company_address, company_postal_code, company_city, company_country, managing_director, hrb_number, ust_id, tax_number, bank_iban, bank_bic, bank_name, contact_email, support_phone";

const text = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

/**
 * Freitext aus den Einstellungen ("HRB 230114", "230114",
 * "HRB 230114 Amtsgericht Hannover", "HRB 12345, Amtsgericht München")
 * → "Amtsgericht Hannover, HRB 230114".
 */
export function formatRegisterEntry(raw: string): string {
  const value = text(raw);
  if (!value) return `${BRAND_LEGAL.registerCourt}, ${BRAND_LEGAL.registerNumber}`;
  const court = value.match(/Amtsgericht\s+[\p{L}.\- ]+?(?=\s*,|\s+HR|$)/iu)?.[0].trim() ?? BRAND_LEGAL.registerCourt;
  const number = value.match(/HR\s?([AB])\s*(\d+)/i);
  if (number) return `${court}, HR${number[1].toUpperCase()} ${number[2]}`;
  if (/^\d+$/.test(value)) return `${court}, HRB ${value}`;
  return value;
}

export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Prüfsumme nach ISO 13616 (mod 97). */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  let remainder = 0;
  for (const char of iban.slice(4) + iban.slice(0, 4)) {
    const code = char.charCodeAt(0);
    const digits = code >= 65 ? String(code - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function formatIban(raw: string): string {
  return normalizeIban(raw).replace(/(.{4})(?=.)/g, "$1 ");
}

export function issuerProfile(settings: IssuerSettings): IssuerProfile {
  const s = settings ?? {};
  return {
    company: BRAND_LEGAL.company,
    street: text(s.company_address) || BRAND_LEGAL.street,
    postalCode: text(s.company_postal_code) || BRAND_LEGAL.postalCode,
    city: text(s.company_city) || BRAND_LEGAL.city,
    country: text(s.company_country) || BRAND_LEGAL.country,
    managingDirector: text(s.managing_director) || BRAND_LEGAL.managingDirector,
    registerEntry: formatRegisterEntry(text(s.hrb_number)),
    vatId: text(s.ust_id).replace(/\s+/g, "").toUpperCase() || BRAND_LEGAL.vatId,
    taxNumber: text(s.tax_number),
    iban: normalizeIban(text(s.bank_iban)),
    bic: text(s.bank_bic).replace(/\s+/g, "").toUpperCase(),
    bankName: text(s.bank_name),
    accountHolder: BRAND_LEGAL.company,
    email: text(s.contact_email) || BRAND.supportEmail,
    phone: text(s.support_phone) || BRAND_LEGAL.phone,
  };
}

/** Pflichtangaben, ohne die keine Rechnung ausgestellt werden darf. */
export function missingIssuerFields(profile: IssuerProfile): string[] {
  const missing: string[] = [];
  if (!profile.iban) missing.push("Bankverbindung (IBAN)");
  else if (!isValidIban(profile.iban)) missing.push("gültige IBAN (Prüfziffer stimmt nicht)");
  if (!profile.vatId && !profile.taxNumber) missing.push("USt-IdNr. oder Steuernummer");
  return missing;
}
