/**
 * kw-google-ads — Google Ads API für das KüchenWert-Konto 760-376-7237
 *
 *   { "action": "status" }  Zugangsdaten (nur Herkunft), Konto, Verknüpfung mit
 *     dem Verwaltungskonto, Conversion-Aktionen, Abgleich mit Admin → Tracking.
 *   { "action": "gaql", "query": "SELECT …" }
 *   { "action": "gaql", "queries": { "<name>": "SELECT …" } }
 *     Nur lesend (searchStream, nur SELECT) und nur auf dem KüchenWert-Konto.
 *   { "action": "setup", "dryRun"?: true }  Sollzustand herstellen (setup.ts),
 *     wiederholbar; dryRun lässt Google die Änderungen nur prüfen.
 *   { "action": "keyword-ideas", "seeds": [...], "url"?, "limit"? }
 *   { "action": "keyword-metrics", "keywords": [...] }
 *     Keyword-Planer, nur lesend (research.ts).
 *
 * Aufruf: Admin im Browser, service_role oder pg_net mit x-kw-cron-secret
 * (Agenten, siehe AGENTS.md → Google Tracking).
 */

import { checkCronOrServiceRoleOrAdmin } from "../_shared/auth.ts";
import {
  createGoogleAdsClient,
  describeGoogleAdsError,
  loadGoogleAdsCredentials,
  type GoogleAdsClient,
} from "../_shared/google-ads.ts";
import { HttpError, jsonResponse, readJson, serve, serviceClient } from "../_shared/kw-http.ts";
import { keywordIdeas, keywordMetrics } from "./research.ts";
import { runSetup } from "./setup.ts";
import { runStatus } from "./status.ts";

const MAX_QUERIES = 20;
const MAX_QUERY_LENGTH = 10_000;

type Body = Record<string, unknown> & { action?: string };

function selectOnly(query: unknown): string {
  if (typeof query !== "string" || !/^\s*SELECT\s/i.test(query) || query.length > MAX_QUERY_LENGTH) {
    throw new HttpError(400, "Nur SELECT-Abfragen (GAQL) sind erlaubt.", "invalid_query");
  }
  return query;
}

async function runGaql(client: GoogleAdsClient, body: Body) {
  if (body.queries === undefined) {
    const rows = await client.search(selectOnly(body.query));
    return { ok: true, rowCount: rows.length, rows };
  }
  if (!body.queries || typeof body.queries !== "object" || Array.isArray(body.queries)) {
    throw new HttpError(400, "queries muss ein Objekt { name: GAQL } sein.", "invalid_query");
  }
  const queries = Object.entries(body.queries as Record<string, unknown>).map(([k, q]) => [k, selectOnly(q)] as const);
  if (queries.length === 0 || queries.length > MAX_QUERIES) {
    throw new HttpError(400, `1 bis ${MAX_QUERIES} Abfragen pro Aufruf.`, "invalid_query");
  }
  const results: Record<string, unknown[]> = {};
  const errors: Record<string, string> = {};
  for (const [key, query] of queries) {
    try {
      results[key] = await client.search(query);
    } catch (err) {
      errors[key] = describeGoogleAdsError(err);
      results[key] = [];
    }
  }
  return { ok: Object.keys(errors).length === 0, results, errors };
}

const CLIENT_ACTIONS: Record<string, (client: GoogleAdsClient, body: Body) => Promise<unknown>> = {
  gaql: runGaql,
  "keyword-ideas": keywordIdeas,
  "keyword-metrics": keywordMetrics,
};

serve(async (req) => {
  const auth = await checkCronOrServiceRoleOrAdmin(req, {});
  if (!auth.authorized) throw new HttpError(401, "Nicht autorisiert.", "unauthorized");
  const body = await readJson<Body>(req);
  const sb = serviceClient();

  if (body.action === "status") return jsonResponse(req, await runStatus(sb));
  const handler = body.action && Object.hasOwn(CLIENT_ACTIONS, body.action) ? CLIENT_ACTIONS[body.action] : undefined;
  if (!handler && body.action !== "setup") throw new HttpError(400, "Unbekannte Aktion.", "unknown_action");

  const { credentials } = await loadGoogleAdsCredentials();
  if (!credentials) throw new HttpError(503, "Google-Ads-Zugangsdaten fehlen (Vault gads_*).", "gads_unconfigured");
  const client = createGoogleAdsClient(credentials);

  if (body.action === "setup") return jsonResponse(req, await runSetup(client, sb, body.dryRun === true));
  try {
    return jsonResponse(req, await handler!(client, body));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    return jsonResponse(req, { ok: false, error: describeGoogleAdsError(err) }, 502);
  }
});
