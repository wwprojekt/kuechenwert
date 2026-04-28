import { useRef } from "react";
import { clsx } from "clsx";

export interface CardOption {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface CardStepProps {
  options: CardOption[];
  selected: string;
  onSelect: (id: string) => void;
  columns?: 2 | 3 | 4 | 5;
  /** Auto-Advance Delay in ms; default 250 (snappy) */
  autoAdvanceMs?: number;
  onAutoAdvance?: () => void;
}

export function CardStep({
  options,
  selected,
  onSelect,
  columns = 3,
  autoAdvanceMs = 250,
  onAutoAdvance,
}: CardStepProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClick(id: string) {
    onSelect(id);
    if (onAutoAdvance && autoAdvanceMs > 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onAutoAdvance, autoAdvanceMs);
    }
  }

  const gridCols: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  };

  return (
    <div className={clsx("grid gap-3 sm:gap-4", gridCols[columns])}>
      {options.map((opt) => {
        const isActive = selected === opt.id;

        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleClick(opt.id)}
            aria-pressed={isActive}
            className={clsx(
              "group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 px-4 py-6 text-center transition-all",
              isActive
                ? "border-brand-500 bg-brand-50 shadow-card-active ring-4 ring-brand-500/15"
                : "border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-card-hover",
            )}
          >
            {opt.icon && (
              <div
                className={clsx(
                  "grid h-14 w-14 place-items-center rounded-full transition",
                  isActive
                    ? "bg-brand-500 text-white"
                    : "bg-brand-50 text-brand-600 group-hover:bg-brand-100",
                )}
              >
                <span className="[&>svg]:h-7 [&>svg]:w-7">{opt.icon}</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <span
                className={clsx(
                  "font-display text-[15px] font-bold leading-tight sm:text-base",
                  isActive ? "text-brand-900" : "text-black",
                )}
              >
                {opt.label}
              </span>
              {opt.description && (
                <span className="text-xs leading-relaxed text-ink-muted">
                  {opt.description}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
