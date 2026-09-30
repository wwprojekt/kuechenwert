import { AlertCircle, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { FunnelFooter } from "@/components/funnel/funnel-footer";
import { FOCUS_RING, FunnelHeader } from "@/components/funnel/funnel-header";
import { FunnelProgress } from "@/components/funnel/funnel-progress";
import { useVirtualKeyboardOpen } from "@/hooks/useVirtualKeyboardOpen";
import { cn } from "@/lib/utils";

export const FUNNEL_HEADING_ID = "funnel-question";

export interface FunnelNav {
  onBack?: () => void;
  /** Ohne onNext und ohne nextForm gibt es keinen Weiter-Button (z. B. Lade-Schritt). */
  onNext?: () => void;
  /** Weiter-Button als Absende-Button dieses Formulars (id). */
  nextForm?: string;
  nextLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  /** Hinweis, warum es noch nicht weitergeht (steht direkt über „Weiter“). */
  blockedHint?: string | null;
  /** Nur in der mobilen Leiste; auf dem Desktop bringt der Inhalt den Button selbst mit. */
  mobileOnly?: boolean;
}

interface FunnelFrameProps {
  /** Schlüssel des Schritts: Animation, Fokus und Scroll setzen bei Wechsel neu an. */
  stepKey: string | number;
  current: number;
  total: number;
  /** Überschreibt den linearen Prozentwert (z. B. 100 % im Ergebnis). */
  percent?: number;
  heading: ReactNode;
  /** Ergänzung zur Frage; auf sehr niedrigen Bildschirmen ausgeblendet, außer hintAlways. */
  hint?: ReactNode;
  hintAlways?: boolean;
  /** Über der Überschrift, z. B. der Status einer laufenden Visualisierung. */
  above?: ReactNode;
  children: ReactNode;
  nav?: FunnelNav | null;
  /** Unter dem Inhalt, nur wenn Platz ist (Vertrauen, Hinweise). */
  below?: ReactNode;
  /** Rechte Spalte ab lg. */
  aside?: ReactNode;
  width?: "md" | "lg" | "xl";
  guardExit?: boolean;
  guardUnload?: boolean;
  savedHint?: string;
  headerAside?: ReactNode;
  hideProgress?: boolean;
}

const WIDTH = { md: "max-w-2xl", lg: "max-w-3xl", xl: "max-w-5xl" } as const;
const CONTAINER = "mx-auto w-full max-w-5xl px-4 sm:px-6";

function BlockedHint({ text, className }: { text: string; className?: string }) {
  return (
    <p role="alert" className={cn("flex items-center justify-center gap-2 text-sm font-medium text-destructive", className)}>
      <AlertCircle className="h-4 w-4 flex-none" aria-hidden="true" />
      {text}
    </p>
  );
}

function NextButton({ nav, className }: { nav: FunnelNav; className?: string }) {
  const label = nav.nextLabel ?? "Weiter";
  const content = nav.busy ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {nav.busyLabel ?? "Bitte warten …"}
    </>
  ) : (
    <>
      <span className="truncate">{label}</span>
      <ArrowRight className="h-4 w-4 flex-none max-[379px]:hidden" aria-hidden="true" />
    </>
  );
  const cls = cn("btn-primary-lg gap-2 whitespace-nowrap px-4 text-[15px] min-[400px]:text-base sm:px-6", FOCUS_RING, className);
  if (nav.nextForm) {
    return (
      <button type="submit" form={nav.nextForm} disabled={nav.busy} className={cls}>
        {content}
      </button>
    );
  }
  return (
    <button type="button" onClick={nav.onNext} disabled={nav.busy} className={cls}>
      {content}
    </button>
  );
}

/**
 * Gemeinsamer Rahmen aller Funnel-Schritte: Kopf mit Fortschritt in Prozent,
 * eine Frage, Antworten und Weiter. Das Layout füllt genau die sichtbare Höhe
 * (100dvh); auf dem Handy stehen Zurück, Weiter und die Pflichtlinks in einer
 * Leiste am unteren Rand, damit kein Schritt gescrollt werden muss.
 */
