import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  Loader2,
  BadgeEuro,
  ShieldCheck,
  Clock3,
} from "lucide-react";

interface FunnelShellProps {
  children: React.ReactNode;
  /** Current step index (0-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /**
   * Kurzer Kontext-Label (z.B. "Anlass"). Wird als dezenter Eyebrow
   * oberhalb der Frage gerendert, nicht mehr als Haupt-Headline.
   */
  stepLabel: string;
  /**
   * Die eigentliche Frage (h1). Beispiel:
   * "Was ist der Anlass für Ihre neue Küche?"
   */
  stepDescription: string;
  /** Called when back button is pressed */
  onBack: () => void;
  /** Called when next/submit button is pressed */
  onNext: () => void;
  /** Whether the next button should be disabled */
  canProceed: boolean;
  /** Whether this is the final step with a submit action */
  isFinalStep?: boolean;
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
  /** Custom label for the next button */
  nextLabel?: string;
  /** Custom label for the submit button */
  submitLabel?: string;
  /** Show exit intent dialog when user tries to leave */
  showExitIntent?: boolean;
}

const SUPPORT_PHONE_DISPLAY = "+49 30 - 555 80 100";
const SUPPORT_PHONE_TEL = "+493055580100";

/**
 * Progress-Balken + dezenter Schritt-Counter rechts.
 * KP-Style, aber mit Orientierungshilfe (bei 17 Schritten essenziell).
 */
