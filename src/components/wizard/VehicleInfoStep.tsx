import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Calendar, Gauge, Info, Check, X } from "lucide-react";
import { popularManufacturers, wohnwagenManufacturers, manufacturerModels, wohnwagenManufacturerModels, resolveManufacturer } from "@/lib/vehicle-data";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface VehicleInfoStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  fieldErrors?: Record<string, string>;
}

// Popular manufacturers – sorted by ACTUAL usage frequency from wizard_sessions data
// (last 60 days, Wohnmobil only, "Andere" excluded). Hobby + Fendt moved out of
// Wohnmobil list because they are primarily Wohnwagen brands (not in Top-20 for
// Wohnmobil). Fiat (16), Pilote (12), Mercedes-Benz (8), Eura Mobil (8) added
// because they appear in the Top-16 selections but were missing from the list.
const POPULAR_WOHNMOBIL = ["Hymer", "Bürstner", "Pössl", "Weinsberg", "Knaus", "Dethleffs", "Fiat", "Ford", "Adria", "Pilote", "Volkswagen", "Chausson", "LMC", "Mercedes-Benz", "Eura Mobil", "Carthago"];
const POPULAR_WOHNWAGEN = ["Hobby", "Fendt", "Dethleffs", "Tabbert", "Adria", "Bürstner", "Knaus", "LMC", "Weinsberg", "Eriba", "Niewiadow", "TEC"];

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
};

// Normalisiert für die Suche: lowercase + alle Nicht-Alphanumerischen weg.
// "T 65" → "t65", "CaraCore" → "caracore", "Cara Core" → "caracore",
// "Concord-Compact" → "concordcompact". Damit fängt die Eingabe "T65"
// die Liste mit "T 65" ab und "Cara Core" findet "CaraCore".
const normalizeForSearch = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "");

const fuzzyScore = (query: string, target: string): number => {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 1;

  // Whitespace-/Sonderzeichen-insensitiver Match (z.B. "t65" → "T 65")
  const qN = normalizeForSearch(query);
  const tN = normalizeForSearch(target);
  if (qN.length >= 2 && tN.includes(qN)) return 0.95;

  if (q.length < 2 || t.length < 2) return 0;

  const qBigrams = new Set<string>();
  for (let i = 0; i < q.length - 1; i++) qBigrams.add(q.slice(i, i + 2));
  let shared = 0;
  for (let i = 0; i < t.length - 1; i++) {
    if (qBigrams.has(t.slice(i, i + 2))) shared++;
  }
  const bigramScore = (2 * shared) / (q.length - 1 + t.length - 1);

  if (q.length >= 3) {
    for (let i = 0; i < q.length; i++) {
      const reduced = q.slice(0, i) + q.slice(i + 1);
      if (t.includes(reduced)) return 0.7;
    }
  }

  return bigramScore >= 0.3 ? bigramScore * 0.5 : 0;
};

