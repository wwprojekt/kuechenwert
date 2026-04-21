import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { useEffect, useState } from "react";
import { Settings, Home, Sun, Tent, Tv, Camera, ParkingCircle, Battery, Lock, Shield, Snowflake, Users, Truck, ClipboardCheck, ChevronDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { baseVehicles, getPowerOptionsForBaseVehicle, formatPower, psToKw } from "@/lib/vehicle-data";

interface EquipmentStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

const FeatureCheckbox = ({ id, label, checked, onCheckedChange, icon }: {
  id: string; label: string; checked: boolean; onCheckedChange: (checked: boolean) => void; icon?: React.ReactNode;
}) => (
  <div
    className={cn(
      "flex items-center space-x-2 rounded-lg p-2.5 cursor-pointer transition-all border",
      checked ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-transparent hover:bg-muted/40"
    )}
    onClick={(e) => { e.preventDefault(); onCheckedChange(!checked); }}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onCheckedChange(!checked); } }}
  >
    <Checkbox id={id} checked={checked} onCheckedChange={(c) => onCheckedChange(c as boolean)} onClick={(e) => e.stopPropagation()} />
    <span className="text-sm font-medium cursor-pointer flex items-center gap-2">
      {icon}
      {label}
    </span>
  </div>
);

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const MONTH_VALUES = ["01","02","03","04","05","06","07","08","09","10","11","12"];

