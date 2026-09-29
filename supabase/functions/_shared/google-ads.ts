/**
 * Google Ads API (REST) für das KüchenWert-Konto „Küchenwert24.de“.
 *
 * Zugangsdaten: Edge-Secrets GADS_DEVELOPER_TOKEN, GADS_OAUTH_CLIENT_ID,
 * GADS_OAUTH_CLIENT_SECRET, GADS_OAUTH_REFRESH_TOKEN, sonst Supabase Vault
 * (gads_* über RPC kw_gads_credentials). Die Konto-IDs sind nicht geheim;
 * GADS_CUSTOMER_ID und GADS_LOGIN_CUSTOMER_ID überschreiben sie.
 *
 * Aufrufe laufen über das Verwaltungskonto (login-customer-id). Lehnt Google
 * das mit USER_PERMISSION_DENIED ab (Konto nicht im MCC), wiederholt der
 * Client einmal mit dem Konto selbst als login-customer-id.
 *
 * Docs: https://developers.google.com/google-ads/api/rest/overview
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

/** Sunset laut Google August 2027: https://developers.google.com/google-ads/api/docs/sunset-dates */
export const GADS_API_VERSION = "v25";
/** Werbekonto „Küchenwert24.de“ (760-376-7237). */
export const KW_GADS_CUSTOMER_ID = "7603767237";
/** „WohnWert Verwaltungskonto“ (974-650-8145), Inhaber des Developer-Tokens. */
export const KW_GADS_MANAGER_ID = "9746508145";

const API_BASE = `https://googleads.googleapis.com/${GADS_API_VERSION}`;
const VAULT_CACHE_MS = 5 * 60 * 1000;
const TOKEN_TIMEOUT_MS = 15_000;
const API_TIMEOUT_MS = 60_000;

const SECRET_KEYS = ["developer_token", "oauth_client_id", "oauth_client_secret", "oauth_refresh_token"] as const;
export type GadsSecretKey = (typeof SECRET_KEYS)[number];
export type GadsSecretSource = "env" | "vault" | "missing";

const ENV_NAMES: Record<GadsSecretKey, string> = {
  developer_token: "GADS_DEVELOPER_TOKEN",
  oauth_client_id: "GADS_OAUTH_CLIENT_ID",
  oauth_client_secret: "GADS_OAUTH_CLIENT_SECRET",
  oauth_refresh_token: "GADS_OAUTH_REFRESH_TOKEN",
};

export interface GoogleAdsCredentials {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface GoogleAdsCredentialStatus {
  /** Herkunft je Wert; die Werte selbst verlassen dieses Modul nie. */
  sources: Record<GadsSecretKey, GadsSecretSource>;
  credentials: GoogleAdsCredentials | null;
}

let vaultCache: { values: Partial<Record<GadsSecretKey, string>>; at: number } | null = null;

async function vaultSecrets(): Promise<Partial<Record<GadsSecretKey, string>>> {
  if (vaultCache && Date.now() - vaultCache.at < VAULT_CACHE_MS) return vaultCache.values;
  let values: Partial<Record<GadsSecretKey, string>> = {};
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && key) {
      const sb = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await sb.rpc("kw_gads_credentials");
      if (error) console.error("[google-ads] Vault nicht lesbar", error.message);
      else if (data && typeof data === "object") values = data as Partial<Record<GadsSecretKey, string>>;
    }
  } catch (err) {
    console.error("[google-ads] Vault nicht lesbar", err instanceof Error ? err.message : err);
  }
  vaultCache = { values, at: Date.now() };
  return values;
}

