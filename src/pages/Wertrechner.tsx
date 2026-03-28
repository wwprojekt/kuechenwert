import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import PageLayout from "@/components/PageLayout";
import { generateServiceSchema, generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  User,
  Mail,
  Phone,
  Lock,
  Shield,
  Clock,
  Star,
  Truck,
  CarFront,
  Bus,
  Caravan,
  TrendingUp,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { trackWertrechnerLead, setEnhancedConversionFromForm, generateTransactionId } from "@/lib/gadsConversionService";
import { getTrackingData } from "@/lib/clickIdService";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Bitte geben Sie Ihren Namen ein"),
  email: z.string().trim().email("Ungültige E-Mail-Adresse"),
  phone: z.string().trim().min(5, "Bitte geben Sie Ihre Telefonnummer ein"),
});

const BODY_TYPES = [
  { value: "integriert", label: "Integriertes Wohnmobil", icon: Bus, description: "Vollintegriert mit Fahrerhaus", basePrice: 120000 },
  { value: "teilintegriert", label: "Teilintegriertes Wohnmobil", icon: Caravan, description: "Aufbau auf Fahrzeugbasis", basePrice: 90000 },
  { value: "alkoven", label: "Alkovenmobil", icon: Truck, description: "Mit Schlafbereich über dem Fahrerhaus", basePrice: 80000 },
  { value: "kastenwagen", label: "Kastenwagen / Van", icon: CarFront, description: "Kompakt und wendig", basePrice: 65000 },
  { value: "campingbus", label: "Campingbus", icon: CarFront, description: "Flexibel und alltagstauglich", basePrice: 55000 },
];

const CONDITIONS = [
  { value: "new", label: "Neu / Wie neu", description: "Keine Gebrauchsspuren, neuwertig", emoji: "✨", factor: 1.0 },
  { value: "excellent", label: "Ausgezeichnet", description: "Minimale Gebrauchsspuren, top gepflegt", emoji: "🌟", factor: 0.92 },
  { value: "good", label: "Gut", description: "Normale Gebrauchsspuren, gepflegt", emoji: "👍", factor: 0.80 },
  { value: "fair", label: "Befriedigend", description: "Deutliche Gebrauchsspuren, funktionsfähig", emoji: "👌", factor: 0.65 },
  { value: "poor", label: "Renovierungsbedürftig", description: "Erhebliche Mängel, Reparaturbedarf", emoji: "🔧", factor: 0.45 },
];

const MANUFACTURERS = [
  "Adria", "Ahorn Camp", "Bavaria", "Benimar", "Bürstner", "Carado", "Carthago",
  "Challenger", "Chausson", "Concorde", "Dethleffs", "Elnagh", "Etrusco",
  "Eura Mobil", "Fendt", "Forster", "Frankia", "Globecar", "Hobby", "Hymer",
  "Knaus", "Laika", "LMC", "Malibu", "McLouis", "Morelo", "Niesmann+Bischoff",
  "Pilote", "Pössl", "Rapido", "Roller Team", "Sunlight", "Sun Living",
  "Volkswagen", "Weinsberg", "Westfalia",
];

// Markenspezifische Preisklassen (Tier-System)
const BRAND_TIERS: Record<string, string> = {
  // Luxus
  "Concorde": "luxus", "Morelo": "luxus", "Volkner": "luxus",
  // Premium
  "Carthago": "premium", "Hymer": "premium", "Niesmann+Bischoff": "premium",
  "Frankia": "premium", "Eura Mobil": "premium", "Rapido": "premium",
  "La Strada": "premium", "Phoenix": "premium",
  // Mittelklasse
  "Knaus": "mittelklasse", "Bürstner": "mittelklasse", "Dethleffs": "mittelklasse",
  "Hobby": "mittelklasse", "LMC": "mittelklasse", "Chausson": "mittelklasse",
  "Challenger": "mittelklasse", "Pilote": "mittelklasse", "Adria": "mittelklasse",
  "Benimar": "mittelklasse", "Laika": "mittelklasse", "Elnagh": "mittelklasse",
  "Globecar": "mittelklasse", "Pössl": "mittelklasse", "Malibu": "mittelklasse",
  "Westfalia": "mittelklasse", "Volkswagen": "mittelklasse", "Fendt": "mittelklasse",
  "Bavaria": "mittelklasse",
  // Economy
  "Sunlight": "economy", "Sun Living": "economy", "Etrusco": "economy",
  "Forster": "economy", "Roller Team": "economy", "McLouis": "economy",
  "Carado": "economy", "Weinsberg": "economy", "Ahorn Camp": "economy",
};

const TIER_MULTIPLIERS: Record<string, number> = {
  luxus: 2.8,
  premium: 1.4,
  mittelklasse: 1.0,
  economy: 0.8,
};

// Degressive Abschreibungskurven nach Aufbautyp [Jahr1, Jahr2, Jahr3, Jahr4, ab_Jahr5]
const DEPRECIATION_CURVES: Record<string, number[]> = {
  campingbus: [0.15, 0.06, 0.05, 0.04, 0.03],
  kastenwagen: [0.15, 0.06, 0.05, 0.04, 0.03],
  alkoven: [0.16, 0.08, 0.06, 0.04, 0.03],
  teilintegriert: [0.16, 0.07, 0.06, 0.04, 0.03],
  integriert: [0.17, 0.07, 0.06, 0.05, 0.03],
};

