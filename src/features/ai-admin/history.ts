import { falModel } from "../../../supabase/functions/_shared/fal-models.ts";
import { PLAN_READING_MODELS } from "../../../supabase/functions/_shared/plan-reading.ts";
import type { DailyStats, SettingsChange } from "./api";

export type HistoryBucket = "week" | "month";

export interface HistoryRow {
  key: string;
  label: string;
  sessions: number;
  leads: number;
  images: number;
  started: number;
  firstTrySuccess: number;
  fellBack: number;
  thumbsUp: number;
  thumbsDown: number;
  costCents: number;
  /** Tages-Mediane gewichtet mit ihren Bildern: eine Näherung, der echte Median ist nicht summierbar. */
  medianMs: number | null;
  /** Modell mit den meisten Bildern mit Foto. */
  mainModel: string | null;
}

function isoWeek(day: string): { year: number; week: number } {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return { year: date.getUTCFullYear(), week: Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7) };
}

function bucketOf(day: string, bucket: HistoryBucket): { key: string; label: string } {
  if (bucket === "week") {
    const { year, week } = isoWeek(day);
    return { key: `${year}-W${String(week).padStart(2, "0")}`, label: `KW ${week}/${year}` };
  }
  const key = day.slice(0, 7);
  const label = new Date(`${key}-01T00:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
  return { key, label };
}

/** Tageswerte zu Wochen oder Monaten zusammenfassen, neueste zuerst. */
export function aggregateHistory(days: DailyStats[], bucket: HistoryBucket): HistoryRow[] {
  type Acc = HistoryRow & { msSum: number; msWeight: number; modelImages: Map<string, number> };
  const byKey = new Map<string, Acc>();
  for (const { day, stats } of days) {
    const { key, label } = bucketOf(day, bucket);
    let row = byKey.get(key);
    if (!row) {
      row = {
        key,
        label,
        sessions: 0,
        leads: 0,
        images: 0,
        started: 0,
        firstTrySuccess: 0,
        fellBack: 0,
        thumbsUp: 0,
        thumbsDown: 0,
        costCents: 0,
        medianMs: null,
        mainModel: null,
        msSum: 0,
        msWeight: 0,
        modelImages: new Map(),
      };
      byKey.set(key, row);
    }
    row.sessions += stats.funnel?.sessions ?? 0;
    row.leads += stats.funnel?.leads ?? 0;
    row.costCents += stats.funnel?.cost_cents ?? 0;
    for (const m of stats.models ?? []) {
      row.images += m.images;
      row.started += m.started;
      row.firstTrySuccess += m.first_try_success;
      row.fellBack += m.fell_back;
      row.thumbsUp += m.thumbs_up;
      row.thumbsDown += m.thumbs_down;
      if (m.p50_ms && m.images > 0) {
        row.msSum += m.p50_ms * m.images;
        row.msWeight += m.images;
      }
      if (m.mode === "edit" && m.images > 0) row.modelImages.set(m.model, (row.modelImages.get(m.model) ?? 0) + m.images);
    }
  }
  return [...byKey.values()]
    .map(({ msSum, msWeight, modelImages, ...row }) => ({
      ...row,
      medianMs: msWeight > 0 ? Math.round(msSum / msWeight) : null,
      mainModel: [...modelImages.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

const FIELD_LABELS: Record<string, string> = {
  edit_model: "Hauptmodell mit Foto",
  text_model: "Modell ohne Foto",
  variant_model: "Varianten",
  fallback_edit_model: "1. Ausweichmodell",
  fallback_edit_model_2: "2. Ausweichmodell",
  fallback_text_model: "Ausweichmodell ohne Foto",
  challenger_edit_model: "Vergleichsmodell",
  challenger_share: "Anteil Vergleich",
  lora_url: "LoRA",
  lora_scale: "LoRA-Stärke",
  daily_render_cap: "Tageslimit",
  price_calibration_enabled: "Marktabgleich",
  plan_reading_enabled: "Planungen auslesen",
  plan_reading_model: "Modell zum Auslesen",
};

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "keins";
  if (typeof value === "boolean") return value ? "an" : "aus";
  if (key === "plan_reading_model") return PLAN_READING_MODELS.find((m) => m.id === value)?.label ?? String(value);
  if (typeof value === "string" && key.endsWith("_model")) return falModel(value)?.label ?? value;
  if (key === "challenger_share") return `${String(value)} %`;
  return String(value);
}

/** Eine Zeile je geänderter Einstellung, z. B. „Tageslimit: 300 → 400“. */
export function describeChanges(change: SettingsChange): string[] {
  return Object.entries(change.changes ?? {}).map(
    ([key, diff]) => `${FIELD_LABELS[key] ?? key}: ${formatValue(key, diff?.from)} → ${formatValue(key, diff?.to)}`,
  );
}
