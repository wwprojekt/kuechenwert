/**
 * kw-funnel-telemetry — Schritt- und Feldereignisse der Funnels A, B und C
 *
 * POST { session_id, funnel, consent_id?, device_type?, viewport_width?, events: [...] }
 * Auch als text/plain: navigator.sendBeacon schickt beim Verlassen der Seite
 * ohne Preflight und ohne Header.
 *
 * Schreibt in kw_funnel_events (Admin → Analytics → Funnels). Nur
 * Feldschlüssel, keine Eingaben; die IP-Adresse dient nur gehasht dem
 * Rate-Limit. Der Browser sendet nur mit Statistik-Einwilligung.
 * Prüfregeln: _shared/funnel-telemetry.ts (auch im Browser genutzt).
 */

import { isAllowedOrigin } from "../_shared/cors.ts";
import { parseTelemetryBatch } from "../_shared/funnel-telemetry.ts";
import {
  HttpError,
  enforceRateLimit,
  jsonResponse,
  rateLimitIp,
  readJson,
  serve,
  serviceClient,
  sha256Hex,
} from "../_shared/kw-http.ts";

serve(async (req) => {
  if (!isAllowedOrigin(req.headers.get("origin"))) {
    throw new HttpError(403, "Nicht erlaubt.", "origin");
  }

  const sb = serviceClient();
  const ipHash = (await sha256Hex(`kw-funnel-telemetry:${rateLimitIp(req)}`)).slice(0, 32);
  await enforceRateLimit(sb, `kw:funnel-telemetry:${ipHash}`, 60, 60);

  const parsed = parseTelemetryBatch(await readJson(req));
  if (!parsed.ok) throw new HttpError(400, parsed.error, "invalid_batch");
  if (parsed.rows.length === 0) return jsonResponse(req, { ok: true, inserted: 0, skipped: parsed.skipped });

  const { error } = await sb.from("kw_funnel_events").insert(parsed.rows);
  if (error) throw error;
  return jsonResponse(req, { ok: true, inserted: parsed.rows.length, skipped: parsed.skipped });
});
