/**
 * Gemeinsamer Lead-Eingang für kw-lead (Funnel A), kw-lead-b (Funnel B) und
 * kw-planner (Funnel C): Klick-IDs, Idempotenz über submission_id und
 * Lead + Einwilligungen in einer Transaktion (RPC kw_insert_lead_with_consents).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "msclkid", "fbclid"] as const;
export type ClickIdKey = (typeof CLICK_ID_KEYS)[number];
export type ClickIdColumns = Partial<Record<ClickIdKey, string>>;

/**
 * Klick-IDs aus dem Request. Der Browser schickt sie nur mit
 * Marketing-Einwilligung (getConsentedClickIds); hier wird nur das Format geprüft.
 */
export function sanitizeClickIds(value: unknown): ClickIdColumns {
  const rec = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const out: ClickIdColumns = {};
  for (const key of CLICK_ID_KEYS) {
    const raw = rec[key];
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (/^[A-Za-z0-9_-]{10,500}$/.test(trimmed)) out[key] = trimmed;
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vom Browser erzeugte ID eines Absendeversuchs (UUID) oder null. */
export function parseSubmissionId(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value.trim()) ? value.trim().toLowerCase() : null;
}

/** Lead zu einer bereits verarbeiteten submission_id. */
export async function leadForSubmission(sb: SupabaseClient, submissionId: string | null): Promise<string | null> {
  if (!submissionId) return null;
  const { data } = await sb.from("leads").select("id").eq("submission_id", submissionId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export interface ConsentGrant {
  purpose: string;
  granted: boolean;
}

export interface ConsentContext {
  textVersion: string;
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
}

/**
 * Legt Lead und Einwilligungen gemeinsam an (scheitert eines, entsteht keines).
 * Kommt dieselbe submission_id parallel ein zweites Mal, liefert die Funktion
 * den vorhandenen Lead mit duplicate = true.
 */
export async function insertLeadWithConsents(
  sb: SupabaseClient,
  lead: Record<string, unknown>,
  consents: ConsentGrant[],
  ctx: ConsentContext,
): Promise<{ leadId: string; duplicate: boolean }> {
  const rows = consents.map((c) => ({
    purpose: c.purpose,
    granted: c.granted,
    user_id: ctx.userId,
    text_version: ctx.textVersion,
    ip_address: ctx.ip,
    user_agent: ctx.userAgent,
  }));
  // null-Werte weglassen, sonst überschreibt das RPC die DB-Defaults der Spalten.
  const values = Object.fromEntries(Object.entries(lead).filter(([, v]) => v !== null && v !== undefined));
  const { data, error } = await sb.rpc("kw_insert_lead_with_consents", { p_lead: values, p_consents: rows });
  if (!error && typeof data === "string") return { leadId: data, duplicate: false };

  if (error?.code === "23505" && typeof lead.submission_id === "string") {
    const existing = await leadForSubmission(sb, lead.submission_id);
    if (existing) return { leadId: existing, duplicate: true };
  }
  throw error ?? new Error("lead insert failed");
}
