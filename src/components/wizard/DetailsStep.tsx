import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { useState, useEffect } from "react";
import { Gauge, Shield, AlertTriangle, CheckCircle2, Bed, Users as UsersIcon, Info, Truck, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { baseVehicles, getPowerOptionsForBaseVehicle } from "@/lib/vehicle-data";

interface DetailsStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  fieldErrors?: Record<string, string>;
}

export const DetailsStep = ({ formData, updateFormData, fieldErrors = {} }: DetailsStepProps) => {
  const isWohnwagen = formData.vehicleType === "Wohnwagen";
  const [showOptional, setShowOptional] = useState(false);

  const handleDefectsToggle = (value: string) => {
    const noDefects = value === "no";
    updateFormData({
      no_known_defects: noDefects,
      known_defects: noDefects ? undefined : (formData.known_defects || ""),
    });
  };

  // Pre-select "Keine Mängel" on mount – reduces required decisions to zero
  useEffect(() => {
    if (!formData.no_known_defects && formData.known_defects === undefined) {
      updateFormData({ no_known_defects: true });
    }
  }, []);

  // Progressive disclosure phases
  const phase1Done = isWohnwagen || !!(formData.fuel_type && formData.transmission);
  const phase2Done = !!formData.sleeping_places;
  const defectsAnswered = formData.no_known_defects || (formData.known_defects !== undefined && formData.known_defects !== "");

  // Required: Wohnmobil = fuel + transmission + sleeping + defects (4), Wohnwagen = sleeping + defects (2)
  const requiredFilled = [
    ...(!isWohnwagen ? [formData.fuel_type, formData.transmission] : []),
    formData.sleeping_places,
    defectsAnswered,
  ].filter(Boolean).length;
  const requiredTotal = isWohnwagen ? 2 : 4;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Gauge className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Technische Details
        </h2>
        <p className="text-sm text-muted-foreground">
          {isWohnwagen
            ? "Nur 2 kurze Angaben – jeweils ein Klick"
            : "Nur 4 kurze Angaben – jeweils ein Klick"
          }
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <div className="flex gap-0.5">
            {Array.from({ length: requiredTotal }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-5 h-1.5 rounded-full transition-colors",
                  i < requiredFilled ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
          <span>{requiredFilled} von {requiredTotal}</span>
        </div>
      </div>

      {/* ═══ PHASE 1: Motor & Antrieb (Wohnmobil only) ═══ */}
      {!isWohnwagen && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className={cn(fieldErrors.fuel_type && "text-red-600")}>
              Kraftstoffart <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "Diesel", label: "⛽ Diesel" },
                { value: "Benzin", label: "⛽ Benzin" },
                { value: "Hybrid", label: "🔋 Hybrid" },
                { value: "Elektro", label: "⚡ Elektro" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateFormData({ fuel_type: opt.value })}
                  className={cn(
                    "px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-all text-center",
                    "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]",
                    formData.fuel_type === opt.value
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-card border-border",
                    fieldErrors.fuel_type && !formData.fuel_type && "border-red-300"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {fieldErrors.fuel_type && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.fuel_type}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className={cn(fieldErrors.transmission && "text-red-600")}>
              Getriebe <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2 max-w-xs">
              {[
                { value: "Schaltgetriebe", label: "⚙️ Schaltung" },
                { value: "Automatik", label: "🅰️ Automatik" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateFormData({ transmission: opt.value })}
                  className={cn(
                    "px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-all text-center",
                    "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]",
                    formData.transmission === opt.value
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-card border-border",
                    fieldErrors.transmission && !formData.transmission && "border-red-300"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {fieldErrors.transmission && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.transmission}</p>
            )}
          </div>

          {phase1Done && (
            <div className="flex items-center gap-2 text-sm text-green-600 animate-fade-in">
              <Check className="w-4 h-4" />
              <span className="font-medium">Motor & Antrieb ✓</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ PHASE 2: Schlafplätze as Chips (visible after Phase 1) ═══ */}
      {phase1Done && (
        <div className="space-y-2 animate-fade-in">
          <Label className={cn("flex items-center gap-2", fieldErrors.sleeping_places && "text-red-600")}>
            <Bed className="w-4 h-4" />
            Schlafplätze <span className="text-red-500">*</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => updateFormData({ sleeping_places: n })}
                className={cn(
                  "w-10 h-10 rounded-lg text-sm font-medium border-2 transition-all",
                  "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]",
                  formData.sleeping_places === n
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-card border-border",
                  fieldErrors.sleeping_places && !formData.sleeping_places && "border-red-300"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          {fieldErrors.sleeping_places && (
            <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.sleeping_places}</p>
          )}
        </div>
      )}

      {/* ═══ PHASE 3: Mängel pre-selected (visible after Phase 2) ═══ */}
      {phase1Done && phase2Done && (
        <div className="space-y-3 animate-fade-in">
          <Label>Bekannte Mängel?</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card
              className={cn(
                "p-3 cursor-pointer transition-all",
                formData.no_known_defects
                  ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                  : "hover:border-muted-foreground/50"
              )}
              onClick={() => handleDefectsToggle("no")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleDefectsToggle("no"); } }}
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                  formData.no_known_defects ? "border-green-500 bg-green-500" : "border-muted-foreground/30"
                )}>
                  {formData.no_known_defects && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className="cursor-pointer flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Keine Mängel bekannt
                </span>
              </div>
            </Card>

            <Card
              className={cn(
                "p-3 cursor-pointer transition-all",
                !formData.no_known_defects && formData.known_defects !== undefined
                  ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
                  : "hover:border-muted-foreground/50"
              )}
              onClick={() => handleDefectsToggle("yes")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleDefectsToggle("yes"); } }}
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                  !formData.no_known_defects && formData.known_defects !== undefined ? "border-orange-500 bg-orange-500" : "border-muted-foreground/30"
                )}>
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
              className="min-h-[80px] animate-fade-in"
            />
          )}
        </div>
      )}

      {/* ═══ All required done: confirmation + optional collapsed section ═══ */}
      {requiredFilled === requiredTotal && (
        <div className="space-y-3 animate-fade-in">
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2 text-sm">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-green-700 dark:text-green-300 font-medium">
              Alle Pflichtangaben vollständig – klicken Sie auf „Weiter" oder ergänzen Sie optionale Details
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowOptional(prev => !prev)}
            className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Info className="w-4 h-4 text-primary" />
              Weitere Details hinzufügen
              <span className="text-xs font-normal">(optional – erhöht Ihr Angebot)</span>
            </span>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showOptional && "rotate-180")} />
          </button>

          {showOptional && (
            <div className="space-y-5 animate-fade-in border-l-2 border-primary/20 pl-4 ml-1">
              {/* Sitzplätze optional, nur Wohnmobil */}
              {!isWohnwagen && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <UsersIcon className="w-4 h-4" />
                    Sitzplätze mit Gurt
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => updateFormData({ seats_with_seatbelts: formData.seats_with_seatbelts === n ? null : n })}
                        className={cn(
                          "w-10 h-10 rounded-lg text-sm font-medium border-2 transition-all",
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

              {/* Erstzulassung */}
              {!isWohnwagen && (
                <div className="space-y-2">
                  <Label>Erstzulassung</Label>
                  <div className="grid grid-cols-2 gap-2 max-w-sm">
                    <Select
                      value={formData.first_registration ? formData.first_registration.substring(5, 7) : ""}
                      onValueChange={(month) => {
                        const year = formData.first_registration ? formData.first_registration.substring(0, 4) : "";
                        if (year) {
                          updateFormData({ first_registration: `${year}-${month}-01` });
                        } else {
                          updateFormData({ first_registration: `${new Date().getFullYear()}-${month}-01` });
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Monat" /></SelectTrigger>
                      <SelectContent>
                        {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m, i) => (
                          <SelectItem key={m} value={m}>
                            {["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"][i]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={formData.first_registration ? formData.first_registration.substring(0, 4) : ""}
                      onValueChange={(year) => {
                        const month = formData.first_registration ? formData.first_registration.substring(5, 7) : "01";
                        updateFormData({ first_registration: `${year}-${month}-01` });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Jahr" /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: new Date().getFullYear() - 1979 }, (_, i) => (new Date().getFullYear() + 1 - i).toString()).map(y => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Basisfahrzeug + PS */}
              {!isWohnwagen && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    Basisfahrzeug / Chassis
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      value={formData.baseVehicle || ""}
                      onValueChange={(value) => {
                        updateFormData({ baseVehicle: value, power_ps: null, power_kw: null });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="z.B. Fiat Ducato" />
                      </SelectTrigger>
                      <SelectContent>
                        {baseVehicles.map(bv => (
                          <SelectItem key={bv.label} value={bv.label}>{bv.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Leistung (PS)</Label>
                      {formData.baseVehicle && getPowerOptionsForBaseVehicle(formData.baseVehicle).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {getPowerOptionsForBaseVehicle(formData.baseVehicle).map(ps => (
                            <button
                              key={ps}
                              type="button"
                              onClick={() => {
                                const newPs = formData.power_ps === ps ? null : ps;
                                updateFormData({ power_ps: newPs, power_kw: newPs ? Math.round(newPs * 0.7355) : null });
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all",
                                formData.power_ps === ps
                                  ? "bg-primary text-white border-primary shadow-sm"
                                  : "bg-card border-border hover:border-primary/50 hover:bg-primary/5"
                              )}
                            >
                              {ps} PS <span className="text-xs opacity-70">({Math.round(ps * 0.7355)} kW)</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="z.B. 130"
                          value={formData.power_ps || ""}
                          onChange={(e) => {
                            const ps = e.target.value ? parseInt(e.target.value) : null;
                            updateFormData({ power_ps: ps, power_kw: ps ? Math.round(ps * 0.7355) : null });
                          }}
                          min={0}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Fahrzeugzustand Checkboxen */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Fahrzeugzustand
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([
                    { id: "accident_free", label: "Unfallfrei", field: "accident_free" },
                    { id: "non_smoker", label: "Nichtraucher", field: "non_smoker" },
                    { id: "service_history_available", label: "Scheckheft", field: "service_history_available" },
                  ] as const).map(opt => (
                    <div
                      key={opt.id}
                      className={cn(
                        "flex items-center space-x-2 rounded-lg p-2.5 cursor-pointer transition-all border",
                        formData[opt.field] ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-transparent hover:bg-muted/40"
                      )}
                      onClick={(e) => { e.preventDefault(); updateFormData({ [opt.field]: !formData[opt.field] }); }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); updateFormData({ [opt.field]: !formData[opt.field] }); } }}
                    >
                      <Checkbox
                        id={opt.id}
                        checked={formData[opt.field] as boolean}
                        onCheckedChange={(checked) => updateFormData({ [opt.field]: checked as boolean })}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-sm font-medium cursor-pointer">{opt.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
