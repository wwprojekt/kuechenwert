import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_MODELS,
  FAL_MODELS,
  FALLBACK_AFTER_MS,
  abGroup,
  buildModelInput,
  chooseModel,
  falModel,
  fallbackFor,
  fallbackReason,
  resolveAiSettings,
} from "../../../../supabase/functions/_shared/fal-models.ts";

describe("Modell-Registry", () => {
  it("hat eindeutige IDs und Standardmodelle der passenden Art", () => {
    expect(new Set(FAL_MODELS.map((m) => m.id)).size).toBe(FAL_MODELS.length);
    expect(falModel(DEFAULT_AI_MODELS.edit, "edit")).not.toBeNull();
    expect(falModel(DEFAULT_AI_MODELS.text, "text")).not.toBeNull();
    expect(falModel(DEFAULT_AI_MODELS.fallbackEdit, "edit")?.vendor).not.toBe(falModel(DEFAULT_AI_MODELS.edit)?.vendor);
    expect(falModel(DEFAULT_AI_MODELS.fallbackText, "text")?.vendor).not.toBe(falModel(DEFAULT_AI_MODELS.text)?.vendor);
  });

  it("lehnt ein Bildbearbeitungsmodell als Textmodell ab", () => {
    expect(falModel("fal-ai/nano-banana-pro/edit", "text")).toBeNull();
  });
});

describe("resolveAiSettings", () => {
  it("ersetzt unbekannte oder falsche Modelle durch die Standardmodelle", () => {
    const s = resolveAiSettings({ edit_model: "fal-ai/gibt-es-nicht", text_model: "fal-ai/nano-banana-pro/edit" });
    expect(s.editModel.id).toBe(DEFAULT_AI_MODELS.edit);
    expect(s.textModel.id).toBe(DEFAULT_AI_MODELS.text);
    expect(s.variantModel.id).toBe(DEFAULT_AI_MODELS.edit);
    expect(s.dailyRenderCap).toBe(300);
  });

  it("ignoriert ein Vergleichsmodell, das dem Hauptmodell entspricht, und begrenzt den Anteil", () => {
    expect(resolveAiSettings({ challenger_edit_model: DEFAULT_AI_MODELS.edit, challenger_share: 30 }).challengerShare).toBe(0);
    const s = resolveAiSettings({ challenger_edit_model: "fal-ai/nano-banana-2/edit", challenger_share: 90 });
    expect(s.challengerEdit?.id).toBe("fal-ai/nano-banana-2/edit");
    expect(s.challengerShare).toBe(50);
  });

  it("übernimmt nur https-LoRAs und hält Tageslimit 0 als Pause", () => {
    expect(resolveAiSettings({ lora_url: "http://x.test/a.safetensors" }).lora).toBeNull();
    expect(resolveAiSettings({ lora_url: "https://x.test/a.safetensors", lora_scale: "0.8" }).lora).toEqual({
      url: "https://x.test/a.safetensors",
      scale: 0.8,
    });
    expect(resolveAiSettings({ daily_render_cap: 0 }).dailyRenderCap).toBe(0);
  });
});

describe("A/B-Zuteilung und Modellwahl", () => {
  const ids = Array.from({ length: 2000 }, (_, i) => `${(i * 2654435761 >>> 0).toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`);

  it("verteilt Planungen ungefähr im eingestellten Anteil und bleibt je Planung gleich", () => {
    const challengers = ids.filter((id) => abGroup(id, 20) === "challenger").length;
    expect(challengers / ids.length).toBeGreaterThan(0.15);
    expect(challengers / ids.length).toBeLessThan(0.25);
    expect(abGroup(ids[7]!, 20)).toBe(abGroup(ids[7]!, 20));
    expect(abGroup(ids[7]!, 0)).toBe("control");
  });

  it("nutzt das Vergleichsmodell nur für neue Visualisierungen mit Foto", () => {
    const s = resolveAiSettings({ challenger_edit_model: "fal-ai/qwen-image-edit-plus-lora", challenger_share: 20, variant_model: "fal-ai/nano-banana-2/edit" });
    expect(chooseModel(s, { mode: "edit", variant: false, group: "challenger" }).id).toBe("fal-ai/qwen-image-edit-plus-lora");
    expect(chooseModel(s, { mode: "edit", variant: false, group: "control" }).id).toBe(DEFAULT_AI_MODELS.edit);
    expect(chooseModel(s, { mode: "edit", variant: true, group: "challenger" }).id).toBe("fal-ai/nano-banana-2/edit");
    expect(chooseModel(s, { mode: "text", variant: false, group: "challenger" }).id).toBe(DEFAULT_AI_MODELS.text);
  });
});

