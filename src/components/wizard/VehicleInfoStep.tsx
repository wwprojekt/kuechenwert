import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Calendar, Gauge, Info, Check } from "lucide-react";
import { popularManufacturers, wohnwagenManufacturers, manufacturerModels, wohnwagenManufacturerModels, resolveManufacturer } from "@/lib/vehicle-data";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface VehicleInfoStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  fieldErrors?: Record<string, string>;
}

// Popular manufacturers shown at top of dropdown when no search query
const POPULAR_WOHNMOBIL = ["Hymer", "Dethleffs", "Bürstner", "Knaus", "Carthago", "Hobby", "Pössl", "Adria", "Carado", "Chausson", "Fendt", "Frankia"];
const POPULAR_WOHNWAGEN = ["Hobby", "Fendt", "Knaus", "Dethleffs", "Bürstner", "Tabbert", "Adria", "Weinsberg", "LMC", "Eriba"];

/**
 * Fuzzy match: handles common typos like "Exzellent"→"Excellent", "smara"→"Amara".
 * Uses bigram overlap (2-char pairs) for typo tolerance + subsequence for reordering.
 */
const fuzzyScore = (query: string, target: string): number => {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 1;
  if (q.length < 2 || t.length < 2) return 0;

  // Bigram overlap: count shared 2-char pairs
  const qBigrams = new Set<string>();
  for (let i = 0; i < q.length - 1; i++) qBigrams.add(q.slice(i, i + 2));
  let shared = 0;
  for (let i = 0; i < t.length - 1; i++) {
    if (qBigrams.has(t.slice(i, i + 2))) shared++;
  }
  const bigramScore = (2 * shared) / (q.length - 1 + t.length - 1);

  // Also try: does removing any single char from query create a substring match?
  if (q.length >= 3) {
    for (let i = 0; i < q.length; i++) {
      const reduced = q.slice(0, i) + q.slice(i + 1);
      if (t.includes(reduced)) return 0.7; // single-char-off = strong match
    }
  }

  return bigramScore >= 0.3 ? bigramScore * 0.5 : 0;
};

/**
 * Searchable Combobox – input that filters a list as you type.
 * - No query: shows popular items first (if provided), then rest alphabetically
 * - With query: exact starts-with first, then contains, then fuzzy matches
 */
