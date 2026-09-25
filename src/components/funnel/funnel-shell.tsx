import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { ArrowLeft, ArrowRight, BadgeEuro, Clock3, Phone, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteLogo } from "@/components/SiteLogo";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";

const FALLBACK_SUPPORT_PHONE = "+49 511 51532476";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

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
  nextLabel?: string;
  showExitIntent?: boolean;
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const percentage = Math.min(100, Math.round(((current + 1) / total) * 100));
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          Ihre Küchenanfrage
        </span>
        <span className="text-xs font-medium tabular-nums text-ink-muted">
          Schritt {current + 1} <span className="text-ink-subtle">/ {total}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuetext={`Schritt ${current + 1} von ${total}`}
        aria-label="Fortschritt"
        className="h-[3px] w-full overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
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

function ExitIntentDialog({
  open,
  onOpenChange,
  onLeave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeave: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl sm:rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl font-bold tracking-tight-2">
            Anfrage unterbrechen?
          </AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            Kein Problem: Ihre Angaben bleiben in diesem Browser-Tab gespeichert. Solange Sie ihn nicht
            schließen, können Sie später genau hier weitermachen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-2 flex flex-col gap-2">
          <AlertDialogPrimitive.Cancel className={cn("btn-primary w-full", FOCUS_RING)}>
            Weiter ausfüllen
          </AlertDialogPrimitive.Cancel>
          <AlertDialogPrimitive.Action onClick={onLeave} className={cn("btn-ghost w-full text-ink-muted", FOCUS_RING)}>
            Zur Startseite
          </AlertDialogPrimitive.Action>
        </div>
      </AlertDialogContent>
    </AlertDialog>
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

function NextButton({
  onClick,
  disabled,
  label,
  className,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn("btn-primary gap-1.5", FOCUS_RING, className)}>
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
  nextLabel = "Weiter",
  showExitIntent = true,
}: FunnelShellProps) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const phone = settings?.support_phone || FALLBACK_SUPPORT_PHONE;
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const guardExit = showExitIntent && currentStep > 0;
  const isFirst = currentStep === 0;
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(currentStep);

  // Nach einem Schrittwechsel die neue Frage fokussieren (Tastatur, Screenreader),
  // außer ein Feld im Schritt hat sich den Fokus schon genommen (autoFocus).
  // Erst im nächsten Frame: PageTransition nimmt beim Pfadwechsel jeden Fokus weg.
  useEffect(() => {
    if (shownStep.current === currentStep) return;
    shownStep.current = currentStep;
    const active = document.activeElement;
    const target = active instanceof HTMLElement && sectionRef.current?.contains(active) ? active : headingRef.current;
    const frame = window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [currentStep]);

  const handleLogoClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!guardExit) return;
    event.preventDefault();
    setExitDialogOpen(true);
  };

  useEffect(() => {
    if (!guardExit) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [guardExit]);

  return (
    <div className="flex min-h-screen flex-col bg-surface-soft">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="section-container flex h-14 items-center justify-between sm:h-16">
          <Link to="/" onClick={handleLogoClick} className={cn("rounded-lg transition-opacity hover:opacity-90", FOCUS_RING)}>
            <SiteLogo variant="icon-text-compact" asLink={false} iconSize="h-8 w-8 sm:h-9 sm:w-9" />
          </Link>
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 sm:text-sm",
              FOCUS_RING,
            )}
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Fragen? </span>
            <span className="hidden min-[380px]:inline">{phone}</span>
            <span className="sr-only min-[380px]:hidden">Anrufen: {phone}</span>
          </a>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 py-6 sm:py-10 lg:py-14">
        <div className="w-full max-w-2xl">
          <ProgressBar current={currentStep} total={totalSteps} />
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

            <div className={cn("mt-8 items-center justify-between gap-4", onNext ? "hidden sm:flex" : "flex")}>
              <BackButton hidden={isFirst} onClick={onBack} />
              {onNext && <NextButton onClick={onNext} disabled={!canProceed} label={nextLabel} />}
            </div>
          </section>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-subtle">
            Ihre Angaben werden verschlüsselt übertragen. Ihre Kontaktdaten erhalten nur geprüfte Küchenstudios –
            niemals sonstige Dritte.
          </p>
        </div>
      </main>

      {onNext && (
        <div className="sticky bottom-0 z-30 border-t border-border bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <BackButton hidden={isFirst} onClick={onBack} className="px-2" />
            <NextButton onClick={onNext} disabled={!canProceed} label={nextLabel} className="flex-1" />
          </div>
        </div>
      )}

      <ExitIntentDialog open={exitDialogOpen} onOpenChange={setExitDialogOpen} onLeave={() => navigate("/")} />
    </div>
  );
}
