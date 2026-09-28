/**
 * Signierte Abmeldelinks für Rundmails (ohne Login, RFC 8058 One-Click).
 *
 * Token = base64url("<userId>.<scope>") + "." + base64url(HMAC-SHA256).
 * Der Signaturschlüssel wird per HMAC aus SUPABASE_SERVICE_ROLE_KEY abgeleitet;
 * nach einer Schlüsselrotation sind alte Links ungültig, die Abmeldung bleibt
 * dann über /dashboard/settings möglich.
 */
import { BRAND } from "./brand-config.ts";

export type UnsubscribeScope = "werbung" | "hinweise";

const encoder = new TextEncoder();

// Über globalThis statt Deno.env, damit der Vitest-Test das Modul unter Node laden kann.
function readEnv(name: string): string {
  const deno = (globalThis as { Deno?: { env: { get(key: string): string | undefined } } }).Deno;
  return deno?.env.get(name) ?? "";
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let keyPromise: Promise<CryptoKey> | null = null;

function signingKey(): Promise<CryptoKey> {
  keyPromise ??= (async () => {
    const root = readEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!root) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt");
    const rootKey = await crypto.subtle.importKey("raw", encoder.encode(root), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const derived = new Uint8Array(await crypto.subtle.sign("HMAC", rootKey, encoder.encode("kw-unsubscribe-v1")));
    return crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  })();
  return keyPromise;
}

export async function createUnsubscribeToken(userId: string, scope: UnsubscribeScope): Promise<string> {
  const payload = toBase64Url(encoder.encode(`${userId}.${scope}`));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(payload)));
  return `${payload}.${toBase64Url(signature)}`;
}

export async function verifyUnsubscribeToken(token: string): Promise<{ userId: string; scope: UnsubscribeScope } | null> {
  if (typeof token !== "string" || token.length > 300) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await signingKey(), fromBase64Url(signature), encoder.encode(payload));
    if (!valid) return null;
    const [userId, scope] = new TextDecoder().decode(fromBase64Url(payload)).split(".");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId ?? "")) return null;
    if (scope !== "werbung" && scope !== "hinweise") return null;
    return { userId, scope };
  } catch {
    return null;
  }
}

/** page: Link im Mail-Text (Bestätigungsseite), oneClick: Ziel des List-Unsubscribe-Headers (POST). */
export function unsubscribeUrls(token: string): { page: string; oneClick: string } {
  const t = encodeURIComponent(token);
  return {
    page: `${BRAND.baseUrl}/abmelden?t=${t}`,
    oneClick: `${readEnv("SUPABASE_URL")}/functions/v1/kw-unsubscribe?t=${t}`,
  };
}
