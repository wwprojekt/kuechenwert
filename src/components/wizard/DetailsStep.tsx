import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { useEffect } from "react";
import { Gauge, AlertTriangle, CheckCircle2, Bed, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

      {/* ═══ All required done: confirmation ═══ */}
      {requiredFilled === requiredTotal && (
        <div className="animate-fade-in">
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2 text-sm">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-green-700 dark:text-green-300 font-medium">
              Alle Pflichtangaben vollständig – klicken Sie auf „Weiter"!
            </span>
          </div>
        </div>
      )}

    </div>
  );
};
