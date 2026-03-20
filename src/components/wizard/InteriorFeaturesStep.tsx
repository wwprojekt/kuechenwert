import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Home, Droplets, Wind, Flame } from "lucide-react";

interface InteriorFeaturesStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

export const InteriorFeaturesStep = ({ formData, updateFormData }: InteriorFeaturesStepProps) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Home className="w-6 h-6 text-primary" />
          Innenausstattung
        </h2>
        <p className="text-muted-foreground">
          Details zur Innenausstattung und Komfort
        </p>
      </div>

      {/* Kitchen & Appliances */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Küche & Geräte</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="has_kitchen"
              checked={formData.has_kitchen}
              onCheckedChange={(checked) => updateFormData({ has_kitchen: checked as boolean })}
            />
            <label htmlFor="has_kitchen" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Küche vorhanden
            </label>
          </div>

        </div>
      </div>

      {/* Heating & Climate */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Flame className="w-5 h-5" />
          Heizung & Klima
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="heating_type">Heizungsart</Label>
            <Select
              value={formData.heating_type || ""}
              onValueChange={(value) => updateFormData({ heating_type: value })}
            >
              <SelectTrigger id="heating_type">
                <SelectValue placeholder="Wählen Sie..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Gas">Gas</SelectItem>
                <SelectItem value="Diesel">Diesel</SelectItem>
                <SelectItem value="Elektrisch">Elektrisch</SelectItem>
                <SelectItem value="Kombiniert">Kombiniert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="air_conditioning" className="flex items-center gap-2">
              <Wind className="w-4 h-4" />
              Klimaanlage
            </Label>
            <Select
              value={formData.air_conditioning || "Keine"}
              onValueChange={(value) => updateFormData({ air_conditioning: value })}
            >
              <SelectTrigger id="air_conditioning">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Keine">Keine</SelectItem>
                <SelectItem value="Fahrerhaus">Fahrerhaus</SelectItem>
                <SelectItem value="Wohnraum">Wohnraum</SelectItem>
                <SelectItem value="Beides">Beides</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bathroom */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Droplets className="w-5 h-5" />
          Sanitär
        </h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="has_bathroom"
              checked={formData.has_bathroom}
              onCheckedChange={(checked) => updateFormData({ has_bathroom: checked as boolean })}
            />
            <label htmlFor="has_bathroom" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Badezimmer vorhanden
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="has_toilet"
              checked={formData.has_toilet}
              onCheckedChange={(checked) => updateFormData({ has_toilet: checked as boolean })}
            />
            <label htmlFor="has_toilet" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Toilette vorhanden
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="has_shower"
              checked={formData.has_shower}
              onCheckedChange={(checked) => updateFormData({ has_shower: checked as boolean })}
            />
            <label htmlFor="has_shower" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Dusche vorhanden
            </label>
          </div>
        </div>
      </div>

      {/* Water Capacities */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Wasserkapazitäten</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fresh_water_capacity_liters">Frischwasser (Liter)</Label>
            <Input
              id="fresh_water_capacity_liters"
              type="number"
              placeholder="z.B. 120"
              value={formData.fresh_water_capacity_liters || ""}
              onChange={(e) => updateFormData({ fresh_water_capacity_liters: e.target.value ? parseInt(e.target.value) : null })}
              min={0}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="grey_water_capacity_liters">Abwasser (Liter)</Label>
            <Input
              id="grey_water_capacity_liters"
              type="number"
              placeholder="z.B. 100"
              value={formData.grey_water_capacity_liters || ""}
              onChange={(e) => updateFormData({ grey_water_capacity_liters: e.target.value ? parseInt(e.target.value) : null })}
              min={0}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
