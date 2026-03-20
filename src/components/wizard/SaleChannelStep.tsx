import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Gavel, Zap, MapPin, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface SaleChannelStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  onAutoNext?: () => void;
}

export const SaleChannelStep = ({ formData, updateFormData, onAutoNext }: SaleChannelStepProps) => {
  const autoNextTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoNextTimerRef.current) {
        clearTimeout(autoNextTimerRef.current);
      }
    };
  }, []);

  const handleSelection = useCallback((value: string) => {
    // Clear any pending auto-next
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
    }
    
    updateFormData({ saleChannel: value });
    
    // Only auto-proceed for options that don't need additional input
    // "auction" option has a reserve price field, so we might not want to auto-proceed
    if (onAutoNext && value !== "auction") {
      autoNextTimerRef.current = setTimeout(() => {
        onAutoNext();
      }, 500);
    }
  }, [updateFormData, onAutoNext]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Verkaufsweg wählen
        </h2>
        <p className="text-muted-foreground">
          Wie möchten Sie Ihr Wohnmobil verkaufen?
        </p>
      </div>

      <RadioGroup
        value={formData.saleChannel}
        onValueChange={handleSelection}
        className="space-y-4"
      >
        <Card
          className={cn(
            "p-4 md:p-6 cursor-pointer transition-all duration-200 group",
            formData.saleChannel === "instant_price"
              ? "border-2 border-primary shadow-md ring-2 ring-primary/20"
              : "border-2 border-border hover:border-primary/50 hover:bg-muted/30"
          )}
          onClick={() => handleSelection("instant_price")}
        >
          <div className="flex items-start gap-4">
            <RadioGroupItem value="instant_price" id="instant_price" className="mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <Label htmlFor="instant_price" className="text-lg font-semibold cursor-pointer">
                  Sofortpreis
                </Label>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Erhalten Sie innerhalb von 24 Stunden ein faires Kaufangebot von professionellen Händlern
              </p>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Schnelle Abwicklung
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Garantierte Zahlung
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Keine Auktion nötig
                </li>
              </ul>
            </div>
          </div>
        </Card>

        <Card
          className={cn(
            "p-4 md:p-6 cursor-pointer transition-all duration-200 group",
            formData.saleChannel === "auction"
              ? "border-2 border-primary shadow-md ring-2 ring-primary/20"
              : "border-2 border-border hover:border-primary/50 hover:bg-muted/30"
          )}
          onClick={() => handleSelection("auction")}
        >
          <div className="flex items-start gap-4">
            <RadioGroupItem value="auction" id="auction" className="mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Gavel className="w-5 h-5 text-primary" />
                </div>
                <Label htmlFor="auction" className="text-lg font-semibold cursor-pointer">
                  Händler-Auktion
                </Label>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Lassen Sie professionelle Händler um Ihr Wohnmobil bieten und erzielen Sie den Höchstpreis
              </p>
              <ul className="space-y-1 text-sm mb-4">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Höchstpreis durch Wettbewerb
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Nur verifizierte Händler
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Mindestpreis festlegbar
                </li>
              </ul>

              {formData.saleChannel === "auction" && (
                <div className="space-y-2 pt-4 border-t border-border animate-slide-up">
                  <Label htmlFor="reservePrice">
                    Mindestpreis (optional)
                  </Label>
                  <Input
                    id="reservePrice"
                    type="number"
                    placeholder="z.B. 45000"
                    value={formData.reservePrice || ""}
                    onChange={(e) =>
                      updateFormData({ reservePrice: parseInt(e.target.value) || null })
                    }
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Der Mindestpreis wird Händlern nicht angezeigt
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card
          className={cn(
            "p-4 md:p-6 cursor-pointer transition-all duration-200 group",
            formData.saleChannel === "station"
              ? "border-2 border-primary shadow-md ring-2 ring-primary/20"
              : "border-2 border-border hover:border-primary/50 hover:bg-muted/30"
          )}
          onClick={() => handleSelection("station")}
        >
          <div className="flex items-start gap-4">
            <RadioGroupItem value="station" id="station" className="mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <Label htmlFor="station" className="text-lg font-semibold cursor-pointer">
                  Ankaufstation
                </Label>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Besuchen Sie eine unserer Ankaufstationen in Ihrer Nähe für eine persönliche Bewertung
              </p>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Persönliche Beratung vor Ort
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Sofortige Bewertung
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Direkter Verkauf möglich
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </RadioGroup>

      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Empfehlung:</strong> Die Händler-Auktion erzielt in der Regel die höchsten Preise, 
          während der Sofortpreis die schnellste Abwicklung garantiert.
        </p>
      </div>

      {formData.saleChannel && formData.saleChannel !== "auction" && (
        <p className="text-sm text-muted-foreground text-center animate-fade-in">
          Sie werden automatisch zum nächsten Schritt weitergeleitet...
        </p>
      )}
    </div>
  );
};
