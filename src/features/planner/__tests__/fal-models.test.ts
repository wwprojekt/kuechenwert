import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_MODELS,
  FAL_MODELS,
  FALLBACK_AFTER_MS,
  abGroup,
  buildModelInput,
  chooseModel,
  falModel,
  fallbackReason,
  nextFallback,
  resolveAiSettings,
} from "../../../../supabase/functions/_shared/fal-models.ts";

describe("Modell-Registry", () => {
  it("hat eindeutige IDs und Standardmodelle der passenden Art", () => {
    expect(new Set(FAL_MODELS.map((m) => m.id)).size).toBe(FAL_MODELS.length);
    expect(falModel(DEFAULT_AI_MODELS.edit, "edit")).not.toBeNull();
    expect(falModel(DEFAULT_AI_MODELS.text, "text")).not.toBeNull();
    expect(falModel(DEFAULT_AI_MODELS.fallbackEdit, "edit")).not.toBeNull();
  });

  it("endet die Ausweichkette bei einem anderen Anbieter", () => {
    expect(falModel(DEFAULT_AI_MODELS.fallbackEdit2, "edit")?.vendor).not.toBe(falModel(DEFAULT_AI_MODELS.edit)?.vendor);
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

  it("rechnet in der Vergleichsgruppe alle Bilder mit Foto samt Varianten mit dem Vergleichsmodell", () => {
    const s = resolveAiSettings({ challenger_edit_model: "fal-ai/qwen-image-edit-plus-lora", challenger_share: 20, variant_model: "fal-ai/nano-banana-2/edit" });
    expect(chooseModel(s, { mode: "edit", variant: false, group: "challenger" }).id).toBe("fal-ai/qwen-image-edit-plus-lora");
    expect(chooseModel(s, { mode: "edit", variant: true, group: "challenger" }).id).toBe("fal-ai/qwen-image-edit-plus-lora");
    expect(chooseModel(s, { mode: "edit", variant: false, group: "control" }).id).toBe(DEFAULT_AI_MODELS.edit);
    expect(chooseModel(s, { mode: "edit", variant: true, group: "control" }).id).toBe("fal-ai/nano-banana-2/edit");
    expect(chooseModel(s, { mode: "edit", variant: true, group: null }).id).toBe("fal-ai/nano-banana-2/edit");
    expect(chooseModel(s, { mode: "text", variant: false, group: "challenger" }).id).toBe(DEFAULT_AI_MODELS.text);
  });

  it("nimmt Modelle anderer Anbieter-Präfixe aus der Registry an", () => {
    expect(resolveAiSettings({ edit_model: "openai/gpt-image-2.5/sunburst/edit" }).editModel.vendor).toBe("OpenAI");
    const s = resolveAiSettings({
      edit_model: "fal-ai/nano-banana-pro/edit",
      challenger_edit_model: "openai/gpt-image-2.5/sunburst/edit",
      challenger_share: 50,
    });
    expect(s.challengerEdit?.vendor).toBe("OpenAI");
    expect(s.challengerShare).toBe(50);
  });
});

describe("Ausweichkette", () => {
  const model = (id: string) => falModel(id)!;

  it("geht die Ausweichmodelle der Reihe nach durch, jedes von einem anderen Anbieter", () => {
    const s = resolveAiSettings(null);
    const first = s.editModel;
    const step1 = nextFallback(s, first, first)!;
    expect(step1.id).toBe(DEFAULT_AI_MODELS.fallbackEdit);
    const step2 = nextFallback(s, first, step1)!;
    expect(step2.id).toBe(DEFAULT_AI_MODELS.fallbackEdit2);
    expect(nextFallback(s, first, step2)).toBeNull();
    expect(new Set([first.vendor, step1.vendor, step2.vendor]).size).toBe(3);
  });

  it("versucht das erste Modell nie noch einmal und überspringt doppelte Einträge", () => {
    const s = resolveAiSettings({ fallback_edit_model: DEFAULT_AI_MODELS.edit, fallback_edit_model_2: DEFAULT_AI_MODELS.edit });
    expect(nextFallback(s, s.editModel, s.editModel)).toBeNull();
    const challenger = model(DEFAULT_AI_MODELS.fallbackEdit);
    const chain = resolveAiSettings(null);
    expect(nextFallback(chain, challenger, challenger)?.id).toBe(DEFAULT_AI_MODELS.fallbackEdit2);
  });

  it("nutzt ohne Foto das Textmodell-Ausweichen", () => {
    const s = resolveAiSettings(null);
    expect(nextFallback(s, s.textModel, s.textModel)?.id).toBe(DEFAULT_AI_MODELS.fallbackText);
    expect(nextFallback(s, s.textModel, model(DEFAULT_AI_MODELS.fallbackText))).toBeNull();
  });

  it("nutzt ohne lesbare Einstellungen die Standardkette, bei bewusst leerem Feld keine", () => {
    expect(resolveAiSettings(null).fallbackEdit?.id).toBe(DEFAULT_AI_MODELS.fallbackEdit);
    expect(resolveAiSettings(null).fallbackEdit2?.id).toBe(DEFAULT_AI_MODELS.fallbackEdit2);
    const none = resolveAiSettings({ fallback_edit_model: null, fallback_edit_model_2: null });
    expect(nextFallback(none, none.editModel, none.editModel)).toBeNull();
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

  it("fordert bei GPT Image hohe Qualität im Seitenverhältnis des Fotos an", () => {
    const input = buildModelInput(falModel("openai/gpt-image-2.5/sunburst/edit", "edit")!, { prompt: "x", imageUrl: url });
    expect(input).toMatchObject({ quality: "high", image_size: "auto", output_format: "jpeg", num_images: 1 });
  });
});
