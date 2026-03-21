import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useRef, useEffect, useCallback } from "react";

interface DefectsStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  onAutoNext?: () => void;
}

export const DefectsStep = ({ formData, updateFormData, onAutoNext }: DefectsStepProps) => {
  const autoNextTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoNextTimerRef.current) {
        clearTimeout(autoNextTimerRef.current);
      }
    };
  }, []);

  const handleDefectsToggle = useCallback((value: string) => {
    // Clear any pending auto-next
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
    }

    const noDefects = value === "no";
    updateFormData({
      no_known_defects: noDefects,
      known_defects: noDefects ? undefined : formData.known_defects,
    });

    // Auto-proceed only if user selects "no defects" since that doesn't require more input
    if (noDefects && onAutoNext) {
      autoNextTimerRef.current = setTimeout(() => {
        onAutoNext();
      }, 500);
    }
  }, [updateFormData, formData.known_defects, onAutoNext]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          Bekannte Mängel
        </h2>
        <p className="text-muted-foreground">
          Bitte geben Sie ehrlich an, ob Ihnen Mängel am Fahrzeug bekannt sind. Dies schützt Sie und den Käufer.
        </p>
      </div>

      <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
        <p className="text-sm text-orange-800 dark:text-orange-200">
          <strong>Wichtiger Hinweis:</strong> Die vollständige und ehrliche Angabe von Mängeln ist rechtlich erforderlich 
          und schützt Sie vor späteren Reklamationen. Verschweigen von Mängeln kann zu rechtlichen Konsequenzen führen.
        </p>
      </div>

      <RadioGroup
        value={formData.no_known_defects ? "no" : formData.known_defects ? "yes" : ""}
        onValueChange={handleDefectsToggle}
        className="space-y-4"
      >
        <Card className={`p-4 cursor-pointer transition-all ${formData.no_known_defects ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'hover:border-muted-foreground/50'}`} onClick={() => handleDefectsToggle("no")}>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="no" id="no-defects" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="no-defects" className="text-base font-medium cursor-pointer flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Keine erwähnenswerten Mängel bekannt
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Mir sind keine wesentlichen Mängel am Fahrzeug bekannt. Das Fahrzeug wurde nach bestem Wissen und 
                Gewissen gepflegt und gewartet.
              </p>
            </div>
          </div>
        </Card>

        <Card className={`p-4 cursor-pointer transition-all ${!formData.no_known_defects && formData.known_defects !== undefined ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'hover:border-muted-foreground/50'}`} onClick={() => handleDefectsToggle("yes")}>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="yes" id="has-defects" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="has-defects" className="text-base font-medium cursor-pointer flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Folgende Mängel sind mir bekannt
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Es gibt bekannte Mängel, die ich nachfolgend beschreiben möchte.
              </p>
            </div>
          </div>
        </Card>
      </RadioGroup>

      {!formData.no_known_defects && (
        <div className="space-y-3 animate-fade-in">
          <Label htmlFor="known_defects" className="text-base font-medium">
            Beschreibung der bekannten Mängel <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="known_defects"
            placeholder="Bitte beschreiben Sie alle bekannten Mängel detailliert. Zum Beispiel: Kleine Delle an der rechten Seite, Wasserhahn tropft leicht, Markise zeigt Verschleiß..."
            value={formData.known_defects || ""}
            onChange={(e) => updateFormData({ known_defects: e.target.value })}
            className="min-h-[150px]"
          />
          <p className="text-xs text-muted-foreground">
            Bitte beschreiben Sie die Mängel so genau wie möglich, einschließlich Ort und Schwere.
          </p>
        </div>
      )}

      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Tipp:</strong> Ehrliche Angaben über Mängel bauen Vertrauen bei Käufern auf und vermeiden 
          Überraschungen bei der Besichtigung. Ein transparenter Verkauf führt zu zufriedeneren Käufern und 
          weniger Reklamationen.
        </p>
      </div>

      {formData.no_known_defects && (
        <p className="text-sm text-muted-foreground text-center animate-fade-in">
          Sie werden automatisch zum nächsten Schritt weitergeleitet...
        </p>
      )}
    </div>
  );
};