// Kilometer-Anpassungsfaktor (relativ zum Alter)
const getMileageAdjustment = (age: number, mileage: number): number => {
  if (age <= 0) return 1.0;
  const expectedKm = age * 10000;
  const kmRatio = expectedKm > 0 ? mileage / expectedKm : 1.0;
  if (kmRatio <= 0.5) return 1.10;
  if (kmRatio <= 0.8) return 1.05;
  if (kmRatio <= 1.2) return 1.0;
  if (kmRatio <= 1.5) return 0.95;
  if (kmRatio <= 2.0) return 0.90;
  if (kmRatio <= 3.0) return 0.85;
  return 0.80;
};

const calculateValue = (
  bodyType: string,
  year: number,
  mileage: number,
  condition: string,
  manufacturer?: string
): { min: number; max: number; brandTier: string } => {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  // 1. Basispreis nach Aufbautyp
  const basePrice = BODY_TYPES.find((b) => b.value === bodyType)?.basePrice || 80000;

  // 2. Marken-Multiplikator
  const brandTier = manufacturer ? (BRAND_TIERS[manufacturer] || "mittelklasse") : "mittelklasse";
  const tierMult = TIER_MULTIPLIERS[brandTier] || 1.0;
  const adjustedBase = basePrice * tierMult;

  // 3. Degressive Altersabschreibung
  const curve = DEPRECIATION_CURVES[bodyType] || [0.16, 0.07, 0.06, 0.04, 0.03];
  let remaining = 1.0;
  for (let y = 0; y < age; y++) {
    const rate = y < curve.length - 1 ? curve[y] : curve[curve.length - 1];
    remaining *= (1 - rate);
  }
  const ageAdjusted = adjustedBase * remaining;

  // 4. Kilometer-Anpassung
  const kmFactor = getMileageAdjustment(age, mileage);
  const kmAdjusted = ageAdjusted * kmFactor;

  // 5. Zustandsfaktor
  const conditionFactor = CONDITIONS.find((c) => c.value === condition)?.factor || 0.80;
  const finalValue = kmAdjusted * conditionFactor;

  // 6. Ergebnis-Spanne (±12%)
  const min = Math.round(finalValue * 0.88);
  const max = Math.round(finalValue * 1.12);
  return { min: Math.max(min, 2000), max: Math.max(max, 3500), brandTier };
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
};

// Generate years for dropdown
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 1979 }, (_, i) => currentYear - i);

// Loading messages for fake calculation
const LOADING_MESSAGES = [
  { text: "Fahrzeugdaten werden analysiert...", duration: 800 },
  { text: "Marktdaten werden abgeglichen...", duration: 1000 },
  { text: "Vergleichbare Fahrzeuge werden gesucht...", duration: 1200 },
  { text: "Wert wird berechnet...", duration: 800 },
];

