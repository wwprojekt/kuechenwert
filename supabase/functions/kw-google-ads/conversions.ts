/**
 * Meldet echte Marktplatz-Umsätze als Offline-Conversions an Google Ads:
 *   { action: "upload-conversions", dryRun?: true }
 *
 * Warteschlange kw_gads_conversion_uploads (Migration
 * kw_google_ads_conversion_uploads, Cron stündlich): je Rechnung einer
 * Anfrage mit Google-Klick eine Zeile. Der Lauf sammelt neue Umsätze, liest
 * die Klick-IDs frisch am Lead (Löschung/Widerruf leert sie), meldet an
 * „Kontakt freigeschaltet“ bzw. „Auftrag vergeben“ und zieht Conversions
 * stornierter Rechnungen zurück. Gehashte Kontaktdaten nur, wenn das Konto
 * die Kundendaten-Bedingungen akzeptiert und Enhanced Conversions für Leads
 * aktiviert hat. dryRun: Google prüft nur (validateOnly), nichts wird verbucht.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  MAX_UPLOAD_ATTEMPTS,
  classifyUploadError,
  clickConversion,
  googleAdsDateTime,
  retryDelayHours,
  type UploadKind,
} from "../_shared/google-ads-conversions.ts";
import {
  describeGoogleAdsError,
  partialFailureDetails,
  type GoogleAdsClient,
  type GoogleAdsErrorDetail,
} from "../_shared/google-ads.ts";
import { OFFLINE_ACTION_NAMES } from "./setup.ts";

const BATCH_SIZE = 200;

interface QueueRow {
  invoice_id: string;
  lead_id: string;
  kind: UploadKind;
  order_id: string;
  value_eur: number;
  conversion_at: string;
  status: string;
  attempts: number;
}

interface LeadRow {
  id: string;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  email: string | null;
  phone: string | null;
  anonymized_at: string | null;
}

interface ResultRow {
  invoice_id: string;
  status: string;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
}

type Tally = Record<string, number>;

const describe = (d: GoogleAdsErrorDetail) => `${d.code}: ${d.message}`.slice(0, 500);
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

function dbError(step: string, error: { message?: string } | null): void {
  if (error) throw new Error(`${step}: ${error.message ?? "Datenbankfehler"}`);
}

async function uploadActions(client: GoogleAdsClient): Promise<Partial<Record<UploadKind, string>>> {
  const rows = await client.search(
    `SELECT conversion_action.resource_name, conversion_action.name FROM conversion_action
     WHERE conversion_action.type = 'UPLOAD_CLICKS' AND conversion_action.status = 'ENABLED'`,
  );
  const byName = new Map(
    rows.map((r) => {
      const a = (r.conversionAction ?? {}) as { name?: string; resourceName?: string };
      return [a.name ?? "", a.resourceName ?? ""] as const;
    }),
  );
  return { contact: byName.get(OFFLINE_ACTION_NAMES.contact), order: byName.get(OFFLINE_ACTION_NAMES.order) };
}

async function userIdentifiersAccepted(client: GoogleAdsClient): Promise<boolean> {
  const [row] = await client.search(
    `SELECT customer.conversion_tracking_setting.accepted_customer_data_terms,
       customer.conversion_tracking_setting.enhanced_conversions_for_leads_enabled FROM customer`,
  );
  const s = ((row?.customer ?? {}) as { conversionTrackingSetting?: Record<string, unknown> }).conversionTrackingSetting ?? {};
  return s.acceptedCustomerDataTerms === true && s.enhancedConversionsForLeadsEnabled === true;
}

/** Ergebnis einer Zeile nach einem Google-Fehler: erledigt, endgültig oder später erneut. */
function afterFailure(row: QueueRow, detail: GoogleAdsErrorDetail, kind: "upload" | "retract", tally: Tally): ResultRow {
  const attempts = row.attempts + 1;
  const outcome = classifyUploadError(detail.code);
  const base = { invoice_id: row.invoice_id, attempts, last_error: describe(detail), next_attempt_at: null };
  if (outcome === "done") {
    tally[kind === "upload" ? "uploaded" : "retracted"]++;
    return { ...base, status: kind === "upload" ? "uploaded" : "retracted", last_error: null };
  }
  if (outcome === "final") {
    tally[kind === "upload" ? "skipped" : "retractExpired"]++;
    return { ...base, status: kind === "upload" ? "skipped" : "retract_expired" };
  }
  if (attempts >= MAX_UPLOAD_ATTEMPTS) {
    tally[kind === "upload" ? "rejected" : "retractFailed"]++;
    return { ...base, status: kind === "upload" ? "rejected" : "retract_failed" };
  }
  tally.retrying++;
  return { ...base, status: kind === "upload" ? "failed" : "retract_pending", next_attempt_at: hoursFromNow(retryDelayHours(attempts)) };
}

