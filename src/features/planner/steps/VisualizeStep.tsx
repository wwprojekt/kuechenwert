import { AlertTriangle, ImageIcon, Loader2, RefreshCcw, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PlannerRender } from "../api";
import type { KitchenEstimate } from "../core";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider";
import { PriceSummary } from "../components/PriceSummary";

const VARIANTS = [
  { label: "Wärmeres Licht", hint: "warm golden evening light, cosy atmosphere" },
  { label: "Mehr Holz", hint: "more visible natural wood on fronts, shelves and details" },
  { label: "Dunklere Fronten", hint: "darker, deeper front colour with the same material" },
  { label: "Hellere Fronten", hint: "lighter, brighter front colour with the same material" },
  { label: "Messing-Akzente", hint: "brushed brass handles, tap and lamp details" },
  { label: "Luftiger", hint: "lighter, more open and airy feeling with less clutter" },
];

const PROGRESS_MESSAGES = [
  "Wir analysieren Raum, Perspektive und Licht …",
  "Schränke, Fronten und Arbeitsplatte werden eingesetzt …",
  "Geräte und Details werden platziert …",
  "Letzter Feinschliff an Licht und Materialien …",
];

function ProgressPanel() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1)), 7000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="relative grid h-16 w-16 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <Wand2 className="relative h-8 w-8 text-primary" />
      </div>
      <p className="text-base font-semibold text-foreground" aria-live="polite">
        {PROGRESS_MESSAGES[index]}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">Das dauert meist 20–40 Sekunden. Sie können währenddessen die Preisaufstellung ansehen.</p>
    </div>
  );
}

export function VisualizeStep({
  renders,
  activeRenderId,
  beforePhotoUrl,
  estimate,
  wishes,
  generating,
  error,
  onGenerate,
  onSelectRender,
  onWishes,
  onContinue,
}: {
  renders: PlannerRender[];
  activeRenderId: string | null;
  beforePhotoUrl: string | null;
  estimate: KitchenEstimate;
  wishes: string;
  generating: boolean;
  error: string | null;
  onGenerate: (variant?: { label: string; hint: string }) => void;
  onSelectRender: (id: string) => void;
  onWishes: (value: string) => void;
  onContinue: () => void;
}) {
  const [customHint, setCustomHint] = useState("");
  const autoStarted = useRef(false);
  const active = renders.find((r) => r.id === activeRenderId) ?? renders[renders.length - 1] ?? null;
  const anyPending = renders.some((r) => r.status === "pending");
  const inputPhoto = beforePhotoUrl;

  useEffect(() => {
    if (autoStarted.current || renders.length > 0 || generating) return;
    autoStarted.current = true;
    onGenerate();
  }, [renders.length, generating, onGenerate]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
      <div className="space-y-4">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-muted/40">
          {active?.status === "success" && active.image_url ? (
            active.mode === "edit" && inputPhoto ? (
              <BeforeAfterSlider before={inputPhoto} after={active.image_url} beforeLabel="Ihr Raum heute" afterLabel="Ihre neue Küche" className="h-full w-full" />
            ) : (
              <img src={active.image_url} alt="KI-Visualisierung Ihrer neuen Küche" className="h-full w-full object-cover" />
            )
          ) : active?.status === "pending" || (generating && !active) ? (
            <ProgressPanel />
          ) : active?.status === "failed" || error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <AlertTriangle className="h-9 w-9 text-destructive" />
              <p className="font-semibold text-foreground">{error ?? active?.error ?? "Die Visualisierung ist fehlgeschlagen."}</p>
              <Button onClick={() => onGenerate()} disabled={generating}>
                <RefreshCcw className="mr-2 h-4 w-4" /> Erneut versuchen
              </Button>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <ImageIcon className="h-9 w-9 text-muted-foreground" />
              <Button onClick={() => onGenerate()} disabled={generating} size="lg">
                <Wand2 className="mr-2 h-5 w-5" /> Visualisierung erstellen
              </Button>
            </div>
          )}
          {active?.variant_label && active.status === "success" && (
            <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">{active.variant_label}</span>
          )}
        </div>

        {renders.length > 1 && (
          <div role="radiogroup" aria-label="Visualisierungen" className="flex gap-2 overflow-x-auto pb-1">
            {renders.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={r.id === active?.id}
                onClick={() => onSelectRender(r.id)}
                className={cn(
                  "relative h-16 w-24 flex-none overflow-hidden rounded-lg border-2 bg-muted transition",
                  r.id === active?.id ? "border-primary" : "border-transparent hover:border-primary/40",
                )}
              >
                {r.image_url ? (
                  <img src={r.image_url} alt={r.variant_label ?? `Version ${r.version}`} className="h-full w-full object-cover" />
                ) : r.status === "pending" ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                ) : (
                  <AlertTriangle className="mx-auto h-5 w-5 text-destructive" />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-2xl border bg-card p-4 sm:p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-accent" /> Variante ausprobieren
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {VARIANTS.map((v) => (
              <button
                key={v.label}
                type="button"
                disabled={generating || anyPending}
                onClick={() => onGenerate(v)}
                className="rounded-full border-2 border-border bg-background px-3 py-1.5 text-sm font-medium transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + {v.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Textarea
              value={customHint}
              onChange={(e) => setCustomHint(e.target.value.slice(0, 300))}
              placeholder="Eigener Wunsch, z. B. „Insel mit Sitzplätzen“ oder „Arbeitsplatte in Eiche“"
              rows={2}
              className="min-h-[44px] resize-none"
            />
            <Button
              type="button"
              variant="outline"
              disabled={generating || anyPending || customHint.trim().length < 3}
              onClick={() => {
                onGenerate({ label: "Eigener Wunsch", hint: customHint.trim() });
                setCustomHint("");
              }}
              className="h-auto sm:w-40"
            >
              Variante erstellen
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 sm:p-5">
          <label htmlFor="wishes" className="text-sm font-semibold text-foreground">
            Hinweise für die Küchenstudios (optional)
          </label>
          <Textarea
            id="wishes"
            value={wishes}
            onChange={(e) => onWishes(e.target.value.slice(0, 500))}
            placeholder="z. B. Heizkörper unter dem Fenster bleibt, Wasseranschluss an Wand B, Wunschtermin für die Montage …"
            rows={3}
            className="mt-2"
          />
        </div>
      </div>

      <div className="space-y-4">
        <PriceSummary estimate={estimate} defaultOpen />
        <Button size="lg" className="h-12 w-full text-base font-semibold" onClick={onContinue}>
          Angebote von Studios erhalten
        </Button>
        <p className="text-center text-xs text-muted-foreground">Kostenlos und unverbindlich · Sie entscheiden, welches Studio den Auftrag bekommt</p>
      </div>
    </div>
  );
}
