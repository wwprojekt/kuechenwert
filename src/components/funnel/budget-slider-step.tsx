import { useCallback } from "react";
import { clsx } from "clsx";

interface BudgetSliderStepProps {
  /** Aktueller Budget-Wert in € (0 = noch nicht gewählt) */
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /** Vorgeschlagener Default wenn value === 0 */
  defaultValue: number;
}

const EUR = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function BudgetSliderStep({
  value,
  onChange,
  min,
  max,
  step,
  defaultValue,
}: BudgetSliderStepProps) {
  const displayValue = value > 0 ? value : defaultValue;
  const isSet = value > 0;

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange],
  );

  const percentage = ((displayValue - min) / (max - min)) * 100;

  return (
    <div className="space-y-7">
      {/* Große Budget-Anzeige */}
      <div className="text-center">
        <div
          className={clsx(
            "font-display text-4xl font-bold tracking-tight-2 transition-colors sm:text-5xl",
            isSet ? "text-brand-700" : "text-ink",
          )}
        >
          {EUR.format(displayValue)}
          {displayValue === max && (
            <span className="ml-1 text-3xl sm:text-4xl">+</span>
          )}
        </div>
        {!isSet && (
          <p className="mt-1 text-xs text-ink-muted">
            (Vorschlag — Slider anpassen oder bestätigen)
          </p>
        )}
      </div>

      {/* Slider */}
      <div className="px-1">
        <div className="relative">
          {/* Custom Track-Progress (visuell, über Gradient im Track) */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={displayValue}
            onChange={handleSliderChange}
            aria-label="Budget in Euro"
            className="w-full cursor-pointer appearance-none bg-transparent focus:outline-none"
            style={{
              // @ts-expect-error CSS-Var
              "--pct": `${percentage}%`,
            }}
          />
        </div>

        {/* Min / Max-Labels */}
        <div className="mt-3 flex justify-between text-xs font-medium text-ink-muted">
          <span>{EUR.format(min)}</span>
          <span>
            {EUR.format(max)}
            <span className="ml-0.5">+</span>
          </span>
        </div>
      </div>

      {/* Vorschlags-Chips als Quick-Select */}
      <div className="flex flex-wrap justify-center gap-2">
        {[5_000, 10_000, 15_000, 25_000, 40_000].map((v) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={clsx(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                active
                  ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                  : "border-neutral-300 bg-white text-ink-muted hover:border-brand-300 hover:text-brand-700",
              )}
            >
              {EUR.format(v).replace("\u00a0€", " €")}
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs leading-relaxed text-ink-subtle">
        Unverbindliche Angabe — unsere Fachbetriebe helfen Ihnen dabei, das
        Beste für Ihr Budget herauszuholen.
      </p>

      {/* Range-Input-Styling (brand-500 = #f59e0b, Amber) */}
      <style jsx>{`
        input[type="range"] {
          -webkit-appearance: none;
          width: 100%;
          height: 8px;
          border-radius: 9999px;
          background: linear-gradient(
            to right,
            #f59e0b 0%,
            #f59e0b var(--pct, 0%),
            #e5e7eb var(--pct, 0%),
            #e5e7eb 100%
          );
          transition: background 100ms ease-out;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid #f59e0b;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          cursor: grab;
          transition: transform 120ms ease-out, box-shadow 120ms ease-out;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.08);
        }
        input[type="range"]::-webkit-slider-thumb:active {
          cursor: grabbing;
          transform: scale(1.12);
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
        }
        input[type="range"]::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid #f59e0b;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          cursor: grab;
        }
        input[type="range"]::-moz-range-track {
          height: 8px;
          border-radius: 9999px;
          background: transparent;
        }
        input[type="range"]:focus-visible {
          outline: 2px solid #f59e0b;
          outline-offset: 4px;
        }
      `}</style>
    </div>
  );
}

export function isBudgetValid(value: number, min: number, max: number) {
  return Number.isFinite(value) && value >= min && value <= max;
}
