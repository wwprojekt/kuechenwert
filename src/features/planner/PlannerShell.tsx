import { ArrowLeft, ArrowRight, Check, Phone, ShieldCheck } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SiteLogo } from "@/components/SiteLogo";
import { useSupportPhone } from "@/hooks/useSupportPhone";
import { cn } from "@/lib/utils";
import type { KitchenEstimate } from "./core";
import { PLANNER_STEPS, type PlannerStep } from "./state";
import { PriceRange, PriceSummary } from "./components/PriceSummary";

export function PlannerShell({
  step,
  maxVisitedIndex,
  estimate,
  onStep,
  onBack,
  onNext,
  nextLabel,
  showSummary,
  children,
}: {
  step: PlannerStep;
  maxVisitedIndex: number;
  estimate: KitchenEstimate;
  onStep: (step: PlannerStep) => void;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  showSummary: boolean;
  children: ReactNode;
}) {
  const phone = useSupportPhone();
  const index = PLANNER_STEPS.findIndex((s) => s.id === step);
  const current = PLANNER_STEPS[index];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);

  // Nach einem Schrittwechsel die neue Überschrift fokussieren (Tastatur, Screenreader).
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background pb-28 lg:pb-12">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <SiteLogo variant="icon-text-compact" />
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:inline-flex">
              <ShieldCheck className="h-4 w-4 text-primary" /> Kostenlos · automatisch gespeichert
            </span>
            <a
              href={phone.href}
              aria-label={`Anrufen: ${phone.display}`}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{phone.display}</span>
            </a>
          </div>
        </div>
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
                        "mt-1.5 hidden items-center gap-1 text-[11px] font-medium md:flex",
                        active ? "text-foreground" : reachable ? "text-muted-foreground group-hover:text-foreground" : "text-muted-foreground/50",
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
      </header>

      <main className="container py-6 sm:py-8">
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
                <PriceSummary estimate={estimate} />
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
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
                Zur Startseite
              </Link>
            )}
            <Button size="lg" onClick={onNext}>
              {nextLabel} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}
      </main>

      {showSummary && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden safe-bottom">
          <div className="flex items-center gap-2 min-[380px]:gap-3">
            {index > 0 && (
              <Button variant="outline" size="icon" className="h-12 w-12 flex-none" onClick={onBack} aria-label="Zurück">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Geschätzt</p>
              <p className="truncate text-[15px] font-extrabold text-foreground min-[380px]:text-base">
                <PriceRange estimate={estimate} />
              </p>
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
