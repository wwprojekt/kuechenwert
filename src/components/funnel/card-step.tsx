import { Check } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CardOption {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  /** Farbpunkte statt Icon (Farbwelt); Werte stammen aus dem Katalog. */
  swatches?: readonly string[];
  /** Ab sm als volle Zeile unter dem Raster, z. B. „Weiß ich noch nicht“. */
  wide?: boolean;
}

interface CardStepProps {
  options: readonly CardOption[];
  selected: string;
  onSelect: (id: string) => void;
  columns?: 2 | 3;
  /** Verzögerung bis zum automatischen Weiterblättern, damit die Auswahl sichtbar wird. */
  autoAdvanceMs?: number;
  onAutoAdvance?: () => void;
  labelledBy?: string;
}

const GRID_COLS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
} as const;

function Swatches({ colors }: { colors: readonly string[] }) {
  return (
    <span className="flex -space-x-2.5" aria-hidden="true">
      {colors.map((color) => (
        <span
          key={color}
          className="h-8 w-8 rounded-full border-2 border-card shadow-sm ring-1 ring-foreground/10 sm:h-9 sm:w-9"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

/**
 * Einzelauswahl als Kacheln: auf dem Handy eine kompakte Liste, ab sm ein
 * Raster. Ein Klick wählt aus und blättert nach autoAdvanceMs weiter.
 */
export function CardStep({
  options,
  selected,
  onSelect,
  columns = 3,
  autoAdvanceMs = 250,
  onAutoAdvance,
  labelledBy,
}: CardStepProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleClick(id: string) {
    onSelect(id);
    if (!onAutoAdvance) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onAutoAdvance, autoAdvanceMs);
  }

  const anySwatches = options.some((o) => (o.swatches?.length ?? 0) > 0);

  return (
    <div role="group" aria-labelledby={labelledBy} className={cn("grid grid-cols-1 gap-2.5 sm:gap-4", GRID_COLS[columns])}>
      {options.map((opt) => {
        const isActive = selected === opt.id;
        const swatches = opt.swatches ?? [];
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleClick(opt.id)}
            aria-pressed={isActive}
            className={cn(
              "group relative flex items-center gap-3.5 rounded-2xl border-2 px-4 py-3 text-left transition-all duration-200",
              opt.wide
                ? "sm:col-span-full sm:gap-4 sm:px-5 sm:py-4"
                : "sm:flex-col sm:justify-start sm:gap-3 sm:px-4 sm:py-6 sm:text-center",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "border-primary bg-brand-50 shadow-card-active"
                : "border-border bg-card hover:border-brand-300 hover:shadow-card-hover motion-safe:hover:-translate-y-0.5",
            )}
          >
            {(swatches.length > 0 || opt.icon) && (
              <span
                className={cn(
                  "flex h-11 flex-none items-center justify-center sm:h-14",
                  anySwatches && "w-[4.75rem] sm:w-auto",
                )}
              >
                {swatches.length > 0 ? (
                  <Swatches colors={swatches} />
                ) : (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-11 w-11 place-items-center rounded-full transition-colors sm:h-14 sm:w-14",
                      "[&>svg]:h-5 [&>svg]:w-5 sm:[&>svg]:h-7 sm:[&>svg]:w-7",
                      isActive ? "bg-primary text-primary-foreground" : "bg-brand-50 text-brand-600 group-hover:bg-brand-100",
                    )}
                  >
                    {opt.icon}
                  </span>
                )}
              </span>
            )}
            <span className={cn("flex min-w-0 flex-1 flex-col gap-0.5 pr-6", !opt.wide && "sm:flex-none sm:pr-0")}>
              <span
                className={cn(
                  "font-display text-[15px] font-semibold leading-tight sm:text-base",
                  isActive ? "text-brand-900" : "text-foreground",
                )}
              >
                {opt.label}
              </span>
              {opt.description && <span className="text-xs leading-snug text-ink-muted">{opt.description}</span>}
            </span>
            {isActive && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-primary text-primary-foreground",
                  !opt.wide && "sm:right-2.5 sm:top-2.5 sm:translate-y-0",
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
