import { BadgeEuro, Clock3, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { FunnelFrame } from "@/components/funnel/funnel-frame";

interface FunnelShellProps {
  children: ReactNode;
  /** Aktueller Schritt (0-basiert). */
  currentStep: number;
  totalSteps: number;
  /** Die Frage des Schritts (h1). */
  question: string;
  hint?: string;
  /** Hinweis auch auf sehr niedrigen Bildschirmen zeigen. */
  hintAlways?: boolean;
  onBack: () => void;
  /** Ohne onNext bringt der Schritt ein Formular mit, das submit absendet. */
  onNext?: () => void;
  canProceed?: boolean;
  /** Hinweis, wenn „Weiter“ ohne Pflichtantwort geklickt wird. */
  blockedHint?: string;
  onBlocked?: () => void;
  nextLabel?: string;
  /** Absende-Button in der Weiter-Position für das Formular des Schritts. */
  submit?: { form: string; label: string; busy: boolean; busyLabel: string };
  /** Fehler beim Absenden, steht direkt über dem Button. */
  error?: string | null;
  showExitIntent?: boolean;
}

const TRUST_ITEMS = [
  { icon: BadgeEuro, label: "Kostenlos & unverbindlich" },
  { icon: Clock3, label: "In ca. 3 Minuten fertig" },
  { icon: ShieldCheck, label: "Datenschutz nach DSGVO" },
];

export function FunnelTrustStrip({ items = TRUST_ITEMS }: { items?: typeof TRUST_ITEMS }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-muted">
      {items.map(({ icon: Icon, label }) => (
        <li key={label} className="inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}

/** Funnel A: ein Schritt pro URL im gemeinsamen Funnel-Rahmen. */
export function FunnelShell({
  children,
  currentStep,
  totalSteps,
  question,
  hint,
  hintAlways = false,
  onBack,
  onNext,
  canProceed = true,
  blockedHint = "Bitte wählen Sie eine Antwort aus.",
  onBlocked,
  nextLabel = "Weiter",
  submit,
  error = null,
  showExitIntent = true,
}: FunnelShellProps) {
  const guardExit = showExitIntent && currentStep > 0;
  const [blocked, setBlocked] = useState(false);

  useEffect(() => setBlocked(false), [currentStep]);
  useEffect(() => {
    if (canProceed) setBlocked(false);
  }, [canProceed]);

  // „Weiter“ bleibt klickbar und sagt, was noch fehlt.
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
    <FunnelFrame
      stepKey={currentStep}
      current={currentStep}
      total={totalSteps}
      heading={question}
      hint={hint}
      hintAlways={hintAlways}
      guardExit={guardExit}
      guardUnload={guardExit}
      nav={{
        onBack: currentStep > 0 ? onBack : undefined,
        onNext: submit ? undefined : handleNext,
        nextForm: submit?.form,
        nextLabel: submit?.label ?? nextLabel,
        busy: submit?.busy,
        busyLabel: submit?.busyLabel,
        blockedHint: error ?? (blocked ? blockedHint : null),
      }}
      below={<FunnelTrustStrip />}
    >
      {children}
    </FunnelFrame>
  );
}
