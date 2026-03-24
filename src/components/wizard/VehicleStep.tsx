import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Car, Calendar, Gauge, Users, TrendingUp } from "lucide-react";
import { popularManufacturers, manufacturerModels, bodyTypes } from "@/lib/vehicle-data";
import { useMemo } from "react";

interface VehicleStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

export const VehicleStep = ({ formData, updateFormData }: VehicleStepProps) => {
  // Kaskadierende Modelle basierend auf dem ausgewählten Hersteller
  const availableModels = useMemo(() => {
    if (!formData.manufacturer) return [];
    return manufacturerModels[formData.manufacturer] || [];
  }, [formData.manufacturer]);

  // Baujahr-Optionen (aktuelles Jahr+1 bis 1980)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear + 1; y >= 1980; y--) {
      years.push(y);
    }
    return years;
  }, []);

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
          <strong>127 Händler</strong> suchen aktuell nach Wohnmobilen in Ihrer Region
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
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
              {popularManufacturers.map((manufacturer) => (
                <SelectItem key={manufacturer} value={manufacturer}>
                  {manufacturer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Modell - Kaskadierendes Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="model" className="flex items-center gap-1">
            Modell / Baureihe <span className="text-red-500">*</span>
          </Label>
          {availableModels.length > 0 ? (
            <Select
              value={formData.model}
              onValueChange={(value) => updateFormData({ model: value })}
            >
              <SelectTrigger id="model" className="transition-smooth">
                <SelectValue placeholder="Modell wählen" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
                <SelectItem value="__other">Anderes Modell</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="model"
              type="text"
              placeholder={formData.manufacturer ? "Modell eingeben" : "Bitte zuerst Hersteller wählen"}
              value={formData.model}
              onChange={(e) => updateFormData({ model: e.target.value })}
              className="transition-smooth"
              disabled={!formData.manufacturer}
              autoComplete="off"
            />
          )}
          {/* Freitext-Fallback wenn "Anderes Modell" gewählt */}
          {formData.model === "__other" && (
            <Input
              type="text"
              placeholder="Modellbezeichnung eingeben"
              value=""
              onChange={(e) => updateFormData({ model: e.target.value })}
              className="transition-smooth mt-2"
              autoComplete="off"
              autoFocus
            />
          )}
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
              {bodyTypes.map((type) => (
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