export async function loadGoogleAdsCredentials(): Promise<GoogleAdsCredentialStatus> {
  const env = {} as Record<GadsSecretKey, string>;
  for (const k of SECRET_KEYS) env[k] = Deno.env.get(ENV_NAMES[k])?.trim() ?? "";
  const vault = SECRET_KEYS.every((k) => env[k]) ? {} : await vaultSecrets();

  const values = {} as Record<GadsSecretKey, string>;
  const sources = {} as Record<GadsSecretKey, GadsSecretSource>;
  for (const k of SECRET_KEYS) {
    const fromVault = typeof vault[k] === "string" ? vault[k]!.trim() : "";
    values[k] = env[k] || fromVault;
    sources[k] = env[k] ? "env" : fromVault ? "vault" : "missing";
  }
  const complete = SECRET_KEYS.every((k) => values[k]);
  return {
    sources,
    credentials: complete
      ? {
          developerToken: values.developer_token,
          clientId: values.oauth_client_id,
          clientSecret: values.oauth_client_secret,
          refreshToken: values.oauth_refresh_token,
        }
      : null,
  };
}

export interface GoogleAdsErrorDetail {
  /** Fehlergruppe, z. B. authorizationError */
  kind: string;
  /** Fehlercode, z. B. USER_PERMISSION_DENIED */
  code: string;
  message: string;
  /** Feldpfad mit Indizes, z. B. mutate_operations[12].ad_group_ad_operation… */
  field?: string;
  /** Index der betroffenen Operation eines Batch-Mutates. */
  operationIndex?: number;
  /** Auslösender Wert, z. B. der beanstandete Anzeigentext. */
  trigger?: string;
  /** Richtlinien-Themen bei Policy-Befunden. */
  policyTopics?: string[];
}

export class GoogleAdsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: GoogleAdsErrorDetail[] = [],
    public readonly requestId?: string,
  ) {
    super(message);
  }

  hasCode(code: string): boolean {
    return this.details.some((d) => d.code === code);
  }

  describe(): string {
    const parts = this.details.map((d) => `${d.code}${d.field ? ` (${d.field})` : ""}: ${d.message}`);
    return parts.length ? `${this.message} – ${parts.join("; ")}` : this.message;
  }
}

export function describeGoogleAdsError(err: unknown): string {
  if (err instanceof GoogleAdsApiError) return err.describe();
  return err instanceof Error ? err.message : String(err);
}

function parseApiError(status: number, text: string): GoogleAdsApiError {
  try {
    const parsed = JSON.parse(text);
    const error = (Array.isArray(parsed) ? parsed[0]?.error : parsed?.error) ?? {};
    const failure = (error.details ?? []).find(
      (d: { "@type"?: string }) => typeof d?.["@type"] === "string" && d["@type"].endsWith("GoogleAdsFailure"),
    );
    const details: GoogleAdsErrorDetail[] = (failure?.errors ?? []).map((e: Record<string, unknown>) => {
      const [kind, code] = Object.entries((e.errorCode ?? {}) as Record<string, unknown>)[0] ?? ["unknown", "UNKNOWN"];
      const path = (e.location as { fieldPathElements?: Array<{ fieldName?: string; index?: number }> } | undefined)
        ?.fieldPathElements ?? [];
      const field = path
        .filter((p) => p.fieldName)
        .map((p) => (p.index === undefined ? p.fieldName : `${p.fieldName}[${p.index}]`))
        .join(".");
      const operationIndex = path.find((p) => p.fieldName === "mutate_operations" || p.fieldName === "operations")?.index;
      const trigger = (e.trigger as { stringValue?: string } | undefined)?.stringValue;
      const topics = ((e.details as { policyFindingDetails?: { policyTopicEntries?: Array<{ topic?: string }> } } | undefined)
        ?.policyFindingDetails?.policyTopicEntries ?? [])
        .map((t) => t.topic)
        .filter((t): t is string => Boolean(t));
      return {
        kind,
        code: String(code),
        message: String(e.message ?? ""),
        field: field || undefined,
        operationIndex,
        trigger,
        policyTopics: topics.length ? topics : undefined,
      };
    });
    return new GoogleAdsApiError(String(error.message ?? `HTTP ${status}`), status, details, failure?.requestId);
  } catch {
    return new GoogleAdsApiError(`HTTP ${status}: ${text.slice(0, 300)}`, status);
  }
}

