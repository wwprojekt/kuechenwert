import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Gauge, Calendar, Shield } from "lucide-react";

interface TechnicalDetailsStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

export const TechnicalDetailsStep = ({ formData, updateFormData }: TechnicalDetailsStepProps) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Gauge className="w-6 h-6 text-primary" />
          Technische Daten
        </h2>
        <p className="text-muted-foreground">
          Geben Sie die technischen Spezifikationen Ihres Fahrzeugs an
        </p>
      </div>

      {/* Engine & Transmission */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Motor & Antrieb</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fuel_type">Kraftstoffart (optional)</Label>
            <Select
              value={formData.fuel_type || ""}
              onValueChange={(value) => updateFormData({ fuel_type: value })}
            >
              <SelectTrigger id="fuel_type">
                <SelectValue placeholder="Wählen Sie..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Diesel">Diesel</SelectItem>
                <SelectItem value="Benzin">Benzin</SelectItem>
                <SelectItem value="Elektro">Elektro</SelectItem>
                <SelectItem value="Hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transmission">Getriebe (optional)</Label>
            <Select
              value={formData.transmission || ""}
              onValueChange={(value) => updateFormData({ transmission: value })}
            >
              <SelectTrigger id="transmission">
                <SelectValue placeholder="Wählen Sie..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Schaltgetriebe">Schaltgetriebe</SelectItem>
                <SelectItem value="Automatik">Automatik</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="power_kw">Leistung (kW) (optional)</Label>
            <Input
              id="power_kw"
              type="number"
              placeholder="z.B. 96"
              value={formData.power_kw || ""}
              onChange={(e) => updateFormData({ power_kw: e.target.value ? parseInt(e.target.value) : null })}
              min={0}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="power_ps">Leistung (PS) (optional)</Label>
            <Input
              id="power_ps"
              type="number"
              placeholder="z.B. 130"
              value={formData.power_ps || ""}
              onChange={(e) => updateFormData({ power_ps: e.target.value ? parseInt(e.target.value) : null })}
              min={0}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="engine_displacement_ccm">Hubraum (ccm) (optional)</Label>
            <Input
              id="engine_displacement_ccm"
              type="number"
              placeholder="z.B. 2287"
              value={formData.engine_displacement_ccm || ""}
              onChange={(e) => updateFormData({ engine_displacement_ccm: e.target.value ? parseInt(e.target.value) : null })}
              min={0}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emission_class">Schadstoffklasse (optional)</Label>
            <Select
              value={formData.emission_class || ""}
              onValueChange={(value) => updateFormData({ emission_class: value })}
            >
              <SelectTrigger id="emission_class">
                <SelectValue placeholder="Wählen Sie..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Euro 6d">Euro 6d</SelectItem>
                <SelectItem value="Euro 6d-TEMP">Euro 6d-TEMP</SelectItem>
                <SelectItem value="Euro 6c">Euro 6c</SelectItem>
                <SelectItem value="Euro 6">Euro 6</SelectItem>
                <SelectItem value="Euro 5">Euro 5</SelectItem>
                <SelectItem value="Euro 4">Euro 4</SelectItem>
                <SelectItem value="Euro 3">Euro 3</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>
      </div>

      {/* Registration & Documentation */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Zulassung & Dokumentation
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_registration">Erstzulassung (optional)</Label>
            <Input
              id="first_registration"
              type="date"
              value={formData.first_registration || ""}
              onChange={(e) => updateFormData({ first_registration: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="previous_owners">Vorbesitzer (optional)</Label>
            <Input
              id="previous_owners"
              type="number"
              placeholder="z.B. 1"
              value={formData.previous_owners || ""}
              onChange={(e) => updateFormData({ previous_owners: e.target.value ? parseInt(e.target.value) : null })}
              min={0}
              max={99}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tuv_valid_until">TÜV/HU gültig bis (optional)</Label>
            <Input
              id="tuv_valid_until"
              type="date"
              value={formData.tuv_valid_until || ""}
              onChange={(e) => updateFormData({ tuv_valid_until: e.target.value })}
            />
          </div>
        </div>

        {/* Tires */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="main_tires">Hauptsatz Reifen (optional)</Label>
            <Input
              id="main_tires"
              type="text"
              placeholder="z.B. 225/75 R16 Sommerreifen"
              value={formData.main_tires || ""}
              onChange={(e) => updateFormData({ main_tires: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="second_tires">Zweiter Reifensatz (optional)</Label>
            <Input
              id="second_tires"
              type="text"
              placeholder="z.B. 225/75 R16 Winterreifen"
              value={formData.second_tires || ""}
              onChange={(e) => updateFormData({ second_tires: e.target.value })}
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="accident_free"
              checked={formData.accident_free}
              onCheckedChange={(checked) => updateFormData({ accident_free: checked as boolean })}
            />
            <label htmlFor="accident_free" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Unfallfrei
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="non_smoker"
              checked={formData.non_smoker}
              onCheckedChange={(checked) => updateFormData({ non_smoker: checked as boolean })}
            />
            <label htmlFor="non_smoker" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Nichtraucherfahrzeug
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="service_history_available"
              checked={formData.service_history_available}
              onCheckedChange={(checked) => updateFormData({ service_history_available: checked as boolean })}
            />
            <label htmlFor="service_history_available" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Scheckheftgepflegt / Serviceheft vorhanden
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
