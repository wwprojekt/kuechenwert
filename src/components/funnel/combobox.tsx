import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  /** optional Kategorie-Label; Optionen mit gleichem group werden gruppiert */
  group?: string;
  /** optional Chip/Tag rechts (z. B. Segment "premium") */
  badge?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  ariaLabel?: string;
  /** bei > N Optionen wird Suchfeld erzwungen */
  searchThreshold?: number;
}

/**
 * Mobile-freundliche, searchable Combobox als Ersatz fuer native
 * <select>. Nutzt native Event-Semantik (keine dep auf Radix/Headless UI).
 * - Keyboard-Nav (ArrowUp/Down, Enter, Esc)
 * - Group-Headers wenn option.group gesetzt
 * - Sucht in label + description + badge
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "– Bitte wählen –",
  emptyLabel = "Keine Treffer",
  ariaLabel,
  searchThreshold = 8,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showSearch = options.length >= searchThreshold;

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.description ?? ""} ${o.badge ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  const grouped = useMemo(() => {
    const out: Array<{ group: string | null; items: ComboboxOption[] }> = [];
    const map = new Map<string | null, ComboboxOption[]>();
    for (const opt of filtered) {
      const g = opt.group ?? null;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(opt);
    }
    for (const [group, items] of map) out.push({ group, items });
    return out;
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && showSearch) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open, showSearch]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
        setQuery("");
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={clsx(
          "input-field flex w-full items-center justify-between gap-2 text-left",
          !selected && "text-ink-subtle",
        )}
      >
        <span className="truncate">
          {selected ? selected.label : placeholder}
          {selected?.badge && (
            <span className="ml-2 inline-flex items-center rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
              {selected.badge}
            </span>
          )}
        </span>
        <ChevronDown
          className={clsx("h-4 w-4 flex-none transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          role="listbox"
        >
          {showSearch && (
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
              <Search className="h-4 w-4 text-ink-subtle" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Suchen…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-subtle"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded p-0.5 text-ink-subtle hover:bg-slate-100"
                  aria-label="Suche zurücksetzen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-ink-subtle">
                {emptyLabel}
              </div>
            )}

            {grouped.map((g, gi) => (
              <div key={`${g.group ?? "_"}-${gi}`}>
                {g.group && (
                  <div className="sticky top-0 bg-slate-50/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle backdrop-blur">
                    {g.group}
                  </div>
                )}
                {g.items.map((opt) => {
                  const idx = filtered.indexOf(opt);
                  const isHighlight = idx === highlight;
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={clsx(
                        "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition",
                        isHighlight && "bg-brand-50",
                        isSelected && "font-medium text-brand-900",
                      )}
                    >
                      <Check
                        className={clsx(
                          "mt-0.5 h-4 w-4 flex-none",
                          isSelected ? "text-brand-700" : "text-transparent",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="block truncate text-xs text-ink-muted">
                            {opt.description}
                          </span>
                        )}
                      </span>
                      {opt.badge && (
                        <span className="mt-0.5 inline-flex items-center rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                          {opt.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
