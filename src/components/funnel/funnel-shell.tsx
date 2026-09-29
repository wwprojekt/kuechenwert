import { AlertCircle, ArrowLeft, ArrowRight, BadgeEuro, Clock3, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FunnelFooter } from "@/components/funnel/funnel-footer";
import { FOCUS_RING, FunnelHeader } from "@/components/funnel/funnel-header";
import { FunnelProgress } from "@/components/funnel/funnel-progress";
import { useVirtualKeyboardOpen } from "@/hooks/useVirtualKeyboardOpen";
import { cn } from "@/lib/utils";

interface FunnelShellProps {
  children: ReactNode;
  /** Aktueller Schritt (0-basiert). */
  currentStep: number;
  totalSteps: number;
  /** Kurzes Kontext-Label über der Frage. */
  eyebrow: string;
  /** Die Frage des Schritts (h1). */
  question: string;
  hint?: string;
  onBack: () => void;
  /** Ohne onNext bringt der Schritt seinen eigenen Absende-Button mit (Kontakt). */
  onNext?: () => void;
  canProceed?: boolean;
  /** Hinweis, wenn „Weiter“ ohne Pflichtantwort geklickt wird. */
  blockedHint?: string;
  onBlocked?: () => void;
  nextLabel?: string;
  showExitIntent?: boolean;
}

const TRUST_ITEMS = [
  { icon: BadgeEuro, label: "Kostenlos & unverbindlich" },
  { icon: Clock3, label: "In ca. 3 Minuten fertig" },
  { icon: ShieldCheck, label: "Datenschutz nach DSGVO" },
];

function FunnelTrustStrip() {
  return (
    <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-ink-muted">
      {TRUST_ITEMS.map(({ icon: Icon, label }) => (
        <li key={label} className="inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}

function BackButton({ hidden, onClick, className }: { hidden: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={hidden}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink",
        FOCUS_RING,
        hidden && "invisible",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Zurück
    </button>
  );
}

function BlockedHint({ text, className }: { text: string; className?: string }) {
  return (
    <p role="alert" className={cn("items-center justify-center gap-2 text-sm font-medium text-destructive", className)}>
      <AlertCircle className="h-4 w-4 flex-none" aria-hidden="true" />
      {text}
    </p>
  );
}

function NextButton({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("btn-primary gap-1.5", FOCUS_RING, className)}>
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export function FunnelShell({
  children,
  currentStep,
  totalSteps,
  eyebrow,
  question,
  hint,
  onBack,
  onNext,
  canProceed = true,
  blockedHint = "Bitte wählen Sie eine Antwort aus.",
  onBlocked,
  nextLabel = "Weiter",
  showExitIntent = true,
}: FunnelShellProps) {
  const guardExit = showExitIntent && currentStep > 0;
  const isFirst = currentStep === 0;
  const keyboardOpen = useVirtualKeyboardOpen();
  const [blocked, setBlocked] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(currentStep);

  // Nach einem Schrittwechsel die neue Frage fokussieren (Tastatur, Screenreader),
  // außer ein Feld im Schritt hat sich den Fokus schon genommen (autoFocus).
  // Erst im nächsten Frame: PageTransition nimmt beim Pfadwechsel jeden Fokus weg.
  useEffect(() => {
    if (shownStep.current === currentStep) return;
    shownStep.current = currentStep;
    setBlocked(false);
    const active = document.activeElement;
    const target = active instanceof HTMLElement && sectionRef.current?.contains(active) ? active : headingRef.current;
    const frame = window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [currentStep]);

  useEffect(() => {
    if (canProceed) setBlocked(false);
  }, [canProceed]);

  // Wie bei CaravanWert bleibt „Weiter“ klickbar und sagt, was noch fehlt.
  const handleNext = () => {
    if (!onNext) return;
    if (!canProceed) {
      setBlocked(true);
      onBlocked?.();
      return;
    }
    onNext();
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-soft">
      <FunnelHeader guardExit={guardExit} guardUnload={guardExit} />

      <main data-funnel-telemetry="" className="flex flex-1 flex-col items-center px-4 py-6 sm:py-10 lg:py-14">
        <div className="w-full max-w-2xl">
          <FunnelProgress label="Ihre Küchenanfrage" current={currentStep} total={totalSteps} />
          <FunnelTrustStrip />

          <section
            key={currentStep}
            ref={sectionRef}
            aria-labelledby="funnel-question"
            className="mt-5 animate-step-in rounded-2xl border border-border bg-card p-5 shadow-card motion-reduce:animate-none sm:p-10"
          >
            {eyebrow && (
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">{eyebrow}</p>
            )}
            <h1
              id="funnel-question"
              ref={headingRef}
              tabIndex={-1}
              className="mx-auto mt-2 max-w-xl text-balance text-center font-display text-[1.625rem] font-bold leading-[1.15] tracking-tight-2 text-foreground focus:outline-none sm:text-[2rem]"
            >
              {question}
            </h1>
            {hint && (
              <p className="mx-auto mt-3 max-w-lg text-pretty text-center text-sm leading-relaxed text-ink-muted">{hint}</p>
            )}

            <div className="mt-6 sm:mt-8">{children}</div>

            {blocked && <BlockedHint text={blockedHint} className="mt-6 hidden sm:flex" />}

            <div className={cn("mt-8 items-center justify-between gap-4", onNext ? "hidden sm:flex" : "flex")}>
              <BackButton hidden={isFirst} onClick={onBack} />
              {onNext && <NextButton onClick={handleNext} label={nextLabel} />}
            </div>
          </section>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-subtle">
            Ihre Angaben werden verschlüsselt übertragen. Ihre Kontaktdaten erhalten nur freigeschaltete Küchenstudios –
            niemals andere Unternehmen zu Werbezwecken.
          </p>
        </div>
      </main>

      <FunnelFooter />

      {onNext && (
        <div
          className={cn(
            "sticky bottom-0 z-30 border-t border-border bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden",
            keyboardOpen && "hidden",
          )}
        >
          {/* Auf dem Handy direkt über „Weiter“, sonst läge der Hinweis unter den Kacheln außer Sicht. */}
          {blocked && <BlockedHint text={blockedHint} className="mb-2 flex" />}
          <div className="flex items-center justify-between gap-3">
            <BackButton hidden={isFirst} onClick={onBack} className="px-2" />
            <NextButton onClick={handleNext} label={nextLabel} className="flex-1" />
          </div>
        </div>
      )}
    </div>
  );
}
