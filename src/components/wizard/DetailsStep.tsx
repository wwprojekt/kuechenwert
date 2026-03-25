import { Label } from "@/components/ui/label"; // Used for Select labels
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
// RadioGroup nicht mehr benötigt - Cards mit eigenem State
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
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Gauge className="w-5 h-5 md:w-6 md:h-6 text-primary" />
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
              inputMode="numeric"
              pattern="[0-9]*"
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
          <div
            className={`flex items-center space-x-2 rounded-lg p-3 cursor-pointer transition-all border ${
              formData.accident_free ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-transparent hover:bg-muted/40"
            }`}
            onClick={(e) => { e.preventDefault(); updateFormData({ accident_free: !formData.accident_free }); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); updateFormData({ accident_free: !formData.accident_free }); } }}
          >
            <Checkbox
              id="accident_free"
              checked={formData.accident_free}
              onCheckedChange={(checked) => updateFormData({ accident_free: checked as boolean })}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-sm font-medium cursor-pointer">
              Unfallfrei
            </span>
          </div>

          <div
            className={`flex items-center space-x-2 rounded-lg p-3 cursor-pointer transition-all border ${
              formData.non_smoker ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-transparent hover:bg-muted/40"
            }`}
            onClick={(e) => { e.preventDefault(); updateFormData({ non_smoker: !formData.non_smoker }); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); updateFormData({ non_smoker: !formData.non_smoker }); } }}
          >
            <Checkbox
              id="non_smoker"
              checked={formData.non_smoker}
              onCheckedChange={(checked) => updateFormData({ non_smoker: checked as boolean })}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-sm font-medium cursor-pointer">
              Nichtraucher
            </span>
          </div>

          <div
            className={`flex items-center space-x-2 rounded-lg p-3 cursor-pointer transition-all border ${
              formData.service_history_available ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-transparent hover:bg-muted/40"
            }`}
            onClick={(e) => { e.preventDefault(); updateFormData({ service_history_available: !formData.service_history_available }); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); updateFormData({ service_history_available: !formData.service_history_available }); } }}
          >
            <Checkbox
              id="service_history_available"
              checked={formData.service_history_available}
              onCheckedChange={(checked) => updateFormData({ service_history_available: checked as boolean })}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-sm font-medium cursor-pointer">
              Scheckheft
            </span>
          </div>
        </div>
      </div>

      {/* Mängel - kompakt integriert */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Bekannte Mängel
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card
            className={`p-3 cursor-pointer transition-all ${
              formData.no_known_defects ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "hover:border-muted-foreground/50"
            }`}
            onClick={() => handleDefectsToggle("no")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleDefectsToggle("no"); } }}
          >
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                formData.no_known_defects ? "border-green-500 bg-green-500" : "border-muted-foreground/30"
              }`}>
                {formData.no_known_defects && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className="cursor-pointer flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Keine Mängel bekannt
              </span>
            </div>
          </Card>

          <Card
            className={`p-3 cursor-pointer transition-all ${
              !formData.no_known_defects && formData.known_defects !== undefined
                ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
                : "hover:border-muted-foreground/50"
            }`}
            onClick={() => handleDefectsToggle("yes")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleDefectsToggle("yes"); } }}
          >
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                !formData.no_known_defects && formData.known_defects !== undefined ? "border-orange-500 bg-orange-500" : "border-muted-foreground/30"
              }`}>
                {!formData.no_known_defects && formData.known_defects !== undefined && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className="cursor-pointer flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Mängel vorhanden
              </span>
            </div>
          </Card>
        </div>

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
