/**
 * Gemeinsame HTTP-Helfer für die KüchenWert-Marktplatz-Functions
 * (kw-planner, kw-project, kw-market-worker).
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "./cors.ts";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") throw new Error("not an object");
    return body as T;
  } catch {
    throw new HttpError(400, "Ungültige Anfrage.", "invalid_json");
  }
}

/** Wrappt einen Handler mit CORS-Preflight, POST-Pflicht und Fehler-Mapping. */
export function serve(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);
    if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof HttpError) {
        return jsonResponse(req, { error: err.message, code: err.code }, err.status);
      }
      const pg = err as { code?: string; message?: string };
      if (pg?.code === "42501") return jsonResponse(req, { error: pg.message ?? "Nicht erlaubt." }, 403);
      if (pg?.code === "P0001" || pg?.code === "22023") return jsonResponse(req, { error: pg.message }, 409);
      if (pg?.code === "P0002") return jsonResponse(req, { error: pg.message ?? "Nicht gefunden." }, 404);
      console.error("[kw] unhandled", err);
      return jsonResponse(req, { error: "Interner Fehler. Bitte später erneut versuchen." }, 500);
    }
  });
}

export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return (req.headers.get("x-real-ip") ?? "unknown").trim();
}

/**
 * Schlüssel für Rate-Limits: IPv4 je Adresse, IPv6 je /64-Netz. Ein Anschluss
 * erhält mindestens ein /64 und kann darin beliebig viele Adressen nutzen.
 */
export function rateLimitIp(req: Request): string {
  const ip = clientIp(req).split("%")[0]!.toLowerCase();
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1]!;
  if (!ip.includes(":") || !/^[0-9a-f:]+$/.test(ip)) return ip;
  const halves = ip.split("::");
  if (halves.length > 2) return ip;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  const groups = [...head, ...Array<string>(Math.max(0, fill)).fill("0"), ...tail];
  if (groups.length !== 8 || groups.some((g) => g.length === 0 || g.length > 4)) return ip;
  return `${groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(":")}::/64`;
}

/** Nur plausible IPv4/IPv6-Adressen, damit Inserts in inet-Spalten nicht scheitern. */
export function validIp(ip: string): string | null {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
  if (/^[0-9a-f:]+$/i.test(ip) && ip.includes(":")) return ip;
  return null;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Rate-Limit über planner_rate_limit_increment. Fällt der Zähler aus, lässt
 * die Standardeinstellung die Anfrage durch (keine verlorenen Leads);
 * failClosed lehnt stattdessen ab – für Aktionen, die Geld kosten (KI-Bilder).
 */
export async function enforceRateLimit(
  sb: SupabaseClient,
  key: string,
  windowSeconds: number,
  limit: number,
  opts: { failClosed?: boolean } = {},
): Promise<void> {
  const { data, error } = await sb.rpc("planner_rate_limit_increment", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });
  if (error) {
    console.warn("[kw] rate-limit rpc failed", error.message);
    if (opts.failClosed) {
      throw new HttpError(503, "Der Dienst ist gerade ausgelastet. Bitte versuchen Sie es in ein paar Minuten erneut.", "rate_limit_unavailable");
    }
    return;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) {
    throw new HttpError(429, "Zu viele Anfragen. Bitte versuchen Sie es in einer Weile erneut.", "rate_limited");
  }
}

export const isEmail = (s: unknown): s is string =>
  typeof s === "string" && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

export const isPostalCode = (s: unknown): s is string => typeof s === "string" && /^\d{5}$/.test(s);

export function normalizePhone(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const cleaned = s.replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 16) return null;
  return cleaned.startsWith("+") ? cleaned : cleaned.replace(/^00/, "+");
}

export function cleanText(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  // eslint-disable-next-line no-control-regex -- Steuerzeichen aus Freitext entfernen
  const t = s.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return t.length ? t : null;
}

export function escapeHtml(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatEuro(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "–";
  return `${Math.round(value).toLocaleString("de-DE")} €`;
}
