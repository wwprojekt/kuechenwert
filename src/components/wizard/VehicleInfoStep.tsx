import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Calendar, Gauge, Info, Check, Search } from "lucide-react";
import { popularManufacturers, wohnwagenManufacturers, manufacturerModels, wohnwagenManufacturerModels } from "@/lib/vehicle-data";
import { useMemo, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface VehicleInfoStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  fieldErrors?: Record<string, string>;
}

// Top manufacturers by market share (shown prominently)
const TOP_WOHNMOBIL = ["Hymer", "Dethleffs", "Bürstner", "Knaus", "Carthago", "Hobby", "Pössl", "Adria", "Carado", "Chausson", "Fendt", "Frankia"];
const TOP_WOHNWAGEN = ["Hobby", "Fendt", "Knaus", "Dethleffs", "Bürstner", "Tabbert", "Adria", "Weinsberg", "LMC", "Eriba"];

export const VehicleInfoStep = ({ formData, updateFormData, fieldErrors = {} }: VehicleInfoStepProps) => {
  const vehicleType = formData.vehicleType || "Wohnmobil";
  const isWohnwagen = vehicleType === "Wohnwagen";
  const [showAllManufacturers, setShowAllManufacturers] = useState(false);
  const [manufacturerSearch, setManufacturerSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const topManufacturers = isWohnwagen ? TOP_WOHNWAGEN : TOP_WOHNMOBIL;
  const allManufacturers = useMemo(() => {
    return isWohnwagen ? wohnwagenManufacturers : popularManufacturers;
  }, [isWohnwagen]);

  const modelOptions = useMemo(() => {
    if (!formData.manufacturer) return [];
    const models = isWohnwagen
      ? wohnwagenManufacturerModels[formData.manufacturer]
      : manufacturerModels[formData.manufacturer];
    return models || [];
  }, [formData.manufacturer, isWohnwagen]);

  const filteredModels = useMemo(() => {
    if (!modelSearch) return modelOptions;
    const lower = modelSearch.toLowerCase();
    return modelOptions.filter((m) => m.toLowerCase().includes(lower));
  }, [modelOptions, modelSearch]);

  const filteredManufacturers = useMemo(() => {
    const remaining = allManufacturers.filter((m) => !topManufacturers.includes(m));
    if (!manufacturerSearch) return remaining;
    const lower = manufacturerSearch.toLowerCase();
    return remaining.filter((m) => m.toLowerCase().includes(lower));
  }, [allManufacturers, topManufacturers, manufacturerSearch]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear + 1; y >= 1980; y--) {
      years.push(y);
    }
    return years;
  }, []);

  // Close model dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node) &&
        modelInputRef.current &&
        !modelInputRef.current.contains(e.target as Node)
      ) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleManufacturerSelect = (value: string) => {
    updateFormData({ manufacturer: value, model: "" });
    setShowAllManufacturers(false);
    setManufacturerSearch("");
    setModelSearch("");
  };

  const handleModelSelect = (model: string) => {
    updateFormData({ model });
    setModelSearch("");
    setShowModelDropdown(false);
  };

  // Count filled fields for micro-progress
  const totalRequired = isWohnwagen ? 4 : 5; // manufacturer, model, year, (mileage), condition
  const filledCount = [
    formData.manufacturer,
    formData.model,
    formData.year,
    ...(!isWohnwagen ? [formData.mileage] : []),
    formData.condition,
  ].filter(Boolean).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="mb-2">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Info className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Fahrzeugdaten
        </h2>
        <p className="text-sm text-muted-foreground">
          Beschreiben Sie Ihr {vehicleType} in wenigen Schritten
        </p>
      </div>

      {/* Selected body type badge + micro-progress */}
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

      {/* ===== HERSTELLER ===== */}
      <div className="space-y-3">
        <Label className={cn("flex items-center gap-1 text-base font-semibold", fieldErrors.manufacturer && "text-red-600")}>
          Hersteller wählen <span className="text-red-500">*</span>
        </Label>

        {/* Quick-pick: Top-Hersteller als Chips */}
        {!formData.manufacturer && (
          <>
            <div className="flex flex-wrap gap-2">
              {topManufacturers.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleManufacturerSelect(m)}
                  className="px-3 py-2 rounded-lg border-2 border-border bg-background text-sm font-medium
                    hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm transition-all
                    active:scale-95"
                >
                  {m}
                </button>
              ))}
            </div>

            {!showAllManufacturers ? (
              <button
                type="button"
                onClick={() => setShowAllManufacturers(true)}
                className="text-sm text-primary hover:underline font-medium flex items-center gap-1"
              >
                <Search className="w-3.5 h-3.5" />
                Alle {allManufacturers.length} Hersteller anzeigen
              </button>
            ) : (
              <div className="space-y-2 animate-fade-in">
                <Input
                  type="text"
                  placeholder="Hersteller suchen..."
                  value={manufacturerSearch}
                  onChange={(e) => setManufacturerSearch(e.target.value)}
                  className="h-10"
                  autoFocus
                />
                <div className="max-h-[200px] overflow-y-auto border rounded-lg divide-y">
                  {filteredManufacturers.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleManufacturerSelect(m)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 transition-colors"
                    >
                      {m}
                    </button>
                  ))}
                  {filteredManufacturers.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Kein Hersteller gefunden</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Selected manufacturer badge */}
        {formData.manufacturer && (
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-sm font-semibold text-primary">
              <Check className="w-4 h-4" />
              {formData.manufacturer}
            </div>
            <button
              type="button"
              onClick={() => {
                updateFormData({ manufacturer: "", model: "" });
                setShowAllManufacturers(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Ändern
            </button>
          </div>
        )}
        {fieldErrors.manufacturer && (
          <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.manufacturer}</p>
        )}
      </div>

      {/* ===== MODELL (shown after manufacturer) ===== */}
      {formData.manufacturer && (
        <div className="space-y-3 animate-fade-in">
          <Label className={cn("flex items-center gap-1 text-base font-semibold", fieldErrors.model && "text-red-600")}>
            Modell / Baureihe <span className="text-red-500">*</span>
          </Label>

          {/* Model quick-pick chips (if models available) */}
          {modelOptions.length > 0 && !formData.model && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {modelOptions.slice(0, 12).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleModelSelect(m)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm
                      hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-95"
                  >
                    {m}
                  </button>
                ))}
              </div>
              {modelOptions.length > 12 && (
                <p className="text-xs text-muted-foreground">+ {modelOptions.length - 12} weitere Modelle</p>
              )}
            </div>
          )}

          {/* Model input with autocomplete dropdown */}
          <div className="relative">
            <Input
              ref={modelInputRef}
              id="model"
              type="text"
              placeholder={modelOptions.length > 0 ? "Modell wählen oder eingeben..." : "z.B. B-Klasse, California, Coral..."}
              value={formData.model || modelSearch}
              onChange={(e) => {
                const val = e.target.value;
                setModelSearch(val);
                updateFormData({ model: val });
                setShowModelDropdown(val.length > 0 && filteredModels.length > 0);
              }}
              onFocus={() => {
                if (modelOptions.length > 0 && !formData.model) {
                  setShowModelDropdown(true);
                }
              }}
              className={cn("h-11 text-base transition-smooth", fieldErrors.model && "border-red-500 ring-red-500/20 ring-2")}
              autoComplete="off"
            />
            {showModelDropdown && filteredModels.length > 0 && (
              <div
                ref={modelDropdownRef}
                className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-[200px] overflow-y-auto"
              >
                {filteredModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleModelSelect(m)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 transition-colors"
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {formData.model && (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <Check className="w-3.5 h-3.5" />
              Modell eingetragen
            </div>
          )}
          {fieldErrors.model && (
            <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.model}</p>
          )}
        </div>
      )}

      {/* ===== BAUJAHR + KM + ZUSTAND (shown after model) ===== */}
      {formData.manufacturer && formData.model && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
          {/* Baujahr */}
          <div className="space-y-2">
            <Label htmlFor="year" className={cn("flex items-center gap-2", fieldErrors.year && "text-red-600")}>
              <Calendar className="w-4 h-4" />
              Baujahr <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.year?.toString() || ""}
              onValueChange={(value) => updateFormData({ year: parseInt(value) })}
            >
              <SelectTrigger id="year" className={cn("h-11 transition-smooth", fieldErrors.year && "border-red-500 ring-red-500/20 ring-2")}>
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
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.year}</p>
            )}
          </div>

          {/* Kilometerstand - nur Wohnmobil */}
          {!isWohnwagen && (
            <div className="space-y-2">
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
                className={cn("h-11 transition-smooth", fieldErrors.mileage && "border-red-500 ring-red-500/20 ring-2")}
              />
              {fieldErrors.mileage && (
                <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.mileage}</p>
              )}
            </div>
          )}

          {/* Zustand */}
          <div className={cn("space-y-2", isWohnwagen ? "" : "md:col-span-2")}>
            <Label htmlFor="condition" className={cn("flex items-center gap-1", fieldErrors.condition && "text-red-600")}>
              Zustand <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {[
                { value: "Neuwertig", emoji: "✨" },
                { value: "Sehr gepflegt", emoji: "👍" },
                { value: "Gepflegt", emoji: "👌" },
                { value: "Gebrauchsspuren", emoji: "🔧" },
                { value: "Reparaturbedürftig", emoji: "⚠️" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateFormData({ condition: opt.value })}
                  className={cn(
                    "px-2 py-2.5 rounded-lg border-2 text-center text-xs sm:text-sm font-medium transition-all",
                    "hover:border-primary/50 hover:bg-primary/5",
                    formData.condition === opt.value
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-background text-foreground"
                  )}
                >
                  <span className="block text-base mb-0.5">{opt.emoji}</span>
                  {opt.value}
                </button>
              ))}
            </div>
            {fieldErrors.condition && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.condition}</p>
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