let tokenCache: { refreshToken: string; token: string; expiresAt: number } | null = null;

async function accessToken(creds: GoogleAdsCredentials): Promise<string> {
  if (tokenCache && tokenCache.refreshToken === creds.refreshToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
    }),
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });
  const text = await resp.text();
  let body: { access_token?: string; expires_in?: number; error?: string; error_description?: string } = {};
  try {
    body = JSON.parse(text);
  } catch {
    /* kein JSON: Status allein entscheidet */
  }
  if (!resp.ok || !body.access_token) {
    const reason = [body.error, body.error_description].filter(Boolean).join(": ") || `HTTP ${resp.status}`;
    throw new GoogleAdsApiError(`OAuth-Anmeldung bei Google abgelehnt (${reason})`, resp.status, [
      { kind: "oauth", code: (body.error ?? "token_refresh_failed").toUpperCase(), message: reason },
    ]);
  }
  tokenCache = {
    refreshToken: creds.refreshToken,
    token: body.access_token,
    expiresAt: Date.now() + Math.max(60, Number(body.expires_in ?? 3600) - 120) * 1000,
  };
  return body.access_token;
}

export type GadsRow = Record<string, unknown>;

export interface GadsCallOptions {
  /** Zielkonto, Standard: KüchenWert-Konto. */
  customerId?: string;
  /** Fester login-customer-id-Header, dann ohne Wiederholung. */
  loginCustomerId?: string;
}

export interface GoogleAdsClient {
  readonly customerId: string;
  readonly loginCustomerId: string;
  search(query: string, opts?: GadsCallOptions): Promise<GadsRow[]>;
  /** POST customers/{id}/{resource}:mutate, z. B. resource = "conversionActions" oder "googleAds". */
  mutate(resource: string, body: Record<string, unknown>, opts?: GadsCallOptions): Promise<GadsRow>;
  /** POST customers/{id}:mutate (CustomerService, eine Operation). */
  mutateCustomer(body: Record<string, unknown>, opts?: GadsCallOptions): Promise<GadsRow>;
  /** POST customers/{id}:{method}, z. B. generateKeywordIdeas. */
  callCustomer(method: string, body: Record<string, unknown>, opts?: GadsCallOptions): Promise<GadsRow>;
}

const digits = (s: string | undefined) => (s ?? "").replace(/\D/g, "");

