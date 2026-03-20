import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  Euro,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Calculator,
  Info,
  Check,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";
import { z } from "zod";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Bitte geben Sie Ihren Namen ein"),
  email: z.string().trim().email("Ungültige E-Mail-Adresse"),
  phone: z.string().optional(),
});

const BODY_TYPES = [
  { value: "integriert", label: "Integriertes Wohnmobil", factor: 1.2 },
  { value: "teilintegriert", label: "Teilintegriertes Wohnmobil", factor: 1.1 },
  { value: "alkoven", label: "Alkovenmobil", factor: 1.0 },
  { value: "kastenwagen", label: "Kastenwagen / Van", factor: 0.95 },
  { value: "campingbus", label: "Campingbus", factor: 0.85 },
];

const CONDITIONS = [
  { value: "new", label: "Neu / Wie neu", factor: 1.0 },
  { value: "excellent", label: "Ausgezeichnet", factor: 0.9 },
  { value: "good", label: "Gut", factor: 0.75 },
  { value: "fair", label: "Befriedigend", factor: 0.6 },
  { value: "poor", label: "Renovierungsbedürftig", factor: 0.4 },
];

// Base value calculation constants
const BASE_VALUE_NEW = 80000; // Average base value for a new motorhome
const DEPRECIATION_RATE = 0.08; // 8% per year
const MILEAGE_FACTOR = 0.00001; // Reduce 1% per 10000km

const calculateValue = (
  bodyType: string,
  year: number,
  mileage: number,
  condition: string
): { min: number; max: number } => {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  // Get factors
  const bodyFactor = BODY_TYPES.find((b) => b.value === bodyType)?.factor || 1.0;
  const conditionFactor = CONDITIONS.find((c) => c.value === condition)?.factor || 0.75;

  // Calculate depreciation (limit to 80% max depreciation)
  const ageDepreciation = Math.min(0.8, age * DEPRECIATION_RATE);
  const mileageDepreciation = Math.min(0.3, mileage * MILEAGE_FACTOR);

  // Base calculation
  const baseValue = BASE_VALUE_NEW * bodyFactor;
  const depreciatedValue = baseValue * (1 - ageDepreciation) * (1 - mileageDepreciation);
  const finalValue = depreciatedValue * conditionFactor;

  // Add variance (+/- 15%)
  const min = Math.round(finalValue * 0.85);
  const max = Math.round(finalValue * 1.15);

  return { min: Math.max(min, 3000), max: Math.max(max, 5000) };
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
};

