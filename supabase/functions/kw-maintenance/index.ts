/**
 * kw-maintenance — Betriebsaufgaben, aufgerufen von pg_cron (Header
 * x-kw-cron-secret) oder manuell mit Service-Role/Admin.
 *
 *   { "task": "retention" }  täglich: Löschfristen. Leads werden erst nach dem
 *     Entfernen ihrer Dateien (Storage-API) anonymisiert, verwaiste
 *     Planer-Sitzungen samt Bildern gelöscht, abgelaufene KI-Trainingskopien
 *     entfernt, Betriebsdaten bereinigt (Fristen siehe Migration
 *     kw_maintenance_jobs).
 *   { "task": "health" }     stündlich: Outbox, Cron, HTTP-Aufrufe, offene
 *     Anfragen, blockierte Rechnungen, kritische Fehler, KI-Tageslimit,
 *     fehlschlagende, ausweichende oder hängende Visualisierungen, gesperrtes
 *     fal-Konto und Google Ads: API-Zugang (hält
 *     nebenbei den Refresh-Token aktiv, den Google nach 6 Monaten ohne
 *     Nutzung verfallen lässt), abgelehnte Anzeigen, Kosten ohne
 *     Conversion, gescheiterte Umsatzmeldungen. Hinweis-Mail an das
 *     Admin-Postfach, je Befund höchstens
 *     alle 12 Stunden.
 *   { "task": "price-calibration" } täglich 03:40 und aus dem Admin: gleicht
 *     die Preis-Engine mit den Studio-Angeboten ab (kitchen_price_calibration).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { expireTrainingSamples } from "../_shared/ai-training.ts";
import { checkCronOrServiceRoleOrAdmin } from "../_shared/auth.ts";
import { BRAND } from "../_shared/brand-config.ts";
import { logEdgeError } from "../_shared/edgeLogger.ts";
import { sendAdminEmail } from "../_shared/admin-mail.ts";
import { button, list, paragraph } from "../_shared/email-builder.ts";
import { estimateFunnelA, sanitizeFunnelAAnswers } from "../_shared/funnel-a-catalog.ts";
import { googleAdsHealth } from "../_shared/google-ads.ts";
import { sanitizeConfig, sanitizeRoom } from "../_shared/kitchen-catalog.ts";
import { calibrationFactor, calibrationFromRows, estimateKitchenPrice } from "../_shared/kitchen-pricing.ts";
import { HttpError, escapeHtml, jsonResponse, readJson, serve, serviceClient } from "../_shared/kw-http.ts";
import { accuracySummary, type AccuracyPoint } from "../_shared/price-accuracy.ts";
import { computeCalibration, observationWeight, type CalibrationObservation } from "../_shared/price-calibration.ts";
import { loadRateCard } from "../_shared/rate-card.ts";

const ALERT_WINDOW_SECONDS = 12 * 60 * 60;

type StorageFile = { bucket: string | null; path: string | null };

async function removeFiles(sb: SupabaseClient, files: StorageFile[]): Promise<number> {
  const byBucket = new Map<string, string[]>();
  for (const file of files) {
    if (!file.bucket || !file.path) continue;
    byBucket.set(file.bucket, [...(byBucket.get(file.bucket) ?? []), file.path]);
  }
  let removed = 0;
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      const { data, error } = await sb.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) throw new Error(`Storage ${bucket}: ${error.message}`);
      removed += data?.length ?? 0;
    }
  }
  return removed;
}

async function runRetention(sb: SupabaseClient) {
  const failures: string[] = [];
  let leadsAnonymized = 0;
  let filesRemoved = 0;

  const { data: dueLeads, error: dueError } = await sb.rpc("kw_retention_due_leads", { p_limit: 50 });
  if (dueError) throw dueError;
  for (const row of (dueLeads ?? []) as Array<{ lead_id: string; reason: string }>) {
    try {
      const { data: files, error: filesError } = await sb.rpc("kw_lead_storage_paths", { p_lead_id: row.lead_id });
      if (filesError) throw filesError;
      filesRemoved += await removeFiles(sb, (files ?? []) as StorageFile[]);
      const { error } = await sb.rpc("kw_anonymize_lead", { p_lead_id: row.lead_id, p_source: `retention:${row.reason}` });
      if (error) throw error;
      leadsAnonymized++;
    } catch (err) {
      failures.push(`Lead ${row.lead_id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let plannerSessionsDeleted = 0;
  const { data: stale, error: staleError } = await sb.rpc("kw_retention_stale_planner_files", { p_limit: 100 });
  if (staleError) throw staleError;
  const staleRows = (stale ?? []) as Array<StorageFile & { session_id: string }>;
  const sessionIds = [...new Set(staleRows.map((r) => r.session_id))];
  if (sessionIds.length > 0) {
    try {
      filesRemoved += await removeFiles(sb, staleRows);
      const { data: deleted, error } = await sb.rpc("kw_delete_planner_sessions", { p_ids: sessionIds });
      if (error) throw error;
      plannerSessionsDeleted = Number(deleted ?? 0);
    } catch (err) {
      failures.push(`Planer-Sitzungen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let trainingSamplesExpired = 0;
  try {
    trainingSamplesExpired = await expireTrainingSamples(sb);
  } catch (err) {
    failures.push(`KI-Trainingskopien: ${err instanceof Error ? err.message : String(err)}`);
  }

  const { data: cleanup, error: cleanupError } = await sb.rpc("kw_retention_cleanup");
  if (cleanupError) throw cleanupError;

  if (failures.length > 0) {
    await logEdgeError(sb, {
      component: "kw-maintenance",
      message: `Löschfristen: ${failures.length} Fehler`,
      severity: "high",
      category: "privacy",
      metadata: { failures: failures.slice(0, 20) },
    });
  }

  return {
    task: "retention",
    leadsAnonymized,
    plannerSessionsDeleted,
    trainingSamplesExpired,
    filesRemoved,
    cleanup,
    failures: failures.length,
  };
}

type ObservationRow = {
  funnel: string;
  postal_code: string | null;
  funnel_answers: Record<string, unknown> | null;
  kitchen_form: string | null;
  kitchen_style: string | null;
  planner_config: Record<string, unknown> | null;
  planner_room: Record<string, unknown> | null;
  observed_eur: number | string;
  bid_count: number | null;
  created_at: string | null;
  shown_min_eur: number | string | null;
  shown_max_eur: number | string | null;
  shown_mid_eur: number | string | null;
};

type Range = { min: number; max: number; mid: number };

/**
 * Rechnet jede Ausschreibung mit der aktuellen Engine und Rate-Card neu (ohne
 * bisherigen Abgleich) und vergleicht mit dem Median der Angebote. So wirken
 * Änderungen an Rate-Card oder Engine sofort, ohne doppelt zu korrigieren.
 * Jeder Lauf landet mit Treffsicherheit in kitchen_price_calibration_runs;
 * ist der Marktabgleich ausgeschaltet, bleiben die angewendeten Faktoren 1.
 */
