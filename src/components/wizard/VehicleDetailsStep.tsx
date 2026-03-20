import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Car, Calendar, Gauge, Info } from "lucide-react";

interface VehicleDetailsStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

export const VehicleDetailsStep = ({ formData, updateFormData }: VehicleDetailsStepProps) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Car className="w-6 h-6 text-primary" />
          Fahrzeugdetails
        </h2>
        <p className="text-muted-foreground">
          Geben Sie die grundlegenden Informationen zu Ihrem Wohnmobil ein
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-2">
          <Label htmlFor="manufacturer" className="flex items-center gap-1">
            Hersteller <span className="text-red-500">*</span>
          </Label>
          <Input
            id="manufacturer"
            type="text"
            placeholder="z.B. Hymer, Dethleffs, Knaus"
            value={formData.manufacturer}
            onChange={(e) => updateFormData({ manufacturer: e.target.value })}
            className="transition-smooth"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Modell *</Label>
          <Input
            id="model"
            type="text"
            placeholder="z.B. B-Klasse, Globebus"
            value={formData.model}
            onChange={(e) => updateFormData({ model: e.target.value })}
            className="transition-smooth"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="year" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Baujahr *
          </Label>
          <Input
            id="year"
            type="number"
            placeholder="z.B. 2020"
            value={formData.year || ""}
            onChange={(e) => updateFormData({ year: parseInt(e.target.value) || null })}
            min={1980}
            max={new Date().getFullYear() + 1}
            className="transition-smooth"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mileage" className="flex items-center gap-2">
            <Gauge className="w-4 h-4" />
            Kilometerstand *
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

        <div className="space-y-2">
          <Label htmlFor="condition">Zustand *</Label>
          <Select
            value={formData.condition}
            onValueChange={(value) => updateFormData({ condition: value })}
          >
            <SelectTrigger id="condition" className="transition-smooth">
              <SelectValue placeholder="Wählen Sie den Zustand" />
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

        <div className="space-y-2 relative">
          <Label htmlFor="bodyType">Aufbauart *</Label>
          <Select
            value={formData.bodyType}
            onValueChange={(value) => updateFormData({ bodyType: value })}
          >
            <SelectTrigger id="bodyType" className="transition-smooth relative z-10">
              <SelectValue placeholder="Wählen Sie die Aufbauart" />
            </SelectTrigger>
            <SelectContent className="z-[200]">
              <SelectItem value="Teilintegriert">Teilintegriert</SelectItem>
              <SelectItem value="Alkoven">Alkoven</SelectItem>
              <SelectItem value="Vollintegriert">Vollintegriert</SelectItem>
              <SelectItem value="Kastenwagen">Kastenwagen</SelectItem>
              <SelectItem value="Campingbus">Campingbus</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="flex items-center gap-2">
          <Info className="w-4 h-4" />
          Beschreibung <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="description"
          placeholder="Beschreiben Sie Ihr Wohnmobil im Detail. Erwähnen Sie besondere Merkmale, Wartungshistorie, zusätzliche Ausstattung usw."
          value={formData.description}
          onChange={(e) => updateFormData({ description: e.target.value })}
          rows={6}
          className="resize-none transition-smooth"
        />
        <p className="text-xs text-muted-foreground">
          Mindestens 20 Zeichen. Eine detaillierte Beschreibung erhöht Ihre Verkaufschancen.
        </p>
      </div>
    </div>
  );
};
