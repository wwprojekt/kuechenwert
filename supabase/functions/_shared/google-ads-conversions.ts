/**
 * Offline-Conversions für Google Ads: Aufbereitung und Fehlerklassen für
 * kw-google-ads (action "upload-conversions"). Reines Modul ohne Deno-APIs,
 * getestet in src/lib/__tests__/google-ads-conversions.test.ts.
 *
 * Docs: https://developers.google.com/google-ads/api/docs/conversions/upload-clicks
 */

export type UploadKind = "contact" | "order";
export type UploadOutcome = "done" | "retry" | "final";

/** Gilt als erledigt: Google kennt die Conversion bzw. den Rückzug schon. */
const DONE_CODES = new Set([
  "CLICK_CONVERSION_ALREADY_EXISTS",
  "ORDER_ID_ALREADY_IN_USE",
  "DUPLICATE_ORDER_ID",
  "CONVERSION_ALREADY_RETRACTED",
]);

/** Endgültig: lässt sich nie mehr melden (abgelaufener Klick, fremdes Konto, ungültige ID). */
const FINAL_CODES = new Set([
  "EXPIRED_EVENT",
  "CONVERSION_PRECEDES_EVENT",
  "UNPARSEABLE_GCLID",
  "UNPARSEABLE_GBRAID",
  "UNPARSEABLE_WBRAID",
  "INVALID_CUSTOMER_FOR_CLICK",
  "CONVERSION_TRACKING_NOT_ENABLED_AT_IMPRESSION_TIME",
  "CONVERSION_NOT_COMPLIANT_WITH_ATT_POLICY",
  "CONVERSION_EXPIRED",
]);

export const MAX_UPLOAD_ATTEMPTS = 6;

export function classifyUploadError(code: string): UploadOutcome {
  if (DONE_CODES.has(code)) return "done";
  if (FINAL_CODES.has(code)) return "final";
  return "retry";
}

/** 2, 4, 8, 16, 24, 24 … Stunden bis zum nächsten Versuch. */
export function retryDelayHours(attempts: number): number {
  return Math.min(24, 2 ** Math.max(1, attempts));
}

/** Google-Format „yyyy-mm-dd hh:mm:ss+00:00“. */
export function googleAdsDateTime(value: string | Date): string {
  return new Date(value).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "+00:00");
}

/** Normalisierung vor dem Hashen laut Google: klein, ohne Leerzeichen, Gmail ohne Punkte. */
export function normalizeEmail(email: string | null | undefined): string | null {
  const value = (email ?? "").trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1 || at === value.length - 1) return null;
  const [local, domain] = [value.slice(0, at), value.slice(at + 1)];
  if (domain === "gmail.com" || domain === "googlemail.com") return `${local.replace(/\./g, "")}@${domain}`;
  return value;
}

/** E.164; nationale Nummern (0…) gelten als deutsch. */
export function normalizePhoneE164(phone: string | null | undefined): string | null {
  const cleaned = (phone ?? "").replace(/[^\d+]/g, "");
  let candidate: string;
  if (cleaned.startsWith("+")) candidate = cleaned;
  else if (cleaned.startsWith("00")) candidate = `+${cleaned.slice(2)}`;
  else if (cleaned.startsWith("0")) candidate = `+49${cleaned.slice(1)}`;
  else return null;
  return /^\+[1-9]\d{7,14}$/.test(candidate) ? candidate : null;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface UploadCandidate {
  orderId: string;
  valueEur: number;
  conversionAt: string;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * Eine ClickConversion (REST) oder null ohne Klick-ID. Google erlaubt genau
 * eine der IDs; gclid hat Vorrang. Klick-IDs liegen nur mit
 * Marketing-Einwilligung am Lead, daher consent GRANTED.
 */
export async function clickConversion(
  c: UploadCandidate,
  conversionAction: string,
  withUserIdentifiers: boolean,
): Promise<Record<string, unknown> | null> {
  const clickId = c.gclid ? { gclid: c.gclid } : c.gbraid ? { gbraid: c.gbraid } : c.wbraid ? { wbraid: c.wbraid } : null;
  if (!clickId) return null;
  const identifiers: Array<Record<string, string>> = [];
  if (withUserIdentifiers) {
    const email = normalizeEmail(c.email);
    const phone = normalizePhoneE164(c.phone);
    if (email) identifiers.push({ hashedEmail: await sha256Hex(email) });
    if (phone) identifiers.push({ hashedPhoneNumber: await sha256Hex(phone) });
  }
  return {
    conversionAction,
    conversionDateTime: googleAdsDateTime(c.conversionAt),
    conversionValue: Math.round(c.valueEur * 100) / 100,
    currencyCode: "EUR",
    orderId: c.orderId,
    ...clickId,
    ...(identifiers.length ? { userIdentifiers: identifiers } : {}),
    consent: { adUserData: "GRANTED", adPersonalization: "GRANTED" },
  };
}