async function runPriceCalibration(sb: SupabaseClient) {
  const { card } = await loadRateCard(sb);
  const { data: settings } = await sb.from("kw_ai_settings").select("price_calibration_enabled").eq("id", true).maybeSingle();
  const applied = settings?.price_calibration_enabled !== false;
  const { data, error } = await sb.rpc("kw_price_observations", { p_limit: 2000 });
  if (error) throw error;

  const now = Date.now();
  const observations: CalibrationObservation[] = [];
  const raw: Array<AccuracyPoint & { index: number }> = [];
  const shown: AccuracyPoint[] = [];
  for (const row of (data ?? []) as ObservationRow[]) {
    const observed = Number(row.observed_eur);
    if (!Number.isFinite(observed) || observed <= 0) continue;
    let estimate: Range;
    let segment: Pick<CalibrationObservation, "source" | "quality" | "postalCode">;
    if (row.funnel === "traumkueche" && row.planner_config) {
      const config = sanitizeConfig(row.planner_config);
      estimate = estimateKitchenPrice(config, sanitizeRoom(row.planner_room), { card, postalCode: row.postal_code });
      segment = { source: "c", quality: config.quality, postalCode: row.postal_code };
    } else if (row.funnel === "a") {
      const answers = sanitizeFunnelAAnswers({
        ...(row.funnel_answers ?? {}),
        kitchen_form: row.kitchen_form,
        kitchen_style: row.kitchen_style,
        postal_code: row.postal_code,
      });
      estimate = estimateFunnelA(answers, { card });
      segment = { source: "a", quality: null, postalCode: row.postal_code };
    } else {
      continue;
    }
    const ageDays = row.created_at ? (now - new Date(row.created_at).getTime()) / 86_400_000 : 0;
    observations.push({ ...segment, ratio: observed / estimate.mid, weight: observationWeight({ ageDays, offers: Number(row.bid_count ?? 1) }) });
    raw.push({ observed, min: estimate.min, max: estimate.max, mid: estimate.mid, index: observations.length - 1 });
    const s = { min: Number(row.shown_min_eur), max: Number(row.shown_max_eur), mid: Number(row.shown_mid_eur) };
    if (s.min > 0 && s.max > 0) shown.push({ observed, min: s.min, max: s.max, mid: s.mid > 0 ? s.mid : Math.sqrt(s.min * s.max) });
  }

  const rows = computeCalibration(observations);
  const learned = calibrationFromRows(rows.map((r) => ({ segment: r.segment, factor: r.factor, sample_count: r.sampleCount })));
  const calibrated = raw.map((p) => {
    const f = calibrationFactor(learned, observations[p.index]!);
    return { observed: p.observed, min: p.min * f, max: p.max * f, mid: p.mid * f };
  });
  const accuracy = { shown: accuracySummary(shown), raw: accuracySummary(raw), calibrated: accuracySummary(calibrated) };

  const updatedAt = new Date().toISOString();
  const { error: upsertError } = await sb.from("kitchen_price_calibration").upsert(
    rows.map((r) => ({
      segment: r.segment,
      factor: applied ? r.factor : 1,
      sample_count: r.sampleCount,
      observed_ratio: r.observedRatio,
      updated_at: updatedAt,
    })),
    { onConflict: "segment" },
  );
  if (upsertError) throw upsertError;
  const global = rows.find((r) => r.segment === "global");
  const { error: runError } = await sb.from("kitchen_price_calibration_runs").insert({
    applied,
    observations: observations.length,
    global_factor: global?.factor ?? 1,
    factors: rows,
    accuracy,
  });
  if (runError) console.error("[kw-maintenance] calibration run log failed", runError.message);
  return { task: "price-calibration", observations: observations.length, globalFactor: global?.factor ?? 1, applied, accuracy };
}

