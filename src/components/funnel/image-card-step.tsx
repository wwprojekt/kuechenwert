import { useCallback } from "react";
import { clsx } from "clsx";

export interface ImageOption {
  id: string;
  label: string;
  description?: string;
  /** Tailwind background class als Fallback */
  bgClass: string;
  /** Optional image URL (Unsplash/CDN) */
  imageSrc?: string;
  /** Optional SVG-Pictogramm (rendert statt Image, in Brand-Color) */
  pictogram?: React.ReactNode;
}

interface ImageCardStepProps {
  options: ImageOption[];
  selected: string[];
  onSelectionChange: (ids: string[]) => void;
  /** Single select or multi select */
  multiple?: boolean;
  columns?: 2 | 3;
  /** Auto-Advance bei Single-Select nach Klick (ms, 0 = aus) */
  autoAdvanceMs?: number;
  onAutoAdvance?: () => void;
}

export function ImageCardStep({
  options,
  selected,
  onSelectionChange,
  multiple = false,
  columns = 2,
  autoAdvanceMs = 0,
  onAutoAdvance,
}: ImageCardStepProps) {
  const toggle = useCallback(
    (id: string) => {
      if (multiple) {
        if (selected.includes(id)) {
          onSelectionChange(selected.filter((s) => s !== id));
        } else {
          onSelectionChange([...selected, id]);
        }
      } else {
        onSelectionChange([id]);
        if (onAutoAdvance && autoAdvanceMs > 0) {
          setTimeout(onAutoAdvance, autoAdvanceMs);
        }
      }
    },
    [selected, onSelectionChange, multiple, autoAdvanceMs, onAutoAdvance],
  );

  const gridCols: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
  };

  return (
    <div className={clsx("grid gap-3 sm:gap-4", gridCols[columns])}>
      {options.map((opt) => {
        const isActive = selected.includes(opt.id);
        const hasPictogram = !!opt.pictogram;

        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            aria-pressed={isActive}
            className={clsx(
              "group relative overflow-hidden rounded-2xl border-2 bg-white text-left transition-all",
              isActive
                ? "border-brand-500 shadow-card-active ring-4 ring-brand-500/15"
                : "border-neutral-200 shadow-sm hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-card-hover",
            )}
          >
            {/* Visual-Header: Pictogram auf material-getöntem Hintergrund ODER Foto */}
            {hasPictogram ? (
              <div
                className={clsx(
                  "relative flex aspect-[4/3] items-center justify-center p-3 transition-colors sm:p-4",
                  // Aktive Karte: kräftiger Brand-Tint überschreibt den Material-Tint
                  // (klare Selection-Signalisierung). Inaktiv: Material-Tint aus bgClass.
                  isActive ? "bg-brand-50" : opt.bgClass || "bg-neutral-50",
                )}
              >
                <div
                  className={clsx(
                    "h-full w-full transition-colors",
                    isActive ? "text-brand-700" : "text-ink/70",
                  )}
                >
                  {opt.pictogram}
                </div>
              </div>
            ) : (
              <div className={clsx("relative aspect-[4/3] overflow-hidden", opt.bgClass)}>
                {opt.imageSrc && (
                  <>
                    <img
                      src={opt.imageSrc}
                      alt={opt.label}
                      loading="lazy"
                      decoding="async"
                      sizes="(max-width: 640px) 50vw, 280px"
                      className={clsx(
                        "absolute inset-0 h-full w-full object-cover transition-transform duration-500",
                        isActive ? "scale-[1.03]" : "group-hover:scale-105",
                      )}
                    />
                    {/* Subtiler Gradient am unteren Rand für bessere Lesbarkeit
                        des Label-Bars (der direkt darunter kommt) */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent"
                    />
                    {isActive && (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-white shadow-lg"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="none"
                          strokeWidth={3}
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 10l4 4 8-9" />
                        </svg>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Label-Bar (zentriert, KP-Style) */}
            <div
              className={clsx(
                "px-2.5 py-2 text-center transition sm:px-3 sm:py-2.5",
                isActive ? "bg-brand-50" : "bg-white",
              )}
            >
              <div
                className={clsx(
                  "font-display text-[13px] font-bold leading-tight sm:text-sm",
                  isActive ? "text-brand-900" : "text-black",
                )}
              >
                {opt.label}
              </div>
              {opt.description && (
                <div className="mt-0.5 text-[11px] leading-tight text-ink-muted sm:text-xs">
                  {opt.description}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
