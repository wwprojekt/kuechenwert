import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { FunnelFooter } from "@/components/funnel/funnel-footer";
import { FunnelHeader } from "@/components/funnel/funnel-header";
import { Button } from "@/components/ui/button";
import { useVirtualKeyboardOpen } from "@/hooks/useVirtualKeyboardOpen";
import { cn } from "@/lib/utils";
import type { KitchenEstimate } from "./core";
import { PLANNER_STEPS, type PlannerStep } from "./state";
import { PriceRange, PriceSummary } from "./components/PriceSummary";

const SAVED_IN_BROWSER = "Ihre Planung bleibt in diesem Browser gespeichert. Sie können später genau hier weitermachen.";

export function PlannerShell({
  step,
  maxVisitedIndex,
  estimate,
  estimateNote,
  onStep,
  onBack,
  onNext,
  nextLabel,
  showSummary,
  guardExit,
  children,
}: {
  step: PlannerStep;
  maxVisitedIndex: number;
  estimate: KitchenEstimate | null;
  estimateNote?: string | null;
  onStep: (step: PlannerStep) => void;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  showSummary: boolean;
  /** Logo-Klick fragt nach, sobald geplant wurde. */
  guardExit: boolean;
  children: ReactNode;
}) {
  const index = PLANNER_STEPS.findIndex((s) => s.id === step);
  const current = PLANNER_STEPS[index];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);
  const keyboardOpen = useVirtualKeyboardOpen();

  // Nach einem Schrittwechsel die neue Überschrift fokussieren (Tastatur, Screenreader).
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  return (
    <div className={cn("min-h-screen bg-gradient-to-b from-muted/40 via-background to-background", showSummary && "pb-28 lg:pb-0")}>
      <FunnelHeader
        guardExit={guardExit}
        savedHint={SAVED_IN_BROWSER}
        containerClassName="container"
        aside={
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:inline-flex">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" /> Kostenlos · automatisch gespeichert
          </span>
        }
      >
        <nav aria-label="Fortschritt" className="container pb-3">
          <ol className="flex gap-1.5">
            {PLANNER_STEPS.map((s, i) => {
              const reachable = i <= maxVisitedIndex;
              const done = i < index;
              const active = i === index;
              return (
                <li key={s.id} className="flex-1">
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => onStep(s.id)}
                    aria-current={active ? "step" : undefined}
                    aria-label={`Schritt ${i + 1}: ${s.label}${done ? " (erledigt)" : ""}`}
                    className="group -my-2.5 w-full py-2.5 text-left disabled:cursor-not-allowed md:my-0 md:py-0"
                  >
                    <span className={cn("block h-1.5 rounded-full transition-colors", done || active ? "bg-primary" : "bg-border")} />
                    <span
                      className={cn(
                        "mt-1.5 hidden items-center gap-1 text-xs font-medium md:flex",
                        active ? "text-foreground" : reachable ? "text-muted-foreground group-hover:text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {done && <Check className="h-3 w-3 text-primary" />}
                      {s.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </FunnelHeader>

      <main data-funnel-telemetry="" className="container py-6 sm:py-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Schritt {index + 1} von {PLANNER_STEPS.length}
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 text-2xl font-extrabold tracking-tight text-foreground focus:outline-none sm:text-3xl"
          >
            {current?.label}
          </h1>
        </div>

        <div className={cn(showSummary && "grid gap-8 lg:grid-cols-[1fr_340px]")}>
          <div>{children}</div>
          {showSummary && (
            <aside className="hidden lg:block">
              <div className="sticky top-32 space-y-4">
                <PriceSummary estimate={estimate} note={estimateNote} />
                <Button size="lg" className="h-12 w-full text-base font-semibold" onClick={onNext}>
                  {nextLabel} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                {index > 0 && (
                  <Button variant="ghost" className="w-full" onClick={onBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
                  </Button>
                )}
              </div>
            </aside>
          )}
        </div>

        {showSummary && (
          <div className="mt-10 hidden items-center justify-between border-t pt-6 lg:flex">
            {index > 0 ? (
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
              </Button>
            ) : (
              <span />
            )}
            <Button size="lg" onClick={onNext}>
              {nextLabel} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}
      </main>

      <FunnelFooter />

      {showSummary && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden safe-bottom",
            keyboardOpen && "hidden",
          )}
        >
          <div className="flex items-center gap-2 min-[380px]:gap-3">
            {index > 0 && (
              <Button variant="outline" size="icon" className="h-12 w-12 flex-none" onClick={onBack} aria-label="Zurück">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="min-w-0 flex-1">
              {estimate ? (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Geschätzt</p>
                  <p className="truncate text-[15px] font-extrabold text-foreground min-[380px]:text-base">
                    <PriceRange estimate={estimate} />
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preisschätzung</p>
                  <p className="truncate text-sm font-semibold text-muted-foreground">folgt nach diesem Schritt</p>
                </>
              )}
            </div>
            <Button size="lg" className="h-12 flex-none px-4 font-semibold min-[380px]:px-5" onClick={onNext}>
              Weiter <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
