/**
 * kw-lead — Anfrage „Küchenangebote einholen“ (Funnel A, Version 2)
 *
 * Aktionen (POST { action, ... }):
 *   submit     Antworten + Kontakt → Lead, Einwilligungen, Projektlink
 *   coverage   Zahl der aktiven Studios, deren Einzugsgebiet eine PLZ abdeckt
 *
 * Ausschreibung und Kunden-Mail (project_created) legt der DB-Trigger
 * kw_leads_after_insert_tender an, nicht diese Function.
 *
 * Auth: anonym, optional Bearer-JWT zur Verknüpfung mit dem Konto.
 * Rate-Limit pro IP; ohne gültiges Turnstile-Token wird der Lead nicht
 * automatisch veröffentlicht (leads.bot_check). Schreibzugriffe mit service_role.
 * Lead und Einwilligungen entstehen gemeinsam (_shared/lead-intake.ts);
 * dieselbe submission_id liefert bei Wiederholung denselben Lead.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  HttpError,
  cleanText,
  clientIp,
  enforceRateLimit,
  isEmail,
  isPostalCode,
  jsonResponse,
  normalizePhone,
  randomToken,
  readJson,
  serve,
  serviceClient,
  sha256Hex,
  validIp,
} from "../_shared/kw-http.ts";
import { checkTurnstile } from "../_shared/turnstile.ts";
import { insertLeadWithConsents, leadForSubmission, parseSubmissionId, sanitizeClickIds } from "../_shared/lead-intake.ts";
import {
  estimateFunnelA,
  housingType,
  missingRequired,
  regionForPostalCode,
  sanitizeFunnelAAnswers,
  statedBudget,
  timeframeMonths,
  toStoredAnswers,
  type FunnelAAnswers,
} from "../_shared/funnel-a-catalog.ts";
import { loadRateCard } from "../_shared/rate-card.ts";
import { BRAND } from "../_shared/brand-config.ts";

const CONSENT_TEXT_VERSION = "kw-anfrage-2026-09-28";
const SALUTATIONS = new Set(["Herr", "Frau", "Divers"]);

const MISSING_ANSWER_MESSAGES: Partial<Record<keyof FunnelAAnswers, string>> = {
  kitchen_form: "Bitte wählen Sie eine Küchenform – oder „Steht noch nicht fest“.",
  timeframe: "Bitte geben Sie an, wann Ihre neue Küche kommen soll.",
  postal_code: "Bitte eine gültige Postleitzahl angeben.",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function userIdFromAuthHeader(sb: SupabaseClient, req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const jwt = header.slice(7);
  if (jwt.split(".").length !== 3) return null;
  const { data } = await sb.auth.getUser(jwt);
  return data?.user?.id ?? null;
}

async function projectLinkResponse(req: Request, sb: SupabaseClient, leadId: string, estimate?: unknown) {
  const token = randomToken();
  const { error: tokenErr } = await sb.rpc("kw_project_issue_token", {
    p_lead_id: leadId,
    p_token_hash: await sha256Hex(token),
  });
  if (tokenErr) {
    console.error("[kw-lead] token issue failed", leadId, tokenErr.message);
    // Der Lead ist bereits angelegt: 502 wiederholt callFunction nicht automatisch. Den
    // Projektlink verschickt kw-market-worker ohnehin mit project_created.
    throw new HttpError(502, "Ihre Anfrage ist eingegangen. Den Link zu Ihrem Projekt senden wir Ihnen per E-Mail.", "project_link");
  }
  return jsonResponse(req, {
    ok: true,
    lead_id: leadId,
    project_token: token,
    project_url: `${BRAND.baseUrl}/projekt/${token}`,
    ...(estimate ? { estimate } : {}),
  });
}

async function actionSubmit(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return jsonResponse(req, { ok: true, project_url: `${BRAND.baseUrl}/` });
  }
  const ip = clientIp(req);
  await enforceRateLimit(sb, `kw:lead:${ip}`, 3600, 6);

  // Doppelklick oder Wiederholung nach Zeitüberschreitung: denselben Lead zurückgeben.
  const submissionId = parseSubmissionId(body.submission_id);
  const previousLead = await leadForSubmission(sb, submissionId);
  if (previousLead) return projectLinkResponse(req, sb, previousLead);

  const answers = sanitizeFunnelAAnswers(body.answers);
  const missing = missingRequired(answers)[0];
  if (missing) {
    throw new HttpError(422, MISSING_ANSWER_MESSAGES[missing] ?? "Bitte vervollständigen Sie Ihre Angaben.", missing);
  }

  const contact = asRecord(body.contact);
  const consents = asRecord(body.consents);
  const utm = asRecord(body.utm);

  const firstName = cleanText(contact.first_name, 80);
  const lastName = cleanText(contact.last_name, 80);
  const email = typeof contact.email === "string" ? contact.email.trim().toLowerCase() : "";
  const phoneInput = typeof contact.phone === "string" ? contact.phone.trim() : "";
  const phone = phoneInput ? normalizePhone(phoneInput) : null;
  if (!firstName || !lastName) throw new HttpError(422, "Bitte Vor- und Nachnamen angeben.", "name");
  if (!isEmail(email)) throw new HttpError(422, "Bitte eine gültige E-Mail-Adresse angeben.", "email");
  if (phoneInput && !phone) {
    throw new HttpError(422, "Bitte eine gültige Telefonnummer angeben oder das Feld leer lassen.", "phone");
  }
  if (consents.share_with_studios !== true) {
    throw new HttpError(422, "Bitte stimmen Sie der Weitergabe an geprüfte Küchenstudios zu.", "consent");
  }

  // Erst nach der Validierung: ein Eingabefehler soll das Token nicht verbrauchen.
  const botCheck = await checkTurnstile(body.turnstile_token, ip);

  const { card, version: rateCardVersion, calibration } = await loadRateCard(sb);
  const estimate = estimateFunnelA(answers, { card, postalCode: answers.postal_code, rateCardVersion, calibration });
  const estimateRange = { min: estimate.min, max: estimate.max, mid: estimate.mid };
  const months = timeframeMonths(answers.timeframe);
  const budget = statedBudget(answers);

  const { data: tierRow } = await sb.rpc("kw_lead_tier_score", {
    p_has_photo: false,
    p_has_dimensions: false,
    p_has_phone: !!phone,
    p_timeframe_months: months,
    p_value_eur: budget ?? estimate.mid,
  });
  const tier = (Array.isArray(tierRow) ? tierRow[0] : tierRow) ?? { tier: "standard", score: 0 };
  const userId = await userIdFromAuthHeader(sb, req);
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const consentCall = !!phone && consents.contact_by_phone === true;
  const consentMarketing = consents.marketing === true;
  const salutation =
    typeof contact.salutation === "string" && SALUTATIONS.has(contact.salutation) ? contact.salutation : null;

  const { leadId } = await insertLeadWithConsents(
    sb,
    {
      submission_id: submissionId,
      ...sanitizeClickIds(body.click_ids),
      user_id: userId,
      funnel_type: "a",
      funnel_variant: "A2",
      status: "new",
      bot_check: botCheck,
      tier: tier.tier,
      score: tier.score,
      postal_code: answers.postal_code,
      region: regionForPostalCode(answers.postal_code),
      housing_type: housingType(answers.housing),
      kitchen_form: answers.kitchen_form || null,
      kitchen_style: answers.kitchen_style || null,
      purchase_reason: answers.purchase_reason || null,
      timeframe_months: months,
      budget_midpoint: budget,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      consent_call: consentCall,
      consent_marketing: consentMarketing,
      funnel_answers: toStoredAnswers(answers, { salutation, estimate: estimateRange }),
      utm_source: cleanText(utm.utm_source, 120),
      utm_medium: cleanText(utm.utm_medium, 120),
      utm_campaign: cleanText(utm.utm_campaign, 200),
      utm_content: cleanText(utm.utm_content, 200),
      utm_term: cleanText(utm.utm_term, 200),
      landing_page: cleanText(body.landing_page, 300),
      ip_address: validIp(ip),
      user_agent: userAgent,
    },
    [
      { purpose: "share_with_studios", granted: true },
      { purpose: "contact_by_phone", granted: consentCall },
      { purpose: "marketing", granted: consentMarketing },
    ],
    { textVersion: CONSENT_TEXT_VERSION, userId, ip: validIp(ip), userAgent },
  );

  return projectLinkResponse(req, sb, leadId, estimateRange);
}

async function actionCoverage(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const postalCode = typeof body.postal_code === "string" ? body.postal_code.trim() : "";
  if (!isPostalCode(postalCode)) throw new HttpError(422, "Bitte eine gültige Postleitzahl angeben.", "postal_code");
  await enforceRateLimit(sb, `kw:coverage:${clientIp(req)}`, 3600, 60);
  const { data, error } = await sb.rpc("kw_studios_covering", { p_postal_code: postalCode });
  if (error) throw error;
  return jsonResponse(req, { studios: typeof data === "number" ? data : 0 });
}

serve(async (req) => {
  const body = await readJson(req);
  const sb = serviceClient();
  switch (body.action) {
    case "submit":
      return actionSubmit(req, sb, body);
    case "coverage":
      return actionCoverage(req, sb, body);
    default:
      throw new HttpError(400, "Unbekannte Aktion.", "unknown_action");
  }
});
