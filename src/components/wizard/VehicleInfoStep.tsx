import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Calendar, Gauge, Info } from "lucide-react";
import { popularManufacturers, wohnwagenManufacturers } from "@/lib/vehicle-data";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface VehicleInfoStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  fieldErrors?: Record<string, string>;
}

export const VehicleInfoStep = ({ formData, updateFormData, fieldErrors = {} }: VehicleInfoStepProps) => {
  const vehicleType = formData.vehicleType || "Wohnmobil";

  const currentManufacturers = useMemo(() => {
    return vehicleType === "Wohnwagen" ? wohnwagenManufacturers : popularManufacturers;
  }, [vehicleType]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear + 1; y >= 1980; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const handleManufacturerChange = (value: string) => {
    updateFormData({ manufacturer: value, model: "" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Info className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Fahrzeugdaten
        </h2>
        <p className="text-muted-foreground">
          Ein paar Angaben zu Ihrem {vehicleType} – dauert nur 30 Sekunden
        </p>
      </div>

      {formData.bodyType && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-2 text-sm">
          <span className="text-primary font-medium">✓ {vehicleType}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-primary font-medium">{formData.bodyType}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Hersteller */}
        <div className="space-y-2">
          <Label htmlFor="manufacturer" className={cn("flex items-center gap-1", fieldErrors.manufacturer && "text-red-600")}>
            Hersteller <span className="text-red-500">*</span>
          </Label>
          <Select value={formData.manufacturer} onValueChange={handleManufacturerChange}>
            <SelectTrigger id="manufacturer" className={cn("transition-smooth", fieldErrors.manufacturer && "border-red-500 ring-red-500/20 ring-2")}>
              <SelectValue placeholder="Hersteller wählen" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {currentManufacturers.map((manufacturer) => (
                <SelectItem key={manufacturer} value={manufacturer}>
                  {manufacturer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.manufacturer && (
            <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.manufacturer}</p>
          )}
        </div>

        {/* Modell */}
        <div className="space-y-2">
          <Label htmlFor="model" className={cn("flex items-center gap-1", fieldErrors.model && "text-red-600")}>
            Modell / Baureihe <span className="text-red-500">*</span>
          </Label>
          <Input
            id="model"
            type="text"
            placeholder={formData.manufacturer ? "z.B. B-Klasse, California, Coral..." : "Bitte zuerst Hersteller wählen"}
            value={formData.model}
            onChange={(e) => updateFormData({ model: e.target.value })}
            className={cn("transition-smooth", fieldErrors.model && "border-red-500 ring-red-500/20 ring-2")}
            disabled={!formData.manufacturer}
            autoComplete="off"
          />
          {fieldErrors.model && (
            <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.model}</p>
          )}
        </div>

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
            <SelectTrigger id="year" className={cn("transition-smooth", fieldErrors.year && "border-red-500 ring-red-500/20 ring-2")}>
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
        {vehicleType !== "Wohnwagen" && (
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
              className={cn("transition-smooth", fieldErrors.mileage && "border-red-500 ring-red-500/20 ring-2")}
            />
            {fieldErrors.mileage && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.mileage}</p>
            )}
          </div>
        )}

        {/* Zustand */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="condition" className={cn("flex items-center gap-1", fieldErrors.condition && "text-red-600")}>
            Zustand <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.condition}
            onValueChange={(value) => updateFormData({ condition: value })}
          >
            <SelectTrigger id="condition" className={cn("transition-smooth", fieldErrors.condition && "border-red-500 ring-red-500/20 ring-2")}>
              <SelectValue placeholder="Zustand wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Neuwertig">Neuwertig</SelectItem>
              <SelectItem value="Sehr gepflegt">Sehr gepflegt</SelectItem>
              <SelectItem value="Gepflegt">Gepflegt</SelectItem>
              <SelectItem value="Gebrauchsspuren">Gebrauchsspuren</SelectItem>
              <SelectItem value="Reparaturbedürftig">Reparaturbedürftig</SelectItem>
            </SelectContent>
          </Select>
          {fieldErrors.condition && (
            <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.condition}</p>
          )}
        </div>
      </div>
    </div>
  );
};
