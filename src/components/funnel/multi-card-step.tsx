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
  columns?: 1 | 2;
  labelledBy?: string;
}

/** Mehrfachauswahl als Umschalt-Kacheln (aria-pressed). */
export function MultiCardStep<Id extends string>({
  options,
  selected,
  onSelectionChange,
  columns = 2,
  labelledBy,
}: MultiCardStepProps<Id>) {
  const toggle = (id: Id) => {
    onSelectionChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className={cn("grid grid-cols-1 gap-2.5 sm:gap-3", columns === 2 && "sm:grid-cols-2")}
    >
      {options.map((opt) => {
        const isActive = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            aria-pressed={isActive}
            className={cn(
              "group flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all duration-200",
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
                  "grid h-9 w-9 flex-none place-items-center rounded-lg transition-colors [&>svg]:h-5 [&>svg]:w-5",
                  isActive ? "bg-brand-100 text-brand-700" : "bg-surface-strong text-ink-muted",
                )}
              >
                {opt.icon}
              </span>
            )}
            <span className={cn("text-sm font-medium sm:text-[15px]", isActive ? "text-brand-900" : "text-foreground")}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
