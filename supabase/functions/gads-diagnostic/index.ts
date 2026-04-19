/**
 * Google Ads Diagnostic Edge Function
 *
 * Admin-only diagnostic helper used by `AdminTrackingTab.tsx` to verify the
 * Google Ads API setup. Returns:
 *  - SALE_ENV_VALUE: masked value of GADS_SALE_CONVERSION_ACTION_ID
 *  - LENGTH:         length of the env var (helps spot trailing whitespace)
 *  - FIRST_CHAR:     char code of first character (detect leading whitespace)
 *  - actions:        live list of all conversion actions in the configured
 *                    Google Ads customer account, so the admin can see which
 *                    `id` belongs to which `name` (and which one is set as
 *                    "Fahrzeug Verkauft").
 *
 * Auth: admin or service_role only (uses checkServiceRoleOrAdmin).
 *
 * Errors are returned as `{ error: string }` with HTTP 200 so the UI can
 * render a friendly message instead of a generic 500.
 */

import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

interface ConversionAction {
  id: string;
  name: string;
  status: string;
  type: string;
  category: string;
  primary_for_goal: boolean;
}

interface DiagnosticResponse {
  SALE_ENV_VALUE?: string | null;
  LENGTH?: number | null;
  FIRST_CHAR?: number | null;
  actions?: ConversionAction[];
  error?: string;
}

const LOGIN_CUSTOMER_ID_FALLBACK = '9746508145';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const json = (body: DiagnosticResponse, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // ─── Auth ──────────────────────────────────────────────────────────────
  const authResult = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!authResult.authorized) return authResult.response;

  // ─── Env vars ──────────────────────────────────────────────────────────
  const SALE_ACTION_ID = Deno.env.get('GADS_SALE_CONVERSION_ACTION_ID') ?? '';
  const GADS_CUSTOMER_ID = Deno.env.get('GADS_CUSTOMER_ID');
  const GADS_DEVELOPER_TOKEN = Deno.env.get('GADS_DEVELOPER_TOKEN');
  const GADS_OAUTH_REFRESH_TOKEN = Deno.env.get('GADS_OAUTH_REFRESH_TOKEN');
  const GADS_OAUTH_CLIENT_ID = Deno.env.get('GADS_OAUTH_CLIENT_ID');
  const GADS_OAUTH_CLIENT_SECRET = Deno.env.get('GADS_OAUTH_CLIENT_SECRET');
  const GADS_LOGIN_CUSTOMER_ID = Deno.env.get('GADS_LOGIN_CUSTOMER_ID') || LOGIN_CUSTOMER_ID_FALLBACK;

  const envSummary: DiagnosticResponse = {
    SALE_ENV_VALUE: SALE_ACTION_ID || null,
    LENGTH: SALE_ACTION_ID.length || 0,
    FIRST_CHAR: SALE_ACTION_ID.length > 0 ? SALE_ACTION_ID.charCodeAt(0) : null,
  };

  if (
    !GADS_CUSTOMER_ID ||
    !GADS_DEVELOPER_TOKEN ||
    !GADS_OAUTH_REFRESH_TOKEN ||
    !GADS_OAUTH_CLIENT_ID ||
    !GADS_OAUTH_CLIENT_SECRET
  ) {
    return json({
      ...envSummary,
      error:
        'Google Ads API Secrets unvollständig. Bitte folgende Edge-Function-Secrets prüfen: GADS_CUSTOMER_ID, GADS_DEVELOPER_TOKEN, GADS_OAUTH_REFRESH_TOKEN, GADS_OAUTH_CLIENT_ID, GADS_OAUTH_CLIENT_SECRET.',
    });
  }

  // ─── OAuth Token holen ─────────────────────────────────────────────────
  let accessToken: string;
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: GADS_OAUTH_CLIENT_ID,
        client_secret: GADS_OAUTH_CLIENT_SECRET,
        refresh_token: GADS_OAUTH_REFRESH_TOKEN,
      }),
    });

    if (!tokenResponse.ok) {
      const txt = await tokenResponse.text();
      return json({
        ...envSummary,
        error: `OAuth Token Fehler (HTTP ${tokenResponse.status}): ${txt.slice(0, 300)}`,
      });
    }

    const tokenJson = await tokenResponse.json();
    accessToken = tokenJson.access_token;
    if (!accessToken) {
      return json({ ...envSummary, error: 'OAuth Antwort enthält keinen access_token.' });
    }
  } catch (err: any) {
    return json({ ...envSummary, error: `OAuth Netzwerkfehler: ${err?.message ?? String(err)}` });
  }

  // ─── Conversion Actions abfragen (GAQL) ────────────────────────────────
  const customerId = GADS_CUSTOMER_ID.replace(/-/g, '');
  const gaqlQuery = `
    SELECT
      conversion_action.id,
      conversion_action.name,
      conversion_action.status,
      conversion_action.type,
      conversion_action.category,
      conversion_action.primary_for_goal
    FROM conversion_action
    ORDER BY conversion_action.id
  `;

  try {
    const searchResponse = await fetch(
      `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'developer-token': GADS_DEVELOPER_TOKEN,
          'login-customer-id': GADS_LOGIN_CUSTOMER_ID,
        },
        body: JSON.stringify({ query: gaqlQuery }),
      },
    );

    if (!searchResponse.ok) {
      const errTxt = await searchResponse.text();
      return json({
        ...envSummary,
        error: `Google Ads API Fehler (HTTP ${searchResponse.status}): ${errTxt.slice(0, 500)}`,
      });
    }

    // searchStream returns NDJSON or a JSON array of streamed batches
    const responseText = await searchResponse.text();
    const actions: ConversionAction[] = [];

    // Parse either a JSON array or newline-delimited JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // NDJSON fallback
      const lines = responseText.split('\n').filter((l) => l.trim().length > 0);
      parsed = lines.map((l) => JSON.parse(l));
    }

    const batches = Array.isArray(parsed) ? parsed : [parsed];
    for (const batch of batches) {
      const results = (batch as { results?: Array<Record<string, unknown>> })?.results;
      if (!Array.isArray(results)) continue;
      for (const row of results) {
        const ca = (row as { conversionAction?: Record<string, unknown> }).conversionAction;
        if (!ca) continue;
        actions.push({
          id: String(ca.id ?? ''),
          name: String(ca.name ?? ''),
          status: String(ca.status ?? ''),
          type: String(ca.type ?? ''),
          category: String(ca.category ?? ''),
          primary_for_goal: Boolean(ca.primaryForGoal),
        });
      }
    }

    return json({ ...envSummary, actions });
  } catch (err: any) {
    return json({
      ...envSummary,
      error: `Google Ads Netzwerkfehler: ${err?.message ?? String(err)}`,
    });
  }
});
