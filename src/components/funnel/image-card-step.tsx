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
  autoAdvanceMs?: number;
  onAutoAdvance?: () => void;
  labelledBy?: string;
}

const TILE_BASE =
  "group relative overflow-hidden rounded-2xl border-2 text-left transition-all duration-200 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Bildhöhe: auf niedrigen Bildschirmen flacher, damit die Frage ohne Scrollen passt. */
const VISUAL_ASPECT = "aspect-[4/3] short:aspect-[16/10] xshort:aspect-[2/1] sm:aspect-[16/10] sm:short:aspect-[2/1]";

function tileState(isActive: boolean) {
  return isActive
    ? "border-primary bg-brand-50 shadow-card-active"
    : "border-border bg-card shadow-sm hover:border-brand-300 hover:shadow-card-hover motion-safe:hover:-translate-y-0.5";
}

function SelectedBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute right-1.5 top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-md sm:right-2 sm:top-2 sm:h-6 sm:w-6"
    >
      <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={3} />
    </span>
  );
}

/** Die Höhe kommt nur aus dem Seitenverhältnis; der Inhalt liegt absolut darin und kann sie nicht aufdrücken. */
function Visual({ option, isActive }: { option: ImageOption; isActive: boolean }) {
  if (option.pictogram) {
    return (
      <span
        className={cn(
          "relative block min-h-0 transition-colors",
          VISUAL_ASPECT,
          isActive ? "bg-brand-100/70" : option.bgClass || "bg-surface-soft",
        )}
      >
        <span
          className={cn(
            "absolute inset-1.5 flex items-center justify-center transition-colors sm:inset-3 [&>svg]:max-h-full [&>svg]:max-w-full",
            isActive ? "text-brand-700" : "text-foreground/70",
          )}
        >
          {option.pictogram}
        </span>
      </span>
    );
  }
  return (
    <span className={cn("relative block min-h-0 overflow-hidden bg-muted", VISUAL_ASPECT, option.bgClass)}>
      {option.imageSrc && (
        <img
          src={option.imageSrc}
          alt=""
          decoding="async"
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none",
            isActive ? "scale-[1.03]" : "motion-safe:group-hover:scale-105",
          )}
        />
      )}
    </span>
  );
}

/**
 * Einzelauswahl mit Fotos oder Piktogrammen (Küchenform, Stil, Arbeitsplatte).
 * Ab fünf Bildern dreispaltig auch auf dem Handy; Optionen mit icon statt Bild
 * stehen als kompakte Zeile unter dem Raster.
 */
export function ImageCardStep({
  options,
  selected,
  onSelect,
  autoAdvanceMs = 250,
  onAutoAdvance,
  labelledBy,
}: ImageCardStepProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visualCount = options.filter((o) => o.imageSrc || o.pictogram).length;

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
    <div
      role="group"
      aria-labelledby={labelledBy}
      className={cn("grid gap-2 sm:gap-3", visualCount > 4 ? "grid-cols-3" : "grid-cols-2", visualCount === 4 && "sm:grid-cols-4")}
    >
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
              isRow ? "col-span-full flex min-h-[3.25rem] items-center gap-3 px-3.5 py-2 sm:py-2.5" : "flex flex-col",
            )}
          >
            {isActive && <SelectedBadge />}
            {isRow ? (
              <>
                {opt.icon && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-9 w-9 flex-none place-items-center rounded-xl transition-colors [&>svg]:h-5 [&>svg]:w-5",
                      isActive ? "bg-primary text-primary-foreground" : "bg-brand-50 text-brand-600 group-hover:bg-brand-100",
                    )}
                  >
                    {opt.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1 pr-6">
                  <span className="block font-display text-[15px] font-semibold leading-tight text-foreground">{opt.label}</span>
                  {opt.description && <span className="mt-0.5 block text-xs text-ink-muted">{opt.description}</span>}
                </span>
              </>
            ) : (
              <>
                <Visual option={opt} isActive={isActive} />
                <span className="flex flex-1 flex-col justify-center px-1.5 py-1.5 text-center sm:px-3 sm:py-2.5 sm:short:py-1.5">
                  <span
                    className={cn(
                      "hyphens-auto break-words font-display text-[13px] font-semibold leading-tight sm:text-sm",
                      isActive ? "text-brand-900" : "text-foreground",
                    )}
                  >
                    {opt.label}
                  </span>
                  {opt.description && (
                    <span className="mt-0.5 hidden text-xs leading-tight text-ink-muted sm:block sm:short:hidden">{opt.description}</span>
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