type Snapshot = Record<string, number>;

const FINDINGS: Array<{ key: string; text: (n: number) => string; link: string }> = [
  { key: "outbox_dead", text: (n) => `${n} Marktplatz-Ereignisse sind nach 8 Versuchen endgültig fehlgeschlagen (Mails oder Rechnungen fehlen).`, link: "/admin/cron-health" },
  { key: "outbox_stuck", text: (n) => `${n} Marktplatz-Ereignisse warten seit über 30 Minuten; die Worker laufen vermutlich nicht.`, link: "/admin/cron-health" },
  { key: "cron_failed", text: (n) => `${n} Cron-Läufe sind in den letzten 2 Stunden fehlgeschlagen.`, link: "/admin/cron-health" },
  { key: "http_failed", text: (n) => `${n} zeitgesteuerte Function-Aufrufe endeten in den letzten 2 Stunden mit Fehler oder Zeitüberschreitung.`, link: "/admin/cron-health" },
  { key: "leads_waiting", text: (n) => `${n} Küchenanfragen warten seit über 24 Stunden auf Bearbeitung.`, link: "/admin/leads" },
  { key: "invoices_blocked", text: (n) => `${n} Rechnungen hängen seit über einem Tag als Entwurf (z. B. fehlende Bankverbindung in den Einstellungen).`, link: "/admin/financials" },
  { key: "complaints_open", text: (n) => `${n} Reklamationen von Küchenstudios sind seit über 5 Tagen offen.`, link: "/admin/leads" },
  { key: "errors_critical", text: (n) => `${n} kritische Fehler in der letzten Stunde.`, link: "/admin/error-logs" },
  { key: "render_cap_near", text: (n) => `${n} KI-Visualisierungen in 24 Stunden – über 80 % des Tageslimits. Danach sehen Besucher keine Visualisierung mehr; Limit unter „KI & Preis-Engine“ prüfen.`, link: "/admin/ki" },
  { key: "renders_failing", text: (n) => `${n} KI-Visualisierungen sind in den letzten 2 Stunden fehlgeschlagen (fal.ai-Guthaben, API-Schlüssel und Modellstatus prüfen).`, link: "/admin/ki" },
  { key: "fal_account_blocked", text: () => "fal.ai lehnt Aufträge ab (Guthaben aufgebraucht, Konto oder Modell gesperrt, API-Schlüssel ungültig). Alle Bildmodelle laufen über dieses Konto, die Ausweichkette hilft hier nicht: Guthaben, Schlüssel und Modellzugriff im fal-Dashboard prüfen.", link: "/admin/ki" },
  { key: "renders_fallback_high", text: (n) => `${n} KI-Visualisierungen mussten in 24 Stunden auf ein Ausweichmodell wechseln (mindestens ein Viertel). Kund:innen warten länger und bekommen evtl. schwächere Bilder; Hauptmodell bei fal.ai prüfen (Störung, abgekündigt) und unter „KI & Preis-Engine“ ggf. umstellen.`, link: "/admin/ki" },
  { key: "renders_stuck", text: (n) => `${n} KI-Visualisierungen hängen seit über 10 Minuten; der Nachlauf (Cron kw-planner-sweep) arbeitet vermutlich nicht.`, link: "/admin/cron-health" },
  { key: "gads_api_failing", text: () => "Google Ads lehnt den API-Zugriff ab (Zugangsdaten gads_* im Supabase Vault prüfen, z. B. widerrufener Refresh-Token; Diagnose unter Einstellungen → Tracking). Die Conversion-Messung im Browser läuft unabhängig davon weiter.", link: "/admin/settings" },
  { key: "gads_ads_disapproved", text: (n) => `${n} Google-Ads-Anzeigen sind abgelehnt und laufen nicht. Grund in Google Ads unter Anzeigen prüfen; die Texte stehen im Kampagnenplan (google-ads-plan.ts).`, link: "/admin/settings" },
  { key: "gads_no_delivery", text: (n) => `Keine der ${n} aktiven Google-Ads-Kampagnen hatte gestern eine einzige Impression (erwartet nur, wenn sie gestern pausiert waren). In Google Ads Zahlung, Kontostatus und Richtlinienhinweise prüfen.`, link: "/admin/settings" },
  { key: "gads_spend_no_conversions", text: (n) => `${n} € Google-Ads-Kosten in 7 Tagen ohne eine einzige Küchenanfrage. Conversion-Tracking prüfen (Einstellungen → Tracking → Live-Diagnose) und Suchbegriffe ansehen.`, link: "/admin/settings" },
  { key: "gads_uploads_rejected", text: (n) => `${n} Rückmeldungen an Google Ads (geprüfte Anfragen oder Umsätze) sind in 24 Stunden endgültig gescheitert (Upload abgewiesen oder Rückzug nicht möglich). Grund steht in kw_gads_conversion_uploads.last_error; bis dahin lernen die Gebote mit unvollständigen Daten.`, link: "/admin/settings" },
];

