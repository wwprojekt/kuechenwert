import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage } from "@/features/marketplace/api-client";
import { KITCHEN_FORMS, STYLES } from "@/features/planner/core";
import { FAL_MODELS, falModel } from "../../../supabase/functions/_shared/fal-models.ts";
import { fetchAiSettings, labList, labRun, labStatus, labUploadPhoto, rateLabRender, type LabRun } from "./api";
import { LabResults } from "./LabResults";

const MAX_MODELS = 4;
const EDIT_MODELS = FAL_MODELS.filter((m) => m.kind === "edit");

/** Dasselbe Raumfoto mit mehreren Modellen und dem aktuellen Prompt, bevor Kund:innen ein neues Modell sehen. */
export function AiLabCard() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["admin-ai-settings"], queryFn: fetchAiSettings });
  const runs = useQuery({ queryKey: ["admin-ai-lab"], queryFn: labList });
  const [file, setFile] = useState<File | null>(null);
  const [style, setStyle] = useState("modern");
  const [form, setForm] = useState("l");
  const [picked, setPicked] = useState<string[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const defaults = useMemo(() => {
    const s = settings.data;
    const ids = [s?.edit_model, s?.challenger_edit_model, s?.fallback_edit_model, "openai/gpt-image-2.5/sunburst/edit"];
    return [...new Set(ids.filter((id): id is string => !!falModel(id, "edit")))].slice(0, MAX_MODELS);
  }, [settings.data]);
  const models = picked ?? defaults;
  const toggleModel = (id: string, on: boolean) =>
    setPicked((current) => {
      const base = current ?? defaults;
      return on ? [...new Set([...base, id])].slice(0, MAX_MODELS) : base.filter((m) => m !== id);
    });

  const runId = activeId ?? runs.data?.[0]?.run_id ?? null;
  const active = useQuery({
    queryKey: ["admin-ai-lab-run", runId],
    queryFn: () => labStatus(runId!),
    enabled: !!runId,
    initialData: () => runs.data?.find((r) => r.run_id === runId),
    refetchInterval: (query) => (query.state.data?.renders.some((r) => r.status === "pending") ? 3000 : false),
  });

  const start = useMutation({
    mutationFn: async (): Promise<LabRun> => {
      const photoPath = file ? await labUploadPhoto(file) : active.data?.photo_path;
      if (!photoPath) throw new Error("Bitte ein Testfoto wählen.");
      return labRun({ photoPath, models, style, form });
    },
    onSuccess: (run) => {
      qc.setQueryData(["admin-ai-lab-run", run.run_id], run);
      setActiveId(run.run_id);
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["admin-ai-lab"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const rate = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: 1 | -1 | null }) => rateLabRender(id, rating),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-ai-lab-run", runId] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const cost = models.reduce((sum, id) => sum + (falModel(id)?.costCents ?? 0), 0);
  const canStart = models.length > 0 && (!!file || !!active.data?.photo_path) && !start.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Modell-Testlauf</CardTitle>
        <CardDescription>
          Dasselbe Raumfoto mit mehreren Modellen und dem aktuellen Prompt: So sehen Sie vor dem A/B-Vergleich, welches Modell den Raum am
          echtesten erhält. Nur eigene, lizenzfreie oder eingewilligte Fotos verwenden. Zählt nicht zum Tageslimit, Testbilder werden nach
          90 Tagen gelöscht.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="lab-photo">Testfoto</Label>
            <Input id="lab-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {!file && active.data?.photo_path && <p className="text-xs text-muted-foreground">Ohne neues Foto: Foto des angezeigten Laufs.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lab-style">Stil</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger id="lab-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lab-form">Küchenform</Label>
            <Select value={form} onValueChange={setForm}>
              <SelectTrigger id="lab-form">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KITCHEN_FORMS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Modelle (höchstens {MAX_MODELS})</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {EDIT_MODELS.map((m) => {
              const checked = models.includes(m.id);
              return (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={checked} disabled={!checked && models.length >= MAX_MODELS} onCheckedChange={(v) => toggleModel(m.id, v === true)} />
                  {m.label} · {m.vendor}
                </label>
              );
            })}
          </div>
        </fieldset>

        <Button onClick={() => start.mutate()} disabled={!canStart}>
          {start.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
          Testlauf starten (ca. {(cost / 100).toLocaleString("de-DE", { style: "currency", currency: "USD" })})
        </Button>

        {(runs.data?.length ?? 0) > 1 && (
          <div className="flex flex-wrap gap-2">
            {runs.data!.map((r) => (
              <Button key={r.run_id} size="sm" variant={r.run_id === runId ? "default" : "outline"} onClick={() => setActiveId(r.run_id)}>
                {r.created_at ? new Date(r.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "Lauf"}
              </Button>
            ))}
          </div>
        )}
        {runs.isError && <p className="text-sm text-destructive">{errorMessage(runs.error)}</p>}
        {active.data && <LabResults run={active.data} onRate={(id, rating) => rate.mutate({ id, rating })} />}
      </CardContent>
    </Card>
  );
}
