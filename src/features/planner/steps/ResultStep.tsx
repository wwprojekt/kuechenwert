import { AlertTriangle, CheckCircle2, ImageIcon, PencilLine, RefreshCcw, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ConsentCheckbox } from "@/features/funnel-a/components/ContactFields";
import type { RenderFeedbackReason } from "../../../../supabase/functions/_shared/render-feedback.ts";
import type { PlannerRender, RenderFeedback as Feedback } from "../api";
import { AiBadge } from "../components/AiBadge";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider";
import { PriceSummary } from "../components/PriceSummary";
import { RenderFeedback } from "../components/RenderFeedback";
import { useRenderPercent } from "../components/RenderProgress";
import { VariantPanel, type VariantRequest } from "../components/VariantPanel";
import type { KitchenEstimate } from "../core";
import { VisualizingStep } from "./VisualizingStep";

interface ResultStepProps {
  renders: PlannerRender[];
  active: PlannerRender | null;
  beforePhotoUrl: string | null;
  estimate: KitchenEstimate;
  generating: boolean;
  error: string | null;
  /** Die gewählte Visualisierung zeigt eine ältere Auswahl als die aktuelle Planung. */
  outdated: boolean;
  startedAt: number | null;
  offersRequested: boolean;
  onGenerate: (variant?: VariantRequest) => void;
  onSelectRender: (id: string) => void;
  onFeedback: (renderId: string, value: Feedback, reasons: RenderFeedbackReason[]) => void;
  onRequestOffers: () => void;
  onAdjust: () => void;
  onNewPlanning: () => void;
  aiTraining: { granted: boolean; busy: boolean; onChange: (granted: boolean) => void } | null;
}

