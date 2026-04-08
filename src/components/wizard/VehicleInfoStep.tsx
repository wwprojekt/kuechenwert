import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Calendar, Gauge, Info, Check } from "lucide-react";
import { popularManufacturers, wohnwagenManufacturers, manufacturerModels, wohnwagenManufacturerModels } from "@/lib/vehicle-data";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface VehicleInfoStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  fieldErrors?: Record<string, string>;
}

/**
 * Searchable Combobox – simple input that filters a list.
 * Used for Hersteller and Modell selection (like AutoScout24).
 */
const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  hasError,
  id,
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  disabled?: boolean;
  hasError?: boolean;
  id?: string;
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query) return options;
    const lower = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(lower));
  }, [options, query]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // When value is set externally (e.g. reset), sync the query
  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);

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
          // Select all text on focus for easy replacement
          if (value) inputRef.current?.select();
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-[220px] overflow-y-auto">
          {filtered.slice(0, 50).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                onChange(o);
                setQuery("");
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-4 py-3 text-sm transition-colors",
                "hover:bg-primary/5 active:bg-primary/10",
                o === value && "bg-primary/10 font-medium text-primary"
              )}
            >
              {o}
            </button>
          ))}
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
    return m || [];
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
    // When manufacturer changes, reset model
    if (value !== formData.manufacturer) {
      updateFormData({ manufacturer: value, model: "" });
    } else {
      updateFormData({ manufacturer: value });
    }
  }, [formData.manufacturer, updateFormData]);

  // Micro-progress
  const totalRequired = isWohnwagen ? 4 : 5;
  const filledCount = [
    formData.manufacturer && manufacturers.includes(formData.manufacturer) ? formData.manufacturer : null,
    formData.model,
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

      {/* Body type badge + micro-progress */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {formData.bodyType && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm">
            <Check className="w-3.5 h-3.5 text-primary" />
            <span className="text-primary font-medium">{vehicleType} · {formData.bodyType}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
          <div className="flex gap-0.5">
            {Array.from({ length: totalRequired }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-5 h-1.5 rounded-full transition-colors",
                  i < filledCount ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
          <span>{filledCount} von {totalRequired}</span>
        </div>
      </div>

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
            value={formData.manufacturer}
            onChange={handleManufacturerChange}
            placeholder="Hersteller eingeben..."
            hasError={!!fieldErrors.manufacturer}
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
            placeholder={formData.manufacturer ? "Modell eingeben..." : "Erst Hersteller wählen"}
            disabled={!formData.manufacturer}
            hasError={!!fieldErrors.model}
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