describe("Ausweichmodell", () => {
  it("wechselt nie auf dasselbe Modell", () => {
    const s = resolveAiSettings({ fallback_edit_model: DEFAULT_AI_MODELS.edit });
    expect(fallbackFor(s, s.editModel)).toBeNull();
    const challenger = falModel("fal-ai/qwen-image-edit-plus-lora")!;
    expect(fallbackFor(s, challenger)?.id).toBe(DEFAULT_AI_MODELS.edit);
    expect(fallbackFor(resolveAiSettings(null), falModel(DEFAULT_AI_MODELS.text)!)?.id).toBe(DEFAULT_AI_MODELS.fallbackText);
  });

  it("nutzt ohne lesbare Einstellungen die Standard-Ausweichmodelle, bei bewusst leerem Feld keins", () => {
    expect(resolveAiSettings(null).fallbackEdit?.id).toBe(DEFAULT_AI_MODELS.fallbackEdit);
    expect(resolveAiSettings({ fallback_edit_model: null }).fallbackEdit).toBeNull();
  });

  it("wartet normale Laufzeiten ab und weicht bei Fehlern oder Stau aus", () => {
    expect(fallbackReason("ERROR", 0)).toBe("error");
    expect(fallbackReason("IN_QUEUE", FALLBACK_AFTER_MS.queue - 1)).toBeNull();
    expect(fallbackReason("IN_QUEUE", FALLBACK_AFTER_MS.queue + 1)).toBe("queue_slow");
    expect(fallbackReason("IN_PROGRESS", 60_000)).toBeNull();
    expect(fallbackReason("IN_PROGRESS", FALLBACK_AFTER_MS.progress + 1)).toBe("slow");
    expect(fallbackReason("UNKNOWN", FALLBACK_AFTER_MS.unknown + 1)).toBe("status_unavailable");
    expect(fallbackReason("COMPLETED", 999_999)).toBeNull();
  });
});

describe("buildModelInput", () => {
  const url = "https://example.test/raum.jpg";

  it("baut für jede Modellfamilie gültige Eingaben", () => {
    for (const model of FAL_MODELS) {
      const input = buildModelInput(model, { prompt: "Küche", imageUrl: url });
      expect(input.prompt).toBe("Küche");
      if (model.kind === "edit") expect(input.image_urls).toEqual([url]);
      else expect(input).not.toHaveProperty("image_urls");
    }
  });

  it("verlangt bei Bildbearbeitung ein Ausgangsbild und setzt das LoRA nur bei LoRA-Modellen", () => {
    expect(() => buildModelInput(falModel(DEFAULT_AI_MODELS.edit)!, { prompt: "x" })).toThrow();
    const lora = { url: "https://example.test/kw.safetensors", scale: 0.9 };
    expect(buildModelInput(falModel("fal-ai/qwen-image-edit-plus-lora")!, { prompt: "x", imageUrl: url, lora }).loras).toEqual([
      { path: lora.url, scale: 0.9 },
    ]);
    expect(buildModelInput(falModel(DEFAULT_AI_MODELS.edit)!, { prompt: "x", imageUrl: url, lora })).not.toHaveProperty("loras");
  });
});
