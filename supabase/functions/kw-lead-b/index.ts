/**
 * kw-lead-b — Anfrage „Studio-Preis unterbieten“ (Funnel B)
 *
 * Aktionen (POST { action, ... }):
 *   submit        Genannter Preis + Kontakt + AGB-Haken → Lead und
 *                 Einwilligungen. Für angekündigte Dateien (Planung, Angebot,
 *                 Fotos): Upload-Token plus signierte Upload-URLs (lead-files,
 *                 siehe _shared/lead-files.ts).
 *   attach-files  Nach dem Upload: vorhandene Dateien am Lead eintragen.
 *
 * Unterlagen lassen sich später über den Projektlink nachreichen (kw-project).
 *
 * Die Ausschreibung legt der DB-Trigger kw_leads_after_insert_tender als
 * Entwurf an; veröffentlicht wird nach dem Experten-Check.
 *
 * Auth: anonym, optional Bearer-JWT zur Verknüpfung mit dem Konto.
 * Honeypot und Rate-Limit pro IP, Turnstile-Ergebnis in leads.bot_check.
 * Schreibzugriffe mit service_role.
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
  readJson,
  serve,
  serviceClient,
  validIp,
} from "../_shared/kw-http.ts";
import { checkTurnstile } from "../_shared/turnstile.ts";
import { insertLeadWithConsents, leadForSubmission, parseSubmissionId, sanitizeClickIds } from "../_shared/lead-intake.ts";
import { regionForPostalCode } from "../_shared/plz-region.ts";
import {
  DELIVERY_MODES,
  EXTRAS_OPTIONS,
  FINANCING_OPTIONS,
  OFFER_INCLUDES,
  OFFER_INCLUDES_UNKNOWN,
  TIMEFRAMES,
  plausibleOfferDate,
} from "../_shared/funnel-b-catalog.ts";
import { FORM_OPTIONS } from "../_shared/funnel-a-catalog.ts";
import { attachUploadedFiles, issueUploads, parseAnnouncedFiles } from "../_shared/lead-files.ts";
import { redactOptional } from "../_shared/contact-redaction.ts";
import { FUNNEL_TERMS, TERMS_MISSING, termsAnswer } from "../_shared/lead-terms.ts";

/** Vier einzelne Haken (Weitergabe, Rückruf, Studio-Anrufe, Werbung), bis 30.09.2026. */
const LEGACY_CONSENT_TEXT_VERSION = "kw-unterbieten-2026-09-28b";

const SALUTATIONS = new Set(["frau", "herr", "divers"]);
const WASTE_SEPARATION = new Set(["yes", "no", "unknown"]);
const TIMEFRAME_MONTHS = new Map<string, number | null>(TIMEFRAMES.map((t) => [t.slug, t.months]));
const DELIVERY = new Set<string>(DELIVERY_MODES.map((d) => d.slug));
const FINANCING = new Set<string>(FINANCING_OPTIONS.map((f) => f.slug));
const EXTRAS = new Set<string>(EXTRAS_OPTIONS.map((e) => e.slug));
const INCLUDES = OFFER_INCLUDES.map((o) => o.slug);
const FORMS = new Set<string>(FORM_OPTIONS.map((f) => f.id));

/** Freitext, den Studios sehen: gekürzt und ohne Kontaktdaten. */
function studioText(value: unknown, max: number): string | null {
  return redactOptional(cleanText(value, max));
}

