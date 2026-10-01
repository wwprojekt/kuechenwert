/**
 * Mistral AI (Mistral AI SAS, Paris) über den EU-Endpunkt: Die Verarbeitung
 * bleibt in der EU. Vor dem Einschalten im Mistral-Konto den AVV aus dem
 * Legal Center abschließen und unter Admin → Privacy „Anonymous improvement
 * data“ ausschalten (kein Training mit unseren Anfragen); auf Wunsch Zero
 * Data Retention beantragen, sonst hält Mistral Anfragen 30 Tage zur
 * Missbrauchsabwehr.
 *
 * Schlüssel: Edge-Secret MISTRAL_API_KEY, sonst Supabase Vault
 * („mistral_api_key“ über RPC kw_mistral_api_key, nur service_role).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { mistralErrorText, parsePlanReadingResponse, type PlanReadingResponse } from "./plan-reading.ts";

const BASE_URL = (Deno.env.get("MISTRAL_API_BASE") ?? "https://api.eu.mistral.ai").replace(/\/+$/, "");
const TIMEOUT_MS = 120_000;

export async function mistralApiKey(sb: SupabaseClient): Promise<string | null> {
  const fromEnv = Deno.env.get("MISTRAL_API_KEY")?.trim();
  if (fromEnv) return fromEnv;
  const { data, error } = await sb.rpc("kw_mistral_api_key");
  if (error) {
    console.error("[mistral] Schlüssel aus dem Vault nicht lesbar", error.message);
    return null;
  }
  return typeof data === "string" && data.trim() ? data.trim() : null;
}

export class MistralError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    /** Zeitüberschreitung, Überlast oder Serverfehler: später erneut versuchen. */
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** POST /v1/chat/completions mit Antwort nach JSON-Schema. */
export async function mistralChatJson(apiKey: string, body: Record<string, unknown>): Promise<PlanReadingResponse> {
  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timeout = err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new MistralError(timeout ? "Mistral antwortet nicht (Zeitüberschreitung)" : "Mistral nicht erreichbar", null, true);
  }
  const text = await resp.text();
  if (!resp.ok) {
    throw new MistralError(`Mistral ${resp.status}: ${mistralErrorText(text)}`, resp.status, resp.status === 429 || resp.status >= 500);
  }
  try {
    return parsePlanReadingResponse(text);
  } catch (err) {
    throw new MistralError(`Mistral-Antwort unlesbar: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200), resp.status, true);
  }
}
