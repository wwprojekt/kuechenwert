import { useState, useEffect } from "react";
import { clsx } from "clsx";
import { getRegionByPlz } from "@/config/regions";

interface PlzStepProps {
  value: string;
  onChange: (plz: string) => void;
}

export function PlzStep({ value, onChange }: PlzStepProps) {
  const [region, setRegion] = useState<string | null>(null);

  useEffect(() => {
    if (value.length === 5) {
      const r = getRegionByPlz(value);
      setRegion(r?.label ?? null);
    } else {
      setRegion(null);
    }
  }, [value]);

  const isValid = /^\d{5}$/.test(value);

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{5}"
          maxLength={5}
          placeholder="z.B. 10115"
          name="postal-code"
          autoComplete="postal-code"
          aria-label="Postleitzahl"
          value={value}
          onChange={(e) =>
            onChange(e.target.value.replace(/\D/g, "").slice(0, 5))
          }
          className={clsx(
            "w-full rounded-xl border-2 bg-white px-5 py-4 text-center text-2xl font-bold tracking-widest outline-none transition",
            isValid
              ? "border-brand-600 text-brand-800"
              : "border-zinc-300 text-zinc-800 focus:border-brand-500",
          )}
          autoFocus
        />
        {isValid && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
        )}
      </div>

      {region && (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-brand-50 px-4 py-2.5">
          <svg
            className="h-4 w-4 text-brand-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z"
            />
          </svg>
          <span className="text-sm font-medium text-brand-700">
            Region: {region}
          </span>
        </div>
      )}

      <p className="text-center text-xs text-zinc-400">
        Wir nutzen Ihre PLZ ausschließlich, um Küchenstudios in Ihrer Nähe zu
        finden.
      </p>
    </div>
  );
}