/** Reusable month+year picker for EZ and TÜV */
const MonthYearPicker = ({ label, value, onChange, futureYears = 0, idPrefix }: {
  label: string;
  value: string | undefined;
  onChange: (val: string) => void;
  futureYears?: number;
  /**
   * Optional prefix that becomes `${idPrefix}_month` / `${idPrefix}_year`
   * on the underlying SelectTrigger buttons. Required for the wizard
   * telemetry to attribute focus/blur events to the right field.
   */
  idPrefix?: string;
}) => {
  const month = value ? value.substring(5, 7) : "";
  const year = value ? value.substring(0, 4) : "";
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1979 + futureYears }, (_, i) => (currentYear + futureYears - i).toString());

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Select value={month} onValueChange={(m) => {
          const y = year || currentYear.toString();
          onChange(`${y}-${m}-01`);
        }}>
          <SelectTrigger id={idPrefix ? `${idPrefix}_month` : undefined} className="h-10"><SelectValue placeholder="Monat" /></SelectTrigger>
          <SelectContent>
            {MONTH_VALUES.map((m, i) => <SelectItem key={m} value={m}>{MONTHS[i]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={(y) => {
          const m = month || "01";
          onChange(`${y}-${m}-01`);
        }}>
          <SelectTrigger id={idPrefix ? `${idPrefix}_year` : undefined} className="h-10"><SelectValue placeholder="Jahr" /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

// Die ~3 mit Abstand häufigsten Wohnmobil-Chassis (vgl. Sevel-Plattform-Anteil
// am DE-Markt + interne wizard_sessions-Auswertung). Diese als Quick-Pick-Chips
// über dem Dropdown zeigen, damit ~80% der Nutzer das 33-Optionen-Menü gar
// nicht öffnen müssen.
const TOP_BASE_VEHICLES = ["Fiat Ducato", "Mercedes Sprinter", "Ford Transit"] as const;

// Bei vielen PS-Optionen (z.B. Iveco Daily mit 12) fluten die Chips auf Mobile
// 3–4 Zeilen und wirken überfordernd. Daher: standardmäßig max.
// PS_CHIPS_VISIBLE anzeigen, der Rest wird per "+N weitere" Toggle eingeblendet.
const PS_CHIPS_VISIBLE = 5;

export const EquipmentStep = ({ formData, updateFormData }: EquipmentStepProps) => {
  const isWohnwagen = formData.vehicleType === "Wohnwagen";
  const [showEquipment, setShowEquipment] = useState(false);
  const [showAllPs, setShowAllPs] = useState(false);

  // Wenn der User das Basisfahrzeug wechselt, wieder auf die kompakte
  // Chip-Ansicht zurücksetzen, sonst startet die Liste bereits voll
  // geöffnet, obwohl es nun nur noch wenige PS-Werte gibt.
  useEffect(() => {
    setShowAllPs(false);
  }, [formData.baseVehicle]);

  return (
    <div className="space-y-3 sm:space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-0.5 sm:mb-1 flex items-center gap-2">
          <Star className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Fahrzeug-Details & Ausstattung
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Je mehr Angaben, desto bessere Angebote von Händlern – alles optional, aber empfohlen
        </p>
      </div>

      {/* ═══ SECTION 1: Wichtige Fahrzeug-Details (sichtbar) ═══ */}
      <div className="space-y-4">
        {/* Sitzplätze – Chips, nur Wohnmobil */}
        {!isWohnwagen && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4" />
              Sitzplätze mit Gurt
            </Label>
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => updateFormData({ seats_with_seatbelts: formData.seats_with_seatbelts === n ? null : n })}
                  className={cn(
                    "w-11 h-11 rounded-lg text-sm font-medium border-2 transition-all",
                    "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]",
                    formData.seats_with_seatbelts === n
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-card border-border"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* EZ + TÜV nebeneinander */}
        {!isWohnwagen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MonthYearPicker
              label="📅 Erstzulassung"
              value={formData.first_registration}
              onChange={(val) => updateFormData({ first_registration: val })}
              idPrefix="first_registration"
            />
            <MonthYearPicker
              label="🔧 TÜV/HU gültig bis"
              value={formData.tuv_valid_until}
              onChange={(val) => updateFormData({ tuv_valid_until: val })}
              futureYears={3}
              idPrefix="tuv_valid_until"
            />
          </div>
        )}

        {/* Wohnwagen: nur TÜV */}
        {isWohnwagen && (
          <div className="max-w-sm">
            <MonthYearPicker
              label="🔧 TÜV/HU gültig bis"
              value={formData.tuv_valid_until}
              onChange={(val) => updateFormData({ tuv_valid_until: val })}
              futureYears={3}
              idPrefix="tuv_valid_until"
            />
          </div>
        )}

        {/* Basisfahrzeug + PS – nur Wohnmobil */}
        {!isWohnwagen && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Truck className="w-4 h-4 text-primary" />
              Basisfahrzeug / Chassis
            </Label>

            {/* Top-3 Quick-Pick Chips: deckt empirisch ~80% der Wohnmobile ab
                (Sevel-Plattform = Fiat Ducato / Citroën / Peugeot, Mercedes
                Sprinter, Ford Transit). Wer einen davon hat, klickt 1× und
                muss das lange Dropdown nie öffnen – primärer Hebel für die
                Mobile-Conversion in diesem Step. */}
            <div className="flex flex-wrap gap-2">
              {TOP_BASE_VEHICLES.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (formData.baseVehicle === label) return;
                    updateFormData({ baseVehicle: label, power_ps: null, power_kw: null });
                  }}
                  aria-pressed={formData.baseVehicle === label}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border-2 transition-all whitespace-nowrap min-h-[36px] active:scale-[0.97]",
                    formData.baseVehicle === label
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-card border-border hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                value={formData.baseVehicle || ""}
                onValueChange={(value) => updateFormData({ baseVehicle: value, power_ps: null, power_kw: null })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Anderes Chassis wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {baseVehicles.map(bv => (
                    <SelectItem key={bv.label} value={bv.label}>{bv.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* PS-Eingabe: Quick-Select Chips (sofern vorhanden) PLUS dauerhaftes
                  Freitext-Feld. Chips alleine waren ein Killer für ~17 abgebrochene
                  Sessions/90 Tage, weil exotische PS-Werte (Tuning-Chips, sehr alte
                  Generationen) keine Wahl hatten. */}
              <div className="space-y-2">
                {formData.baseVehicle && (() => {
                  const allPsOptions = getPowerOptionsForBaseVehicle(formData.baseVehicle);
                  if (allPsOptions.length === 0) return null;
                  const visiblePsOptions = showAllPs
                    ? allPsOptions
                    : allPsOptions.slice(0, PS_CHIPS_VISIBLE);
                  const hiddenCount = allPsOptions.length - PS_CHIPS_VISIBLE;
                  return (
                    <div className="flex flex-wrap gap-2 items-center">
                      {visiblePsOptions.map((ps) => (
                        <button
                          key={ps}
                          type="button"
                          onClick={() => {
                            const newPs = formData.power_ps === ps ? null : ps;
                            updateFormData({ power_ps: newPs, power_kw: newPs ? psToKw(newPs) : null });
                          }}
                          aria-pressed={formData.power_ps === ps}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border-2 transition-all whitespace-nowrap min-h-[36px] active:scale-[0.97]",
                            formData.power_ps === ps
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-card border-border hover:border-primary/50 hover:bg-primary/5"
                          )}
                        >
                          {formatPower(ps)}
                        </button>
                      ))}
                      {!showAllPs && hiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowAllPs(true)}
                          className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all whitespace-nowrap min-h-[36px]"
                        >
                          + {hiddenCount} weitere
                        </button>
                      )}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder={
                      formData.baseVehicle && getPowerOptionsForBaseVehicle(formData.baseVehicle).length > 0
                        ? "Andere PS-Zahl?"
                        : "Leistung in PS"
                    }
                    value={formData.power_ps || ""}
                    onChange={(e) => {
                      const ps = e.target.value ? parseInt(e.target.value) : null;
                      updateFormData({ power_ps: ps, power_kw: ps ? psToKw(ps) : null });
                    }}
                    min={0}
                    className="h-10 max-w-[180px]"
                  />
                  {formData.power_ps ? (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      = {formatPower(formData.power_ps)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Zustand-Checkboxen */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4" />
            Fahrzeugzustand
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <FeatureCheckbox id="accident_free" label="Unfallfrei" checked={formData.accident_free} onCheckedChange={(c) => updateFormData({ accident_free: c })} />
            <FeatureCheckbox id="non_smoker" label="Nichtraucher" checked={formData.non_smoker} onCheckedChange={(c) => updateFormData({ non_smoker: c })} />
            <FeatureCheckbox id="service_history_available" label="Scheckheft" checked={formData.service_history_available} onCheckedChange={(c) => updateFormData({ service_history_available: c })} icon={<ClipboardCheck className="w-3.5 h-3.5" />} />
          </div>
        </div>
      </div>

      {/* ═══ SECTION 2: Ausstattung (collapsed) ═══ */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowEquipment(prev => !prev)}
          className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Settings className="w-4 h-4 text-primary" />
            Ausstattung hinzufügen
            <span className="text-xs font-normal">(optional)</span>
          </span>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showEquipment && "rotate-180")} />
        </button>

        {showEquipment && (
          <div className="space-y-4 animate-fade-in">
            {/* Wohnbereich */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Home className="w-4 h-4 text-primary" />
                Wohnbereich
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <FeatureCheckbox id="has_kitchen" label="Küche" checked={formData.has_kitchen} onCheckedChange={(c) => updateFormData({ has_kitchen: c })} />
                <FeatureCheckbox id="has_bathroom" label="Bad" checked={formData.has_bathroom} onCheckedChange={(c) => updateFormData({ has_bathroom: c })} />
                <FeatureCheckbox id="has_toilet" label="Toilette" checked={formData.has_toilet} onCheckedChange={(c) => updateFormData({ has_toilet: c })} />
                <FeatureCheckbox id="has_shower" label="Dusche" checked={formData.has_shower} onCheckedChange={(c) => updateFormData({ has_shower: c })} />
                <FeatureCheckbox id="has_tv_sat" label="TV / SAT" checked={formData.has_tv_sat} onCheckedChange={(c) => updateFormData({ has_tv_sat: c })} icon={<Tv className="w-3.5 h-3.5" />} />
                <FeatureCheckbox id="has_awning" label="Markise" checked={formData.has_awning} onCheckedChange={(c) => updateFormData({ has_awning: c })} icon={<Tent className="w-3.5 h-3.5" />} />
                <FeatureCheckbox id="has_awning_tent" label="Vorzelt" checked={formData.has_awning_tent} onCheckedChange={(c) => updateFormData({ has_awning_tent: c })} icon={<Tent className="w-3.5 h-3.5" />} />
                <FeatureCheckbox id="has_roof_ac" label="Dachklima/Standklima" checked={formData.has_roof_ac} onCheckedChange={(c) => updateFormData({ has_roof_ac: c, has_stand_ac: c })} icon={<Snowflake className="w-3.5 h-3.5" />} />
              </div>
            </div>

            {/* Basisfahrzeug-Features – nur Wohnmobil */}
            {!isWohnwagen && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Fahrzeug-Extras
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <FeatureCheckbox id="has_airbag" label="Airbag" checked={formData.has_airbag} onCheckedChange={(c) => updateFormData({ has_airbag: c })} />
                  <FeatureCheckbox id="has_esp" label="ESP" checked={formData.has_esp} onCheckedChange={(c) => updateFormData({ has_esp: c })} />
                  <FeatureCheckbox id="has_cruise_control" label="Tempomat" checked={formData.has_cruise_control} onCheckedChange={(c) => updateFormData({ has_cruise_control: c })} />
                  <FeatureCheckbox id="has_parking_sensors" label="Parksensoren" checked={formData.has_parking_sensors} onCheckedChange={(c) => updateFormData({ has_parking_sensors: c })} icon={<ParkingCircle className="w-3.5 h-3.5" />} />
                  <FeatureCheckbox id="has_reversing_camera" label="Rückfahrkamera" checked={formData.has_reversing_camera} onCheckedChange={(c) => updateFormData({ has_reversing_camera: c })} icon={<Camera className="w-3.5 h-3.5" />} />
                  <FeatureCheckbox id="has_central_locking" label="Zentralverriegelung" checked={formData.has_central_locking} onCheckedChange={(c) => updateFormData({ has_central_locking: c })} icon={<Lock className="w-3.5 h-3.5" />} />
                  <FeatureCheckbox id="has_swivel_seats" label="Drehsitze" checked={formData.has_swivel_seats} onCheckedChange={(c) => updateFormData({ has_swivel_seats: c })} />
                  <FeatureCheckbox id="has_alarm" label="Alarmanlage" checked={formData.has_alarm} onCheckedChange={(c) => updateFormData({ has_alarm: c })} />
                </div>
              </div>
            )}

            {/* Wohnwagen Sicherheit */}
            {isWohnwagen && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Sicherheit & Komfort
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <FeatureCheckbox id="has_alarm" label="Alarmanlage" checked={formData.has_alarm} onCheckedChange={(c) => updateFormData({ has_alarm: c })} />
                  <FeatureCheckbox id="has_central_locking" label="Zentralverriegelung" checked={formData.has_central_locking} onCheckedChange={(c) => updateFormData({ has_central_locking: c })} icon={<Lock className="w-3.5 h-3.5" />} />
                  <FeatureCheckbox id="has_reversing_camera" label="Rückfahrkamera" checked={formData.has_reversing_camera} onCheckedChange={(c) => updateFormData({ has_reversing_camera: c })} icon={<Camera className="w-3.5 h-3.5" />} />
                </div>
              </div>
            )}

            {/* Energie & Außen */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sun className="w-4 h-4 text-primary" />
                Energie & Außen
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <FeatureCheckbox id="has_solar" label="Solaranlage" checked={formData.has_solar} onCheckedChange={(c) => updateFormData({ has_solar: c })} icon={<Sun className="w-3.5 h-3.5" />} />
                <FeatureCheckbox id="has_inverter" label="Wechselrichter" checked={formData.has_inverter} onCheckedChange={(c) => updateFormData({ has_inverter: c })} icon={<Battery className="w-3.5 h-3.5" />} />
                <FeatureCheckbox id="has_bike_rack" label="Fahrradträger" checked={formData.has_bike_rack} onCheckedChange={(c) => updateFormData({ has_bike_rack: c })} />
                <FeatureCheckbox id="has_garage" label="Heckgarage" checked={formData.has_garage} onCheckedChange={(c) => updateFormData({ has_garage: c })} />
              </div>
            </div>

            {/* Freitext */}
            <div className="space-y-1.5">
              <Label htmlFor="additional_equipment" className="text-sm font-semibold">
                Weitere Ausstattung
              </Label>
              <Textarea
                id="additional_equipment"
                placeholder="z.B. Fahrradträger für E-Bikes, Sat-Anlage, Auffahrkeile..."
                value={formData.additional_equipment || ""}
                onChange={(e) => updateFormData({ additional_equipment: e.target.value })}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Alle Angaben sind optional. Sie können jederzeit auf <strong>Weiter</strong> klicken.
      </p>
    </div>
  );
};
