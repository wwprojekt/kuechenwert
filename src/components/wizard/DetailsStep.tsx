import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { useEffect } from "react";
import { TrendingUp, AlertTriangle, CheckCircle2, Bed, Check, Fuel, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailsStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  fieldErrors?: Record<string, string>;
}

export const DetailsStep = ({ formData, updateFormData }: DetailsStepProps) => {
  const isWohnwagen = formData.vehicleType === "Wohnwagen";

  const handleDefectsToggle = (value: string) => {
    const noDefects = value === "no";
    updateFormData({
      no_known_defects: noDefects,
      known_defects: noDefects ? undefined : (formData.known_defects || ""),
    });
  };

  // Smart defaults on mount: Diesel + Schaltung + Keine Mängel
  // → Step can be passed with 0 clicks (all pre-selected).
  // We intentionally run once on mount: re-running on formData changes would
  // fight the user (e.g. setting fuel_type back to Diesel after they chose Benzin).
  useEffect(() => {
    const updates: Partial<WizardFormData> = {};
    if (!isWohnwagen && !formData.fuel_type) updates.fuel_type = "Diesel";
    if (!isWohnwagen && !formData.transmission) updates.transmission = "Schaltgetriebe";
    if (!formData.no_known_defects && formData.known_defects === undefined) updates.no_known_defects = true;
    if (Object.keys(updates).length > 0) updateFormData(updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count how many optional fields are filled (for encouragement, not gating)
  const filledCount = [
    formData.fuel_type,
    formData.transmission,
    formData.sleeping_places,
    formData.no_known_defects || formData.known_defects,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3 sm:space-y-5 animate-fade-in">
      {/* Header – positive framing instead of "Technische Details" */}
      <div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-0.5 sm:mb-1 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Bessere Angebote erhalten
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Mit diesen Angaben bieten Händler bis zu <strong className="text-foreground">15% mehr</strong> – alles vorausgefüllt, einfach prüfen
        </p>
      </div>

      {/* Vorauswahl-Info: zeigt dem User dass wir schon für ihn gearbeitet haben */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5 sm:p-3 flex items-center gap-2 text-xs sm:text-sm">
        <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="text-blue-700 dark:text-blue-300">
          Alles ist <strong>optional und vorausgefüllt</strong> — Sie können direkt auf <strong>„Weiter"</strong> klicken oder Angaben anpassen.
        </span>
      </div>

      {/* ═══ Motor & Antrieb (Wohnmobil only) – all visible, no progressive disclosure ═══ */}
      {!isWohnwagen && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-muted-foreground" />
              Kraftstoffart
              {formData.fuel_type && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    "min-h-[44px] px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-all text-center",
                    "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]",
                    formData.fuel_type === opt.value
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-card border-border"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              Getriebe
              {formData.transmission && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
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
                      : "bg-card border-border"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Schlafplätze – always visible, optional ═══ */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Bed className="w-4 h-4 text-muted-foreground" />
          Schlafplätze
          {formData.sleeping_places && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
        </Label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => updateFormData({ sleeping_places: formData.sleeping_places === n ? null : n })}
              className={cn(
                "w-11 h-11 rounded-lg text-sm font-medium border-2 transition-all",
                "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]",
                formData.sleeping_places === n
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-card border-border"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Mängel – always visible, pre-selected "no" ═══ */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          Bekannte Mängel?
          {(formData.no_known_defects || formData.known_defects) && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
        </Label>
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

      {/* ═══ Encouragement footer ═══ */}
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2 text-sm">
        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
        <span className="text-green-700 dark:text-green-300 font-medium">
          {filledCount >= 3
            ? "Super – Ihre Angaben helfen Händlern ein gutes Angebot zu machen!"
            : 'Sie können jederzeit auf "Weiter" klicken – alle Angaben sind optional.'
          }
        </span>
      </div>
    </div>
  );
};