function ProgressBar({ current, total }: { current: number; total: number }) {
  const percentage = Math.min(100, Math.round(((current + 1) / total) * 100));
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          Ihr Küchen-Match
        </span>
        <span className="text-xs font-medium tabular-nums text-ink-muted">
          Schritt {current + 1} <span className="text-ink-subtle">/ {total}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Schritt ${current + 1} von ${total}`}
        className="h-[3px] w-full overflow-hidden rounded-full bg-neutral-200"
      >
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Trust-Strip unter dem ProgressBar — 3 Mini-USPs, sehr dezent.
 * KP zeigt "100% kostenlos · Einfach und sicher · Kostenlose Beratung",
 * wir übersetzen das in unseren Ton.
 */
function FunnelTrustStrip() {
  const items: Array<{ icon: React.ReactNode; label: string }> = [
    { icon: <BadgeEuro className="h-3.5 w-3.5" aria-hidden />, label: "Kostenlos & unverbindlich" },
    { icon: <Clock3 className="h-3.5 w-3.5" aria-hidden />, label: "In 2 Minuten fertig" },
    { icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden />, label: "DSGVO · Deutsches Recht" },
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[12px] text-ink-muted">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="text-brand-600">{it.icon}</span>
          {it.label}
        </span>
      ))}
    </div>
  );
}

function ExitIntentDialog({
  open,
  onStay,
  onLeave,
}: {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card-elevated">
        <h3 className="text-lg font-bold text-black">Wirklich abbrechen?</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Ihre Angaben werden nicht gespeichert und wir können Ihnen keine
          kostenlosen Angebote erstellen.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button type="button" onClick={onStay} className="btn-primary w-full">
            Weiter ausfüllen
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Trotzdem verlassen
          </button>
        </div>
      </div>
    </div>
  );
}

export function FunnelShell({
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
  submitLabel = "Kostenlos Angebote erhalten",
  showExitIntent = true,
}: FunnelShellProps) {
  const [exitDialogOpen, setExitDialogOpen] = useState(false);

  const handleLogoClick = useCallback(
    (e: React.MouseEvent) => {
      if (showExitIntent && currentStep > 0) {
        e.preventDefault();
        setExitDialogOpen(true);
      }
    },
    [showExitIntent, currentStep],
  );

  useEffect(() => {
    if (!showExitIntent || currentStep === 0) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [showExitIntent, currentStep]);

  return (
    <div className="flex min-h-screen flex-col bg-surface-soft">
      {/* ============ HEADER — minimal, KP-Style ============ */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="section-container flex h-14 items-center justify-between sm:h-16">
          <Link
            to="/"
            onClick={handleLogoClick}
            className="inline-flex items-center gap-1 font-display text-lg font-bold tracking-tight-2 text-black"
          >
            <span>Küchen</span>
            <span>Wert</span>
            <span
              className="ml-0.5 inline-block h-1.5 w-1.5 translate-y-1 rounded-full bg-brand-500"
              aria-hidden
            />
          </Link>

          {/* Nur noch der Support-Call — wie Küchenportal */}
          <a
            href={`tel:${SUPPORT_PHONE_TEL}`}
            className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50 sm:text-sm"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Haben Sie Fragen? </span>
            <span>{SUPPORT_PHONE_DISPLAY}</span>
          </a>
        </div>
      </header>

      {/* ============ MAIN ============ */}
      <main className="flex flex-1 flex-col items-center px-4 py-6 sm:py-10 lg:py-14">
        <div className="w-full max-w-2xl">
          {/* Progress + Trust-Strip */}
          <ProgressBar current={currentStep} total={totalSteps} />
          <FunnelTrustStrip />

          {/* Step Card */}
          <div
            key={currentStep}
            className="mt-5 animate-step-in rounded-2xl border border-neutral-200 bg-white p-6 shadow-card sm:p-10 lg:p-12"
          >
            {/* Dezenter Eyebrow (Kontext-Label) + große Frage als h1 */}
            {stepLabel && stepLabel !== stepDescription && (
              <div className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                {stepLabel}
              </div>
            )}
            <h1 className="mx-auto mt-2 max-w-xl text-center font-display text-[26px] font-bold leading-[1.15] tracking-tight-2 text-black sm:text-[2rem] lg:text-[2.25rem]">
              {stepDescription}
            </h1>

            <div className="mt-7 sm:mt-9">{children}</div>

            {/* Desktop-Navigation (Mobile bekommt Sticky-Footer) */}
            <div className="mt-9 hidden items-center justify-between gap-4 sm:flex">
              <button
                type="button"
                onClick={onBack}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-strong hover:text-ink",
                  currentStep === 0 && "invisible",
                )}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="h-4 w-4" />
                Zurück
              </button>

              {isFinalStep ? (
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!canProceed || isSubmitting}
                  className="btn-primary-lg"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Wird gesendet …
                    </span>
                  ) : (
                    <>
                      {submitLabel}
                      <ArrowRight className="h-5 w-5 btn-icon-arrow" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!canProceed}
                  className="btn-primary"
                >
                  {nextLabel}
                  <ArrowRight className="h-4 w-4 btn-icon-arrow" />
                </button>
              )}
            </div>
          </div>

          {/* Zurückhaltender Service-Hinweis unterhalb der Card */}
          <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-subtle">
            Ihre Angaben werden verschlüsselt übertragen. Kein Spam, keine
            Weitergabe an Dritte ohne Ihre Zustimmung.
          </p>
        </div>
      </main>

      {/* ============ STICKY MOBILE FOOTER ============ */}
      <div className="sticky bottom-0 z-30 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className={clsx(
              "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-strong",
              currentStep === 0 && "invisible",
            )}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </button>

          {isFinalStep ? (
            <button
              type="button"
              onClick={onNext}
              disabled={!canProceed || isSubmitting}
              className="btn-primary-lg flex-1 justify-center text-sm"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {submitLabel}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              disabled={!canProceed}
              className="btn-primary flex-1 justify-center"
            >
              {nextLabel}
              <ArrowRight className="h-4 w-4 btn-icon-arrow" />
            </button>
          )}
        </div>
      </div>

      {/* Exit Intent */}
      <ExitIntentDialog
        open={exitDialogOpen}
        onStay={() => setExitDialogOpen(false)}
        onLeave={() => {
          setExitDialogOpen(false);
          window.location.href = "/";
        }}
      />
    </div>
  );
}
