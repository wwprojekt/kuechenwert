import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BadgeEuro, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { FOCUS_RING, FunnelHeader } from "@/components/funnel/funnel-shell";
import { cn } from "@/lib/utils";

export interface FunnelBShellProps {
  children: ReactNode;
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
  stepDescription?: string;
  onBack: () => void;
  onNext: () => void;
  canProceed: boolean;
  isFinalStep?: boolean;
  isSubmitting?: boolean;
  nextLabel?: string;
  submitLabel?: string;
  /** optional sidebar content (Trust, Tipps) */
  sidebar?: ReactNode;
}

const TRUST_ITEMS = [
  { icon: BadgeEuro, label: "Kostenlos & unverbindlich" },
  { icon: Clock3, label: "In ca. 5 Minuten fertig" },
  { icon: ShieldCheck, label: "Nur geprüfte Küchenstudios" },
];

type StepNavProps = Pick<
  FunnelBShellProps,
  "currentStep" | "onBack" | "onNext" | "canProceed" | "isFinalStep" | "isSubmitting" | "nextLabel" | "submitLabel"
> & { compact?: boolean };

function StepNav({
  currentStep,
  onBack,
  onNext,
  canProceed,
  isFinalStep,
  isSubmitting,
  nextLabel,
  submitLabel,
  compact,
}: StepNavProps) {
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        disabled={currentStep === 0 || isSubmitting}
        className={cn("btn-ghost gap-1.5", compact && "px-2", FOCUS_RING, currentStep === 0 && "invisible")}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Zurück
      </button>
      {isFinalStep ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed || isSubmitting}
          className={cn("btn-accent gap-1.5", compact && "flex-1", FOCUS_RING)}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Wird gesendet…
            </>
          ) : (
            submitLabel
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className={cn("btn-primary gap-1.5", compact && "flex-1", FOCUS_RING)}
        >
          {nextLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </>
  );
}

export function FunnelBShell({
  children,
  currentStep,
  totalSteps,
  stepLabel,
  stepDescription,
  onBack,
  onNext,
  canProceed,
  isFinalStep = false,
  isSubmitting = false,
  nextLabel = "Weiter",
  submitLabel = "Anfrage absenden",
  sidebar,
}: FunnelBShellProps) {
  const percentage = Math.round(((currentStep + 1) / totalSteps) * 100);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(currentStep);

  // Nach einem Schrittwechsel die neue Frage fokussieren (Tastatur, Screenreader).
  useEffect(() => {
    if (shownStep.current === currentStep) return;
    shownStep.current = currentStep;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [currentStep]);

  const nav = { currentStep, onBack, onNext, canProceed, isFinalStep, isSubmitting, nextLabel, submitLabel };

  return (
    <div className="flex min-h-screen flex-col bg-surface-soft">
      <FunnelHeader />

      <main className="flex flex-1 justify-center px-4 py-6 sm:py-10 lg:py-14">
        <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_280px]">
          <div className="flex min-w-0 flex-col">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Angebots-Vergleich
              </span>
              <span className="text-xs font-medium tabular-nums text-ink-muted">
                Schritt {currentStep + 1} <span className="text-ink-muted">/ {totalSteps}</span>
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={currentStep + 1}
              aria-valuemin={1}
              aria-valuemax={totalSteps}
              aria-valuetext={`Schritt ${currentStep + 1} von ${totalSteps}`}
              aria-label="Fortschritt"
              className="h-[3px] w-full overflow-hidden rounded-full bg-neutral-200"
            >
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${percentage}%` }}
              />
            </div>

            <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-ink-muted">
              {TRUST_ITEMS.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>

            <section
              key={currentStep}
              aria-labelledby="funnel-question"
              className="mt-5 animate-step-in rounded-2xl border border-neutral-200 bg-white p-5 shadow-card motion-reduce:animate-none sm:p-10 lg:p-12"
            >
              {stepLabel && stepLabel !== stepDescription && (
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">{stepLabel}</p>
              )}
              <h1
                id="funnel-question"
                ref={headingRef}
                tabIndex={-1}
                className="mx-auto mt-2 max-w-xl text-balance text-center font-display text-[26px] font-bold leading-[1.15] tracking-tight-2 text-black focus:outline-none sm:text-[2rem] lg:text-[2.25rem]"
              >
                {stepDescription || stepLabel}
              </h1>

              <div className="mt-7 sm:mt-9">{children}</div>

              <div className="mt-9 hidden items-center justify-between gap-4 sm:flex">
                <StepNav {...nav} />
              </div>
            </section>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-subtle">
              Ihre Angaben werden verschlüsselt übertragen. Kein Spam, keine Weitergabe an Dritte ohne Ihre Zustimmung.
            </p>
          </div>

          {sidebar && <aside className="hidden flex-col gap-4 lg:flex">{sidebar}</aside>}
        </div>
      </main>

      <div className="sticky bottom-0 z-30 border-t border-border bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <StepNav {...nav} compact />
        </div>
      </div>
    </div>
  );
}
