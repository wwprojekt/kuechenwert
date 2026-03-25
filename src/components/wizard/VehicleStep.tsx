import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Car, Calendar, Gauge, Users, TrendingUp, Caravan } from "lucide-react";
import {
  popularManufacturers, bodyTypes,
  wohnwagenManufacturers, wohnwagenBodyTypes,
  vehicleTypes,
} from "@/lib/vehicle-data";
import { useMemo, useState } from "react";

interface VehicleStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

export const VehicleStep = ({ formData, updateFormData }: VehicleStepProps) => {
  // Fahrzeugtyp-State (default: Wohnmobil für Abwärtskompatibilität)
  const [vehicleType, setVehicleType] = useState<string>(
    (formData as Record<string, unknown>).vehicleType as string || "Wohnmobil"
  );

  // Dynamische Hersteller basierend auf Fahrzeugtyp
  const currentManufacturers = useMemo(() => {
    return vehicleType === "Wohnwagen" ? wohnwagenManufacturers : popularManufacturers;
  }, [vehicleType]);

  // Dynamische Aufbauarten basierend auf Fahrzeugtyp
  const currentBodyTypes = useMemo(() => {
    return vehicleType === "Wohnwagen" ? wohnwagenBodyTypes : bodyTypes;
  }, [vehicleType]);

  // Baujahr-Optionen (aktuelles Jahr+1 bis 1980)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear + 1; y >= 1980; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const handleVehicleTypeChange = (value: string) => {
    setVehicleType(value);
    // Reset manufacturer, model, bodyType when vehicle type changes
    updateFormData({
      manufacturer: "",
      model: "",
      bodyType: "",
    });
  };

  const handleManufacturerChange = (value: string) => {
    // Wenn Hersteller wechselt, Modell zurücksetzen
    updateFormData({ manufacturer: value, model: "" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Car className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Welches Fahrzeug möchten Sie verkaufen?
        </h2>
        <p className="text-muted-foreground">
          Wählen Sie Ihr Fahrzeug aus – das dauert nur 30 Sekunden
        </p>
      </div>

      {/* FOMO-Element */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
        <div className="flex items-center gap-1 text-primary">
          <Users className="w-4 h-4" />
          <TrendingUp className="w-4 h-4" />
        </div>
        <p className="text-sm text-foreground">
          <strong>127 Händler</strong> suchen aktuell nach {vehicleType === "Wohnwagen" ? "Wohnwagen" : "Wohnmobilen"} in Ihrer Region
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Fahrzeugtyp - Wohnmobil / Wohnwagen */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="vehicleType" className="flex items-center gap-1">
            Fahrzeugtyp <span className="text-red-500">*</span>
          </Label>
          <div className="grid grid-cols-2 gap-3">
            {vehicleTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleVehicleTypeChange(type.value)}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all font-medium text-sm ${
                  vehicleType === type.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                {type.value === "Wohnmobil" ? (
                  <Car className="w-5 h-5" />
                ) : (
                  <Caravan className="w-5 h-5" />
                )}
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hersteller - Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="manufacturer" className="flex items-center gap-1">
            Hersteller <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.manufacturer}
            onValueChange={handleManufacturerChange}
          >
            <SelectTrigger id="manufacturer" className="transition-smooth">
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
        </div>

        {/* Modell - Freitexteingabe */}
        <div className="space-y-2">
          <Label htmlFor="model" className="flex items-center gap-1">
            Modell / Baureihe <span className="text-red-500">*</span>
          </Label>
          <Input
            id="model"
            type="text"
            placeholder={formData.manufacturer ? "z.B. B-Klasse, California, Coral..." : "Bitte zuerst Hersteller wählen"}
            value={formData.model}
            onChange={(e) => updateFormData({ model: e.target.value })}
            className="transition-smooth"
            disabled={!formData.manufacturer}
            autoComplete="off"
          />
        </div>

        {/* Aufbauart - Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="bodyType" className="flex items-center gap-1">
            Aufbauart <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.bodyType}
            onValueChange={(value) => updateFormData({ bodyType: value })}
          >
            <SelectTrigger id="bodyType" className="transition-smooth">
              <SelectValue placeholder="Aufbauart wählen" />
            </SelectTrigger>
            <SelectContent>
              {currentBodyTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Baujahr - Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="year" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Baujahr <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.year?.toString() || ""}
            onValueChange={(value) => updateFormData({ year: parseInt(value) })}
          >
            <SelectTrigger id="year" className="transition-smooth">
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
        </div>

        {/* Kilometerstand */}
        <div className="space-y-2">
          <Label htmlFor="mileage" className="flex items-center gap-2">
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
            className="transition-smooth"
          />
        </div>

        {/* Zustand */}
        <div className="space-y-2">
          <Label htmlFor="condition" className="flex items-center gap-1">
            Zustand <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.condition}
            onValueChange={(value) => updateFormData({ condition: value })}
          >
            <SelectTrigger id="condition" className="transition-smooth">
              <SelectValue placeholder="Zustand wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Neuwertig">Neuwertig</SelectItem>
              <SelectItem value="Sehr gut">Sehr gut</SelectItem>
              <SelectItem value="Gut">Gut</SelectItem>
              <SelectItem value="Befriedigend">Befriedigend</SelectItem>
              <SelectItem value="Reparaturbedürftig">Reparaturbedürftig</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Vertrauens-Hinweis */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
        <span className="flex items-center gap-1">✓ Kostenlos</span>
        <span className="flex items-center gap-1">✓ Unverbindlich</span>
        <span className="flex items-center gap-1">✓ In 2 Minuten fertig</span>
      </div>
    </div>
  );
};
