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
  /** Volle Zeile unter dem Raster, z. B. „Weiß ich noch nicht“. */
  wide?: boolean;
}

interface CardStepProps {
  options: readonly CardOption[];
  selected: string;
  onSelect: (id: string) => void;
  columns?: 2 | 3;
  /** Spalten auf dem Handy; ohne Angabe bis vier Optionen eine, sonst zwei. */
  mobileColumns?: 1 | 2 | 3;
  /** Viele Optionen: überall kompakte Zeilen ohne Zusatztext statt hoher Kacheln. */
  compact?: boolean;
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
    <span className="flex -space-x-2" aria-hidden="true">
      {colors.map((color) => (
        <span
          key={color}
          className="h-7 w-7 rounded-full border-2 border-card shadow-sm ring-1 ring-foreground/10 sm:h-9 sm:w-9 sm:short:h-8 sm:short:w-8"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

/**
 * Einzelauswahl als Kacheln. Auf dem Handy bis vier Optionen als Liste, ab
 * fünf zweispaltig ohne Zusatztext, damit jede Frage auf einen Bildschirm
 * passt; ab sm ein Raster. Ein Klick wählt aus und blättert weiter.
 */
export function CardStep({
  options,
  selected,
  onSelect,
  columns = 3,
  mobileColumns,
  compact = false,
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
  const cols = mobileColumns ?? (compact || options.length > 4 ? 2 : 1);
  const dense = cols > 1;

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className={cn(
        "grid gap-2 sm:gap-3 xshort:gap-1.5",
        cols === 3 ? "grid-cols-3" : cols === 2 ? "grid-cols-2" : "grid-cols-1",
        GRID_COLS[columns],
      )}
    >
      {options.map((opt) => {
        const isActive = selected === opt.id;
        const swatches = opt.swatches ?? [];
        const visual = swatches.length > 0 || !!opt.icon;
        const tile = !opt.wide && !compact;
        const narrow = dense && !opt.wide;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleClick(opt.id)}
            aria-pressed={isActive}
            className={cn(
              "group relative flex min-h-[3.25rem] items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left transition-all duration-200 xshort:min-h-11 xshort:py-1.5",
              opt.wide && "col-span-full",
              narrow && "gap-2.5 px-3",
              cols === 3 && !opt.wide && "justify-center px-2 text-center",
              opt.wide && "sm:gap-4 sm:px-5 sm:py-3.5",
              tile && "sm:flex-col sm:justify-start sm:gap-2.5 sm:px-4 sm:py-5 sm:text-center sm:short:py-3",
              compact && "sm:min-h-12 sm:py-2",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "border-primary bg-brand-50 shadow-card-active"
                : "border-border bg-card hover:border-brand-300 hover:shadow-card-hover motion-safe:hover:-translate-y-0.5",
            )}
          >
            {visual && !compact && (
              <span
                className={cn(
                  "flex-none items-center justify-center sm:flex sm:h-14 sm:short:h-10",
                  // Zweispaltig auf dem Handy bleibt nur der Text (Farbmuster ausgenommen), sonst bricht er dreizeilig um.
                  narrow && swatches.length === 0 ? "hidden" : "flex",
                  anySwatches && !dense && "w-[4.25rem] sm:w-auto",
                )}
              >
                {swatches.length > 0 ? (
                  <Swatches colors={swatches} />
                ) : (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full transition-colors sm:h-14 sm:w-14 sm:short:h-10 sm:short:w-10",
                      "[&>svg]:h-[1.125rem] [&>svg]:w-[1.125rem] sm:[&>svg]:h-7 sm:[&>svg]:w-7 sm:short:[&>svg]:h-5 sm:short:[&>svg]:w-5",
                      isActive ? "bg-primary text-primary-foreground" : "bg-brand-50 text-brand-600 group-hover:bg-brand-100",
                    )}
                  >
                    {opt.icon}
                  </span>
                )}
              </span>
            )}
            <span
              className={cn(
                "flex min-w-0 flex-1 flex-col gap-0.5",
                cols === 3 && !opt.wide ? "px-1" : narrow ? "pr-3" : "pr-5",
                tile && "sm:flex-none sm:px-0",
              )}
            >
              <span
                className={cn(
                  "hyphens-auto break-words font-display font-semibold leading-tight",
                  cols === 3 && !opt.wide ? "text-[13px] sm:text-[15px]" : dense ? "text-sm sm:text-[15px]" : "text-[15px] sm:text-base",
                  isActive ? "text-brand-900" : "text-foreground",
                )}
              >
                {opt.label}
              </span>
              {opt.description && !compact && (
                <span className={cn("text-xs leading-snug text-ink-muted", narrow && "hidden sm:block", "sm:short:hidden")}>
                  {opt.description}
                </span>
              )}
            </span>
            {isActive && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground",
                  narrow || compact ? "right-1.5 top-1.5" : "right-2.5 top-1/2 -translate-y-1/2",
                  tile && "sm:right-2.5 sm:top-2.5 sm:translate-y-0",
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
