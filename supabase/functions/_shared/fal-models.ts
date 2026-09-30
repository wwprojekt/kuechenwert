/**
 * Bildmodelle der KI-Visualisierung (fal.ai) – gemeinsam für kw-planner und
 * das Admin-Panel. Kosten sind Schätzungen nach der fal-Preisliste (Stand
 * 09/2026) für die Bildgröße, die kw-planner anfordert.
 *
 * Wählbar sind nur Modelle aus dieser Liste: resolveAiSettings ersetzt
 * unbekannte IDs aus kw_ai_settings durch die Standardmodelle.
 */

export type FalModelKind = "edit" | "text";
type FalModelFamily = "gemini" | "flux2" | "qwen" | "openai";

export interface FalModel {
  id: string;
  label: string;
  vendor: string;
  kind: FalModelKind;
  family: FalModelFamily;
  costCents: number;
  openWeights: boolean;
  supportsLora: boolean;
  note: string;
}

export const FAL_MODELS: readonly FalModel[] = [
  {
    id: "fal-ai/nano-banana-pro/edit",
    label: "Nano Banana Pro (Gemini 3 Pro Image)",
    vendor: "Google",
    kind: "edit",
    family: "gemini",
    costCents: 15,
    openWeights: false,
    supportsLora: false,
    note: "Höchste Raumtreue: Wände, Fenster und Perspektive bleiben erhalten.",
  },
  {
    id: "fal-ai/nano-banana-2/edit",
    label: "Nano Banana 2 (Gemini 3.1 Flash Image)",
    vendor: "Google",
    kind: "edit",
    family: "gemini",
    costCents: 12,
    openWeights: false,
    supportsLora: false,
    note: "Schneller und günstiger, erhält den Raum gut – erstes Ausweichmodell.",
  },
  {
    id: "fal-ai/flux-2-pro/edit",
    label: "FLUX.2 [pro] Edit",
    vendor: "Black Forest Labs",
    kind: "edit",
    family: "flux2",
    costCents: 14,
    openWeights: false,
    supportsLora: false,
    note: "Anderer Anbieter als Google, gestaltet den Raum aber freier um – letztes Ausweichmodell.",
  },
  {
    id: "openai/gpt-image-2.5/sunburst/edit",
    label: "GPT Image 2.5 Sunburst Edit",
    vendor: "OpenAI",
    kind: "edit",
    family: "openai",
    costCents: 6,
    openWeights: false,
    supportsLora: false,
    note: "Ändert nur, was verlangt ist: Licht, Belichtung und Raum bleiben am genauesten erhalten. Etwas langsamer, deutlich günstiger – Kandidat für den A/B-Vergleich.",
  },
  {
    id: "fal-ai/qwen-image-edit-plus-lora",
    label: "Qwen Image Edit Plus (offene Gewichte)",
    vendor: "Alibaba",
    kind: "edit",
    family: "qwen",
    costCents: 11,
    openWeights: true,
    supportsLora: true,
    note: "Offenes Modell, mit eigenem LoRA trainierbar – Grundlage für ein eigenes Modell.",
  },
  {
    id: "fal-ai/flux-2-pro",
    label: "FLUX.2 [pro]",
    vendor: "Black Forest Labs",
    kind: "text",
    family: "flux2",
    costCents: 5,
    openWeights: false,
    supportsLora: false,
    note: "Fotorealistische Innenräume ohne Foto, günstig.",
  },
  {
    id: "fal-ai/nano-banana-2",
    label: "Nano Banana 2",
    vendor: "Google",
    kind: "text",
    family: "gemini",
    costCents: 12,
    openWeights: false,
    supportsLora: false,
    note: "Anderer Anbieter als FLUX – geeignet als Ausweichmodell ohne Foto.",
  },
  {
    id: "fal-ai/nano-banana-pro",
    label: "Nano Banana Pro",
    vendor: "Google",
    kind: "text",
    family: "gemini",
    costCents: 15,
    openWeights: false,
    supportsLora: false,
    note: "Sehr detailliert, teurer als FLUX.2.",
  },
];

/**
 * Ausweichkette mit Foto: erst das Schwestermodell (Kapazitätsproblem eines
 * Modells, Raum bleibt erhalten), dann ein anderer Anbieter (Ausfall bei
 * Google, abgelehntes Foto).
 */
