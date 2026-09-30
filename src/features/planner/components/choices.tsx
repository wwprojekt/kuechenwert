import { Check, Minus, Plus } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

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

export interface SwatchOption {
  id: string;
  label: string;
  hex: string;
  wood?: boolean;
}

/** Farbauswahl als Farbfelder; mit onAutoAdvance blättert ein Klick kurz danach weiter. */
export function SwatchPicker({
  label,
  options,
  value,
  onChange,
  onAutoAdvance,
  autoAdvanceMs = 250,
}: {
  label: string;
  options: SwatchOption[];
  value: string;
  onChange: (id: string) => void;
  onAutoAdvance?: () => void;
  autoAdvanceMs?: number;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const pick = (id: string, viaKeyboard: boolean) => {
    onChange(id);
    if (!onAutoAdvance || viaKeyboard) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onAutoAdvance, autoAdvanceMs);
  };

  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-x-2 gap-y-3 sm:flex sm:flex-wrap sm:gap-3">
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={(e) => pick(opt.id, e.detail === 0)}
            onKeyDown={moveFocus}
            className="group flex flex-col items-center gap-1.5 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-20"
          >
            <span
              className={cn(
                "relative grid h-12 w-12 place-items-center rounded-full border shadow-inner transition sm:h-14 sm:w-14 xshort:h-10 xshort:w-10",
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
            <span className={cn("text-center text-[11px] leading-tight sm:text-xs", selected ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {opt.label}
            </span>
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
      <output className="min-w-[3.5rem] text-center text-base font-semibold tabular-nums" aria-live="polite">
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
