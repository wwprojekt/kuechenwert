import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Gauge, Shield, AlertTriangle, CheckCircle2, Bed, Users as UsersIcon, Info, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { baseVehicles, getPowerOptionsForBaseVehicle } from "@/lib/vehicle-data";

interface DetailsStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  fieldErrors?: Record<string, string>;
}

export const DetailsStep = ({ formData, updateFormData, fieldErrors = {} }: DetailsStepProps) => {
  const isWohnwagen = formData.vehicleType === "Wohnwagen";

  const handleDefectsToggle = (value: string) => {
    const noDefects = value === "no";
    updateFormData({
      no_known_defects: noDefects,
      // Bei "Mängel vorhanden": known_defects auf leeren String setzen,
      // damit die Bedingung `known_defects !== undefined` erfüllt ist
      // und die Karte als aktiv dargestellt wird + Textarea erscheint.
      // Bei "Keine Mängel": known_defects auf undefined zurücksetzen.
      known_defects: noDefects ? undefined : (formData.known_defects || ""),
    });
  };

  // Count required fields progress
  const requiredFilled = [
    ...(!isWohnwagen ? [formData.fuel_type, formData.transmission, formData.seats_with_seatbelts] : []),
    formData.sleeping_places,
    formData.no_known_defects || (formData.known_defects !== undefined),
  ].filter(Boolean).length;
  const requiredTotal = isWohnwagen ? 2 : 5; // wohnwagen: sleeping_places + defects; wohnmobil: fuel, trans, seats, sleeping, defects

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Gauge className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Technische Details
        </h2>
        <p className="text-sm text-muted-foreground">
          {isWohnwagen
            ? "Nur 2 Pflichtangaben – der Rest ist optional"
            : "Nur wenige Pflichtangaben – der Rest ist optional"
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
          <span>{requiredFilled} von {requiredTotal} Pflichtangaben</span>
        </div>
      </div>

      {/* Motor & Antrieb - NUR für Wohnmobile */}
      {!isWohnwagen && (<>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Motor & Antrieb</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fuel_type" className={cn(fieldErrors.fuel_type && "text-red-600")}>
                Kraftstoffart <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.fuel_type || ""}
                onValueChange={(value) => updateFormData({ fuel_type: value })}
              >
                <SelectTrigger id="fuel_type" className={cn(fieldErrors.fuel_type && "border-red-500 ring-red-500/20 ring-2")}>
                  <SelectValue placeholder="Wählen Sie..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Diesel">Diesel</SelectItem>
                  <SelectItem value="Benzin">Benzin</SelectItem>
                  <SelectItem value="Elektro">Elektro</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.fuel_type && (
                <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.fuel_type}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="transmission" className={cn(fieldErrors.transmission && "text-red-600")}>
                Getriebe <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.transmission || ""}
                onValueChange={(value) => updateFormData({ transmission: value })}
              >
                <SelectTrigger id="transmission" className={cn(fieldErrors.transmission && "border-red-500 ring-red-500/20 ring-2")}>
                  <SelectValue placeholder="Wählen Sie..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Schaltgetriebe">Schaltgetriebe</SelectItem>
                  <SelectItem value="Automatik">Automatik</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.transmission && (
                <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.transmission}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="first_registration">Erstzulassung <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="first_registration"
                type="month"
                value={formData.first_registration ? formData.first_registration.substring(0, 7) : ""}
                onChange={(e) => updateFormData({ first_registration: e.target.value ? `${e.target.value}-01` : "" })}
              />
            </div>
          </div>
        </div>

        {/* Basisfahrzeug + Leistung – chassis-based PS selection */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Basisfahrzeug & Leistung <span className="text-muted-foreground text-xs font-normal">(optional)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseVehicle">Basisfahrzeug / Chassis</Label>
              <Select
                value={formData.baseVehicle || ""}
                onValueChange={(value) => {
                  updateFormData({ baseVehicle: value, power_ps: null });
                }}
              >
                <SelectTrigger id="baseVehicle">
                  <SelectValue placeholder="z.B. Fiat Ducato" />
                </SelectTrigger>
                <SelectContent>
                  {baseVehicles.map(bv => (
                    <SelectItem key={bv.label} value={bv.label}>{bv.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Leistung (PS)</Label>
              {formData.baseVehicle && getPowerOptionsForBaseVehicle(formData.baseVehicle).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {getPowerOptionsForBaseVehicle(formData.baseVehicle).map(ps => (
                    <button
                      key={ps}
                      type="button"
                      onClick={() => updateFormData({ power_ps: formData.power_ps === ps ? null : ps })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                        formData.power_ps === ps
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-card border-border hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      {ps} PS
                    </button>
                  ))}
                </div>
              ) : (
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="z.B. 130"
                  value={formData.power_ps || ""}
                  onChange={(e) => updateFormData({ power_ps: e.target.value ? parseInt(e.target.value) : null })}
                  min={0}
                />
              )}
            </div>
          </div>
        </div>
      </>)}

      {/* Wohnwagen-Hinweis */}
      {isWohnwagen && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">Wohnwagen ohne Motor</p>
            <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
              Da Wohnwagen keinen eigenen Motor haben, entfallen die Felder für Kraftstoff, Getriebe und Leistung.
            </p>
          </div>
        </div>
      )}

      {/* Erstzulassung für Wohnwagen (separat, da Motor-Sektion ausgeblendet) */}
      {isWohnwagen && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Zulassung</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_registration_ww">Erstzulassung <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="first_registration_ww"
                type="month"
                value={formData.first_registration ? formData.first_registration.substring(0, 7) : ""}
                onChange={(e) => updateFormData({ first_registration: e.target.value ? `${e.target.value}-01` : "" })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Kapazität */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Kapazität</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sitzplätze mit Gurt - NUR für Wohnmobile */}
          {!isWohnwagen && (
            <div className="space-y-2">
              <Label htmlFor="seats_with_seatbelts" className={cn("flex items-center gap-2", fieldErrors.seats_with_seatbelts && "text-red-600")}>
                <UsersIcon className="w-4 h-4" />
                Sitzplätze mit Gurt <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.seats_with_seatbelts?.toString() || ""}
                onValueChange={(value) => updateFormData({ seats_with_seatbelts: parseInt(value) })}
              >
                <SelectTrigger id="seats_with_seatbelts" className={cn(fieldErrors.seats_with_seatbelts && "border-red-500 ring-red-500/20 ring-2")}>
                  <SelectValue placeholder="Anzahl wählen" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.seats_with_seatbelts && (
                <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.seats_with_seatbelts}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sleeping_places" className={cn("flex items-center gap-2", fieldErrors.sleeping_places && "text-red-600")}>
              <Bed className="w-4 h-4" />
              Schlafplätze <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.sleeping_places?.toString() || ""}
              onValueChange={(value) => updateFormData({ sleeping_places: parseInt(value) })}
            >
              <SelectTrigger id="sleeping_places" className={cn(fieldErrors.sleeping_places && "border-red-500 ring-red-500/20 ring-2")}>
                <SelectValue placeholder="Anzahl wählen" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.sleeping_places && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.sleeping_places}</p>
            )}
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
