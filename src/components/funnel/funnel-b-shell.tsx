import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  Loader2,
  BadgeEuro,
  ShieldCheck,
  Clock3,
} from "lucide-react";

export interface FunnelBShellProps {
  children: React.ReactNode;
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
  sidebar?: React.ReactNode;
}

const SUPPORT_PHONE_DISPLAY = "+49 30 - 555 80 100";
const SUPPORT_PHONE_TEL = "+493055580100";

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

  return (
    <div className="flex min-h-screen flex-col bg-surface-soft">
      {/* Header — identisch zu Funnel A, KP-Style minimal */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="section-container flex h-14 items-center justify-between sm:h-16">
          <Link
            to="/"
            className="inline-flex items-center gap-1 font-display text-lg font-bold tracking-tight-2 text-black"
          >
            <span>Küchen</span>
            <span>Wert</span>
            <span
              className="ml-0.5 inline-block h-1.5 w-1.5 translate-y-1 rounded-full bg-brand-500"
              aria-hidden
            />
          </Link>
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

      {/* Content */}
      <main className="flex flex-1 justify-center px-4 py-6 sm:py-10 lg:py-14">
        <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_280px]">
          <div className="flex flex-col">
            {/* Progress + Counter */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                Angebots-Vergleich
              </span>
              <span className="text-xs font-medium tabular-nums text-ink-muted">
                Schritt {currentStep + 1} <span className="text-ink-subtle">/ {totalSteps}</span>
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Schritt ${currentStep + 1} von ${totalSteps}`}
              className="h-[3px] w-full overflow-hidden rounded-full bg-neutral-200"
            >
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] duration-500 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* Trust-Strip */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[12px] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <BadgeEuro className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                Kostenlos & unverbindlich
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                In 5 Minuten fertig
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                Nur geprüfte Händler
              </span>
            </div>

            {/* Card — Eyebrow + Frage als h1 */}
            <div
              key={currentStep}
              className="mt-5 animate-step-in rounded-2xl border border-neutral-200 bg-white p-6 shadow-card sm:p-10 lg:p-12"
            >
              {stepLabel && stepLabel !== stepDescription && (
                <div className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                  {stepLabel}
                </div>
              )}
              <h1 className="mx-auto mt-2 max-w-xl text-center font-display text-[26px] font-bold leading-[1.15] tracking-tight-2 text-black sm:text-[2rem] lg:text-[2.25rem]">
                {stepDescription || stepLabel}
              </h1>

              <div className="mt-7 sm:mt-9">{children}</div>

              {/* Nav */}
              <div className="mt-9 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={onBack}
                  disabled={currentStep === 0 || isSubmitting}
                  className={`btn-ghost ${currentStep === 0 ? "invisible" : ""}`}
                >
                  <ArrowLeft className="h-4 w-4" /> Zurück
                </button>

                {isFinalStep ? (
                  <button
                    type="button"
                    onClick={onNext}
                    disabled={!canProceed || isSubmitting}
                    className="btn-accent"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Wird gesendet…
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
                    className="btn-primary"
                  >
                    {nextLabel} <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-subtle">
              Ihre Angaben werden verschlüsselt übertragen. Kein Spam, keine
              Weitergabe an Dritte ohne Ihre Zustimmung.
            </p>
          </div>

          {/* Sidebar */}
          {sidebar && (
            <aside className="hidden flex-col gap-4 lg:flex">
              {sidebar}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
