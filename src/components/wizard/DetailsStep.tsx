import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Gauge, Shield, AlertTriangle, CheckCircle2, Bed, Users as UsersIcon } from "lucide-react";

interface DetailsStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

export const DetailsStep = ({ formData, updateFormData }: DetailsStepProps) => {
  const handleDefectsToggle = (value: string) => {
    const noDefects = value === "no";
    updateFormData({
      no_known_defects: noDefects,
      known_defects: noDefects ? undefined : formData.known_defects,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Gauge className="w-6 h-6 text-primary" />
          Technische Details
        </h2>
        <p className="text-muted-foreground">
          Ein paar wichtige Angaben zu Ihrem Fahrzeug – die meisten Felder sind optional
        </p>
      </div>

      {/* Wichtigste technische Daten */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Motor & Antrieb</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fuel_type">
              Kraftstoffart <span className="text-red-500">*</span>
            </Label>
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
            <Label htmlFor="transmission">
              Getriebe <span className="text-red-500">*</span>
            </Label>
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
            <Label htmlFor="power_ps">Leistung (PS) <span className="text-muted-foreground text-xs">(optional)</span></Label>
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
            <Label htmlFor="first_registration">Erstzulassung <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="first_registration"
              type="date"
              value={formData.first_registration || ""}
              onChange={(e) => updateFormData({ first_registration: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Kapazität */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Kapazität</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="seats_with_seatbelts" className="flex items-center gap-2">
              <UsersIcon className="w-4 h-4" />
              Sitzplätze mit Gurt <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.seats_with_seatbelts?.toString() || ""}
              onValueChange={(value) => updateFormData({ seats_with_seatbelts: parseInt(value) })}
            >
              <SelectTrigger id="seats_with_seatbelts">
                <SelectValue placeholder="Anzahl wählen" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sleeping_places" className="flex items-center gap-2">
              <Bed className="w-4 h-4" />
              Schlafplätze <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.sleeping_places?.toString() || ""}
              onValueChange={(value) => updateFormData({ sleeping_places: parseInt(value) })}
            >
              <SelectTrigger id="sleeping_places">
                <SelectValue placeholder="Anzahl wählen" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Fahrzeugzustand Checkboxen */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Fahrzeugzustand
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center space-x-2 bg-muted/30 rounded-lg p-3">
            <Checkbox
              id="accident_free"
              checked={formData.accident_free}
              onCheckedChange={(checked) => updateFormData({ accident_free: checked as boolean })}
            />
            <label htmlFor="accident_free" className="text-sm font-medium cursor-pointer">
              Unfallfrei
            </label>
          </div>

          <div className="flex items-center space-x-2 bg-muted/30 rounded-lg p-3">
            <Checkbox
              id="non_smoker"
              checked={formData.non_smoker}
              onCheckedChange={(checked) => updateFormData({ non_smoker: checked as boolean })}
            />
            <label htmlFor="non_smoker" className="text-sm font-medium cursor-pointer">
              Nichtraucher
            </label>
          </div>

          <div className="flex items-center space-x-2 bg-muted/30 rounded-lg p-3">
            <Checkbox
              id="service_history_available"
              checked={formData.service_history_available}
              onCheckedChange={(checked) => updateFormData({ service_history_available: checked as boolean })}
            />
            <label htmlFor="service_history_available" className="text-sm font-medium cursor-pointer">
              Scheckheft
            </label>
          </div>
        </div>
      </div>

      {/* Mängel - kompakt integriert */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Bekannte Mängel
        </h3>
        <RadioGroup
          value={formData.no_known_defects ? "no" : formData.known_defects !== undefined ? "yes" : ""}
          onValueChange={handleDefectsToggle}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <Card
            className={`p-3 cursor-pointer transition-all ${
              formData.no_known_defects ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "hover:border-muted-foreground/50"
            }`}
            onClick={() => handleDefectsToggle("no")}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="no" id="no-defects" />
              <Label htmlFor="no-defects" className="cursor-pointer flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Keine Mängel bekannt
              </Label>
            </div>
          </Card>

          <Card
            className={`p-3 cursor-pointer transition-all ${
              !formData.no_known_defects && formData.known_defects !== undefined
                ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
                : "hover:border-muted-foreground/50"
            }`}
            onClick={() => handleDefectsToggle("yes")}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="yes" id="has-defects" />
              <Label htmlFor="has-defects" className="cursor-pointer flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Mängel vorhanden
              </Label>
            </div>
          </Card>
        </RadioGroup>

        {!formData.no_known_defects && formData.known_defects !== undefined && (
          <Textarea
            id="known_defects"
            placeholder="Bitte beschreiben Sie die bekannten Mängel..."
            value={formData.known_defects || ""}
            onChange={(e) => updateFormData({ known_defects: e.target.value })}
            className="min-h-[100px] animate-fade-in"
          />
        )}
      </div>
    </div>
  );
};