export const DEFAULT_AI_MODELS = {
  edit: "fal-ai/nano-banana-pro/edit",
  text: "fal-ai/flux-2-pro",
  fallbackEdit: "fal-ai/nano-banana-2/edit",
  fallbackEdit2: "fal-ai/flux-2-pro/edit",
  fallbackText: "fal-ai/nano-banana-2",
} as const;

export const DEFAULT_DAILY_RENDER_CAP = 300;
export const MAX_CHALLENGER_SHARE = 50;
/** Erstes Modell plus höchstens zwei Ausweichmodelle (CHECK planner_renders.attempt). */
export const MAX_ATTEMPTS = 3;

export function falModel(id: string | null | undefined, kind?: FalModelKind): FalModel | null {
  const model = FAL_MODELS.find((m) => m.id === id) ?? null;
  return model && (!kind || model.kind === kind) ? model : null;
}

export interface LoraRef {
  url: string;
  scale: number;
}

/** Request-Body für die fal-Queue je Modellfamilie. */
export function buildModelInput(
  model: FalModel,
  opts: { prompt: string; imageUrl?: string | null; lora?: LoraRef | null },
): Record<string, unknown> {
  const { prompt, imageUrl } = opts;
  if (model.kind === "edit" && !imageUrl) throw new Error(`${model.id}: Ausgangsbild fehlt`);
  switch (model.family) {
    case "gemini":
      return model.kind === "edit"
        ? {
            prompt,
            image_urls: [imageUrl],
            num_images: 1,
            aspect_ratio: "auto",
            resolution: "2K",
            output_format: "jpeg",
            safety_tolerance: "4",
            limit_generations: true,
          }
        : {
            prompt,
            num_images: 1,
            aspect_ratio: "3:2",
            resolution: "2K",
            output_format: "jpeg",
            safety_tolerance: "4",
            limit_generations: true,
          };
    case "flux2":
      return model.kind === "edit"
        ? { prompt, image_urls: [imageUrl], image_size: "auto", output_format: "jpeg", safety_tolerance: "2", enable_safety_checker: true }
        : { prompt, image_size: { width: 1536, height: 1024 }, output_format: "jpeg", safety_tolerance: "2", enable_safety_checker: true };
    case "qwen":
      return {
        prompt,
        image_urls: [imageUrl],
        num_images: 1,
        output_format: "jpeg",
        acceleration: "regular",
        enable_safety_checker: true,
        negative_prompt: "blurry, distorted perspective, warped walls, extra windows, people, text, watermark",
        loras: model.supportsLora && opts.lora ? [{ path: opts.lora.url, scale: opts.lora.scale }] : [],
      };
    case "openai":
      return model.kind === "edit"
        ? { prompt, image_urls: [imageUrl], num_images: 1, quality: "high", image_size: "auto", output_format: "jpeg" }
        : { prompt, num_images: 1, quality: "high", image_size: "landscape_4_3", output_format: "jpeg" };
  }
}

/** Zeile aus kw_ai_settings (alle Felder optional, Werte ungeprüft). */
export interface AiSettingsRow {
  edit_model?: string | null;
  text_model?: string | null;
  variant_model?: string | null;
  fallback_edit_model?: string | null;
  fallback_edit_model_2?: string | null;
  fallback_text_model?: string | null;
  challenger_edit_model?: string | null;
  challenger_share?: number | null;
  lora_url?: string | null;
  lora_scale?: number | string | null;
  daily_render_cap?: number | null;
}