export function createGoogleAdsClient(creds: GoogleAdsCredentials): GoogleAdsClient {
  const customerId = digits(Deno.env.get("GADS_CUSTOMER_ID")) || KW_GADS_CUSTOMER_ID;
  const loginCustomerId = digits(Deno.env.get("GADS_LOGIN_CUSTOMER_ID")) || KW_GADS_MANAGER_ID;

  async function send(path: string, body: unknown, login: string): Promise<unknown> {
    const resp = await fetch(`${API_BASE}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await accessToken(creds)}`,
        "developer-token": creds.developerToken,
        "login-customer-id": login,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    const text = await resp.text();
    if (!resp.ok) throw parseApiError(resp.status, text);
    return text ? JSON.parse(text) : {};
  }

  async function call(path: string, body: unknown, target: string, opts: GadsCallOptions): Promise<unknown> {
    if (opts.loginCustomerId) return send(path, body, digits(opts.loginCustomerId));
    try {
      return await send(path, body, loginCustomerId);
    } catch (err) {
      if (err instanceof GoogleAdsApiError && err.hasCode("USER_PERMISSION_DENIED") && loginCustomerId !== target) {
        return send(path, body, target);
      }
      throw err;
    }
  }

  const targetOf = (opts: GadsCallOptions) => digits(opts.customerId) || customerId;

  return {
    customerId,
    loginCustomerId,
    async search(query, opts = {}) {
      const target = targetOf(opts);
      const data = await call(
        `customers/${target}/googleAds:searchStream`,
        { query: query.replace(/\s+/g, " ").trim() },
        target,
        opts,
      );
      const batches = (Array.isArray(data) ? data : [data]) as Array<{ results?: GadsRow[] } | null>;
      return batches.flatMap((b) => (Array.isArray(b?.results) ? b.results : []));
    },
    async mutate(resource, body, opts = {}) {
      const target = targetOf(opts);
      return (await call(`customers/${target}/${resource}:mutate`, body, target, opts)) as GadsRow;
    },
    async mutateCustomer(body, opts = {}) {
      const target = targetOf(opts);
      return (await call(`customers/${target}:mutate`, body, target, opts)) as GadsRow;
    },
    async callCustomer(method, body, opts = {}) {
      const target = targetOf(opts);
      return (await call(`customers/${target}:${method}`, body, target, opts)) as GadsRow;
    },
  };
}

/** send_to „AW-…/Label“ aus den Tag-Snippets einer Webseiten-Conversion. */
export function sendToFromTagSnippets(snippets: unknown): { conversionId: string; label: string } | null {
  if (!Array.isArray(snippets)) return null;
  for (const s of snippets) {
    const snippet = String((s as { eventSnippet?: unknown } | null)?.eventSnippet ?? "");
    const m = snippet.match(/send_to['"]?\s*:\s*['"](AW-\d+)\/([\w-]+)['"]/);
    if (m) return { conversionId: m[1]!, label: m[2]! };
  }
  return null;
}

/**
 * Ab diesen Kosten in 7 Tagen ohne Conversion ist ein Zufall praktisch
 * ausgeschlossen (bei ~2 € CPC und ~3 % Conversion-Rate wären ~4 zu erwarten).
 */
const NO_CONVERSION_SPEND_ALERT_EUR = 250;

export interface GoogleAdsHealth {
  /**
   * true = erreichbar, false = Zugriff abgelehnt oder Zugangsdaten
   * unvollständig, null = nicht eingerichtet oder vorübergehender Fehler
   * (5xx, Quota, Netz), der keinen Alarm auslösen soll.
   */
  reachable: boolean | null;
  /** Abgelehnte Anzeigen in aktiven Kampagnen und Anzeigengruppen. */
  disapprovedAds: number;
  /** Kosten der letzten 7 Tage in €, falls es darin keine Conversion gab und die Schwelle erreicht ist, sonst 0. */
  spendWithoutConversionsEur: number;
}

export async function googleAdsHealth(): Promise<GoogleAdsHealth> {
  const quiet = { disapprovedAds: 0, spendWithoutConversionsEur: 0 };
  const { sources, credentials } = await loadGoogleAdsCredentials();
  if (!credentials) {
    return { reachable: Object.values(sources).every((s) => s === "missing") ? null : false, ...quiet };
  }
  const client = createGoogleAdsClient(credentials);
  try {
    const [totals] = await client.search(
      "SELECT metrics.cost_micros, metrics.conversions FROM customer WHERE segments.date DURING LAST_7_DAYS",
    );
    const disapproved = await client.search(
      `SELECT ad_group_ad.resource_name FROM ad_group_ad
       WHERE ad_group_ad.policy_summary.approval_status = 'DISAPPROVED' AND ad_group_ad.status = 'ENABLED'
       AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'`,
    );
    const metrics = (totals?.metrics ?? {}) as { costMicros?: string; conversions?: number };
    const cost = Number(metrics.costMicros ?? 0) / 1e6;
    const noConversions = Number(metrics.conversions ?? 0) === 0;
    return {
      reachable: true,
      disapprovedAds: disapproved.length,
      spendWithoutConversionsEur: noConversions && cost >= NO_CONVERSION_SPEND_ALERT_EUR ? Math.round(cost) : 0,
    };
  } catch (err) {
    console.error("[google-ads] Health-Check fehlgeschlagen:", describeGoogleAdsError(err));
    const denied = err instanceof GoogleAdsApiError && err.status >= 400 && err.status < 500 && err.status !== 429;
    return { reachable: denied ? false : null, ...quiet };
  }
}
