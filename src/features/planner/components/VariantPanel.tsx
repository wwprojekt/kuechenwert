import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PlannerRender } from "../api";

const VARIANTS = [
  { label: "Wärmeres Licht", hint: "warm golden evening light, cosy atmosphere" },
  { label: "Mehr Holz", hint: "more visible natural wood on fronts, shelves and details" },
  { label: "Dunklere Fronten", hint: "darker, deeper front colour with the same material" },
  { label: "Hellere Fronten", hint: "lighter, brighter front colour with the same material" },
  { label: "Messing-Akzente", hint: "brushed brass handles, tap and lamp details" },
  { label: "Luftiger", hint: "lighter, more open and airy feeling with less clutter" },
];

export type VariantRequest = { label: string; hint: string };

/** Varianten der gewählten Visualisierung und Auswahl zwischen den Versionen. */
export function VariantPanel({
  renders,
  activeId,
  busy,
  refinesActive,
  onGenerate,
  onSelect,
}: {
  renders: PlannerRender[];
  activeId: string | null;
  busy: boolean;
  /** Ändert nur das Gewünschte an der gewählten Visualisierung. */
  refinesActive: boolean;
  onGenerate: (variant: VariantRequest) => void;
  onSelect: (id: string) => void;
}) {
  const [custom, setCustom] = useState("");

  return (
    <div className="space-y-4">
      {renders.length > 1 && (
        <div role="radiogroup" aria-label="Visualisierungen" className="flex gap-2 overflow-x-auto pb-1">
          {renders.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={r.id === activeId}
              onClick={() => onSelect(r.id)}
              className={cn(
                "relative grid h-16 w-24 flex-none place-items-center overflow-hidden rounded-lg border-2 bg-muted transition",
                r.id === activeId ? "border-primary" : "border-transparent hover:border-primary/40",
              )}
            >
              {r.image_url ? (
                <img src={r.image_url} alt={r.variant_label ?? `Version ${r.version}`} className="h-full w-full object-cover" />
              ) : r.status === "pending" ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Wird erstellt" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" aria-label="Fehlgeschlagen" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border bg-card p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" /> Variante ausprobieren
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {refinesActive
            ? "Ändert nur das Gewünschte an der ausgewählten Visualisierung – der Rest bleibt, wie er ist."
            : "Erstellt eine neue Visualisierung Ihrer aktuellen Planung mit diesem Wunsch."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {VARIANTS.map((v) => (
            <button
              key={v.label}
              type="button"
              disabled={busy}
              onClick={() => onGenerate(v)}
              className="min-h-10 rounded-full border-2 border-border bg-background px-3 text-sm font-medium transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + {v.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="variant-wish" className="sr-only">
            Eigener Wunsch
          </label>
          <Textarea
            id="variant-wish"
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, 300))}
            placeholder="Eigener Wunsch, z. B. „Insel mit Sitzplätzen“ oder „Arbeitsplatte in Eiche“"
            rows={2}
            className="min-h-[44px] resize-none"
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy || custom.trim().length < 3}
            onClick={() => {
              onGenerate({ label: "Eigener Wunsch", hint: custom.trim() });
              setCustom("");
            }}
            className="h-auto sm:w-40"
          >
            Variante erstellen
          </Button>
        </div>
      </div>
    </div>
  );
}