/** Leistungsumfang des vorhandenen Angebots; „Weiß ich nicht“ steht allein. */
function offerIncludes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  if (value.includes(OFFER_INCLUDES_UNKNOWN)) return [OFFER_INCLUDES_UNKNOWN];
  return INCLUDES.filter((slug) => value.includes(slug));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function numberIn(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function slugIn(value: unknown, allowed: Set<string>): string | null {
  return typeof value === "string" && allowed.has(value) ? value : null;
}

async function userIdFromAuthHeader(sb: SupabaseClient, req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const jwt = header.slice(7);
  if (jwt.split(".").length !== 3) return null;
  const { data } = await sb.auth.getUser(jwt);
  return data?.user?.id ?? null;
}

async function actionSubmit(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return jsonResponse(req, { ok: true });
  }
  const ip = clientIp(req);
  await enforceRateLimit(sb, `kw:lead-b:${ip}`, 3600, 6);

  const d = asRecord(body.data);
  const files = parseAnnouncedFiles(body.files);

  // Doppelklick oder Wiederholung: denselben Lead verwenden, Uploads neu ausstellen.
  const submissionId = parseSubmissionId(body.submission_id);
  const previousLead = await leadForSubmission(sb, submissionId);
  if (previousLead) return jsonResponse(req, { ok: true, ...(await issueUploads(sb, previousLead, files)) });

  const postalCode = typeof d.postalCode === "string" ? d.postalCode.trim() : "";
  const firstName = cleanText(d.firstName, 80);
  const lastName = cleanText(d.lastName, 80);
  const email = typeof d.email === "string" ? d.email.trim().toLowerCase() : "";
  const phone = normalizePhone(d.phone);
  const priceEur = numberIn(d.existingOfferPriceEur, 1, 2_000_000);
  const offerDelivery = d.offerDeliveryMethod === "now" || d.offerDeliveryMethod === "later" ? d.offerDeliveryMethod : null;

  if (!isPostalCode(postalCode)) throw new HttpError(422, "Bitte eine gültige Postleitzahl angeben.", "postal_code");
  if (!firstName || firstName.length < 2 || !lastName || lastName.length < 2) {
    throw new HttpError(422, "Bitte Vor- und Nachnamen angeben.", "name");
  }
  if (!isEmail(email)) throw new HttpError(422, "Bitte eine gültige E-Mail-Adresse angeben.", "email");
  if (!phone) throw new HttpError(422, "Bitte eine gültige Telefonnummer angeben – wir rufen Sie für den Experten-Check an.", "phone");
  // Seit 30.09.2026 ein AGB-Haken, dessen Hinweis Rückruf, Weitergabe und Studio-Anrufe nennt;
  // ältere Seiten schicken die einzelnen Einwilligungen.
  const terms = termsAnswer(d, "acceptTerms");
  if (terms === "declined") throw new HttpError(422, TERMS_MISSING, "terms");
  const withTerms = terms === "accepted";
  if (!withTerms && d.consentCall !== true) {
    throw new HttpError(422, "Bitte willigen Sie in den Rückruf zum Experten-Check ein.", "consent");
  }
  // Noch ältere Seiten ohne die Studio-Checkbox senden consentShare nicht:
  // Lead annehmen, aber ohne Freigabe der Kontaktdaten an Studios.
  if (!withTerms && d.consentShare === false) {
    throw new HttpError(422, "Bitte stimmen Sie der Weitergabe Ihres Projekts an Küchenstudios zu.", "consent_share");
  }
  const consentShare = withTerms || d.consentShare === true;
  const consentStudioCall = withTerms || (consentShare && d.consentStudioCall === true);
  if (priceEur === null) throw new HttpError(422, "Bitte geben Sie den Preis in Euro an, den Ihnen das Küchenstudio genannt hat.", "price");
  if (!offerDelivery) {
    throw new HttpError(422, "Bitte wählen Sie, ob Sie Ihre Planung jetzt hochladen oder später nachreichen.", "offer_delivery");
  }
  if (offerDelivery === "now" && files.length === 0) {
    throw new HttpError(422, "Bitte laden Sie Ihre Planung, das Angebot oder ein Foto hoch – oder wählen Sie „Später nachreichen“.", "files");
  }

  const timeframe = typeof d.timeframe === "string" && TIMEFRAME_MONTHS.has(d.timeframe) ? d.timeframe : null;
  const timeframeMonths = timeframe ? TIMEFRAME_MONTHS.get(timeframe) ?? null : null;
  const extras = Array.isArray(d.extras) ? d.extras.filter((e): e is string => typeof e === "string" && EXTRAS.has(e)).slice(0, 20) : [];
  const appliances = (Array.isArray(d.appliances) ? d.appliances : []).slice(0, 30).map((raw) => {
    const a = asRecord(raw);
    return {
      categorySlug: cleanText(a.categorySlug, 60),
      brandSlug: cleanText(a.brandSlug, 60),
      model: studioText(a.model, 120),
    };
  });
  const kitchenForm = typeof d.kitchenForm === "string" && FORMS.has(d.kitchenForm) ? d.kitchenForm : null;
  // Erst nach der Validierung: ein Eingabefehler soll das Token nicht verbrauchen.
  const botCheck = await checkTurnstile(body.turnstile_token, ip);
  const waste = slugIn(d.wasteSeparationSystem, WASTE_SEPARATION);
  const salutation = slugIn(d.salutation, SALUTATIONS);
  const priceCents = Math.round(priceEur * 100);
  const consentMarketing = !withTerms && d.consentMarketing === true;
  const utm = asRecord(body.utm);
  const userId = await userIdFromAuthHeader(sb, req);
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const { data: tierRow } = await sb.rpc("kw_lead_tier_score", {
    p_has_photo: files.some((f) => f.category === "kueche_bild" || f.category === "grundriss"),
    p_has_dimensions: false,
    p_has_phone: true,
    p_timeframe_months: timeframeMonths,
    p_value_eur: Math.round(priceEur),
  });
  const tier = (Array.isArray(tierRow) ? tierRow[0] : tierRow) ?? { tier: "standard", score: 0 };

  const { leadId } = await insertLeadWithConsents(
    sb,
    {
      submission_id: submissionId,
      ...sanitizeClickIds(body.click_ids),
      user_id: userId,
      funnel_type: "b",
      status: "new",
      bot_check: botCheck,
      tier: tier.tier,
      score: tier.score,
      postal_code: postalCode,
      region: regionForPostalCode(postalCode),
      city: cleanText(d.city, 80),
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      budget_midpoint: Math.round(priceEur),
      kitchen_form: kitchenForm,
      timeframe_months: timeframeMonths,
      delivery_mode: slugIn(d.deliveryMode, DELIVERY),
      payment_financing: slugIn(d.paymentFinancing, FINANCING),
      payment_financing_apr: numberIn(d.paymentFinancingApr, 0, 30),
      payment_financing_months: (() => {
        const months = numberIn(d.paymentFinancingMonths, 0, 240);
        return months === null ? null : Math.round(months);
      })(),
      payment_down_payment_percent: numberIn(d.paymentDownPaymentPercent, 0, 100),
      has_existing_offer: true,
      existing_offer_studio: cleanText(d.existingOfferStudio, 160),
      existing_offer_price_cents: priceCents,
      waste_separation_system: waste === "yes" ? true : waste === "no" ? false : null,
      special_wishes: extras,
      consent_call: consentStudioCall,
      consent_marketing: consentMarketing,
      // Freitexte sehen Studios vor dem Kontaktkauf: ohne Kontaktdaten speichern.
      funnel_answers: {
        brand: cleanText(d.brand, 80),
        brandCustom: studioText(d.brandCustom, 120),
        frontName: studioText(d.frontName, 120),
        frontMaterialName: cleanText(d.frontMaterialName, 120),
        handleType: cleanText(d.handleType, 60),
        worktopMaterial: cleanText(d.worktopMaterial, 60),
        worktopDesign: cleanText(d.worktopDesign, 120),
        worktopDesignCustom: studioText(d.worktopDesignCustom, 120),
        appliances,
        sinkBrand: cleanText(d.sinkBrand, 60),
        sinkMaterial: cleanText(d.sinkMaterial, 60),
        sinkDesignation: studioText(d.sinkDesignation, 120),
        extrasNotes: studioText(d.extrasNotes, 1000),
        offerIncludes: offerIncludes(d.offerIncludes),
        offerValidUntil: plausibleOfferDate(d.offerValidUntil),
        salutation,
        offerDeliveryMethod: offerDelivery,
        timeframeSlug: timeframe,
      },
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
      ...(withTerms ? [{ purpose: "terms", granted: true }] : []),
      { purpose: "share_with_studios", granted: consentShare },
      { purpose: "kuechenwert_call", granted: true },
      { purpose: "contact_by_phone", granted: consentStudioCall },
      ...(withTerms ? [] : [{ purpose: "marketing", granted: consentMarketing }]),
    ],
    { textVersion: withTerms ? FUNNEL_TERMS.b.version : LEGACY_CONSENT_TEXT_VERSION, userId, ip: validIp(ip), userAgent },
  );

  const { data: covering } = await sb.rpc("kw_studios_covering", { p_postal_code: postalCode });
  return jsonResponse(req, {
    ok: true,
    studios_in_area: typeof covering === "number" ? covering : null,
    review_required: botCheck === "unverified",
    ...(await issueUploads(sb, leadId, files)),
  });
}

async function actionAttachFiles(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  await enforceRateLimit(sb, `kw:lead-b-files:${clientIp(req)}`, 3600, 30);
  const { attached, missing } = await attachUploadedFiles(sb, body.upload_token, body.files);
  return jsonResponse(req, { ok: true, attached, missing });
}

serve(async (req) => {
  const body = await readJson(req);
  const sb = serviceClient();
  switch (body.action) {
    case "submit":
      return actionSubmit(req, sb, body);
    case "attach-files":
      return actionAttachFiles(req, sb, body);
    default:
      throw new HttpError(400, "Unbekannte Aktion.", "unknown_action");
  }
});