function RenderView({ active, beforePhotoUrl, generating, error, startedAt, onGenerate }: Pick<ResultStepProps, "active" | "beforePhotoUrl" | "generating" | "error" | "startedAt" | "onGenerate">) {
  const pending = active?.status === "pending" || (generating && !active);
  const percent = useRenderPercent(pending ? "pending" : active?.status === "success" ? "ready" : "idle", startedAt);

  if (active?.status === "success" && active.image_url) {
    return (
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-muted/40 shadow-card xshort:aspect-[16/10]">
        {active.mode === "edit" && beforePhotoUrl ? (
          <BeforeAfterSlider before={beforePhotoUrl} after={active.image_url} beforeLabel="Ihr Raum heute" afterLabel="Ihre neue Küche" className="h-full w-full" />
        ) : (
          <img src={active.image_url} alt="KI-Visualisierung Ihrer neuen Küche" className="h-full w-full object-cover" />
        )}
        {active.variant_label && (
          <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">{active.variant_label}</span>
        )}
        <AiBadge className="bottom-3 right-3" />
      </div>
    );
  }
  if (pending) return <VisualizingStep percent={percent} photoUrl={beforePhotoUrl} error={null} />;
  return (
    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl border bg-muted/40 p-6 text-center short:aspect-[16/10]">
      {active?.status === "failed" || error ? (
        <AlertTriangle className="h-9 w-9 text-destructive" aria-hidden="true" />
      ) : (
        <ImageIcon className="h-9 w-9 text-muted-foreground" aria-hidden="true" />
      )}
      <p className="font-semibold text-foreground">{error ?? active?.error ?? (active ? "Die Visualisierung ist fehlgeschlagen." : "Noch keine Visualisierung")}</p>
      <Button onClick={() => onGenerate()} disabled={generating}>
        {active ? <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" /> : <Wand2 className="mr-2 h-4 w-4" aria-hidden="true" />}
        {active ? "Erneut versuchen" : "Jetzt visualisieren"}
      </Button>
    </div>
  );
}

const OFFER_STEPS = [
  "Geprüfte Küchenstudios aus Ihrer Region sehen Ihre Planung – ohne Ihren Namen und Ihre Kontaktdaten.",
  "Mehrere Studios können Ihnen ein unverbindliches Angebot machen. Jedes schicken wir Ihnen per E-Mail.",
  "Sie vergleichen auf Ihrer Projektseite und entscheiden in Ruhe – ohne Kaufzwang.",
];

/** Ergebnis nach der Kontakterfassung: Küche, Preis und was mit den Angeboten passiert. */
export function ResultStep(props: ResultStepProps) {
  const { renders, active, estimate, generating, outdated, offersRequested, onGenerate, onSelectRender, onFeedback, onRequestOffers, onAdjust, onNewPlanning, aiTraining } = props;
  const anyPending = renders.some((r) => r.status === "pending");
  const finished = renders.filter((r) => r.status === "success" || r.status === "pending");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
      <div className="space-y-4">
        {outdated && active?.status === "success" && !anyPending && (
          <div role="status" className="flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-foreground">Sie haben Ihre Planung geändert. Die Visualisierung zeigt noch die vorherige Auswahl.</p>
            <Button type="button" size="sm" onClick={() => onGenerate()} disabled={generating} className="flex-none">
              <Wand2 className="mr-2 h-4 w-4" aria-hidden="true" /> Neu visualisieren
            </Button>
          </div>
        )}
        <RenderView {...props} />
        {/* Auf dem Handy direkt unter dem Bild: Küche und Preis auf einen Blick. */}
        <div className="lg:hidden">
          <PriceSummary estimate={estimate} compact />
        </div>
        {active?.status === "success" && active.image_url && (
          <>
            <p className="text-xs text-muted-foreground">
              Die KI-Visualisierung zeigt Stil, Farben und Materialien. Maße und Details plant das Küchenstudio vor Ort genau.
            </p>
            <RenderFeedback
              value={active.feedback ?? null}
              reasons={active.feedback_reasons ?? []}
              onChange={(value, reasons) => onFeedback(active.id, value, reasons)}
            />
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="hidden lg:block">
          <PriceSummary estimate={estimate} />
        </div>
        {offersRequested ? (
          <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <CheckCircle2 className="h-5 w-5 flex-none text-success" aria-hidden="true" /> Ihre kostenlosen Angebote sind angefragt
            </p>
            <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {OFFER_STEPS.map((text, i) => (
                <li key={text} className="flex gap-2">
                  <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-success/15 text-xs font-bold text-success">{i + 1}</span>
                  {text}
                </li>
              ))}
            </ol>
            <Button asChild className="mt-3 w-full">
              <Link to="/projekt">Zu meiner Projektseite</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <p className="font-semibold text-foreground">Was verlangen Studios wirklich für diese Küche?</p>
            <p className="mt-1 text-sm text-muted-foreground">Holen Sie kostenlos und unverbindlich Angebote geprüfter Küchenstudios aus Ihrer Region ein.</p>
            <Button className="mt-3 hidden w-full sm:inline-flex" onClick={onRequestOffers}>
              Kostenlose Angebote anfordern
            </Button>
            <Link to="/projekt" className="mt-2 block text-center text-sm font-medium text-primary underline underline-offset-2">
              Zu meiner Projektseite
            </Link>
          </div>
        )}
        {aiTraining && (
          <div className="rounded-2xl border bg-card p-4">
            <ConsentCheckbox id="ai-training" checked={aiTraining.granted} onChange={(granted) => !aiTraining.busy && aiTraining.onChange(granted)}>
              Meine Raumfotos und Bewertungen dürfen ohne Namen und Kontaktdaten gespeichert werden, um die KI-Visualisierung von KüchenWert zu
              verbessern – auch für das Training eigener Modelle. Höchstens 36 Monate, Widerruf jederzeit auf der Projektseite.
            </ConsentCheckbox>
          </div>
        )}
      </div>

      {finished.length > 0 && (
        <div className="lg:col-span-2">
          <VariantPanel
            renders={renders}
            activeId={active?.id ?? null}
            busy={generating || anyPending}
            refinesActive={active?.status === "success" && !outdated}
            onGenerate={onGenerate}
            onSelect={onSelectRender}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm lg:col-span-2">
        <button type="button" onClick={onAdjust} className="inline-flex min-h-10 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline">
          <PencilLine className="h-4 w-4" aria-hidden="true" /> Planung ändern
        </button>
        <button type="button" onClick={onNewPlanning} className="min-h-10 font-medium text-muted-foreground underline-offset-4 hover:underline">
          Neue Küche planen
        </button>
      </div>
    </div>
  );
}