// Step indicator component
const StepIndicator = ({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) => {
  const steps = [
    { label: "Typ", icon: Truck },
    { label: "Marke", icon: Star },
    { label: "Details", icon: Calculator },
    { label: "Zustand", icon: Shield },
    { label: "Kontakt", icon: User },
  ];
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;
  return (
    <div className="mb-8 space-y-3">
      {/* Progress bar */}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-teal-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Step circles */}
      <div className="flex items-center justify-between">
        {steps.map((s, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;
          const Icon = s.icon;
          return (
            <div key={stepNum} className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                  isCompleted
                    ? "bg-primary text-white shadow-md"
                    : isActive
                    ? "bg-primary text-white shadow-lg ring-4 ring-primary/20 scale-110"
                    : "bg-muted/80 text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium transition-colors hidden sm:block",
                  isActive ? "text-primary font-semibold" : isCompleted ? "text-primary/70" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Trust badges component
const TrustBadges = () => (
  <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-4 text-xs sm:text-sm text-muted-foreground">
    <div className="flex items-center gap-1.5">
      <Shield className="w-4 h-4 text-green-600" />
      <span>100% Kostenlos</span>
    </div>
    <div className="flex items-center gap-1.5">
      <Lock className="w-4 h-4 text-blue-600" />
      <span>Datenschutz garantiert</span>
    </div>
    <div className="flex items-center gap-1.5">
      <Clock className="w-4 h-4 text-orange-500" />
      <span>Ergebnis in 2 Min.</span>
    </div>
    <div className="flex items-center gap-1.5">
      <Star className="w-4 h-4 text-yellow-500" />
      <span>Unverbindlich</span>
    </div>
  </div>
);

// Animated counter for result
const AnimatedValue = ({ value, duration = 1500 }: { value: number; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let start = 0;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * value);
      setDisplayValue(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span ref={ref}>
      {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(displayValue)}
    </span>
  );
};

// Loading/Calculation animation component
const CalculationAnimation = ({ onComplete }: { onComplete: () => void }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let totalElapsed = 0;
    const totalDuration = LOADING_MESSAGES.reduce((sum, m) => sum + m.duration, 0);
    let animFrame: number;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const overallProgress = Math.min((elapsed / totalDuration) * 100, 100);
      setProgress(overallProgress);

      // Determine which message to show
      let accumulated = 0;
      for (let i = 0; i < LOADING_MESSAGES.length; i++) {
        accumulated += LOADING_MESSAGES[i].duration;
        if (elapsed < accumulated) {
          setMessageIndex(i);
          break;
        }
      }

      if (elapsed < totalDuration) {
        animFrame = requestAnimationFrame(animate);
      } else {
        setProgress(100);
        setMessageIndex(LOADING_MESSAGES.length - 1);
        setTimeout(onComplete, 500);
      }
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8 animate-fade-in">
      {/* Animated circle */}
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
          <circle
            cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="6"
            className="text-primary transition-all duration-300"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress / 100)}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Status message */}
      <div className="text-center space-y-2">
        <p className="text-lg font-semibold text-foreground animate-pulse">
          {LOADING_MESSAGES[messageIndex]?.text}
        </p>
        <p className="text-sm text-muted-foreground">
          Bitte warten Sie einen Moment...
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const Wertrechner = () => {
  const { toast } = useToast();
  const { settings } = useSettings();
  const siteName = settings?.site_name || "CaravanWert";
  const [searchParams] = useSearchParams();

  // Determine initial state from URL params (e.g. from LandingLeadForm)
  const prefillBodyType = searchParams.get("bodyType") || "";
  const prefillManufacturer = searchParams.get("manufacturer") || "";
  const fromLanding = searchParams.get("from") === "landing";

  const [step, setStep] = useState(() => {
    // If coming from landing page with prefilled data, skip to step 3 (Baujahr/km)
    if (fromLanding && prefillBodyType) return 3;
    return 1;
  });
  const [showCalculation, setShowCalculation] = useState(false);
  const [formData, setFormData] = useState(() => {
    // If coming from landing page, use URL params as initial data
    if (fromLanding && prefillBodyType) {
      return {
        bodyType: prefillBodyType,
        manufacturer: prefillManufacturer,
        model: "",
        year: "",
        mileage: "",
        condition: "",
        name: "",
        email: "",
        phone: "",
      };
    }
    // Otherwise restore from session storage
    try {
      const saved = sessionStorage.getItem("wertrechner_data");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      bodyType: "",
      manufacturer: "",
      model: "",
      year: "",
      mileage: "",
      condition: "",
      name: "",
      email: "",
      phone: "",
    };
  });
  const [estimatedValue, setEstimatedValue] = useState<{ min: number; max: number } | null>(null);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [aiEstimate, setAiEstimate] = useState<{ value: number; confidence: number; reasoning?: string; trainingCount: number } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [mileageDisplay, setMileageDisplay] = useState(() => {
    if (formData.mileage) {
      return parseInt(formData.mileage, 10).toLocaleString("de-DE");
    }
    return "";
  });
  const [showManufacturerDropdown, setShowManufacturerDropdown] = useState(false);
  const [manufacturerFilter, setManufacturerFilter] = useState(formData.manufacturer || "");
  const manufacturerRef = useRef<HTMLDivElement>(null);

  const totalSteps = 5; // Visual steps (calculation animation is between 4 and 5)

  // Save to session storage on change
  useEffect(() => {
    try {
      sessionStorage.setItem("wertrechner_data", JSON.stringify(formData));
    } catch {}
  }, [formData]);

  // Close manufacturer dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (manufacturerRef.current && !manufacturerRef.current.contains(e.target as Node)) {
        setShowManufacturerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const year = parseInt(data.year, 10);
      const mileage = parseInt(data.mileage, 10);
      const value = calculateValue(data.bodyType, year, mileage, data.condition, data.manufacturer);
      setEstimatedValue(value);

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
        estimated_value_min: value.min,
        estimated_value_max: value.max,
        algorithm_value_min: value.min,
        algorithm_value_max: value.max,
        brand_tier: value.brandTier,
      } as any);

      if (error) throw error;

      try {
        // Tracking-Daten (Click-IDs, GA4 Client-ID) für Server-Side Conversion Tracking
        const trackingData = getTrackingData();
        // Transaction ID für Deduplizierung über alle 3 Tracking-Schichten
        const transactionId = generateTransactionId('wertrechner');
        // transactionId im Closure speichern für onSuccess
        (window as any).__lastTransactionId = transactionId;
        await supabase.functions.invoke("send-lead-notification", {
          body: {
            type: "wertrechner",
            name: data.name,
            email: data.email,
            phone: data.phone,
            manufacturer: data.manufacturer,
            model: data.model,
            estimatedMin: value.min,
            estimatedMax: value.max,
            // Google Ads Click-IDs für serverseitige Attribution
            gclid: trackingData.gclid,
            gbraid: trackingData.gbraid,
            wbraid: trackingData.wbraid,
            ga4ClientId: trackingData.ga4ClientId,
            // Transaction ID für Deduplizierung (Schicht 2 + 3)
            transactionId,
          },
        });
      } catch {}

      return value;
    },
    onSuccess: async (value) => {
      setLeadSubmitted(true);
      setEstimatedValue(value);
      setStep(6);
      // Google Ads: Enhanced Conversions vor dem Conversion-Event setzen
      await setEnhancedConversionFromForm({ email: formData.email, name: formData.name, phone: formData.phone });
      const txId = (window as any).__lastTransactionId || generateTransactionId('wertrechner');
      await trackWertrechnerLead(`${formData.manufacturer} ${formData.model} ${formData.year}`, txId);
      toast({ title: "Vielen Dank!", description: "Hier ist Ihre Wertschätzung." });

      // KI-Schätzung im Hintergrund abrufen (non-blocking)
      setAiLoading(true);
      (async () => {
        try {
          const { data: aiData } = await supabase.functions.invoke("ai-valuation", {
            body: {
              manufacturer: formData.manufacturer || null,
              model: formData.model || null,
              bodyType: formData.bodyType,
              year: parseInt(formData.year, 10),
              mileage: parseInt(formData.mileage, 10),
              condition: formData.condition,
              algorithmMin: value.min,
              algorithmMax: value.max,
            },
          });
          if (aiData?.success && aiData.hasAiEstimate && aiData.aiEstimatedValue) {
            setAiEstimate({
              value: aiData.aiEstimatedValue,
              confidence: aiData.aiConfidence || 0,
              reasoning: aiData.aiReasoning,
              trainingCount: aiData.trainingCount || 0,
            });
          }
        } catch {
          // KI-Schätzung ist optional, Fehler ignorieren
        } finally {
          setAiLoading(false);
        }
      })();
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    },
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev: typeof formData) => ({ ...prev, [field]: value }));
  };

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\./g, "").replace(/\D/g, "");
    if (raw === "") {
      setMileageDisplay("");
      updateField("mileage", "");
      return;
    }
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num <= 999999) {
      setMileageDisplay(num.toLocaleString("de-DE"));
      updateField("mileage", String(num));
    }
  };

  const filteredManufacturers = MANUFACTURERS.filter((m) =>
    m.toLowerCase().includes(manufacturerFilter.toLowerCase())
  );

  const calculateAndProceed = useCallback(() => {
    const year = parseInt(formData.year, 10);
    const mileage = parseInt(formData.mileage, 10);
    const currentYear = new Date().getFullYear();

    if (!formData.bodyType || !formData.condition || isNaN(year) || isNaN(mileage)) {
      toast({ title: "Felder ausfüllen", description: "Bitte füllen Sie alle erforderlichen Felder aus.", variant: "destructive" });
      return;
    }
    if (year < 1950 || year > currentYear) {
      toast({ title: "Ungültiges Baujahr", description: `Baujahr muss zwischen 1950 und ${currentYear} liegen.`, variant: "destructive" });
      return;
    }
    if (mileage < 0 || mileage > 999999) {
      toast({ title: "Ungültiger Kilometerstand", description: "Kilometerstand muss zwischen 0 und 999.999 km liegen.", variant: "destructive" });
      return;
    }

    // Show calculation animation
    setShowCalculation(true);
  }, [formData, toast]);

  const handleCalculationComplete = useCallback(() => {
    setShowCalculation(false);
    setStep(5);
  }, []);

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      leadSchema.parse({ name: formData.name, email: formData.email, phone: formData.phone });
      submitMutation.mutate(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Bitte prüfen Sie Ihre Eingaben", description: error.errors[0].message, variant: "destructive" });
      }
    }
  };

  const canProceed = useCallback(() => {
    switch (step) {
      case 1: return !!formData.bodyType;
      case 2: return true;
      case 3: {
        const y = parseInt(formData.year, 10);
        const m = parseInt(formData.mileage, 10);
        const cy = new Date().getFullYear();
        return !isNaN(y) && y >= 1950 && y <= cy && !isNaN(m) && m >= 0 && m <= 999999;
      }
      case 4: return !!formData.condition;
      case 5: return formData.name.trim().length >= 2 && formData.email.trim().length > 0 && formData.phone.trim().length >= 5;
      default: return false;
    }
  }, [step, formData]);

  const autoNextTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current); };
  }, []);

  const nextStep = useCallback(() => {
    if (step === 4) {
      calculateAndProceed();
    } else if (canProceed()) {
      setStep(step + 1);
    }
  }, [step, calculateAndProceed, canProceed]);

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSelectionWithAutoNext = useCallback((field: string, value: string, shouldAutoNext: boolean = true) => {
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    updateField(field, value);
    if (shouldAutoNext) {
      autoNextTimerRef.current = setTimeout(() => {
        if (field === "condition") {
          // Trigger calculation animation
          const year = parseInt(formData.year, 10);
          const mileage = parseInt(formData.mileage, 10);
          const cy = new Date().getFullYear();
          if (formData.bodyType && !isNaN(year) && year >= 1950 && year <= cy && !isNaN(mileage) && mileage >= 0 && mileage <= 999999) {
            setShowCalculation(true);
          }
        } else {
          setStep((s) => s + 1);
        }
      }, 400);
    }
  }, [step, formData]);

  // Handle Enter key for text steps
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canProceed() && step < 5) {
      e.preventDefault();
      nextStep();
    }
  }, [canProceed, nextStep, step]);

  // Summary chips showing previous selections
  const SummaryChips = () => {
    const chips: string[] = [];
    if (formData.bodyType) chips.push(BODY_TYPES.find((b) => b.value === formData.bodyType)?.label || "");
    if (formData.manufacturer) chips.push(formData.manufacturer);
    if (formData.year) chips.push(`BJ ${formData.year}`);
    if (formData.mileage) chips.push(`${parseInt(formData.mileage, 10).toLocaleString("de-DE")} km`);
    if (formData.condition) chips.push(CONDITIONS.find((c) => c.value === formData.condition)?.label || "");

    if (chips.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mb-6">
        {chips.map((chip, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Check className="w-3 h-3" />
            {chip}
          </span>
        ))}
      </div>
    );
  };

  return (
    <PageLayout
      breadcrumbs={true}
      title="Wohnmobil Wertrechner – Kostenlose Sofort-Schätzung"
      description="Ermitteln Sie sofort den geschätzten Wert Ihres Wohnmobils mit unserem kostenlosen Wertrechner. Einfach, schnell und unverbindlich."
      keywords="wohnmobil wertrechner, wohnmobil wert berechnen, camper wert kalkulieren"
      canonicalPath="/wertrechner"
      structuredData={[
        generateServiceSchema("Wohnmobil Wertrechner", "Kostenloser Online-Wertrechner für Wohnmobile. Sofort-Schätzung in 2 Minuten basierend auf aktuellen Marktdaten."),
        generateBreadcrumbSchema(getBreadcrumbsFromPath("/wertrechner")),
      ]}
    >
      <PageHero size="sm">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Wohnmobil Wertrechner</h1>
          <p className="text-lg text-muted-foreground mb-4">
            Erhalten Sie in nur 2 Minuten eine kostenlose Wertschätzung für Ihr Wohnmobil.
          </p>
          {/* Social proof */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-sm font-medium text-primary">
            <TrendingUp className="w-4 h-4" />
            <span>Über 5.000 Fahrzeuge bewertet</span>
          </div>
        </div>
      </PageHero>

      <div className="container py-8 sm:py-12">
        <div className="max-w-2xl mx-auto">
          {/* Step Indicator */}
          {step <= 5 && !showCalculation && <StepIndicator currentStep={step} totalSteps={totalSteps} />}

          <Card className="p-6 sm:p-8 shadow-xl border-0 ring-1 ring-border/40 rounded-2xl">
            {/* Summary chips */}
            {step > 1 && step <= 5 && !showCalculation && <SummaryChips />}

            {/* Calculation Animation */}
            {showCalculation && <CalculationAnimation onComplete={handleCalculationComplete} />}

            {/* Step 1: Body Type */}
            {!showCalculation && step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-1">Welcher Fahrzeugtyp?</h2>
                  <p className="text-muted-foreground">Wählen Sie den Typ Ihres Wohnmobils aus</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BODY_TYPES.map((type, index) => {
                    const Icon = type.icon;
                    const isSelected = formData.bodyType === type.value;
                    return (
                      <button
                        key={type.value}
                        onClick={() => handleSelectionWithAutoNext("bodyType", type.value)}
                        className={cn(
                          "relative p-5 rounded-2xl border-2 text-left transition-all duration-200 group animate-fade-in overflow-hidden",
                          isSelected
                            ? "border-primary bg-gradient-to-br from-primary/5 via-primary/10 to-teal-50 shadow-lg ring-1 ring-primary/30"
                            : "border-border/60 hover:border-primary/40 hover:shadow-md hover:bg-gradient-to-br hover:from-slate-50 hover:to-white"
                        )}
                        style={{ animationDelay: `${index * 80}ms` }}
                      >
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-200",
                            isSelected
                              ? "bg-primary text-white shadow-md"
                              : "bg-slate-100 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary"
                          )}>
                            <Icon className="w-7 h-7" />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <span className="font-bold block text-[15px]">{type.label}</span>
                            <span className="text-sm text-muted-foreground leading-snug">{type.description}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Manufacturer/Model */}
            {!showCalculation && step === 2 && (
              <div className="space-y-6 animate-fade-in" onKeyDown={handleKeyDown}>
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-1">Hersteller & Modell</h2>
                  <p className="text-muted-foreground">
                    Optional – verbessert die Genauigkeit Ihrer Bewertung
                  </p>
                </div>
                <div className="space-y-5">
                  {/* Manufacturer dropdown */}
                  <div className="animate-fade-in" style={{ animationDelay: "50ms" }} ref={manufacturerRef}>
                    <div className="space-y-2">
                      <Label htmlFor="manufacturer" className="text-sm font-semibold">Hersteller</Label>
                      <div>
                        <Input
                          id="manufacturer"
                          placeholder="Hersteller auswählen oder eingeben..."
                          value={manufacturerFilter}
                          onChange={(e) => {
                            setManufacturerFilter(e.target.value);
                            updateField("manufacturer", e.target.value);
                            setShowManufacturerDropdown(true);
                          }}
                          onFocus={() => setShowManufacturerDropdown(true)}
                          className="h-12 text-base bg-slate-50 border-2 border-slate-200 hover:border-primary/30 focus:border-primary focus:bg-white transition-all shadow-sm hover:shadow focus:shadow-md focus:ring-2 focus:ring-primary/20"
                          autoFocus
                          autoComplete="off"
                        />
                        {showManufacturerDropdown && filteredManufacturers.length > 0 && (
                          <div className="w-full mt-1 bg-background border-2 border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                            {filteredManufacturers.map((m) => (
                              <button
                                key={m}
                                type="button"
                                className={cn(
                                  "w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors text-sm border-b border-border/30 last:border-0",
                                  formData.manufacturer === m && "bg-primary/10 font-semibold text-primary"
                                )}
                                onClick={() => {
                                  updateField("manufacturer", m);
                                  setManufacturerFilter(m);
                                  setShowManufacturerDropdown(false);
                                }}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 animate-fade-in" style={{ animationDelay: "100ms" }}>
                    <Label htmlFor="model" className="text-sm font-semibold">Modell</Label>
                    <Input
                      id="model"
                      placeholder="z.B. B-Klasse MC, Trend, Ixeo..."
                      value={formData.model}
                      onChange={(e) => updateField("model", e.target.value)}
                      className="h-12 text-base bg-slate-50 border-2 border-slate-200 hover:border-primary/30 focus:border-primary focus:bg-white transition-all shadow-sm hover:shadow focus:shadow-md focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Sie können diesen Schritt überspringen, wenn Sie unsicher sind
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Year/Mileage */}
            {!showCalculation && step === 3 && (
              <div className="space-y-6 animate-fade-in" onKeyDown={handleKeyDown}>
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-1">Baujahr & Kilometerstand</h2>
                  <p className="text-muted-foreground">Diese Angaben sind entscheidend für die Wertermittlung</p>
                </div>
                <div className="space-y-5">
                  {/* Year as dropdown */}
                  <div className="space-y-2 animate-fade-in" style={{ animationDelay: "50ms" }}>
                    <Label htmlFor="year" className="text-sm font-semibold">Baujahr *</Label>
                    <select
                      id="year"
                      value={formData.year}
                      onChange={(e) => updateField("year", e.target.value)}
                      className={cn(
                        "flex h-12 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-base ring-offset-background",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary focus-visible:bg-white",
                        "hover:border-primary/30 hover:shadow transition-all cursor-pointer shadow-sm",
                        !formData.year && "text-muted-foreground"
                      )}
                      autoFocus
                    >
                      <option value="">Baujahr auswählen...</option>
                      {YEARS.map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {/* Mileage with formatting */}
                  <div className="space-y-2 animate-fade-in" style={{ animationDelay: "100ms" }}>
                    <Label htmlFor="mileage" className="text-sm font-semibold">Kilometerstand *</Label>
                    <div className="relative">
                      <Input
                        id="mileage"
                        type="text"
                        inputMode="numeric"
                        placeholder="z.B. 45.000"
                        value={mileageDisplay}
                        onChange={handleMileageChange}
                        className="h-12 text-base pr-12 bg-slate-50 border-2 border-slate-200 hover:border-primary/30 focus:border-primary focus:bg-white transition-all shadow-sm hover:shadow focus:shadow-md focus:ring-2 focus:ring-primary/20"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                        km
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Condition */}
            {!showCalculation && step === 4 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-1">Fahrzeugzustand</h2>
                  <p className="text-muted-foreground">Wie würden Sie den Gesamtzustand einschätzen?</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CONDITIONS.map((cond, index) => {
                    const isSelected = formData.condition === cond.value;
                    const colorMap: Record<string, { bg: string; border: string; iconBg: string }> = {
                      "new": { bg: "from-emerald-50 to-green-50", border: "border-emerald-300", iconBg: "bg-emerald-100 text-emerald-600" },
                      "excellent": { bg: "from-blue-50 to-sky-50", border: "border-blue-300", iconBg: "bg-blue-100 text-blue-600" },
                      "good": { bg: "from-teal-50 to-cyan-50", border: "border-teal-300", iconBg: "bg-teal-100 text-teal-600" },
                      "fair": { bg: "from-amber-50 to-orange-50", border: "border-amber-300", iconBg: "bg-amber-100 text-amber-600" },
                      "poor": { bg: "from-red-50 to-rose-50", border: "border-red-300", iconBg: "bg-red-100 text-red-600" },
                    };
                    const colors = colorMap[cond.value] || colorMap["good"];
                    return (
                      <button
                        key={cond.value}
                        onClick={() => handleSelectionWithAutoNext("condition", cond.value)}
                        className={cn(
                          "relative p-5 rounded-2xl border-2 text-left transition-all duration-200 group animate-fade-in",
                          isSelected
                            ? `${colors.border} bg-gradient-to-br ${colors.bg} shadow-lg ring-1 ring-primary/20`
                            : "border-border/60 hover:border-primary/40 hover:shadow-md hover:bg-gradient-to-br hover:from-slate-50 hover:to-white",
                          index === CONDITIONS.length - 1 && CONDITIONS.length % 2 !== 0 && "sm:col-span-2"
                        )}
                        style={{ animationDelay: `${index * 80}ms` }}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl transition-all duration-200",
                            isSelected ? colors.iconBg : "bg-slate-100"
                          )}>
                            {cond.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold block text-[15px]">{cond.label}</span>
                            <span className="text-sm text-muted-foreground leading-snug">{cond.description}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-sm">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 5: Contact Details */}
            {!showCalculation && step === 5 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Ihr Ergebnis ist fertig!</h2>
                  <p className="text-muted-foreground">
                    Geben Sie Ihre Kontaktdaten ein, um Ihre kostenlose Wertschätzung zu erhalten.
                  </p>
                </div>

                {/* Blurred preview teaser */}
                <div className="relative rounded-xl overflow-hidden">
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-8 text-center blur-md select-none" aria-hidden="true">
                    <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                      XX.XXX - XX.XXX
                    </div>
                    <p className="text-muted-foreground">Geschätzter Marktwert</p>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px]">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-primary">Kontaktdaten eingeben zum Freischalten</span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleLeadSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2 text-sm font-semibold">
                      <User className="w-4 h-4 text-primary/60" />
                      Name *
                    </Label>
                    <Input
                      id="name"
                      placeholder="Max Mustermann"
                      value={formData.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      className="h-12 text-base bg-slate-50 border-2 border-slate-200 hover:border-primary/30 focus:border-primary focus:bg-white transition-all shadow-sm hover:shadow focus:shadow-md focus:ring-2 focus:ring-primary/20"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold">
                      <Mail className="w-4 h-4 text-primary/60" />
                      E-Mail *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="max@beispiel.de"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      className="h-12 text-base bg-slate-50 border-2 border-slate-200 hover:border-primary/30 focus:border-primary focus:bg-white transition-all shadow-sm hover:shadow focus:shadow-md focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-semibold">
                      <Phone className="w-4 h-4 text-primary/60" />
                      Telefon *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+49 123 456789"
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      className="h-12 text-base bg-slate-50 border-2 border-slate-200 hover:border-primary/30 focus:border-primary focus:bg-white transition-all shadow-sm hover:shadow focus:shadow-md focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full gradient-hero h-14 text-lg font-semibold shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all rounded-xl"
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? "Wird geladen..." : "Wert jetzt anzeigen"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Ihre Daten werden vertraulich behandelt und nicht an Dritte weitergegeben.</span>
                  </div>
                </form>
              </div>
            )}

            {/* Step 6: Results */}
            {!showCalculation && step === 6 && estimatedValue && (
              <div className="space-y-8 animate-fade-in">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Geschätzter Wert Ihres Wohnmobils</h2>
                  <p className="text-muted-foreground">Basierend auf Ihren Angaben und aktuellen Marktdaten</p>
                </div>

                {/* Warte auf KI-Ergebnis bevor Wert angezeigt wird */}
                {aiLoading ? (
                  <div className="rounded-xl p-10 text-center bg-gradient-to-br from-primary/5 to-primary/10">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-primary" />
                        </div>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">Wert wird berechnet...</p>
                        <p className="text-sm text-muted-foreground mt-1">Unsere KI analysiert vergleichbare Fahrzeuge</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Hauptwert-Anzeige: Nur KI-Wert */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 via-white to-teal-50 p-8 text-center border border-teal-200 shadow-md">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600" />
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-teal-700" />
                        </div>
                        <span className="text-sm font-semibold text-teal-700 uppercase tracking-wide">KI-Wertschätzung</span>
                      </div>
                      {aiEstimate ? (
                        <>
                          <div className="text-4xl md:text-5xl font-bold text-teal-800 mb-3">
                            <AnimatedValue value={Math.round(aiEstimate.value * 0.95)} /> &ndash; <AnimatedValue value={Math.round(aiEstimate.value * 1.05)} />
                          </div>
                          <p className="text-muted-foreground text-sm">Geschätzter Marktwert</p>
                          <div className="flex items-center justify-center gap-3 text-xs text-teal-600 mt-3">
                            <span className="inline-flex items-center gap-1"><Shield className="w-3 h-3" /> Konfidenz: {aiEstimate.confidence}%</span>
                            <span>&bull;</span>
                            <span>Basierend auf {aiEstimate.trainingCount} Vergleichsdaten</span>
                          </div>
                          {aiEstimate.reasoning && (
                            <p className="text-xs text-teal-500 mt-3 italic max-w-md mx-auto">{aiEstimate.reasoning}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-4xl md:text-5xl font-bold text-teal-800 mb-3">
                            <AnimatedValue value={estimatedValue.min} /> &ndash; <AnimatedValue value={estimatedValue.max} />
                          </div>
                          <p className="text-muted-foreground text-sm">Geschätzter Marktwert</p>
                        </>
                      )}
                    </div>
                  </>
                )}

                {!aiLoading && (
                  <>
                    <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl">
                      <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        Dies ist eine erste Schätzung. Der tatsächliche Wert kann je nach Ausstattung,
                        Wartungshistorie und individuellen Faktoren variieren. Unsere Experten melden
                        sich bei Ihnen für eine genauere Bewertung.
                      </p>
                    </div>

                    <div className="border-t pt-8 text-center space-y-4">
                      <p className="text-muted-foreground">
                        Vielen Dank, {formData.name.split(" ")[0]}! Wir melden uns in Kürze bei Ihnen.
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        Möchten Sie direkt ein verbindliches Angebot erhalten?
                      </p>
                      <Link
                        to={(() => {
                          // Mapping: Wertrechner bodyType -> Wizard bodyType
                          const bodyTypeMap: Record<string, string> = {
                            integriert: "Vollintegriert",
                            teilintegriert: "Teilintegriert",
                            alkoven: "Alkoven",
                            kastenwagen: "Kastenwagen",
                            campingbus: "Campingbus",
                          };
                          // Mapping: Wertrechner condition -> Wizard condition
                          const conditionMap: Record<string, string> = {
                            new: "Neuwertig",
                            excellent: "Sehr gut",
                            good: "Gut",
                            fair: "Befriedigend",
                            poor: "Reparaturbedürftig",
                          };
                          const params = new URLSearchParams();
                          params.set("source", "wertrechner");
                          if (formData.bodyType) params.set("bodyType", bodyTypeMap[formData.bodyType] || formData.bodyType);
                          if (formData.manufacturer) params.set("manufacturer", formData.manufacturer);
                          if (formData.model) params.set("model", formData.model);
                          if (formData.year) params.set("year", formData.year.toString());
                          if (formData.mileage) params.set("mileage", formData.mileage.toString());
                          if (formData.condition) params.set("condition", conditionMap[formData.condition] || formData.condition);
                          if (formData.name) params.set("customerName", formData.name);
                          if (formData.email) params.set("customerEmail", formData.email);
                          if (formData.phone) params.set("customerPhone", formData.phone);
                          return `/verkaufen/wizard?${params.toString()}`;
                        })()}
                      >
                        <Button className="gradient-hero shadow-lg hover:shadow-xl transition-shadow" size="lg">
                          Jetzt verbindliches Angebot erhalten
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Ihre Daten werden automatisch übernommen – kein erneutes Ausfüllen nötig
                      </p>
                    </div>

                    {/* Zusammenfassung */}
                    <div className="border-t pt-6">
                      <h4 className="font-medium mb-3 text-sm text-muted-foreground">Ihre Angaben:</h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <span className="text-muted-foreground">Typ:</span>
                        <span className="font-medium">{BODY_TYPES.find((b) => b.value === formData.bodyType)?.label}</span>
                        {formData.manufacturer && (
                          <>
                            <span className="text-muted-foreground">Hersteller:</span>
                            <span className="font-medium">{formData.manufacturer}</span>
                          </>
                        )}
                        {formData.model && (
                          <>
                            <span className="text-muted-foreground">Modell:</span>
                            <span className="font-medium">{formData.model}</span>
                          </>
                        )}
                        <span className="text-muted-foreground">Baujahr:</span>
                        <span className="font-medium">{formData.year}</span>
                        <span className="text-muted-foreground">Kilometerstand:</span>
                        <span className="font-medium">{parseInt(formData.mileage, 10).toLocaleString("de-DE")} km</span>
                        <span className="text-muted-foreground">Zustand:</span>
                        <span className="font-medium">{CONDITIONS.find((c) => c.value === formData.condition)?.label}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Navigation */}
            {!showCalculation && step < 5 && (
              <div className="flex justify-between mt-8 pt-6 border-t border-border/40">
                {step > 1 ? (
                  <Button variant="outline" onClick={prevStep} className="text-muted-foreground hover:text-foreground border-slate-200 hover:border-slate-300 rounded-xl h-11">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Zurück
                  </Button>
                ) : (
                  <div />
                )}
                <Button onClick={nextStep} disabled={!canProceed()} className="gradient-hero px-8 rounded-xl h-11 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all">
                  Weiter
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

            {!showCalculation && step === 5 && (
              <div className="mt-6 pt-4 border-t border-border/40">
                <Button variant="outline" onClick={prevStep} className="w-full text-muted-foreground hover:text-foreground border-slate-200 hover:border-slate-300 rounded-xl h-11">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Zurück zu den Fahrzeugdaten
                </Button>
              </div>
            )}

            {!showCalculation && step === 6 && (
              <div className="mt-8 pt-6 border-t">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep(1);
                    setEstimatedValue(null);
                    setLeadSubmitted(false);
                    setMileageDisplay("");
                    setManufacturerFilter("");
                    setFormData({
                      bodyType: "", manufacturer: "", model: "", year: "", mileage: "", condition: "", name: "", email: "", phone: "",
                    });
                    try { sessionStorage.removeItem("wertrechner_data"); } catch {}
                  }}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  Neues Fahrzeug bewerten
                </Button>
              </div>
            )}
          </Card>

          {/* Trust badges below card */}
          {step <= 5 && !showCalculation && <TrustBadges />}

          {/* Alternative CTA */}
          {step < 5 && !showCalculation && (
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Lieber eine professionelle Bewertung durch unsere Experten?
              </p>
              <Link to="/wertermittlung">
                <Button variant="outline" size="sm" className="text-sm">
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
