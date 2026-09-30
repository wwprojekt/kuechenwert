import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MultiCardOption<Id extends string = string> {
  id: Id;
  label: string;
  icon?: ReactNode;
}

interface MultiCardStepProps<Id extends string> {
  options: readonly MultiCardOption<Id>[];
  selected: readonly Id[];
  onSelectionChange: (ids: Id[]) => void;
  labelledBy?: string;
}

/**
 * Mehrfachauswahl als Umschalt-Kacheln (aria-pressed). Ab fünf Optionen auch
 * auf dem Handy zweispaltig, dann ohne Icon, damit alles auf einen Blick passt.
 */
export function MultiCardStep<Id extends string>({ options, selected, onSelectionChange, labelledBy }: MultiCardStepProps<Id>) {
  const toggle = (id: Id) => {
    onSelectionChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };
  const dense = options.length > 4;

  return (
    <div role="group" aria-labelledby={labelledBy} className={cn("grid gap-2 sm:grid-cols-2 sm:gap-3 xshort:gap-1.5", dense ? "grid-cols-2" : "grid-cols-1")}>
      {options.map((opt) => {
        const isActive = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            aria-pressed={isActive}
            className={cn(
              "group flex min-h-[3.25rem] items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left transition-all duration-200 sm:gap-3 sm:px-4 sm:py-3 sm:short:py-2 xshort:min-h-11 xshort:py-1.5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive ? "border-primary bg-brand-50 shadow-sm" : "border-border bg-card hover:border-brand-300",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid h-5 w-5 flex-none place-items-center rounded-md border-2 transition-colors",
                isActive ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
              )}
            >
              {isActive && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            {opt.icon && (
              <span
                aria-hidden="true"
                className={cn(
                  "h-9 w-9 flex-none place-items-center rounded-lg transition-colors [&>svg]:h-5 [&>svg]:w-5",
                  dense ? "hidden sm:grid" : "grid",
                  isActive ? "bg-brand-100 text-brand-700" : "bg-surface-strong text-ink-muted",
                )}
              >
                {opt.icon}
              </span>
            )}
            <span
              className={cn(
                "hyphens-auto break-words font-medium leading-snug sm:text-[15px]",
                dense ? "text-[13px]" : "text-sm",
                isActive ? "text-brand-900" : "text-foreground",
              )}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
