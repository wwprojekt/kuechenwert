import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Settings, Home, Sun, Tent, Droplets, Tv, Camera, ParkingCircle, Battery, Wind, Lock, Shield } from "lucide-react";

interface EquipmentStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

interface FeatureCheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: React.ReactNode;
}

const FeatureCheckbox = ({ id, label, checked, onCheckedChange, icon }: FeatureCheckboxProps) => (
  <div
    className={`flex items-center space-x-2 rounded-lg p-3 cursor-pointer transition-all border ${
      checked ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-transparent hover:bg-muted/40"
    }`}
    onClick={(e) => {
      e.preventDefault();
      onCheckedChange(!checked);
    }}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onCheckedChange(!checked); } }}
  >
    <Checkbox
      id={id}
      checked={checked}
      onCheckedChange={(c) => onCheckedChange(c as boolean)}
      onClick={(e) => e.stopPropagation()}
    />
    <span className="text-sm font-medium cursor-pointer flex items-center gap-2">
      {icon}
      {label}
    </span>
  </div>
);

export const EquipmentStep = ({ formData, updateFormData }: EquipmentStepProps) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Settings className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Ausstattung
        </h2>
        <p className="text-muted-foreground">
          Wählen Sie die vorhandene Ausstattung aus – dieser Schritt ist <strong>optional</strong> und kann übersprungen werden
        </p>
      </div>

      {/* Wohnbereich */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Home className="w-4 h-4 text-primary" />
          Wohnbereich
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <FeatureCheckbox
            id="has_kitchen"
            label="Küche"
            checked={formData.has_kitchen}
            onCheckedChange={(c) => updateFormData({ has_kitchen: c })}
          />
          <FeatureCheckbox
            id="has_bathroom"
            label="Bad"
            checked={formData.has_bathroom}
            onCheckedChange={(c) => updateFormData({ has_bathroom: c })}
          />
          <FeatureCheckbox
            id="has_toilet"
            label="Toilette"
            checked={formData.has_toilet}
            onCheckedChange={(c) => updateFormData({ has_toilet: c })}
          />
          <FeatureCheckbox
            id="has_shower"
            label="Dusche"
            checked={formData.has_shower}
            onCheckedChange={(c) => updateFormData({ has_shower: c })}
          />
          <FeatureCheckbox
            id="has_tv_sat"
            label="TV / SAT"
            checked={formData.has_tv_sat}
            onCheckedChange={(c) => updateFormData({ has_tv_sat: c })}
            icon={<Tv className="w-3.5 h-3.5" />}
          />
          <FeatureCheckbox
            id="has_awning"
            label="Markise"
            checked={formData.has_awning}
            onCheckedChange={(c) => updateFormData({ has_awning: c })}
            icon={<Tent className="w-3.5 h-3.5" />}
          />
        </div>
      </div>

      {/* Basisfahrzeug */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Basisfahrzeug
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <FeatureCheckbox
            id="has_airbag"
            label="Airbag"
            checked={formData.has_airbag}
            onCheckedChange={(c) => updateFormData({ has_airbag: c })}
          />
          <FeatureCheckbox
            id="has_esp"
            label="ESP"
            checked={formData.has_esp}
            onCheckedChange={(c) => updateFormData({ has_esp: c })}
          />
          <FeatureCheckbox
            id="has_cruise_control"
            label="Tempomat"
            checked={formData.has_cruise_control}
            onCheckedChange={(c) => updateFormData({ has_cruise_control: c })}
          />
          <FeatureCheckbox
            id="has_parking_sensors"
            label="Parksensoren"
            checked={formData.has_parking_sensors}
            onCheckedChange={(c) => updateFormData({ has_parking_sensors: c })}
            icon={<ParkingCircle className="w-3.5 h-3.5" />}
          />
          <FeatureCheckbox
            id="has_reversing_camera"
            label="Rückfahrkamera"
            checked={formData.has_reversing_camera}
            onCheckedChange={(c) => updateFormData({ has_reversing_camera: c })}
            icon={<Camera className="w-3.5 h-3.5" />}
          />
          <FeatureCheckbox
            id="has_central_locking"
            label="Zentralverriegelung"
            checked={formData.has_central_locking}
            onCheckedChange={(c) => updateFormData({ has_central_locking: c })}
            icon={<Lock className="w-3.5 h-3.5" />}
          />
          <FeatureCheckbox
            id="has_swivel_seats"
            label="Drehsitze"
            checked={formData.has_swivel_seats}
            onCheckedChange={(c) => updateFormData({ has_swivel_seats: c })}
          />
          <FeatureCheckbox
            id="has_alarm"
            label="Alarmanlage"
            checked={formData.has_alarm}
            onCheckedChange={(c) => updateFormData({ has_alarm: c })}
          />
        </div>
      </div>

      {/* Energie & Außen */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Sun className="w-4 h-4 text-primary" />
          Energie & Außen
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <FeatureCheckbox
            id="has_solar"
            label="Solaranlage"
            checked={formData.has_solar}
            onCheckedChange={(c) => updateFormData({ has_solar: c })}
            icon={<Sun className="w-3.5 h-3.5" />}
          />
          <FeatureCheckbox
            id="has_inverter"
            label="Wechselrichter"
            checked={formData.has_inverter}
            onCheckedChange={(c) => updateFormData({ has_inverter: c })}
            icon={<Battery className="w-3.5 h-3.5" />}
          />
          <FeatureCheckbox
            id="has_bike_rack"
            label="Fahrradträger"
            checked={formData.has_bike_rack}
            onCheckedChange={(c) => updateFormData({ has_bike_rack: c })}
          />
          <FeatureCheckbox
            id="has_garage"
            label="Heckgarage"
            checked={formData.has_garage}
            onCheckedChange={(c) => updateFormData({ has_garage: c })}
          />
        </div>
      </div>

      {/* Zusätzliche Ausstattung Freitext */}
      <div className="space-y-2">
        <Label htmlFor="additional_equipment" className="text-base font-semibold">
          Weitere Ausstattung <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Textarea
          id="additional_equipment"
          placeholder="z.B. Fahrradträger für E-Bikes, Sat-Anlage, Auffahrkeile, Campingtisch & Stühle..."
          value={formData.additional_equipment || ""}
          onChange={(e) => updateFormData({ additional_equipment: e.target.value })}
          rows={3}
          className="resize-none"
        />
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Dieser Schritt ist optional. Sie können jederzeit auf <strong>Weiter</strong> klicken.
      </p>
    </div>
  );
};
