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
 *
 * Aufruf: Admin im Browser, service_role oder pg_net mit x-kw-cron-secret
 * (Agenten, siehe AGENTS.md → Google Tracking).
 */

import { checkCronOrServiceRoleOrAdmin } from "../_shared/auth.ts";
import { createGoogleAdsClient, describeGoogleAdsError, loadGoogleAdsCredentials } from "../_shared/google-ads.ts";
import { HttpError, jsonResponse, readJson, serve, serviceClient } from "../_shared/kw-http.ts";
import { runSetup } from "./setup.ts";
import { runStatus } from "./status.ts";

const MAX_QUERIES = 20;
const MAX_QUERY_LENGTH = 10_000;

function selectOnly(query: unknown): string {
  if (typeof query !== "string" || !/^\s*SELECT\s/i.test(query) || query.length > MAX_QUERY_LENGTH) {
    throw new HttpError(400, "Nur SELECT-Abfragen (GAQL) sind erlaubt.", "invalid_query");
  }
  return query;
}

serve(async (req) => {
  const auth = await checkCronOrServiceRoleOrAdmin(req, {});
  if (!auth.authorized) throw new HttpError(401, "Nicht autorisiert.", "unauthorized");
  const body = await readJson<{ action?: string; query?: unknown; queries?: unknown; dryRun?: unknown }>(req);
  const sb = serviceClient();

  if (body.action === "status") return jsonResponse(req, await runStatus(sb));
  if (body.action !== "gaql" && body.action !== "setup") {
    throw new HttpError(400, "Unbekannte Aktion.", "unknown_action");
  }

  const { credentials } = await loadGoogleAdsCredentials();
  if (!credentials) throw new HttpError(503, "Google-Ads-Zugangsdaten fehlen (Vault gads_*).", "gads_unconfigured");
  const client = createGoogleAdsClient(credentials);

  if (body.action === "setup") return jsonResponse(req, await runSetup(client, sb, body.dryRun === true));

  if (body.queries !== undefined) {
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
    return jsonResponse(req, { ok: Object.keys(errors).length === 0, results, errors });
  }

  const query = selectOnly(body.query);
  try {
    const rows = await client.search(query);
    return jsonResponse(req, { ok: true, rowCount: rows.length, rows });
  } catch (err) {
    return jsonResponse(req, { ok: false, error: describeGoogleAdsError(err) }, 502);
  }
});