export interface AiSettings {
  editModel: FalModel;
  textModel: FalModel;
  variantModel: FalModel;
  fallbackEdit: FalModel | null;
  fallbackEdit2: FalModel | null;
  fallbackText: FalModel | null;
  challengerEdit: FalModel | null;
  challengerShare: number;
  lora: LoraRef | null;
  dailyRenderCap: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function resolveAiSettings(row: AiSettingsRow | null | undefined): AiSettings {
  const r = row ?? {};
  const editModel = falModel(r.edit_model, "edit") ?? (falModel(DEFAULT_AI_MODELS.edit, "edit") as FalModel);
  const textModel = falModel(r.text_model, "text") ?? (falModel(DEFAULT_AI_MODELS.text, "text") as FalModel);
  const challenger = falModel(r.challenger_edit_model, "edit");
  const challengerEdit = challenger && challenger.id !== editModel.id ? challenger : null;
  const share = Number(r.challenger_share ?? 0);
  const scale = Number(r.lora_scale ?? 1);
  const cap = Number(r.daily_render_cap ?? DEFAULT_DAILY_RENDER_CAP);
  // Fehlt der Wert (Zeile nicht lesbar), gilt das Standard-Ausweichmodell; null heißt bewusst keins.
  const fallback = (value: string | null | undefined, defaultId: string, kind: FalModelKind) =>
    falModel(value === undefined ? defaultId : value, kind);
  return {
    editModel,
    textModel,
    variantModel: falModel(r.variant_model, "edit") ?? editModel,
    fallbackEdit: fallback(r.fallback_edit_model, DEFAULT_AI_MODELS.fallbackEdit, "edit"),
    fallbackEdit2: fallback(r.fallback_edit_model_2, DEFAULT_AI_MODELS.fallbackEdit2, "edit"),
    fallbackText: fallback(r.fallback_text_model, DEFAULT_AI_MODELS.fallbackText, "text"),
    challengerEdit,
    challengerShare: challengerEdit && Number.isFinite(share) ? clamp(Math.round(share), 0, MAX_CHALLENGER_SHARE) : 0,
    lora:
      typeof r.lora_url === "string" && /^https:\/\/\S+$/.test(r.lora_url)
        ? { url: r.lora_url, scale: Number.isFinite(scale) ? clamp(scale, 0, 2) : 1 }
        : null,
    dailyRenderCap: Number.isFinite(cap) ? clamp(Math.round(cap), 0, 5000) : DEFAULT_DAILY_RENDER_CAP,
  };
}

export type AbGroup = "control" | "challenger";

/** Feste A/B-Gruppe je Planung: gleichverteilt über die ersten 32 Bit der (zufälligen) Session-UUID. */
export function abGroup(sessionId: string, sharePercent: number): AbGroup {
  if (sharePercent <= 0) return "control";
  const bucket = parseInt(sessionId.replace(/-/g, "").slice(0, 8), 16) % 100;
  return Number.isFinite(bucket) && bucket < sharePercent ? "challenger" : "control";
}

/**
 * Modell für eine neue Visualisierung. Varianten bearbeiten immer ein fertiges
 * Bild. Die Vergleichsgruppe rechnet alles mit Foto einschließlich Varianten
 * mit dem Vergleichsmodell, sonst mischt der A/B-Vergleich beide Modelle.
 */
export function chooseModel(settings: AiSettings, opts: { mode: FalModelKind; variant: boolean; group: AbGroup | null }): FalModel {
  const challenger = opts.group === "challenger" ? settings.challengerEdit : null;
  if (opts.variant) return challenger ?? settings.variantModel;
  if (opts.mode === "text") return settings.textModel;
  return challenger ?? settings.editModel;
}

/**
 * Nächstes Modell der Ausweichkette nach dem gescheiterten `current`. `first`
 * ist das Modell des ersten Versuchs; es und bereits versuchte Modelle kommen
 * nicht noch einmal dran.
 */
export function nextFallback(settings: AiSettings, first: FalModel, current: FalModel): FalModel | null {
  const chain = (first.kind === "edit" ? [settings.fallbackEdit, settings.fallbackEdit2] : [settings.fallbackText]).filter(
    (m, i, all): m is FalModel => !!m && m.kind === first.kind && m.id !== first.id && all.findIndex((x) => x?.id === m.id) === i,
  );
  if (current.id === first.id) return chain[0] ?? null;
  const index = chain.findIndex((m) => m.id === current.id);
  return index >= 0 ? (chain[index + 1] ?? null) : null;
}

/** Wartezeiten, nach denen kw-planner auf das Ausweichmodell wechselt. */
export const FALLBACK_AFTER_MS = { queue: 45_000, progress: 150_000, unknown: 60_000 } as const;

export type AttemptState = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "UNKNOWN" | "ERROR";

/** Grund für einen Wechsel auf das Ausweichmodell, null = weiter warten bzw. fertig. */
export function fallbackReason(state: AttemptState, elapsedMs: number): string | null {
  switch (state) {
    case "ERROR":
      return "error";
    case "IN_QUEUE":
      return elapsedMs > FALLBACK_AFTER_MS.queue ? "queue_slow" : null;
    case "IN_PROGRESS":
      return elapsedMs > FALLBACK_AFTER_MS.progress ? "slow" : null;
    case "UNKNOWN":
      return elapsedMs > FALLBACK_AFTER_MS.unknown ? "status_unavailable" : null;
    case "COMPLETED":
      return null;
  }
}