async function sendBatch(
  client: GoogleAdsClient,
  method: "uploadClickConversions" | "uploadConversionAdjustments",
  field: "conversions" | "conversionAdjustments",
  items: Array<{ row: QueueRow; payload: Record<string, unknown> }>,
  kind: "upload" | "retract",
  dryRun: boolean,
  tally: Tally,
): Promise<ResultRow[]> {
  if (items.length === 0) return [];
  let failures: GoogleAdsErrorDetail[];
  try {
    const response = await client.callCustomer(method, {
      [field]: items.map((i) => i.payload),
      partialFailure: true,
      validateOnly: dryRun,
    });
    failures = partialFailureDetails(response);
  } catch (err) {
    const detail: GoogleAdsErrorDetail = { kind: "request", code: "REQUEST_FAILED", message: describeGoogleAdsError(err) };
    return items.map((i) => afterFailure(i.row, detail, kind, tally));
  }
  const byIndex = new Map<number, GoogleAdsErrorDetail>();
  for (const f of failures) if (f.operationIndex !== undefined && !byIndex.has(f.operationIndex)) byIndex.set(f.operationIndex, f);
  return items.map((item, index) => {
    const failure = byIndex.get(index);
    if (failure) return afterFailure(item.row, failure, kind, tally);
    tally[kind === "upload" ? "uploaded" : "retracted"]++;
    return {
      invoice_id: item.row.invoice_id,
      status: kind === "upload" ? "uploaded" : "retracted",
      attempts: item.row.attempts + 1,
      next_attempt_at: null,
      last_error: null,
    };
  });
}

export async function runUploadConversions(client: GoogleAdsClient, sb: SupabaseClient, dryRun: boolean) {
  const { error: collectError } = await sb.rpc("kw_gads_collect_conversions");
  dbError("Umsätze sammeln", collectError);
  const { data, error } = await sb
    .from("kw_gads_conversion_uploads")
    .select("invoice_id, lead_id, kind, order_id, value_eur, conversion_at, status, attempts")
    .in("status", ["pending", "failed", "retract_pending"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("conversion_at")
    .limit(BATCH_SIZE);
  dbError("Warteschlange lesen", error);
  const due = (data ?? []) as QueueRow[];
  if (due.length === 0) return { ok: true, dryRun, due: 0 };

  const actions = await uploadActions(client);
  if (!actions.contact || !actions.order) {
    return { ok: false, dryRun, due: due.length, error: 'Offline-Conversions fehlen in Google Ads – erst action "setup" ausführen.' };
  }
  const withIdentifiers = await userIdentifiersAccepted(client);
  const tally: Tally = { uploaded: 0, retracted: 0, skipped: 0, rejected: 0, retractExpired: 0, retractFailed: 0, retrying: 0 };
  const results: ResultRow[] = [];

  const uploads = due.filter((r) => r.status !== "retract_pending");
  const leadIds = [...new Set(uploads.map((r) => r.lead_id))];
  const { data: leadRows, error: leadError } = leadIds.length
    ? await sb.from("leads").select("id, gclid, gbraid, wbraid, email, phone, anonymized_at").in("id", leadIds)
    : { data: [], error: null };
  dbError("Leads lesen", leadError);
  const leads = new Map(((leadRows ?? []) as LeadRow[]).map((l) => [l.id, l]));

  const conversions: Array<{ row: QueueRow; payload: Record<string, unknown> }> = [];
  for (const row of uploads) {
    const lead = leads.get(row.lead_id);
    const payload = lead && !lead.anonymized_at
      ? await clickConversion(
          {
            orderId: row.order_id,
            valueEur: Number(row.value_eur),
            conversionAt: row.conversion_at,
            gclid: lead.gclid,
            gbraid: lead.gbraid,
            wbraid: lead.wbraid,
            email: lead.email,
            phone: lead.phone,
          },
          actions[row.kind]!,
          withIdentifiers,
        )
      : null;
    if (payload) {
      conversions.push({ row, payload });
    } else {
      tally.skipped++;
      results.push({
        invoice_id: row.invoice_id,
        status: "skipped",
        attempts: row.attempts,
        next_attempt_at: null,
        last_error: "Keine Klick-ID mehr am Lead (Widerruf oder Löschung)",
      });
    }
  }
  results.push(...(await sendBatch(client, "uploadClickConversions", "conversions", conversions, "upload", dryRun, tally)));

  const retractions = due
    .filter((r) => r.status === "retract_pending")
    .map((row) => ({
      row,
      payload: {
        conversionAction: actions[row.kind]!,
        adjustmentType: "RETRACTION",
        adjustmentDateTime: googleAdsDateTime(new Date()),
        orderId: row.order_id,
      },
    }));
  results.push(
    ...(await sendBatch(client, "uploadConversionAdjustments", "conversionAdjustments", retractions, "retract", dryRun, tally)),
  );

  if (!dryRun && results.length) {
    const { error: recordError } = await sb.rpc("kw_gads_record_upload_results", { p_results: results });
    dbError("Ergebnisse verbuchen", recordError);
  }
  return { ok: true, dryRun, due: due.length, userIdentifiers: withIdentifiers, ...tally };
}
