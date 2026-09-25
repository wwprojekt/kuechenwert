import { Check } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ImageOption {
  id: string;
  label: string;
  description?: string;
  imageSrc?: string;
  /** SVG-Piktogramm statt Foto, auf getöntem Hintergrund (bgClass). */
  pictogram?: ReactNode;
  bgClass?: string;
  /** Ohne Bild: volle Zeile mit Icon unter dem Raster, z. B. „Steht noch nicht fest“. */
  icon?: ReactNode;
}

interface ImageCardStepProps {
  options: readonly ImageOption[];
  selected: string;
  onSelect: (id: string) => void;
  columns?: 2 | 3;
  autoAdvanceMs?: number;
  onAutoAdvance?: () => void;
  labelledBy?: string;
}

const GRID_COLS = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
} as const;

const TILE_BASE =
  "group relative overflow-hidden rounded-2xl border-2 text-left transition-all duration-200 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function tileState(isActive: boolean) {
  return isActive
    ? "border-primary bg-brand-50 shadow-card-active"
    : "border-border bg-card shadow-sm hover:border-brand-300 hover:shadow-card-hover motion-safe:hover:-translate-y-0.5";
}

function SelectedBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-md"
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  );
}

function Visual({ option, isActive }: { option: ImageOption; isActive: boolean }) {
  if (option.pictogram) {
    return (
      <span
        className={cn(
          "flex aspect-[4/3] items-center justify-center p-3 transition-colors sm:p-4",
          isActive ? "bg-brand-100/70" : option.bgClass || "bg-surface-soft",
        )}
      >
        <span className={cn("h-full w-full transition-colors", isActive ? "text-brand-700" : "text-foreground/70")}>
          {option.pictogram}
        </span>
      </span>
    );
  }
  return (
    <span className={cn("block aspect-[4/3] overflow-hidden bg-muted", option.bgClass)}>
      {option.imageSrc && (
        <img
          src={option.imageSrc}
          alt=""
          decoding="async"
          className={cn(
            "h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none",
            isActive ? "scale-[1.03]" : "motion-safe:group-hover:scale-105",
          )}
        />
      )}
    </span>
  );
}

/**
 * Einzelauswahl mit Fotos oder Piktogrammen (Küchenform, Stil, Arbeitsplatte).
 * Optionen mit icon statt Bild stehen als volle Zeile unter dem Raster.
 */
export function ImageCardStep({
  options,
  selected,
  onSelect,
  columns = 3,
  autoAdvanceMs = 250,
  onAutoAdvance,
  labelledBy,
}: ImageCardStepProps) {
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

  return (
    <div role="group" aria-labelledby={labelledBy} className={cn("grid gap-3 sm:gap-4", GRID_COLS[columns])}>
      {options.map((opt) => {
        const isActive = selected === opt.id;
        const isRow = !opt.imageSrc && !opt.pictogram;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleClick(opt.id)}
            aria-pressed={isActive}
            className={cn(
              TILE_BASE,
              tileState(isActive),
              isRow ? "col-span-full flex items-center gap-4 p-4" : "flex flex-col",
            )}
          >
            {isActive && <SelectedBadge />}
            {isRow ? (
              <>
                {opt.icon && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-12 w-12 flex-none place-items-center rounded-2xl transition-colors [&>svg]:h-6 [&>svg]:w-6",
                      isActive ? "bg-primary text-primary-foreground" : "bg-brand-50 text-brand-600 group-hover:bg-brand-100",
                    )}
                  >
                    {opt.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1 pr-6">
                  <span className="block font-display text-[15px] font-semibold leading-tight text-foreground sm:text-base">
                    {opt.label}
                  </span>
                  {opt.description && <span className="mt-0.5 block text-xs text-ink-muted sm:text-sm">{opt.description}</span>}
                </span>
              </>
            ) : (
              <>
                <Visual option={opt} isActive={isActive} />
                <span className="flex flex-1 flex-col justify-center px-2.5 py-2 text-center sm:px-3 sm:py-2.5">
                  <span
                    className={cn(
                      "font-display text-[13px] font-semibold leading-tight sm:text-sm",
                      isActive ? "text-brand-900" : "text-foreground",
                    )}
                  >
                    {opt.label}
                  </span>
                  {opt.description && (
                    <span className="mt-0.5 text-[11px] leading-tight text-ink-muted sm:text-xs">{opt.description}</span>
                  )}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
