import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { errorMessage } from "@/features/marketplace/api-client";
import { MAX_CHALLENGER_SHARE, falModel } from "../../../supabase/functions/_shared/fal-models.ts";
import { fetchAiSettings, saveAiSettings, type AiSettingsUpdate } from "./api";
import { ModelSelect } from "./ModelSelect";

// Grenzen = CHECK-Constraints von kw_ai_settings
const schema = z.object({
  daily_render_cap: z.coerce.number().int().min(0, "Mindestens 0.").max(5000, "Höchstens 5.000."),
  lora_scale: z.coerce.number().min(0, "Mindestens 0.").max(2, "Höchstens 2."),
  lora_url: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Bitte eine https-Adresse angeben."),
});

type Form = Omit<AiSettingsUpdate, "daily_render_cap" | "lora_scale" | "lora_url"> & {
  daily_render_cap: string;
  lora_scale: string;
  lora_url: string;
};

export function AiModelSettingsCard() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["admin-ai-settings"], queryFn: fetchAiSettings });
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    setForm({
      edit_model: s.edit_model,
      text_model: s.text_model,
      variant_model: s.variant_model,
      fallback_edit_model: s.fallback_edit_model,
      fallback_edit_model_2: s.fallback_edit_model_2,
      fallback_text_model: s.fallback_text_model,
      challenger_edit_model: s.challenger_edit_model,
      challenger_share: s.challenger_share,
      daily_render_cap: String(s.daily_render_cap),
      lora_scale: String(s.lora_scale),
      lora_url: s.lora_url ?? "",
    });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: saveAiSettings,
    onSuccess: () => {
      toast.success("KI-Einstellungen gespeichert. Sie gelten ab der nächsten Visualisierung.");
      void qc.invalidateQueries({ queryKey: ["admin-ai-settings"] });
      void qc.invalidateQueries({ queryKey: ["admin-ai-stats"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!form) {
    return settings.isError ? (
      <p className="text-sm text-destructive">{errorMessage(settings.error)}</p>
    ) : (
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    );
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm({ ...form, [key]: value });
  const usesLora = [form.edit_model, form.variant_model, form.challenger_edit_model, form.fallback_edit_model, form.fallback_edit_model_2].some(
    (id) => falModel(id, "edit")?.supportsLora,
  );

  const onSave = () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    save.mutate({
      ...form,
      challenger_share: form.challenger_edit_model ? form.challenger_share : 0,
      daily_render_cap: parsed.data.daily_render_cap,
      lora_scale: parsed.data.lora_scale,
      lora_url: parsed.data.lora_url || null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Modelle und Kostenschutz</CardTitle>
        <CardDescription>
          Fällt ein Modell aus oder hängt die Warteschlange, wechselt der Planer automatisch auf das nächste Ausweichmodell: zuerst ein
          Schwestermodell, das den Raum gut erhält, zuletzt ein anderer Anbieter für den Fall eines Ausfalls.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <ModelSelect id="edit_model" label="Hauptmodell mit Raumfoto" kind="edit" value={form.edit_model} onChange={(v) => v && set("edit_model", v)} />
        <ModelSelect
          id="fallback_edit_model"
          label="1. Ausweichmodell mit Raumfoto"
          kind="edit"
          value={form.fallback_edit_model}
          onChange={(v) => set("fallback_edit_model", v)}
          emptyLabel="Kein Ausweichmodell"
          hint="Ohne Ausweichmodell scheitert die Visualisierung bei einer Störung."
        />
        <ModelSelect
          id="fallback_edit_model_2"
          label="2. Ausweichmodell mit Raumfoto"
          kind="edit"
          value={form.fallback_edit_model_2}
          onChange={(v) => set("fallback_edit_model_2", v)}
          emptyLabel="Kein zweites Ausweichmodell"
          hint="Am besten ein anderer Anbieter als Haupt- und 1. Ausweichmodell."
        />
        <ModelSelect
          id="variant_model"
          label="Modell für Varianten"
          kind="edit"
          value={form.variant_model}
          onChange={(v) => set("variant_model", v)}
          emptyLabel="Wie Hauptmodell"
          hint="Varianten ändern gezielt eine fertige Visualisierung."
        />
        <ModelSelect id="text_model" label="Modell ohne Foto" kind="text" value={form.text_model} onChange={(v) => v && set("text_model", v)} />
        <ModelSelect
          id="fallback_text_model"
          label="Ausweichmodell ohne Foto"
          kind="text"
          value={form.fallback_text_model}
          onChange={(v) => set("fallback_text_model", v)}
          emptyLabel="Kein Ausweichmodell"
        />
        <div className="space-y-1.5">
          <Label htmlFor="daily_render_cap">Tageslimit KI-Bilder</Label>
          <Input id="daily_render_cap" inputMode="numeric" value={form.daily_render_cap} onChange={(e) => set("daily_render_cap", e.target.value)} className="w-32" />
          <p className={errors.daily_render_cap ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {errors.daily_render_cap ?? "Je 24 Stunden über alle Besucher; 0 pausiert die Visualisierung. Ab 80 % kommt eine Hinweis-Mail."}
          </p>
        </div>

        <div className="space-y-4 rounded-xl border bg-muted/30 p-4 sm:col-span-2">
          <p className="text-sm font-semibold">A/B-Vergleich (Planungen mit Foto)</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <ModelSelect
              id="challenger_edit_model"
              label="Vergleichsmodell"
              kind="edit"
              value={form.challenger_edit_model}
              onChange={(v) => set("challenger_edit_model", v)}
              emptyLabel="Kein Vergleich"
              exclude={form.edit_model}
              hint="Ein Teil der Planungen mit Foto erhält dieses Modell für alle Bilder, auch für Varianten; Ergebnis oben unter „Leistung der KI“."
            />
            {form.challenger_edit_model && (
              <div className="space-y-3">
                <Label>Anteil: {form.challenger_share} %</Label>
                <Slider
                  value={[form.challenger_share]}
                  min={0}
                  max={MAX_CHALLENGER_SHARE}
                  step={5}
                  onValueChange={([v]) => set("challenger_share", v ?? 0)}
                  aria-label="Anteil des Vergleichsmodells"
                />
                <p className="text-xs text-muted-foreground">Jede Planung bleibt bei ihrer Gruppe. Höchstens 50 %.</p>
              </div>
            )}
          </div>
          {usesLora && (
            <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-1.5">
                <Label htmlFor="lora_url">Eigenes LoRA (URL der Gewichte)</Label>
                <Input id="lora_url" placeholder="https://…/kuechenwert-lora.safetensors" value={form.lora_url} onChange={(e) => set("lora_url", e.target.value)} />
                <p className={errors.lora_url ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                  {errors.lora_url ?? "Gilt für LoRA-fähige Modelle; leer = Basismodell."}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lora_scale">Stärke</Label>
                <Input id="lora_scale" inputMode="decimal" value={form.lora_scale} onChange={(e) => set("lora_scale", e.target.value)} />
                {errors.lora_scale && <p className="text-xs text-destructive">{errors.lora_scale}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="sm:col-span-2">
          <Button onClick={onSave} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