/**
 * Searchable Combobox – typing only updates internal search query.
 * Parent onChange/onCommit are called only when user selects from
 * dropdown, presses Enter, or blurs with a non-empty value.
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
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);
  const isMobile = useIsMobile();

  const results = useMemo(() => {
    const searchTerm = isFocused ? query : "";
    const escapeMatch = escapeLabel ? options.find(o => o === escapeLabel) : undefined;
    const filteredOptions = escapeMatch ? options.filter(o => o !== escapeLabel) : options;
    const andereOption = escapeMatch;
    const optionsWithoutAndere = filteredOptions;

    if (!searchTerm) {
      if (popular && popular.length > 0) {
        const popularSet = new Set(popular);
        const rest = optionsWithoutAndere.filter((o) => !popularSet.has(o));
        return { popular: popular.filter((p) => options.includes(p)), rest, andere: andereOption, customInput: null };
      }
      return { popular: [], rest: optionsWithoutAndere, andere: andereOption, customInput: null };
    }
    const lower = searchTerm.trim().toLowerCase();
    if (!lower) return { popular: [], rest: optionsWithoutAndere, andere: andereOption, customInput: null };
    // Whitespace-/Sonderzeichen-insensitive Variante des Such-Strings.
    // Damit "T65" auch "T 65" findet und "Cara Core" auch "CaraCore".
    const lowerN = normalizeForSearch(lower);
    const startsWith: string[] = [];
    const contains: string[] = [];
    const normMatches: string[] = [];
    const fuzzy: { option: string; score: number }[] = [];
    let exactMatch = false;
    for (const o of optionsWithoutAndere) {
      const oLower = o.toLowerCase();
      const oN = normalizeForSearch(o);
      if (oLower === lower) exactMatch = true;
      if (oLower.startsWith(lower)) {
        startsWith.push(o);
      } else if (oLower.includes(lower)) {
        contains.push(o);
      } else if (lowerN.length >= 2 && oN.includes(lowerN)) {
        normMatches.push(o);
      } else {
        const score = fuzzyScore(lower, oLower);
        if (score > 0) fuzzy.push({ option: o, score });
      }
    }
    fuzzy.sort((a, b) => b.score - a.score);
    // Wenn die Eingabe NICHT exakt einem Listeneintrag entspricht, bieten wir
    // sie als prominenten "Eingabe übernehmen"-Button ganz oben an.
    // Das ist die kritische UX gegen Wizard-Abbrüche bei seltenen Marken/Modellen
    // – der Nutzer darf nie das Gefühl haben, dass die Liste ihn blockiert.
    const trimmedQuery = searchTerm.trim();
    const customInput = !exactMatch && trimmedQuery.length >= 2 ? trimmedQuery : null;
    return {
      popular: [],
      rest: [...startsWith, ...contains, ...normMatches, ...fuzzy.map(f => f.option)],
      andere: andereOption,
      customInput,
    };
  }, [options, popular, query, escapeLabel, isFocused]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Sync query to value when value changes externally (e.g. chip selection)
  useEffect(() => {
    if (!isFocused) setQuery(value || "");
  }, [value, isFocused]);

  // Only autoFocus on desktop – mobile keyboard auto-open kills UX
  useEffect(() => {
    if (autoFocus && !isMobile && inputRef.current && !disabled && !value) {
      const timeout = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timeout);
    }
  }, [autoFocus, disabled, value, isMobile]);

  const commitValue = useCallback((val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    onChange(trimmed);
    onCommit?.(trimmed);
  }, [onChange, onCommit]);

  const handleSelect = useCallback((val: string) => {
    const trimmed = val.trim();
    skipBlurCommitRef.current = true;
    setQuery(trimmed);
    setOpen(false);
    setIsFocused(false);
    onChange(trimmed);
    onCommit?.(trimmed);
    inputRef.current?.blur();
  }, [onChange, onCommit]);

  const dropdownMaxH = isMobile ? "max-h-[200px]" : "max-h-[300px]";

  // Show the typed query while focused, otherwise the committed value
  const displayValue = isFocused ? query : (value || "");

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={displayValue}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={cn(
          "h-12 text-base",
          hasError && "border-red-500 ring-red-500/20 ring-2"
        )}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setIsFocused(true);
          setQuery(value || "");
          if (options.length > 0) setOpen(true);
          if (value) {
            setTimeout(() => inputRef.current?.select(), 0);
          }
          if (isMobile && wrapperRef.current) {
            setTimeout(() => {
              wrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 300);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (open && results.rest.length === 1) {
              handleSelect(results.rest[0]);
            } else {
              skipBlurCommitRef.current = true;
              setOpen(false);
              setIsFocused(false);
              commitValue(query);
              inputRef.current?.blur();
            }
          }
          if (e.key === 'Escape') {
            skipBlurCommitRef.current = true;
            setOpen(false);
            setIsFocused(false);
            setQuery(value || "");
            inputRef.current?.blur();
          }
        }}
        onBlur={() => {
          setIsFocused(false);
          if (skipBlurCommitRef.current) {
            skipBlurCommitRef.current = false;
            return;
          }
          const trimmed = query.trim();
          if (trimmed && trimmed !== value) {
            commitValue(trimmed);
          }
        }}
      />
      {open && (
        <div className={cn("absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg overflow-y-auto", dropdownMaxH)}>
          {/* Free-Text-Übernahme ganz oben: macht klar, dass der User
              jede Eingabe verwenden darf – wichtigster Anti-Abbruch-Hebel
              für Schritt 2 des Verkaufs-Wizards. */}
          {results.customInput && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(results.customInput!)}
              className="w-full text-left px-4 py-3 text-sm bg-primary/5 hover:bg-primary/10 active:bg-primary/15 border-b transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4 text-primary flex-shrink-0" />
              <span>
                <span className="text-muted-foreground">Eingabe übernehmen: </span>
                <strong className="text-foreground">„{results.customInput}"</strong>
              </span>
            </button>
          )}
          {results.popular.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Beliebt</div>
              {results.popular.map((o) => (
                <button
                  key={o}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
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
          {results.rest.length > 0 && (
            <>
              {!!query && results.popular.length === 0 && isFocused && (
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Ergebnisse</div>
              )}
              {!query && results.popular.length > 0 && (
                <div className="px-3 pt-1 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Alle Hersteller</div>
              )}
              {results.rest.map((o) => (
                <button
                  key={o}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
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
          {results.andere && (
            <>
              <div className="border-t my-1" />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
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
          {results.rest.length === 0 && results.popular.length === 0 && !results.customInput && query.trim().length > 0 && query.trim().length < 2 && isFocused && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              <p>Bitte mindestens 2 Zeichen eingeben.</p>
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
  const isMobile = useIsMobile();

  const manufacturers = useMemo(() => {
    return isWohnwagen ? wohnwagenManufacturers : popularManufacturers;
  }, [isWohnwagen]);

  const popularList = isWohnwagen ? POPULAR_WOHNWAGEN : POPULAR_WOHNMOBIL;

  const models = useMemo(() => {
    if (!formData.manufacturer) return [];
    // Defensive: trim vor dem Lookup, damit ein "Bürstner " (Whitespace aus
    // Legacy-Daten oder URL-Params, die dem Commit-Pfad entgangen sind)
    // trotzdem die korrekte Modell-Liste liefert statt einer leeren.
    const cleanMfr = formData.manufacturer.trim();
    const resolved = resolveManufacturer(cleanMfr);
    const mfr = resolved !== cleanMfr ? resolved : cleanMfr;
    const m = isWohnwagen
      ? wohnwagenManufacturerModels[mfr]
      : manufacturerModels[mfr];
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

  const handleManufacturerCommit = useCallback((value: string) => {
    const trimmed = value.trim();
    const resolved = resolveManufacturer(trimmed);
    const final = resolved !== trimmed ? resolved : trimmed;
    if (final !== formData.manufacturer) {
      updateFormData({ manufacturer: final, model: "" });
    }
  }, [formData.manufacturer, updateFormData]);

  const totalRequired = isWohnwagen ? 4 : 5;
  const filledCount = [
    formData.manufacturer?.trim(),
    formData.model?.trim(),
    formData.year,
    ...(!isWohnwagen ? [formData.mileage] : []),
    formData.condition,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3 sm:space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-0.5 sm:mb-1 flex items-center gap-2">
          <Info className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Fahrzeugdaten
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
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

      {/* === HERSTELLER === */}
      <div className="space-y-2">
        <Label className={cn(fieldErrors.manufacturer && "text-red-600")}>
          Hersteller <span className="text-red-500">*</span>
        </Label>

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchableSelect
              id="manufacturer"
              options={manufacturers}
              popular={popularList}
              value={formData.manufacturer}
              onChange={handleManufacturerCommit}
              onCommit={handleManufacturerCommit}
              placeholder="Hersteller auswählen oder eingeben..."
              hasError={!!fieldErrors.manufacturer}
              escapeLabel="Andere"
              autoFocus
            />
          </div>
          {formData.manufacturer && (
            <button
              type="button"
              onClick={() => updateFormData({ manufacturer: "", model: "" })}
              className="h-12 px-3 rounded-lg border border-border hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Hersteller zurücksetzen"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {fieldErrors.manufacturer && (
          <p className="text-sm text-red-600">{fieldErrors.manufacturer}</p>
        )}
      </div>

      {/* === REMAINING FIELDS (only after manufacturer is committed) === */}
      {formData.manufacturer && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Modell */}
            <div className="space-y-1.5">
              <Label htmlFor="model" className={cn(fieldErrors.model && "text-red-600")}>
                Modell / Baureihe <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                id="model"
                options={models}
                value={formData.model}
                onChange={(val) => updateFormData({ model: val.trim() })}
                onCommit={(val) => updateFormData({ model: val.trim() })}
                placeholder={`Modell von ${formData.manufacturer}...`}
                hasError={!!fieldErrors.model}
                escapeLabel="Sonstiges Modell"
                autoFocus={!isMobile}
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
                  type="text"
                  inputMode="numeric"
                  placeholder="z.B. 45000"
                  value={formData.mileage || ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    updateFormData({ mileage: digits ? parseInt(digits) : null });
                  }}
                  className={cn("h-12 text-base", fieldErrors.mileage && "border-red-500 ring-red-500/20 ring-2")}
                />
                {fieldErrors.mileage && (
                  <p className="text-sm text-red-600">{fieldErrors.mileage}</p>
                )}
              </div>
            )}
          </div>

          {/* Zustand – visual tiles */}
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
        </div>
      )}

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