const Wertrechner = () => {
  const { toast } = useToast();
  const { settings } = useSettings();
  const siteName = settings?.site_name || 'CaravanWert';
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    bodyType: "",
    manufacturer: "",
    model: "",
    year: "",
    mileage: "",
    condition: "",
    name: "",
    email: "",
    phone: "",
  });
  const [estimatedValue, setEstimatedValue] = useState<{ min: number; max: number } | null>(null);
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("value_assessment_leads").insert({
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        year: data.year ? parseInt(data.year, 10) : null,
        mileage: data.mileage ? parseInt(data.mileage, 10) : null,
        condition: data.condition || null,
        body_type: data.bodyType || null,
        source: "wertrechner",
        estimated_value_min: estimatedValue?.min || null,
        estimated_value_max: estimatedValue?.max || null,
      });

      if (error) throw error;

      // Trigger notification Edge Function
      try {
        await supabase.functions.invoke("send-lead-notification", {
          body: {
            type: "wertrechner",
            name: data.name,
            email: data.email,
            phone: data.phone,
            manufacturer: data.manufacturer,
            model: data.model,
            estimatedMin: estimatedValue?.min,
            estimatedMax: estimatedValue?.max,
          },
        });
      } catch {
        // Don't fail if notification fails
      }
    },
    onSuccess: () => {
      setLeadSubmitted(true);
      toast({
        title: "Anfrage gesendet!",
        description: "Wir melden uns für eine genaue Bewertung bei Ihnen.",
      });
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Anfrage konnte nicht gesendet werden.",
        variant: "destructive",
      });
    },
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const calculateAndProceed = useCallback(() => {
    const year = parseInt(formData.year, 10);
    const mileage = parseInt(formData.mileage, 10);
    const currentYear = new Date().getFullYear();

    if (!formData.bodyType || !formData.condition || isNaN(year) || isNaN(mileage)) {
      toast({
        title: "Felder ausfüllen",
        description: "Bitte füllen Sie alle erforderlichen Felder aus.",
        variant: "destructive",
      });
      return;
    }

    if (year < 1950 || year > currentYear) {
      toast({
        title: "Ungültiges Baujahr",
        description: `Baujahr muss zwischen 1950 und ${currentYear} liegen.`,
        variant: "destructive",
      });
      return;
    }

    if (mileage < 0 || mileage > 999999) {
      toast({
        title: "Ungültiger Kilometerstand",
        description: "Kilometerstand muss zwischen 0 und 999.999 km liegen.",
        variant: "destructive",
      });
      return;
    }

    const value = calculateValue(formData.bodyType, year, mileage, formData.condition);
    setEstimatedValue(value);
    setStep(5);
  }, [formData.bodyType, formData.year, formData.mileage, formData.condition, toast]);

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      leadSchema.parse({ name: formData.name, email: formData.email, phone: formData.phone });
      submitMutation.mutate(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Bitte prüfen Sie Ihre Eingaben",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
    }
  };

  const canProceed = useCallback(() => {
    switch (step) {
      case 1:
        return !!formData.bodyType;
      case 2:
        return true; // Manufacturer/model optional
      case 3: {
        const y = parseInt(formData.year, 10);
        const m = parseInt(formData.mileage, 10);
        const currentYear = new Date().getFullYear();
        return !isNaN(y) && y >= 1950 && y <= currentYear && !isNaN(m) && m >= 0 && m <= 999999;
      }
      case 4:
        return !!formData.condition;
      default:
        return false;
    }
  }, [step, formData.bodyType, formData.year, formData.mileage, formData.condition]);

  // Auto-proceed timer ref
  const autoNextTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoNextTimerRef.current) {
        clearTimeout(autoNextTimerRef.current);
      }
    };
  }, []);

  const nextStep = useCallback(() => {
    if (step === 4) {
      calculateAndProceed();
    } else if (canProceed()) {
      setStep(step + 1);
    }
  }, [step, calculateAndProceed, canProceed]);

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
      if (step === 5) {
        setEstimatedValue(null);
      }
    }
  };

  // Auto-proceed with delay for visual feedback
  const handleSelectionWithAutoNext = useCallback((field: string, value: string, shouldAutoNext: boolean = true) => {
    // Clear any pending auto-next
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
    }
    
    updateField(field, value);
    
    if (shouldAutoNext) {
      // Small delay for visual feedback before proceeding
      autoNextTimerRef.current = setTimeout(() => {
        if (step === 4) {
          // For condition step, calculate and proceed
          const year = parseInt(formData.year, 10);
          const mileage = parseInt(formData.mileage, 10);
          const currentYear = new Date().getFullYear();
          if (formData.bodyType && !isNaN(year) && year >= 1950 && year <= currentYear && !isNaN(mileage) && mileage >= 0 && mileage <= 999999) {
            const calculatedValue = calculateValue(formData.bodyType, year, mileage, value);
            setEstimatedValue(calculatedValue);
            setStep(5);
          }
        } else {
          setStep(s => s + 1);
        }
      }, 400);
    }
  }, [step, formData]);

  return (
    <PageLayout
      title={`Wohnmobil Wertrechner - Kostenlose Sofort-Schätzung | ${siteName}`}
      description="Ermitteln Sie sofort den geschätzten Wert Ihres Wohnmobils mit unserem kostenlosen Wertrechner. Einfach, schnell und unverbindlich."
      keywords="wohnmobil wertrechner, wohnmobil wert berechnen, camper wert kalkulieren"
      canonicalPath="/wertrechner"
    >
      <PageHero size="sm">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Wohnmobil Wertrechner
          </h1>
          <p className="text-xl text-muted-foreground">
            Erhalten Sie in nur 4 Schritten eine erste Wertschätzung für Ihr Wohnmobil.
          </p>
        </div>
      </PageHero>

      <div className="container py-12">
        <div className="max-w-2xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-end text-sm text-muted-foreground mb-2">
              <span>{Math.round((Math.min(step, 4) / 4) * 100)}%</span>
            </div>
            <Progress value={Math.min(progress, 80)} className="h-2" />
          </div>

          <Card className="p-8">
            {/* Step 1: Body Type */}
            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Fahrzeugtyp</h2>
                  <p className="text-muted-foreground">
                    Welchen Typ Wohnmobil möchten Sie bewerten?
                  </p>
                </div>
                <div className="grid gap-3">
                  {BODY_TYPES.map((type, index) => (
                    <button
                      key={type.value}
                      onClick={() => handleSelectionWithAutoNext("bodyType", type.value)}
                      className={cn(
                        "p-4 rounded-lg border text-left transition-all duration-200 flex items-center justify-between group",
                        "animate-fade-in",
                        formData.bodyType === type.value
                          ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <span className="font-medium">{type.label}</span>
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200",
                        formData.bodyType === type.value
                          ? "bg-primary text-white scale-100"
                          : "bg-muted scale-0 group-hover:scale-75 group-hover:bg-muted"
                      )}>
                        <Check className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Klicken Sie auf eine Option, um fortzufahren
                </p>
              </div>
            )}

            {/* Step 2: Manufacturer/Model */}
            {step === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Hersteller & Modell</h2>
                  <p className="text-muted-foreground">
                    Geben Sie Hersteller und Modell an (optional, verbessert die Genauigkeit).
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2 animate-fade-in" style={{ animationDelay: '50ms' }}>
                    <Label htmlFor="manufacturer">Hersteller</Label>
                    <Input
                      id="manufacturer"
                      placeholder="z.B. Hymer, Dethleffs, Bürstner..."
                      value={formData.manufacturer}
                      onChange={(e) => updateField("manufacturer", e.target.value)}
                      className="transition-all focus:ring-2 focus:ring-primary/20"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <Label htmlFor="model">Modell</Label>
                    <Input
                      id="model"
                      placeholder="z.B. B-Klasse, Globebus, Ixeo..."
                      value={formData.model}
                      onChange={(e) => updateField("model", e.target.value)}
                      className="transition-all focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center animate-fade-in" style={{ animationDelay: '150ms' }}>
                  Diese Angaben sind optional - klicken Sie auf "Weiter" um fortzufahren
                </p>
              </div>
            )}

            {/* Step 3: Year/Mileage */}
            {step === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Baujahr & Kilometerstand</h2>
                  <p className="text-muted-foreground">
                    Diese Daten beeinflussen den Wert erheblich.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 animate-fade-in" style={{ animationDelay: '50ms' }}>
                    <Label htmlFor="year">Baujahr *</Label>
                    <Input
                      id="year"
                      type="number"
                      placeholder="z.B. 2018"
                      min={1980}
                      max={new Date().getFullYear()}
                      value={formData.year}
                      onChange={(e) => updateField("year", e.target.value)}
                      className="transition-all focus:ring-2 focus:ring-primary/20 text-lg h-12"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <Label htmlFor="mileage">Kilometerstand *</Label>
                    <Input
                      id="mileage"
                      type="number"
                      placeholder="z.B. 45000"
                      min={0}
                      value={formData.mileage}
                      onChange={(e) => updateField("mileage", e.target.value)}
                      className="transition-all focus:ring-2 focus:ring-primary/20 text-lg h-12"
                    />
                    <p className="text-xs text-muted-foreground">in Kilometern</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Condition */}
            {step === 4 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Fahrzeugzustand</h2>
                  <p className="text-muted-foreground">
                    Wie würden Sie den Gesamtzustand Ihres Wohnmobils einschätzen?
                  </p>
                </div>
                <div className="grid gap-3">
                  {CONDITIONS.map((cond, index) => (
                    <button
                      key={cond.value}
                      onClick={() => handleSelectionWithAutoNext("condition", cond.value)}
                      className={cn(
                        "p-4 rounded-lg border text-left transition-all duration-200 flex items-center justify-between group",
                        "animate-fade-in",
                        formData.condition === cond.value
                          ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <span className="font-medium">{cond.label}</span>
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200",
                        formData.condition === cond.value
                          ? "bg-primary text-white scale-100"
                          : "bg-muted scale-0 group-hover:scale-75 group-hover:bg-muted"
                      )}>
                        <Check className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Klicken Sie auf eine Option, um den Wert zu berechnen
                </p>
              </div>
            )}

            {/* Step 5: Results */}
            {step === 5 && estimatedValue && (
              <div className="space-y-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                    <Calculator className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Geschätzter Wert</h2>
                  <p className="text-muted-foreground">
                    Basierend auf Ihren Angaben und aktuellen Marktdaten
                  </p>
                </div>

                <div className="bg-primary/5 rounded-xl p-8 text-center">
                  <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                    {formatCurrency(estimatedValue.min)} - {formatCurrency(estimatedValue.max)}
                  </div>
                  <p className="text-muted-foreground">
                    Geschätzter Marktwert
                  </p>
                </div>

                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Dies ist eine erste Schätzung. Der tatsächliche Wert kann je nach Ausstattung, 
                    Wartungshistorie und individuellen Faktoren variieren. Für eine genauere 
                    Bewertung kontaktieren Sie uns.
                  </p>
                </div>

                {/* Lead Capture */}
                {!leadSubmitted ? (
                  <div className="border-t pt-8">
                    <h3 className="font-semibold text-lg mb-4">
                      Genauere Bewertung gewünscht?
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Hinterlassen Sie Ihre Kontaktdaten und unsere Experten melden sich 
                      mit einer detaillierten Einschätzung bei Ihnen.
                    </p>
                    <form onSubmit={handleLeadSubmit} className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name *</Label>
                          <Input
                            id="name"
                            placeholder="Max Mustermann"
                            value={formData.name}
                            onChange={(e) => updateField("name", e.target.value)}

                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">E-Mail *</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="max@beispiel.de"
                            value={formData.email}
                            onChange={(e) => updateField("email", e.target.value)}

                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefon (optional)</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+49 123 456789"
                          value={formData.phone}
                          onChange={(e) => updateField("phone", e.target.value)}
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full gradient-hero"
                        disabled={submitMutation.isPending}
                      >
                        {submitMutation.isPending ? "Wird gesendet..." : "Expertenberatung anfordern"}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </form>
                  </div>
                ) : (
                  <div className="border-t pt-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Vielen Dank!</h3>
                    <p className="text-muted-foreground mb-6">
                      Wir melden uns in Kürze bei Ihnen.
                    </p>
                    <Link to="/verkaufen">
                      <Button className="gradient-hero">
                        Jetzt verkaufen
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                )}

                {/* Summary */}
                <div className="border-t pt-6">
                  <h4 className="font-medium mb-3 text-sm text-muted-foreground">
                    Ihre Angaben:
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Typ:</span>
                    <span>{BODY_TYPES.find((b) => b.value === formData.bodyType)?.label}</span>
                    {formData.manufacturer && (
                      <>
                        <span className="text-muted-foreground">Hersteller:</span>
                        <span>{formData.manufacturer}</span>
                      </>
                    )}
                    {formData.model && (
                      <>
                        <span className="text-muted-foreground">Modell:</span>
                        <span>{formData.model}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">Baujahr:</span>
                    <span>{formData.year}</span>
                    <span className="text-muted-foreground">Kilometerstand:</span>
                    <span>{parseInt(formData.mileage, 10).toLocaleString("de-DE")} km</span>
                    <span className="text-muted-foreground">Zustand:</span>
                    <span>{CONDITIONS.find((c) => c.value === formData.condition)?.label}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            {step < 5 && (
              <div className="flex justify-between mt-8 pt-6 border-t">
                <Button
                  variant="ghost"
                  onClick={prevStep}
                  disabled={step === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Zurück
                </Button>
                <Button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="gradient-hero"
                >
                  {step === 4 ? "Wert berechnen" : "Weiter"}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 5 && (
              <div className="mt-8 pt-6 border-t">
                <Button variant="ghost" onClick={prevStep} className="w-full">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Angaben ändern
                </Button>
              </div>
            )}
          </Card>

          {/* Alternative CTA */}
          {step < 5 && (
            <div className="mt-8 text-center">
              <p className="text-muted-foreground mb-4">
                Lieber eine professionelle Bewertung durch unsere Experten?
              </p>
              <Link to="/wertermittlung">
                <Button variant="outline">
                  <Euro className="w-4 h-4 mr-2" />
                  Kostenlose Expertenbewertung anfordern
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default Wertrechner;