export function FunnelFrame({
  stepKey,
  current,
  total,
  percent,
  heading,
  hint,
  hintAlways = false,
  above,
  children,
  nav,
  below,
  aside,
  width = "md",
  guardExit = false,
  guardUnload = false,
  savedHint,
  headerAside,
  hideProgress = false,
}: FunnelFrameProps) {
  const keyboardOpen = useVirtualKeyboardOpen();
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(stepKey);
  const hasNav = !!nav && (!!nav.onNext || !!nav.nextForm || !!nav.onBack);
  const hasNext = !!nav && (!!nav.onNext || !!nav.nextForm);

  // Nach einem Schrittwechsel oben beginnen und die neue Frage fokussieren
  // (Tastatur, Screenreader), außer ein Feld hat sich den Fokus genommen.
  // Erst im nächsten Frame: PageTransition nimmt beim Pfadwechsel jeden Fokus weg.
  useEffect(() => {
    if (shownStep.current === stepKey) return;
    shownStep.current = stepKey;
    window.scrollTo({ top: 0 });
    const active = document.activeElement;
    const target = active instanceof HTMLElement && sectionRef.current?.contains(active) ? active : headingRef.current;
    const frame = window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [stepKey]);

  return (
    <div className="min-h-viewport flex flex-col bg-surface-soft">
      <FunnelHeader
        guardExit={guardExit}
        guardUnload={guardUnload}
        savedHint={savedHint}
        aside={headerAside}
        containerClassName={CONTAINER}
      >
        {!hideProgress && <FunnelProgress current={current} total={total} percent={percent} className={cn(CONTAINER, "pb-2.5 xshort:pb-2")} />}
      </FunnelHeader>

      <main data-funnel-telemetry="" className="flex flex-1 flex-col">
        <div
          className={cn(
            "mx-auto grid w-full flex-1 gap-8 px-4 pb-4 pt-4 sm:px-6 sm:pb-8 sm:pt-8 short:pt-3 sm:short:pb-4 sm:short:pt-4",
            aside ? "max-w-5xl lg:grid-cols-[minmax(0,1fr)_280px]" : WIDTH[width],
          )}
        >
          <section key={stepKey} ref={sectionRef} aria-labelledby={FUNNEL_HEADING_ID} className="min-w-0 animate-step-in motion-reduce:animate-none">
            {above}
            <h1
              id={FUNNEL_HEADING_ID}
              ref={headingRef}
              tabIndex={-1}
              className="text-balance font-display text-[1.375rem] font-bold leading-tight tracking-tight-2 text-foreground focus:outline-none sm:text-[1.875rem] xshort:text-xl sm:short:text-2xl"
            >
              {heading}
            </h1>
            {hint && (
              <p
                className={cn(
                  "mt-1.5 text-pretty text-sm leading-snug text-ink-muted sm:mt-2 sm:text-base short:text-sm",
                  !hintAlways && "xshort:hidden",
                )}
              >
                {hint}
              </p>
            )}

            <div className="mt-4 sm:mt-6 short:mt-3 sm:short:mt-4">{children}</div>

            {hasNav && !nav?.mobileOnly && (
              <div className="mt-6 hidden sm:block short:mt-4">
                {nav?.blockedHint && <BlockedHint text={nav.blockedHint} className="mb-3 justify-start" />}
                <div className="flex items-center justify-between gap-4">
                  {nav?.onBack ? (
                    <button type="button" onClick={nav.onBack} className={cn("btn-ghost gap-1.5 text-ink-muted", FOCUS_RING)}>
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Zurück
                    </button>
                  ) : (
                    <span />
                  )}
                  {hasNext && nav && <NextButton nav={nav} />}
                </div>
              </div>
            )}
            {below && <div className="mt-6 hidden tall:block sm:block sm:short:hidden">{below}</div>}
          </section>
          {aside && <aside className="hidden flex-col gap-4 lg:flex">{aside}</aside>}
        </div>
      </main>
      <FunnelFooter className="hidden border-t border-border sm:block short:py-3" />

      <div
        className={cn(
          "sticky bottom-0 z-30 border-t border-border bg-card/95 px-4 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur sm:hidden",
          keyboardOpen && "hidden",
        )}
      >
        {nav?.blockedHint && <BlockedHint text={nav.blockedHint} className="mb-2" />}
        {hasNav && nav && (
          <div className="flex items-center gap-3">
            {nav.onBack && (
              <button
                type="button"
                onClick={nav.onBack}
                aria-label="Zurück"
                className={cn("grid h-12 w-12 flex-none place-items-center rounded-xl border border-input bg-card text-foreground", FOCUS_RING)}
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            {hasNext && <NextButton nav={nav} className="min-w-0 flex-1" />}
          </div>
        )}
        <FunnelFooter compact className="mt-1.5" />
      </div>
    </div>
  );
}