async function firstAlertInWindow(sb: SupabaseClient, key: string): Promise<boolean> {
  const { data, error } = await sb.rpc("planner_rate_limit_increment", {
    p_key: `kw_health:${key}`,
    p_window_seconds: ALERT_WINDOW_SECONDS,
    p_limit: 1,
  });
  if (error) return true;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.allowed !== false;
}

async function runHealth(sb: SupabaseClient) {
  const { data, error } = await sb.rpc("kw_health_snapshot");
  if (error) throw error;
  const gads = await googleAdsHealth();
  const { count: rejectedUploads } = await sb
    .from("kw_gads_conversion_uploads")
    .select("source_id", { count: "exact", head: true })
    .in("status", ["rejected", "retract_failed"])
    .gte("updated_at", new Date(Date.now() - 86_400_000).toISOString());
  const snapshot: Snapshot = {
    ...((data ?? {}) as Snapshot),
    gads_api_failing: gads.reachable === false ? 1 : 0,
    gads_ads_disapproved: gads.disapprovedAds,
    gads_no_delivery: gads.campaignsWithoutDelivery,
    gads_spend_no_conversions: gads.spendWithoutConversionsEur,
    gads_uploads_rejected: rejectedUploads ?? 0,
  };
  const active = FINDINGS.filter((f) => Number(snapshot[f.key] ?? 0) > 0);

  const toReport: typeof active = [];
  for (const finding of active) {
    if (await firstAlertInWindow(sb, finding.key)) toReport.push(finding);
  }
  if (toReport.length === 0) return { task: "health", snapshot, alerted: [] };

  await sendAdminEmail(sb, {
    emailType: "ops_health_alert",
    subject: (site) => `Betriebshinweis: ${toReport.length === 1 ? "1 Befund" : `${toReport.length} Befunde`} – ${site}`,
    title: "Betriebshinweis",
    contentHtml:
      paragraph("Die stündliche Prüfung hat Folgendes gefunden:") +
      list(toReport.map((f) => escapeHtml(f.text(Number(snapshot[f.key]))))) +
      button("Zur Übersicht", `${BRAND.baseUrl}${toReport[0].link}`) +
      paragraph("Derselbe Befund wird frühestens nach 12 Stunden erneut gemeldet."),
  });

  return { task: "health", snapshot, alerted: toReport.map((f) => f.key) };
}

serve(async (req) => {
  const auth = await checkCronOrServiceRoleOrAdmin(req, {});
  if (!auth.authorized) throw new HttpError(401, "Nicht autorisiert.", "unauthorized");
  const { task } = await readJson<{ task?: string }>(req);
  const sb = serviceClient();
  if (task === "retention") return jsonResponse(req, await runRetention(sb));
  if (task === "health") return jsonResponse(req, await runHealth(sb));
  if (task === "price-calibration") return jsonResponse(req, await runPriceCalibration(sb));
  throw new HttpError(400, "Unbekannte Aufgabe.", "unknown_task");
});
