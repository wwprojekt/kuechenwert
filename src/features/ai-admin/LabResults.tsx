import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfterSlider } from "@/features/planner/components/BeforeAfterSlider";
import { falModel } from "../../../supabase/functions/_shared/fal-models.ts";
import type { LabRender, LabRun } from "./api";

const usd = (cents: number | null) => (cents == null ? "–" : (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "USD" }));
const seconds = (ms: number | null) => (ms ? `${Math.round(ms / 1000)} s` : "–");

function Rating({ render, onRate }: { render: LabRender; onRate: (id: string, rating: 1 | -1 | null) => void }) {
  const button = (value: 1 | -1, label: string, Icon: typeof ThumbsUp) => (
    <Button
      type="button"
      size="icon"
      variant={render.rating === value ? "default" : "outline"}
      aria-label={label}
      aria-pressed={render.rating === value}
      className="h-8 w-8"
      onClick={() => onRate(render.id, render.rating === value ? null : value)}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
  return (
    <div className="flex gap-1.5">
      {button(1, "Realistisch", ThumbsUp)}
      {button(-1, "Nicht realistisch", ThumbsDown)}
    </div>
  );
}

/** Ergebnisse eines Testlaufs nebeneinander, jedes mit Vorher-nachher-Vergleich zum selben Foto. */
export function LabResults({ run, onRate }: { run: LabRun; onRate: (id: string, rating: 1 | -1 | null) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {run.renders.map((r) => (
        <div key={r.id} className="space-y-2 rounded-2xl border p-3">
          <p className="font-medium">{falModel(r.model)?.label ?? r.model}</p>
          {r.status === "success" && r.image_url && run.photo_url ? (
            <BeforeAfterSlider before={run.photo_url} after={r.image_url} beforeLabel="Foto" afterLabel="KI" className="aspect-[4/3]" />
          ) : r.status === "pending" ? (
            <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Wird erzeugt" />
            </div>
          ) : (
            <p className="rounded-2xl bg-muted p-4 text-sm text-destructive">{r.error ?? "Fehlgeschlagen"}</p>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {seconds(r.generation_ms)} · {usd(r.cost_cents)}
            </p>
            {r.status === "success" && <Rating render={r} onRate={onRate} />}
          </div>
        </div>
      ))}
    </div>
  );
}
