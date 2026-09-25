import { Check } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface BudgetSliderStepProps {
  /** Budget in Euro; null = „Weiß ich nicht – bitte beraten“. */
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step: number;
  /** Startwert des Sliders, solange noch kein Betrag gewählt wurde. */
  defaultValue: number;
}

const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const QUICK_PICKS = [5_000, 10_000, 15_000, 25_000, 40_000];

const RANGE_CSS = `
.kw-budget-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 9999px;
  background: linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) var(--pct, 0%), hsl(var(--border)) var(--pct, 0%), hsl(var(--border)) 100%);
  cursor: pointer;
}
.kw-budget-range[data-muted] {
  background: hsl(var(--border));
}
.kw-budget-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  box-sizing: border-box;
  width: 28px;
  height: 28px;
  border-radius: 9999px;
  background: hsl(var(--card));
  border: 3px solid hsl(var(--primary));
  box-shadow: 0 2px 6px hsl(var(--foreground) / 0.18);
  cursor: grab;
  transition: transform 120ms ease-out;
}
.kw-budget-range::-moz-range-thumb {
  box-sizing: border-box;
  width: 28px;
  height: 28px;
  border-radius: 9999px;
  background: hsl(var(--card));
  border: 3px solid hsl(var(--primary));
  box-shadow: 0 2px 6px hsl(var(--foreground) / 0.18);
  cursor: grab;
}
.kw-budget-range::-moz-range-track {
  height: 8px;
  border-radius: 9999px;
  background: transparent;
}
.kw-budget-range[data-muted]::-webkit-slider-thumb {
  border-color: hsl(var(--muted-foreground));
}
.kw-budget-range[data-muted]::-moz-range-thumb {
  border-color: hsl(var(--muted-foreground));
}
.kw-budget-range:hover::-webkit-slider-thumb {
  transform: scale(1.08);
}
.kw-budget-range:active::-webkit-slider-thumb {
  cursor: grabbing;
  transform: scale(1.12);
}
.kw-budget-range:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 8px;
}
@media (prefers-reduced-motion: reduce) {
  .kw-budget-range::-webkit-slider-thumb {
    transition: none;
  }
}
`;

function formatAmount(value: number, max: number): string {
  return value >= max ? `${EUR.format(max)}+` : EUR.format(value);
}

export function BudgetSliderStep({ value, onChange, min, max, step, defaultValue }: BudgetSliderStepProps) {
  const [remembered, setRemembered] = useState(value ?? defaultValue);
  const unknown = value === null;
  const shown = value ?? remembered;
  const percentage = ((shown - min) / (max - min)) * 100;

  const setAmount = (amount: number) => {
    setRemembered(amount);
    onChange(amount);
  };

  return (
    <div className="space-y-6">
      <style>{RANGE_CSS}</style>

      <div className="text-center">
        {unknown ? (
          <>
            <p className="font-display text-3xl font-bold tracking-tight-2 text-foreground sm:text-4xl">Budget offen</p>
            <p className="mt-1.5 text-sm text-ink-muted">Die Studios beraten Sie zu einem passenden Budget.</p>
          </>
        ) : (
          <p className="font-display text-4xl font-bold tabular-nums tracking-tight-2 text-brand-700 sm:text-5xl">
            {formatAmount(shown, max)}
          </p>
        )}
      </div>

      <div className="px-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={shown}
          onChange={(event) => setAmount(Number(event.target.value))}
          aria-label="Budget in Euro"
          aria-valuetext={unknown ? "Keine Festlegung, Beratung gewünscht" : formatAmount(shown, max)}
          data-muted={unknown || undefined}
          className="kw-budget-range"
          style={{ "--pct": `${percentage}%` } as CSSProperties}
        />
        <div className="mt-3 flex justify-between text-xs font-medium text-ink-muted" aria-hidden="true">
          <span>{EUR.format(min)}</span>
          <span>{EUR.format(max)}+</span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {QUICK_PICKS.map((amount) => {
          const active = value === amount;
          return (
            <button
              key={amount}
              type="button"
              onClick={() => setAmount(amount)}
              aria-pressed={active}
              className={cn(
                "min-h-9 rounded-full border px-3.5 py-1.5 text-xs font-semibold tabular-nums transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-ink-muted hover:border-brand-300 hover:text-brand-700",
              )}
            >
              {EUR.format(amount)}
            </button>
          );
        })}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => onChange(unknown ? remembered : null)}
          aria-pressed={unknown}
          className={cn(
            "inline-flex min-h-11 items-center gap-2.5 rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            unknown
              ? "border-primary bg-brand-50 text-brand-900"
              : "border-border bg-card text-foreground hover:border-brand-300",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "grid h-5 w-5 flex-none place-items-center rounded-md border-2 transition-colors",
              unknown ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
            )}
          >
            {unknown && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </span>
          Weiß ich nicht – bitte beraten
        </button>
      </div>

      <p className="text-center text-xs leading-relaxed text-ink-subtle">
        Unverbindliche Angabe – die Studios helfen Ihnen, das Beste aus Ihrem Budget herauszuholen.
      </p>
    </div>
  );
}
