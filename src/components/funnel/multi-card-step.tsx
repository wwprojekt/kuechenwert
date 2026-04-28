import { useCallback } from "react";
import { clsx } from "clsx";

export interface MultiCardOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface MultiCardStepProps {
  options: MultiCardOption[];
  selected: string[];
  onSelectionChange: (ids: string[]) => void;
  columns?: 2 | 3 | 4;
  /** Maximum number of selections allowed. 0 = unlimited */
  maxSelections?: number;
  hint?: string;
}

export function MultiCardStep({
  options,
  selected,
  onSelectionChange,
  columns = 3,
  maxSelections = 0,
  hint,
}: MultiCardStepProps) {
  const toggle = useCallback(
    (id: string) => {
      if (selected.includes(id)) {
        onSelectionChange(selected.filter((s) => s !== id));
      } else {
        if (maxSelections > 0 && selected.length >= maxSelections) return;
        onSelectionChange([...selected, id]);
      }
    },
    [selected, onSelectionChange, maxSelections],
  );

  const gridCols: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div>
      {hint && (
        <p className="mb-4 text-sm text-zinc-500">{hint}</p>
      )}
      <div className={clsx("grid gap-3", gridCols[columns])}>
        {options.map((opt) => {
          const isActive = selected.includes(opt.id);
          const isDisabled =
            !isActive && maxSelections > 0 && selected.length >= maxSelections;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              disabled={isDisabled}
              className={clsx(
                "flex items-center gap-3 rounded-xl border-2 px-4 py-4 text-left transition-all",
                isActive
                  ? "border-brand-600 bg-brand-50 shadow-sm"
                  : isDisabled
                    ? "cursor-not-allowed border-zinc-100 bg-zinc-50 opacity-50"
                    : "border-zinc-200 bg-white hover:border-brand-300",
              )}
            >
              {/* Checkbox */}
              <div
                className={clsx(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition",
                  isActive
                    ? "border-brand-600 bg-brand-600"
                    : "border-zinc-300",
                )}
              >
                {isActive && (
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={3}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                )}
              </div>

              {opt.icon && (
                <div
                  className={clsx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm",
                    isActive
                      ? "bg-brand-100 text-brand-700"
                      : "bg-zinc-100 text-zinc-500",
                  )}
                >
                  {opt.icon}
                </div>
              )}

              <span
                className={clsx(
                  "text-sm font-medium",
                  isActive ? "text-brand-800" : "text-zinc-700",
                )}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
      {maxSelections > 0 && (
        <p className="mt-3 text-right text-xs text-zinc-400">
          {selected.length} / {maxSelections} ausgewählt
        </p>
      )}
    </div>
  );
}