const SearchableSelect = ({
  options,
  popular,
  value,
  onChange,
  onCommit,
  placeholder,
  disabled,
  hasError,
  id,
  escapeLabel,
  autoFocus,
}: {
  options: string[];
  popular?: string[];
  value: string;
  onChange: (val: string) => void;
  onCommit?: (val: string) => void;
  placeholder: string;
  disabled?: boolean;
  hasError?: boolean;
  id?: string;
  escapeLabel?: string;
  autoFocus?: boolean;
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const escapeMatch = escapeLabel ? options.find(o => o === escapeLabel) : undefined;
    const filteredOptions = escapeMatch ? options.filter(o => o !== escapeLabel) : options;
    const andereOption = escapeMatch;
    const optionsWithoutAndere = filteredOptions;

    if (!query) {
      if (popular && popular.length > 0) {
        const popularSet = new Set(popular);
        const rest = optionsWithoutAndere.filter((o) => !popularSet.has(o));
        return { popular: popular.filter((p) => options.includes(p)), rest, andere: andereOption };
      }
      return { popular: [], rest: optionsWithoutAndere, andere: andereOption };
    }
    const lower = query.trim().toLowerCase();
    if (!lower) return { popular: [], rest: optionsWithoutAndere, andere: andereOption };
    const startsWith: string[] = [];
    const contains: string[] = [];
    const fuzzy: { option: string; score: number }[] = [];
    for (const o of optionsWithoutAndere) {
      const oLower = o.toLowerCase();
      if (oLower.startsWith(lower)) startsWith.push(o);
      else if (oLower.includes(lower)) contains.push(o);
      else {
        const score = fuzzyScore(lower, oLower);
        if (score > 0) fuzzy.push({ option: o, score });
      }
    }
    fuzzy.sort((a, b) => b.score - a.score);
    return { popular: [], rest: [...startsWith, ...contains, ...fuzzy.map(f => f.option)], andere: andereOption };
  }, [options, popular, query, escapeLabel]);

  const hasResults = results.popular.length > 0 || results.rest.length > 0 || !!results.andere;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled && !value) {
      const timeout = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timeout);
    }
  }, [autoFocus, disabled, value]);

  const handleSelect = (val: string) => {
    onChange(val);
    onCommit?.(val);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={value || query}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={cn(
          "h-12 text-base",
          hasError && "border-red-500 ring-red-500/20 ring-2"
        )}
        onChange={(e) => {
          const val = e.target.value;
          setQuery(val);
          onChange(val);
          setOpen(true);
        }}
        onFocus={() => {
          if (options.length > 0) setOpen(true);
          if (value) inputRef.current?.select();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (open && results.rest.length === 1) {
              handleSelect(results.rest[0]);
            } else {
              setOpen(false);
              if (value) onCommit?.(value.trim());
            }
          }
          if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        onBlur={() => {
          const trimmed = value?.trim();
          if (trimmed && trimmed !== value) onChange(trimmed);
          if (trimmed) onCommit?.(trimmed);
        }}
      />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
          {/* Popular section */}
          {results.popular.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Beliebt</div>
              {results.popular.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => handleSelect(o)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm transition-colors",
                    "hover:bg-primary/5 active:bg-primary/10",
                    o === value && "bg-primary/10 font-medium text-primary"
                  )}
                >
                  {o}
                </button>
              ))}
              {results.rest.length > 0 && (
                <div className="border-t my-1" />
              )}
            </>
          )}
          {/* All results — no artificial limit */}
          {results.rest.length > 0 && (
            <>
              {!!query && results.popular.length === 0 && (
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Ergebnisse</div>
              )}
              {!query && results.popular.length > 0 && (
                <div className="px-3 pt-1 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Alle Hersteller</div>
              )}
              {results.rest.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => handleSelect(o)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm transition-colors",
                    "hover:bg-primary/5 active:bg-primary/10",
                    o === value && "bg-primary/10 font-medium text-primary"
                  )}
                >
                  {o}
                </button>
              ))}
            </>
          )}
          {/* "Andere" always visible at bottom as escape hatch */}
          {results.andere && (
            <>
              <div className="border-t my-1" />
              <button
                type="button"
                onClick={() => handleSelect(results.andere!)}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-sm transition-colors text-muted-foreground",
                  "hover:bg-primary/5 active:bg-primary/10",
                  results.andere === value && "bg-primary/10 font-medium text-primary"
                )}
              >
                {results.andere} – Nicht in der Liste
              </button>
            </>
          )}
          {/* Hint when no exact matches found but user is typing */}
          {results.rest.length === 0 && results.popular.length === 0 && query.trim().length > 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              <p>Kein Treffer für „{query}" — <strong className="text-foreground">einfach eintippen</strong> und mit Eingabetaste bestätigen.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const VehicleInfoStep = ({ formData, updateFormData, fieldErrors = {} }: VehicleInfoStepProps) => {
  const vehicleType = formData.vehicleType || "Wohnmobil";
  const isWohnwagen = vehicleType === "Wohnwagen";
  const manufacturers = useMemo(() => {
    return isWohnwagen ? wohnwagenManufacturers : popularManufacturers;
  }, [isWohnwagen]);

  const models = useMemo(() => {
    if (!formData.manufacturer) return [];
    const m = isWohnwagen
      ? wohnwagenManufacturerModels[formData.manufacturer]
      : manufacturerModels[formData.manufacturer];
    if (!m || m.length === 0) return ["Sonstiges Modell"];
    if (m.includes("Sonstiges Modell")) return m;
    return [...m, "Sonstiges Modell"];
  }, [formData.manufacturer, isWohnwagen]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear + 1; y >= 1980; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const handleManufacturerChange = useCallback((value: string) => {
    if (value !== formData.manufacturer) {
      updateFormData({ manufacturer: value, model: "" });
    } else {
      updateFormData({ manufacturer: value });
    }
  }, [formData.manufacturer, updateFormData]);

  const resolveManufacturerOnCommit = useCallback((value: string) => {
    const resolved = resolveManufacturer(value);
    if (resolved !== value) {
      updateFormData({ manufacturer: resolved, model: "" });
    }
  }, [updateFormData]);

  const totalRequired = isWohnwagen ? 4 : 5;
  const filledCount = [
    formData.manufacturer?.trim(),
    formData.model?.trim(),
    formData.year,
    ...(!isWohnwagen ? [formData.mileage] : []),
    formData.condition,
  ].filter(Boolean).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Info className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Fahrzeugdaten
        </h2>
        <p className="text-sm text-muted-foreground">
          Beschreiben Sie Ihr {vehicleType} – dauert nur eine Minute
        </p>
      </div>

      {/* Body type badge */}
      {formData.bodyType && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm w-fit">
          <Check className="w-3.5 h-3.5 text-primary" />
          <span className="text-primary font-medium">{vehicleType} · {formData.bodyType}</span>
        </div>
      )}

      {/* ===== ALL FIELDS VISIBLE AT ONCE ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Hersteller – searchable combobox */}
        <div className="space-y-1.5">
          <Label htmlFor="manufacturer" className={cn(fieldErrors.manufacturer && "text-red-600")}>
            Hersteller <span className="text-red-500">*</span>
          </Label>
          <SearchableSelect
            id="manufacturer"
            options={manufacturers}
            popular={isWohnwagen ? POPULAR_WOHNWAGEN : POPULAR_WOHNMOBIL}
            value={formData.manufacturer}
            onChange={handleManufacturerChange}
            onCommit={resolveManufacturerOnCommit}
            placeholder="z.B. Hymer, Dethleffs, Bürstner..."
            hasError={!!fieldErrors.manufacturer}
            escapeLabel="Andere"
            autoFocus
          />
          {fieldErrors.manufacturer && (
            <p className="text-sm text-red-600">{fieldErrors.manufacturer}</p>
          )}
        </div>

        {/* Modell – searchable combobox, populated by manufacturer */}
        <div className="space-y-1.5">
          <Label htmlFor="model" className={cn(fieldErrors.model && "text-red-600")}>
            Modell / Baureihe <span className="text-red-500">*</span>
          </Label>
          <SearchableSelect
            id="model"
            options={models}
            value={formData.model}
            onChange={(val) => updateFormData({ model: val })}
            placeholder={formData.manufacturer ? `Modell von ${formData.manufacturer}...` : "Erst Hersteller wählen"}
            disabled={!formData.manufacturer}
            hasError={!!fieldErrors.model}
            escapeLabel="Sonstiges Modell"
          />
          {fieldErrors.model && (
            <p className="text-sm text-red-600">{fieldErrors.model}</p>
          )}
        </div>

        {/* Baujahr */}
        <div className="space-y-1.5">
          <Label htmlFor="year" className={cn("flex items-center gap-2", fieldErrors.year && "text-red-600")}>
            <Calendar className="w-4 h-4" />
            Baujahr <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.year?.toString() || ""}
            onValueChange={(value) => updateFormData({ year: parseInt(value) })}
          >
            <SelectTrigger id="year" className={cn("h-12 text-base", fieldErrors.year && "border-red-500 ring-red-500/20 ring-2")}>
              <SelectValue placeholder="Baujahr wählen" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.year && (
            <p className="text-sm text-red-600">{fieldErrors.year}</p>
          )}
        </div>

        {/* Kilometerstand – nur Wohnmobil */}
        {!isWohnwagen && (
          <div className="space-y-1.5">
            <Label htmlFor="mileage" className={cn("flex items-center gap-2", fieldErrors.mileage && "text-red-600")}>
              <Gauge className="w-4 h-4" />
              Kilometerstand <span className="text-red-500">*</span>
            </Label>
            <Input
              id="mileage"
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="z.B. 45000"
              value={formData.mileage || ""}
              onChange={(e) => updateFormData({ mileage: parseInt(e.target.value) || null })}
              min={0}
              className={cn("h-12 text-base", fieldErrors.mileage && "border-red-500 ring-red-500/20 ring-2")}
            />
            {fieldErrors.mileage && (
              <p className="text-sm text-red-600">{fieldErrors.mileage}</p>
            )}
          </div>
        )}
      </div>

      {/* Zustand – full width, visual tiles */}
      <div className="space-y-1.5">
        <Label className={cn(fieldErrors.condition && "text-red-600")}>
          Zustand <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {[
            { value: "Neuwertig", emoji: "✨", short: "Neuwertig" },
            { value: "Sehr gepflegt", emoji: "👍", short: "Sehr gut" },
            { value: "Gepflegt", emoji: "👌", short: "Gepflegt" },
            { value: "Gebrauchsspuren", emoji: "🔧", short: "Gebraucht" },
            { value: "Reparaturbedürftig", emoji: "⚠️", short: "Reparatur" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateFormData({ condition: opt.value })}
              className={cn(
                "min-h-[52px] px-1.5 py-2 rounded-lg border-2 text-center font-medium transition-all flex flex-col items-center justify-center gap-0.5",
                "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]",
                formData.condition === opt.value
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border bg-background text-foreground"
              )}
            >
              <span className="text-lg leading-none">{opt.emoji}</span>
              <span className="text-[11px] sm:text-xs leading-tight sm:hidden">{opt.short}</span>
              <span className="text-xs leading-tight hidden sm:block">{opt.value}</span>
            </button>
          ))}
        </div>
        {fieldErrors.condition && (
          <p className="text-sm text-red-600">{fieldErrors.condition}</p>
        )}
      </div>

      {/* Positive reinforcement when all fields filled */}
      {filledCount === totalRequired && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2 text-sm animate-fade-in">
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-green-700 dark:text-green-300 font-medium">
            Alle Angaben vollständig – klicken Sie auf „Weiter"!
          </span>
        </div>
      )}
    </div>
  );
};
