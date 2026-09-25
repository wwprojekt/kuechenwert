import { CircleCheck, MapPin } from "lucide-react";
import type { FormEvent } from "react";
import { regionForPostalCode } from "@/features/funnel-a/catalog";
import { cn } from "@/lib/utils";

interface PlzStepProps {
  value: string;
  onChange: (plz: string) => void;
  /** Enter bzw. „Los“ auf der Handytastatur bei gültiger PLZ. */
  onSubmit?: () => void;
}

export function PlzStep({ value, onChange, onSubmit }: PlzStepProps) {
  const isComplete = /^\d{5}$/.test(value);
  const region = isComplete ? regionForPostalCode(value) : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isComplete) onSubmit?.();
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-sm space-y-3">
      <label htmlFor="funnel-plz" className="block text-center text-sm font-medium text-ink-muted">
        Postleitzahl des Einbauorts
      </label>
      <div className="relative">
        <input
          id="funnel-plz"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={5}
          placeholder="z. B. 30159"
          name="postal-code"
          autoComplete="postal-code"
          enterKeyHint="go"
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 5))}
          aria-describedby="funnel-plz-status"
          className={cn(
            "h-16 w-full rounded-xl border-2 bg-card px-12 text-center font-display text-2xl font-bold tabular-nums tracking-[0.2em] text-foreground outline-none transition-colors placeholder:font-sans placeholder:text-lg placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-subtle",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isComplete ? "border-primary" : "border-input focus:border-brand-400",
          )}
        />
        {isComplete && (
          <CircleCheck
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 h-6 w-6 -translate-y-1/2 text-success-600"
          />
        )}
      </div>

      <p id="funnel-plz-status" role="status" aria-live="polite" className="min-h-[2.75rem]">
        {region && (
          <span className="flex items-center justify-center gap-2 rounded-lg bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-800">
            <MapPin className="h-4 w-4 flex-none text-brand-600" aria-hidden="true" />
            Region {region}
          </span>
        )}
        {isComplete && !region && (
          <span className="block px-2 py-2.5 text-center text-sm text-ink-muted">
            Diesen PLZ-Bereich kennen wir nicht – bitte prüfen Sie Ihre Eingabe.
          </span>
        )}
      </p>
    </form>
  );
}
