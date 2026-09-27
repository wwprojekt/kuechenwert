/**
 * kw-lead-b — Anfrage „Studio-Preis unterbieten“ (Funnel B)
 *
 * Aktionen (POST { action, ... }):
 *   submit        Angebot + Kontakt → Lead und Einwilligungen. Für angekündigte
 *                 Dateien: Upload-Token plus signierte Upload-URLs (lead-files).
 *   attach-files  Nach dem Upload: vorhandene Dateien am Lead eintragen.
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
  randomToken,
  readJson,
  serve,
  serviceClient,
  sha256Hex,
  validIp,
} from "../_shared/kw-http.ts";
import { checkTurnstile } from "../_shared/turnstile.ts";
import { insertLeadWithConsents, leadForSubmission, parseSubmissionId, sanitizeClickIds } from "../_shared/lead-intake.ts";
import { regionForPostalCode } from "../_shared/plz-region.ts";
import { DELIVERY_MODES, EXTRAS_OPTIONS, FINANCING_OPTIONS, TIMEFRAMES } from "../_shared/funnel-b-catalog.ts";

const CONSENT_TEXT_VERSION = "kw-unterbieten-2026-09";
const BUCKET = "lead-files";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 6;
const UPLOAD_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

const FILE_CATEGORIES = new Set(["kueche_bild", "angebot", "grundriss"]);
const FILE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};
const SALUTATIONS = new Set(["frau", "herr", "divers"]);
const WASTE_SEPARATION = new Set(["yes", "no", "unknown"]);
const TIMEFRAME_MONTHS = new Map<string, number | null>(TIMEFRAMES.map((t) => [t.slug, t.months]));
const DELIVERY = new Set<string>(DELIVERY_MODES.map((d) => d.slug));
const FINANCING = new Set<string>(FINANCING_OPTIONS.map((f) => f.slug));
const EXTRAS = new Set<string>(EXTRAS_OPTIONS.map((e) => e.slug));

type AnnouncedFile = { category: string; name: string; type: string; size: number };

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

function parseAnnouncedFiles(value: unknown): AnnouncedFile[] {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_FILES) throw new HttpError(422, `Bitte höchstens ${MAX_FILES} Dateien anhängen.`, "files");
  return value.map((raw) => {
    const f = asRecord(raw);
    const category = typeof f.category === "string" ? f.category : "";
    const type = typeof f.type === "string" ? f.type.toLowerCase() : "";
    const size = numberIn(f.size, 1, MAX_FILE_BYTES);
    if (!FILE_CATEGORIES.has(category)) throw new HttpError(422, "Unbekannte Dateiart.", "files");
    if (!FILE_EXTENSIONS[type]) throw new HttpError(422, "Bitte nur Bilder (JPG, PNG, WebP, HEIC) oder PDF hochladen.", "files");
    if (size === null) throw new HttpError(422, "Eine Datei ist größer als 10 MB.", "files");
    return { category, type, size, name: cleanText(f.name, 120) ?? "datei" };
  });
}

async function issueUploads(sb: SupabaseClient, leadId: string, files: AnnouncedFile[]) {
  if (!files.length) return {};
  const uploadToken = randomToken();
  const { error: tokenErr } = await sb.from("lead_upload_tokens").insert({
    token_hash: await sha256Hex(uploadToken),
    lead_id: leadId,
    expires_at: new Date(Date.now() + UPLOAD_TOKEN_TTL_MS).toISOString(),
  });
  if (tokenErr) throw tokenErr;

  const uploads = [];
  for (const [index, file] of files.entries()) {
    const path = `${leadId}/${file.category}-${crypto.randomUUID()}.${FILE_EXTENSIONS[file.type]}`;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("signed upload url failed");
    uploads.push({ index, path: data.path, token: data.token });
  }
  return { upload_token: uploadToken, uploads };
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
  if (d.consentCall !== true) {
    throw new HttpError(422, "Bitte willigen Sie in den Rückruf zum Experten-Check ein.", "consent");
  }
  if (priceEur === null) throw new HttpError(422, "Bitte den Angebotspreis Ihres Küchenstudios in Euro angeben.", "price");
  if (!offerDelivery) throw new HttpError(422, "Bitte wählen Sie, wie Sie uns das Bild Ihrer Küche schicken.", "offer_delivery");
  if (offerDelivery === "now" && !files.some((f) => f.category === "kueche_bild")) {
    throw new HttpError(422, "Bitte laden Sie ein Bild Ihrer geplanten Küche hoch.", "files");
  }

  const timeframe = typeof d.timeframe === "string" && TIMEFRAME_MONTHS.has(d.timeframe) ? d.timeframe : null;
  const timeframeMonths = timeframe ? TIMEFRAME_MONTHS.get(timeframe) ?? null : null;
  const extras = Array.isArray(d.extras) ? d.extras.filter((e): e is string => typeof e === "string" && EXTRAS.has(e)).slice(0, 20) : [];
  const appliances = (Array.isArray(d.appliances) ? d.appliances : []).slice(0, 30).map((raw) => {
    const a = asRecord(raw);
    return {
      categorySlug: cleanText(a.categorySlug, 60),
      brandSlug: cleanText(a.brandSlug, 60),
      model: cleanText(a.model, 120),
    };
  });
  // Erst nach der Validierung: ein Eingabefehler soll das Token nicht verbrauchen.
  const botCheck = await checkTurnstile(body.turnstile_token, ip);
  const waste = slugIn(d.wasteSeparationSystem, WASTE_SEPARATION);
  const salutation = slugIn(d.salutation, SALUTATIONS);
  const priceCents = Math.round(priceEur * 100);
  const consentMarketing = d.consentMarketing === true;
  const utm = asRecord(body.utm);
  const userId = await userIdFromAuthHeader(sb, req);
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const { data: tierRow } = await sb.rpc("kw_lead_tier_score", {
    p_has_photo: files.some((f) => f.category === "kueche_bild"),
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
      consent_call: true,
      consent_marketing: consentMarketing,
      funnel_answers: {
        brand: cleanText(d.brand, 80),
        brandCustom: cleanText(d.brandCustom, 120),
        frontName: cleanText(d.frontName, 120),
        frontMaterialName: cleanText(d.frontMaterialName, 120),
        handleType: cleanText(d.handleType, 60),
        worktopMaterial: cleanText(d.worktopMaterial, 60),
        worktopDesign: cleanText(d.worktopDesign, 120),
        worktopDesignCustom: cleanText(d.worktopDesignCustom, 120),
        appliances,
        sinkBrand: cleanText(d.sinkBrand, 60),
        sinkMaterial: cleanText(d.sinkMaterial, 60),
        sinkDesignation: cleanText(d.sinkDesignation, 120),
        extrasNotes: cleanText(d.extrasNotes, 1000),
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
      { purpose: "contact_by_phone", granted: true },
      { purpose: "marketing", granted: consentMarketing },
    ],
    { textVersion: CONSENT_TEXT_VERSION, userId, ip: validIp(ip), userAgent },
  );

  return jsonResponse(req, { ok: true, ...(await issueUploads(sb, leadId, files)) });
}

const STORED_PATH_RE = /^[0-9a-f-]{36}\/(kueche_bild|angebot|grundriss)-[0-9a-f-]{36}\.(jpg|png|webp|heic|heif|pdf)$/;

async function actionAttachFiles(req: Request, sb: SupabaseClient, body: Record<string, unknown>) {
  const ip = clientIp(req);
  await enforceRateLimit(sb, `kw:lead-b-files:${ip}`, 3600, 30);

  const token = typeof body.upload_token === "string" ? body.upload_token : "";
  if (token.length < 20) throw new HttpError(401, "Der Upload-Link ist ungültig.", "upload_token");
  const { data: tokenRow } = await sb
    .from("lead_upload_tokens")
    .select("lead_id, expires_at")
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (!tokenRow || new Date(tokenRow.expires_at as string).getTime() < Date.now()) {
    throw new HttpError(401, "Der Upload-Link ist abgelaufen.", "upload_token");
  }
  const leadId = tokenRow.lead_id as string;

  const requested = (Array.isArray(body.files) ? body.files : []).slice(0, MAX_FILES).map(asRecord);
  const { data: objects, error: listErr } = await sb.storage.from(BUCKET).list(leadId, { limit: 100 });
  if (listErr) throw listErr;
  const stored = new Map((objects ?? []).map((o) => [`${leadId}/${o.name}`, o]));
  const { data: existingRows } = await sb.from("lead_files").select("file_url").eq("lead_id", leadId);
  const alreadyAttached = new Set((existingRows ?? []).map((r) => r.file_url as string));

  const rows = [];
  const missing: string[] = [];
  for (const f of requested) {
    const path = typeof f.path === "string" ? f.path : "";
    const object = stored.get(path);
    const size = Number((object?.metadata as Record<string, unknown> | undefined)?.size ?? f.size ?? 0);
    const category = path.split("/")[1]?.split("-")[0] ?? "";
    if (!path.startsWith(`${leadId}/`) || !STORED_PATH_RE.test(path) || !object || size > MAX_FILE_BYTES) {
      missing.push(path);
      continue;
    }
    if (alreadyAttached.has(path)) continue;
    const type = typeof f.type === "string" && FILE_EXTENSIONS[f.type.toLowerCase()] ? f.type.toLowerCase() : "application/octet-stream";
    rows.push({
      lead_id: leadId,
      file_url: path,
      file_name: cleanText(f.name, 120) ?? "datei",
      file_type: type,
      file_size_bytes: size || null,
      category,
    });
  }
  if (rows.length) {
    const { error } = await sb.from("lead_files").insert(rows);
    if (error) throw error;
  }
  if (missing.length) console.warn("[kw-lead-b] Dateien fehlen oder ungültig", leadId, missing.length);
  return jsonResponse(req, { ok: true, attached: rows.length, missing: missing.length });
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
