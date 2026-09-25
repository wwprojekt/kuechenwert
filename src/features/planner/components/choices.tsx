import { Check, Minus, Plus } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChoiceOption<T extends string> {
  id: T;
  label: string;
  hint?: string;
  image?: string;
  /** Zeichnung statt Foto (z. B. Grundriss), gleiche Fläche wie image. */
  visual?: ReactNode;
  icon?: ReactNode;
  badge?: string;
}

function moveFocus(event: KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
  if (!keys.includes(event.key)) return;
  const group = event.currentTarget.closest('[role="radiogroup"]');
  if (!group) return;
  const items = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
  const index = items.indexOf(event.currentTarget);
  const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
  const next = items[(index + delta + items.length) % items.length];
  event.preventDefault();
  next?.focus();
  next?.click();
}

export function ChoiceGrid<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = "sm:grid-cols-3",
  size = "md",
}: {
  label: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid grid-cols-2 gap-3", columns)}>
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.id)}
            onKeyDown={moveFocus}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-xl border-2 bg-card text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary shadow-md ring-1 ring-primary/30"
                : "border-border hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md",
            )}
          >
            {(opt.image || opt.visual) && (
              <span className={cn("block w-full overflow-hidden bg-muted", size === "lg" ? "aspect-[4/3]" : "aspect-[16/10]")}>
                {opt.image ? (
                  <img
                    src={opt.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-muted/60 p-3">{opt.visual}</span>
                )}
              </span>
            )}
            <span className={cn("flex flex-1 items-start gap-2.5", size === "sm" ? "p-2.5" : "p-3.5")}>
              {opt.icon && (
                <span className={cn("mt-0.5 flex-none", selected ? "text-primary" : "text-muted-foreground")}>{opt.icon}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn("font-semibold leading-tight text-foreground", size === "sm" ? "text-sm" : "text-[15px]")}>
                    {opt.label}
                  </span>
                  {opt.badge && (
                    <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground dark:text-accent">
                      {opt.badge}
                    </span>
                  )}
                </span>
                {opt.hint && <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{opt.hint}</span>}
              </span>
            </span>
            <span
              aria-hidden
              className={cn(
                "absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full border-2 transition",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-white/80 bg-white/70 text-transparent",
              )}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export interface SwatchOption {
  id: string;
  label: string;
  hex: string;
  wood?: boolean;
}

export function SwatchPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SwatchOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-3">
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.id)}
            onKeyDown={moveFocus}
            className="group flex w-16 flex-col items-center gap-1.5 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={cn(
                "relative grid h-11 w-11 place-items-center rounded-full border shadow-inner transition",
                selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "group-hover:scale-105",
              )}
              style={{
                background: opt.wood
                  ? `repeating-linear-gradient(100deg, ${opt.hex} 0 6px, color-mix(in srgb, ${opt.hex} 82%, black) 6px 8px)`
                  : opt.hex,
              }}
            >
              {selected && <Check className="h-4 w-4 text-white mix-blend-difference" strokeWidth={3} />}
            </span>
            <span className={cn("text-center text-[11px] leading-tight", selected ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ToggleChips<T extends string>({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: ChoiceOption<T>[];
  values: T[];
  onChange: (values: T[]) => void;
}) {
  const toggle = (id: T) => onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = values.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            role="checkbox"
            aria-checked={active}
            onClick={() => toggle(opt.id)}
            title={opt.hint}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-2 text-sm font-medium transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-foreground hover:border-primary/50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid h-4 w-4 place-items-center rounded-full border",
                active ? "border-primary-foreground bg-primary-foreground text-primary" : "border-muted-foreground/40",
              )}
            >
              {active && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center rounded-xl border-2 border-border bg-card" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid h-11 w-11 place-items-center rounded-l-xl text-foreground transition hover:bg-muted disabled:opacity-40"
        aria-label={`${label} verringern`}
      >
        <Minus className="h-4 w-4" />
      </button>
      <output className="min-w-[4.5rem] text-center text-base font-semibold tabular-nums" aria-live="polite">
        {value}
        {suffix ? ` ${suffix}` : ""}
      </output>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="grid h-11 w-11 place-items-center rounded-r-xl text-foreground transition hover:bg-muted disabled:opacity-40"
        aria-label={`${label} erhöhen`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-bold text-foreground sm:text-lg">{title}</h3>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
