import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  Car,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { trackWertrechnerLead, setEnhancedConversionFromForm, generateTransactionId } from "@/lib/gadsConversionService";
import { getTrackingData } from "@/lib/clickIdService";
import { trackMetaLead, trackMetaWertrechnerCompleted } from "@/lib/metaPixelService";
import { handleApiError } from "@/lib/errorLogService";
import { withNetworkRetry } from "@/lib/sessionGuard";
import { useTurnstile } from "@/hooks/useTurnstile";
import { HoneypotField, useHoneypot } from "@/components/ui/HoneypotField";

const leadSchema = z.object({
  name: z.string().trim().min(2, "Bitte geben Sie Ihren Namen ein"),
  email: z.string().trim().email("Ungültige E-Mail-Adresse"),
  phone: z.string().trim().min(5, "Bitte geben Sie Ihre Telefonnummer ein"),
});

// ─── Wohnmobil Body Types ───────────────────────────────────────────────────
const WOHNMOBIL_BODY_TYPES = [
  { value: "integriert", label: "Integriertes Wohnmobil", icon: Bus, description: "Vollintegriert mit Fahrerhaus", basePrice: 120000 },
  { value: "teilintegriert", label: "Teilintegriertes Wohnmobil", icon: Caravan, description: "Aufbau auf Fahrzeugbasis", basePrice: 90000 },
  { value: "alkoven", label: "Alkovenmobil", icon: Truck, description: "Mit Schlafbereich über dem Fahrerhaus", basePrice: 80000 },
  { value: "kastenwagen", label: "Kastenwagen / Van", icon: CarFront, description: "Kompakt und wendig", basePrice: 65000 },
  { value: "campingbus", label: "Campingbus", icon: CarFront, description: "Flexibel und alltagstauglich", basePrice: 55000 },
];

// ─── Wohnwagen Body Types ───────────────────────────────────────────────────
const WOHNWAGEN_BODY_TYPES = [
  { value: "wohnwagen", label: "Wohnwagen", icon: Caravan, description: "Klassischer Wohnwagen", basePrice: 25000 },
  { value: "faltcaravan", label: "Faltcaravan", icon: Caravan, description: "Zusammenfaltbar und leicht", basePrice: 8000 },
  { value: "mobilheim", label: "Mobilheim", icon: Truck, description: "Stationäres Wohnheim", basePrice: 35000 },
];

const CONDITIONS = [
  { value: "new", label: "Neuwertig", description: "Keine Gebrauchsspuren, wie aus dem Werk", emoji: "✨", factor: 1.0 },
  { value: "excellent", label: "Sehr gepflegt", description: "Minimale Gebrauchsspuren, regelmäßig gewartet", emoji: "🌟", factor: 0.92 },
  { value: "good", label: "Gepflegt", description: "Normale Gebrauchsspuren, voll funktionsfähig", emoji: "👍", factor: 0.80 },
  { value: "fair", label: "Gebrauchsspuren", description: "Deutliche Gebrauchsspuren, funktionsfähig", emoji: "👌", factor: 0.65 },
  { value: "poor", label: "Reparaturbedürftig", description: "Mängel vorhanden, Reparaturen nötig", emoji: "🔧", factor: 0.45 },
];

// ─── Wohnmobil Hersteller ───────────────────────────────────────────────────
const WOHNMOBIL_MANUFACTURERS = [
  "Adria", "Ahorn Camp", "Bavaria", "Benimar", "Bürstner", "Carado", "Carthago",
  "Challenger", "Chausson", "Concorde", "Dethleffs", "Elnagh", "Etrusco",
  "Eura Mobil", "Fendt", "Forster", "Frankia", "Globecar", "Hobby", "Hymer",
  "Knaus", "Laika", "LMC", "Malibu", "McLouis", "Morelo", "Niesmann+Bischoff",
  "Pilote", "Pössl", "Rapido", "Roller Team", "Sunlight", "Sun Living",
  "Volkswagen", "Weinsberg", "Westfalia",
];

// ─── Wohnwagen Hersteller ───────────────────────────────────────────────────
const WOHNWAGEN_MANUFACTURERS = [
  "Abbey", "Adria", "Beachy", "Bürstner", "Cabby", "Carado", "Caravelair",
  "Caretta", "Dethleffs", "Eifelland", "Elddis", "Eriba", "Fendt",
  "Hobby", "Hymer", "Kabe", "Knaus", "La Mancelle", "LMC", "Niewiadow",
  "Rapido", "Soma", "Sterckeman", "Sun Living", "Sunlight", "Swift",
  "Tabbert", "TEC", "Trigano", "Weinsberg", "Wilk", "Wingamm", "Andere",
];

// ─── Wohnmobil Marken-Tiers ────────────────────────────────────────────────
const WOHNMOBIL_BRAND_TIERS: Record<string, string> = {
  "Concorde": "luxus", "Morelo": "luxus", "Volkner": "luxus",
  "Carthago": "premium", "Hymer": "premium", "Niesmann+Bischoff": "premium",
  "Frankia": "premium", "Eura Mobil": "premium", "Rapido": "premium",
  "La Strada": "premium", "Phoenix": "premium",
  "Knaus": "mittelklasse", "Bürstner": "mittelklasse", "Dethleffs": "mittelklasse",
  "Hobby": "mittelklasse", "LMC": "mittelklasse", "Chausson": "mittelklasse",
  "Challenger": "mittelklasse", "Pilote": "mittelklasse", "Adria": "mittelklasse",
  "Benimar": "mittelklasse", "Laika": "mittelklasse", "Elnagh": "mittelklasse",
  "Globecar": "mittelklasse", "Pössl": "mittelklasse", "Malibu": "mittelklasse",
  "Westfalia": "mittelklasse", "Volkswagen": "mittelklasse", "Fendt": "mittelklasse",
  "Bavaria": "mittelklasse",
  "Sunlight": "economy", "Sun Living": "economy", "Etrusco": "economy",
  "Forster": "economy", "Roller Team": "economy", "McLouis": "economy",
  "Carado": "economy", "Weinsberg": "economy", "Ahorn Camp": "economy",
};

// ─── Wohnwagen Marken-Tiers ────────────────────────────────────────────────
const WOHNWAGEN_BRAND_TIERS: Record<string, string> = {
  "Kabe": "luxus",
  "Tabbert": "premium", "Fendt": "premium", "Hobby": "premium", "Hymer": "premium", "Eriba": "premium",
  "Bürstner": "mittelklasse", "Dethleffs": "mittelklasse", "Knaus": "mittelklasse",
  "Adria": "mittelklasse", "LMC": "mittelklasse", "Wilk": "mittelklasse",
  "Caravelair": "mittelklasse", "Sterckeman": "mittelklasse", "Swift": "mittelklasse",
  "Elddis": "mittelklasse", "La Mancelle": "mittelklasse",
  "Weinsberg": "economy", "Sunlight": "economy", "Sun Living": "economy",
  "Carado": "economy", "Cabby": "economy", "TEC": "economy",
  "Trigano": "economy", "Niewiadow": "economy", "Caretta": "economy",
  "Soma": "economy", "Wingamm": "economy", "Beachy": "economy",
  "Abbey": "economy", "Eifelland": "economy", "Rapido": "mittelklasse",
};

const TIER_MULTIPLIERS: Record<string, number> = {
  luxus: 2.8,
  premium: 1.4,
  mittelklasse: 1.0,
  economy: 0.8,
};

// ─── Wohnmobil Abschreibungskurven ─────────────────────────────────────────
const WOHNMOBIL_DEPRECIATION_CURVES: Record<string, number[]> = {
  campingbus: [0.15, 0.06, 0.05, 0.04, 0.03],
  kastenwagen: [0.15, 0.06, 0.05, 0.04, 0.03],
  alkoven: [0.16, 0.08, 0.06, 0.04, 0.03],
  teilintegriert: [0.16, 0.07, 0.06, 0.04, 0.03],
  integriert: [0.17, 0.07, 0.06, 0.05, 0.03],
};

// ─── Wohnwagen Abschreibungskurven (kein Motor → langsamere Abschreibung) ──
const WOHNWAGEN_DEPRECIATION_CURVES: Record<string, number[]> = {
  wohnwagen: [0.14, 0.06, 0.05, 0.04, 0.03],
  faltcaravan: [0.16, 0.07, 0.05, 0.04, 0.03],
  mobilheim: [0.10, 0.05, 0.04, 0.03, 0.02],
};

// Kilometer-Anpassungsfaktor (relativ zum Alter) – nur für Wohnmobile
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
  manufacturer?: string,
  vehicleType?: string
): { min: number; max: number; brandTier: string } => {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  const isWohnwagen = vehicleType === "Wohnwagen";

  // 1. Basispreis nach Aufbautyp
  const bodyTypes = isWohnwagen ? WOHNWAGEN_BODY_TYPES : WOHNMOBIL_BODY_TYPES;
  const basePrice = bodyTypes.find((b) => b.value === bodyType)?.basePrice || (isWohnwagen ? 25000 : 80000);

  // 2. Marken-Multiplikator
  const brandTiers = isWohnwagen ? WOHNWAGEN_BRAND_TIERS : WOHNMOBIL_BRAND_TIERS;
  const brandTier = manufacturer ? (brandTiers[manufacturer] || "mittelklasse") : "mittelklasse";
  const tierMult = TIER_MULTIPLIERS[brandTier] || 1.0;
  const adjustedBase = basePrice * tierMult;

  // 3. Degressive Altersabschreibung
  const depreciationCurves = isWohnwagen ? WOHNWAGEN_DEPRECIATION_CURVES : WOHNMOBIL_DEPRECIATION_CURVES;
  const curve = depreciationCurves[bodyType] || (isWohnwagen ? [0.14, 0.06, 0.05, 0.04, 0.03] : [0.16, 0.07, 0.06, 0.04, 0.03]);
  let remaining = 1.0;
  for (let y = 0; y < age; y++) {
    const rate = y < curve.length - 1 ? curve[y] : curve[curve.length - 1];
    remaining *= (1 - rate);
  }
  const ageAdjusted = adjustedBase * remaining;

  // 4. Kilometer-Anpassung (nur für Wohnmobile – Wohnwagen haben keinen Motor/Tacho)
  const kmFactor = isWohnwagen ? 1.0 : getMileageAdjustment(age, mileage);
  const kmAdjusted = ageAdjusted * kmFactor;

  // 5. Zustandsfaktor
  const conditionFactor = CONDITIONS.find((c) => c.value === condition)?.factor || 0.80;
  const finalValue = kmAdjusted * conditionFactor;

  // 6. Ergebnis-Spanne (±12%)
  const min = Math.round(finalValue * 0.88);
  const max = Math.round(finalValue * 1.12);
  const minFloor = isWohnwagen ? 500 : 2000;
  const maxFloor = isWohnwagen ? 1000 : 3500;
  return { min: Math.max(min, minFloor), max: Math.max(max, maxFloor), brandTier };
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

// Step indicator component – 6 Steps mit Kategorie
const StepIndicator = ({ currentStep, totalSteps, vehicleType }: { currentStep: number; totalSteps: number; vehicleType: string }) => {
  const isWohnwagen = vehicleType === "Wohnwagen";
  const steps = [
    { label: "Kategorie", icon: Car },
    { label: "Typ", icon: Truck },
    { label: "Marke", icon: Star },
    ...(isWohnwagen
      ? [{ label: "Baujahr", icon: Calculator }]
      : [{ label: "Details", icon: Calculator }]),
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
      <span>DSGVO-konform</span>
    </div>
    <div className="flex items-center gap-1.5">
      <Clock className="w-4 h-4 text-orange-500" />
      <span>Ergebnis in 2 Minuten</span>
    </div>
  </div>
);

// Animated value counter
const AnimatedValue = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      // Ease-out curve
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      current = Math.round(value * eased);
      setDisplayValue(current);

      if (step >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{formatCurrency(displayValue)}</span>;
};

// Calculation animation component
const CalculationAnimation = ({ onComplete }: { onComplete: () => void }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let totalDuration = 0;
    const timers: NodeJS.Timeout[] = [];

    LOADING_MESSAGES.forEach((msg, i) => {
      const timer = setTimeout(() => {
        setMessageIndex(i);
        setProgress(((i + 1) / LOADING_MESSAGES.length) * 100);
      }, totalDuration);
      timers.push(timer);
      totalDuration += msg.duration;
    });

    const completeTimer = setTimeout(onComplete, totalDuration + 300);
    timers.push(completeTimer);

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="py-12 text-center space-y-6 animate-fade-in">
      <div className="relative w-20 h-20 mx-auto">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Calculator className="w-8 h-8 text-primary" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold text-foreground transition-all duration-300">
          {LOADING_MESSAGES[messageIndex]?.text}
        </p>
        <div className="max-w-xs mx-auto h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-teal-400 rounded-full transition-all duration-500 ease-out"
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
  const prefillVehicleType = searchParams.get("vehicleType") || "";
  const fromLanding = searchParams.get("from") === "landing";

  const [step, setStep] = useState(() => {
    // If coming from landing page with prefilled data, skip to step 4 (Baujahr/km)
    if (fromLanding && prefillBodyType && prefillVehicleType) return 4;
    if (fromLanding && prefillBodyType) return 4;
    return 1;
  });
  const [showCalculation, setShowCalculation] = useState(false);
  const [formData, setFormData] = useState(() => {
    // If coming from landing page, use URL params as initial data
    if (fromLanding && prefillBodyType) {
      // Determine vehicleType from bodyType if not explicitly provided
      const wohnwagenBodyValues = WOHNWAGEN_BODY_TYPES.map(b => b.value);
      const detectedVehicleType = prefillVehicleType || (wohnwagenBodyValues.includes(prefillBodyType) ? "Wohnwagen" : "Wohnmobil");
      return {
        vehicleType: detectedVehicleType,
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
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure vehicleType exists for backwards compatibility
        if (!parsed.vehicleType) parsed.vehicleType = "";
        return parsed;
      }
    } catch {}
    return {
      vehicleType: "",
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
  const { turnstileToken, turnstileReady, resetTurnstile, turnstileCallbackRef } = useTurnstile();
  const [honeypotValue, setHoneypotValue, isHoneypotBot] = useHoneypot();
  const [manufacturerFilter, setManufacturerFilter] = useState(formData.manufacturer || "");
  const manufacturerRef = useRef<HTMLDivElement>(null);

  const totalSteps = 6; // 1=Kategorie, 2=Typ, 3=Marke, 4=Baujahr/KM, 5=Zustand, 6=Kontakt

  const isWohnwagen = formData.vehicleType === "Wohnwagen";

  // Dynamic body types based on vehicle type
  const currentBodyTypes = useMemo(() => {
    return isWohnwagen ? WOHNWAGEN_BODY_TYPES : WOHNMOBIL_BODY_TYPES;
  }, [isWohnwagen]);

  // Dynamic manufacturers based on vehicle type
  const currentManufacturers = useMemo(() => {
    return isWohnwagen ? WOHNWAGEN_MANUFACTURERS : WOHNMOBIL_MANUFACTURERS;
  }, [isWohnwagen]);

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

  const result = estimatedValue ? { estimatedValue: (estimatedValue.min + estimatedValue.max) / 2 } : null;

  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Bot-Check: Honeypot ausgefüllt → still abbrechen (Bot merkt nichts)
      if (isHoneypotBot) {
        // Fake-Erfolg: Bot denkt es hat funktioniert
        return { min: 10000, max: 20000, brandTier: 'standard' as const };
      }

      const year = parseInt(data.year, 10);
      const mileage = isWohnwagen ? 0 : parseInt(data.mileage, 10);
      const value = calculateValue(data.bodyType, year, mileage, data.condition, data.manufacturer, data.vehicleType);
      setEstimatedValue(value);

      const { error } = await withNetworkRetry(
        () => supabase.from("value_assessment_leads").insert({
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          manufacturer: data.manufacturer || null,
          model: data.model || null,
          year: data.year ? parseInt(data.year, 10) : null,
          mileage: isWohnwagen ? null : (data.mileage ? parseInt(data.mileage, 10) : null),
          condition: data.condition || null,
          body_type: data.bodyType || null,
          source: "wertrechner",
          estimated_value_min: value.min,
          estimated_value_max: value.max,
          algorithm_value_min: value.min,
          algorithm_value_max: value.max,
          brand_tier: value.brandTier,
          vehicle_type: data.vehicleType || "Wohnmobil",
        } as any),
        2,
        'Wertrechner INSERT'
      );

      if (error) throw error;

      try {
        const trackingData = getTrackingData();
        const transactionId = generateTransactionId('wertrechner');
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
            gclid: trackingData.gclid,
            gbraid: trackingData.gbraid,
            wbraid: trackingData.wbraid,
            ga4ClientId: trackingData.ga4ClientId,
            transactionId,
            turnstileToken,
            honeypot: honeypotValue,
          },
        });
      } catch {}

      return value;
    },
    onSuccess: async (value) => {
      resetTurnstile();
      setLeadSubmitted(true);
      setEstimatedValue(value);
      setStep(7);
      await setEnhancedConversionFromForm({ email: formData.email, name: formData.name, phone: formData.phone });
      const txId = (window as any).__lastTransactionId || generateTransactionId('wertrechner');
      await trackWertrechnerLead(`${formData.manufacturer} ${formData.model} ${formData.year}`, txId);

      trackMetaLead({ content_name: `${formData.manufacturer} ${formData.model}`, content_category: 'Wertrechner' });
      trackMetaWertrechnerCompleted({
        vehicle_type: formData.vehicleType || formData.bodyType || 'Wohnmobil',
        manufacturer: formData.manufacturer || '',
        estimated_value: (value.min + value.max) / 2,
      });

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
              mileage: isWohnwagen ? 0 : parseInt(formData.mileage, 10),
              condition: formData.condition,
              algorithmMin: value.min,
              algorithmMax: value.max,
              vehicleType: formData.vehicleType || "Wohnmobil",
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
    onError: (error: unknown) => {
      const germanMessage = handleApiError(error, 'Wertrechner');
      toast({
        title: "Fehler beim Senden",
        description: germanMessage,
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

  const filteredManufacturers = currentManufacturers.filter((m) =>
    m.toLowerCase().includes(manufacturerFilter.toLowerCase())
  );

  const calculateAndProceed = useCallback(() => {
    const year = parseInt(formData.year, 10);
    const mileage = isWohnwagen ? 0 : parseInt(formData.mileage, 10);
    const currentYear = new Date().getFullYear();

    if (!formData.bodyType || !formData.condition || isNaN(year)) {
      toast({ title: "Felder ausfüllen", description: "Bitte füllen Sie alle erforderlichen Felder aus.", variant: "destructive" });
      return;
    }
    if (!isWohnwagen && isNaN(mileage)) {
      toast({ title: "Felder ausfüllen", description: "Bitte geben Sie den Kilometerstand ein.", variant: "destructive" });
      return;
    }
    if (year < 1950 || year > currentYear) {
      toast({ title: "Ungültiges Baujahr", description: `Baujahr muss zwischen 1950 und ${currentYear} liegen.`, variant: "destructive" });
      return;
    }
    if (!isWohnwagen && (mileage < 0 || mileage > 999999)) {
      toast({ title: "Ungültiger Kilometerstand", description: "Kilometerstand muss zwischen 0 und 999.999 km liegen.", variant: "destructive" });
      return;
    }

    setShowCalculation(true);
  }, [formData, toast, isWohnwagen]);

  const handleCalculationComplete = useCallback(() => {
    setShowCalculation(false);
    setStep(6);
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
      case 1: return !!formData.vehicleType;
      case 2: return !!formData.bodyType;
      case 3: return true; // Hersteller/Modell optional
      case 4: {
        const y = parseInt(formData.year, 10);
        const cy = new Date().getFullYear();
        if (isWohnwagen) {
          return !isNaN(y) && y >= 1950 && y <= cy;
        }
        const m = parseInt(formData.mileage, 10);
        return !isNaN(y) && y >= 1950 && y <= cy && !isNaN(m) && m >= 0 && m <= 999999;
      }
      case 5: return !!formData.condition;
      case 6: return formData.name.trim().length >= 2 && formData.email.trim().length > 0 && formData.phone.trim().length >= 5;
      default: return false;
    }
  }, [step, formData, isWohnwagen]);

  const autoNextTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current); };
  }, []);

  const nextStep = useCallback(() => {
    if (step === 5) {
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
    // For vehicleType, the full reset is handled in the setTimeout block below
    if (field !== "vehicleType") {
      updateField(field, value);
    }
    if (shouldAutoNext) {
      autoNextTimerRef.current = setTimeout(() => {
        if (field === "condition") {
          // Trigger calculation animation
          const year = parseInt(formData.year, 10);
          const mileage = isWohnwagen ? 0 : parseInt(formData.mileage, 10);
          const cy = new Date().getFullYear();
          const yearValid = !isNaN(year) && year >= 1950 && year <= cy;
          const mileageValid = isWohnwagen || (!isNaN(mileage) && mileage >= 0 && mileage <= 999999);
          if (formData.bodyType && yearValid && mileageValid) {
            setShowCalculation(true);
          }
        } else if (field === "vehicleType") {
          // Reset bodyType, manufacturer, model when switching vehicleType
          setFormData((prev: typeof formData) => ({
            ...prev,
            vehicleType: value,
            bodyType: "",
            manufacturer: "",
            model: "",
          }));
          setManufacturerFilter("");
          setStep((s) => s + 1);
        } else {
          setStep((s) => s + 1);
        }
      }, 400);
    }
  }, [step, formData, isWohnwagen]);

  // Handle Enter key for text steps
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canProceed() && step < 6) {
      e.preventDefault();
      nextStep();
    }
  }, [canProceed, nextStep, step]);

  // Dynamic vehicle type label
  const vehicleLabel = isWohnwagen ? "Wohnwagens" : "Wohnmobils";
  const vehicleLabelNominativ = isWohnwagen ? "Wohnwagen" : "Wohnmobil";

  // Summary chips showing previous selections
  const SummaryChips = () => {
    const chips: string[] = [];
    if (formData.vehicleType) chips.push(formData.vehicleType);
    if (formData.bodyType) chips.push(currentBodyTypes.find((b) => b.value === formData.bodyType)?.label || "");
    if (formData.manufacturer) chips.push(formData.manufacturer);
    if (formData.year) chips.push(`BJ ${formData.year}`);
    if (formData.mileage && !isWohnwagen) chips.push(`${parseInt(formData.mileage, 10).toLocaleString("de-DE")} km`);
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
      title="Wohnmobil & Wohnwagen Wertrechner – Kostenlose Sofort-Schätzung"
      description="Ermitteln Sie sofort den geschätzten Wert Ihres Wohnmobils oder Wohnwagens mit unserem kostenlosen Wertrechner. Einfach, schnell und unverbindlich."
      keywords="wohnmobil wertrechner, wohnwagen wertrechner, wohnmobil wert berechnen, wohnwagen wert berechnen, camper wert kalkulieren, caravan wert ermitteln"
      canonicalPath="/wertrechner"
      structuredData={[
        generateServiceSchema("Wohnmobil & Wohnwagen Wertrechner", "Kostenloser Online-Wertrechner für Wohnmobile und Wohnwagen. Sofort-Schätzung in 2 Minuten basierend auf aktuellen Marktdaten."),
        generateBreadcrumbSchema(getBreadcrumbsFromPath("/wertrechner")),
      ]}
    >
      <PageHero size="sm">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Wohnmobil & Wohnwagen Wertrechner</h1>
          <p className="text-lg text-muted-foreground mb-4">
            Erhalten Sie in nur 2 Minuten eine kostenlose Wertschätzung für Ihr Wohnmobil oder Ihren Wohnwagen.
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
          {step <= 6 && !showCalculation && <StepIndicator currentStep={step} totalSteps={totalSteps} vehicleType={formData.vehicleType} />}

          <Card className="p-6 sm:p-8 shadow-xl border-0 ring-1 ring-border/40 rounded-2xl">
            {/* Summary chips */}
            {step > 1 && step <= 6 && !showCalculation && <SummaryChips />}

            {/* Calculation Animation */}
            {showCalculation && <CalculationAnimation onComplete={handleCalculationComplete} />}

            {/* Step 1: Fahrzeugkategorie (NEU) */}
            {!showCalculation && step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-1">Was möchten Sie bewerten?</h2>
                  <p className="text-muted-foreground">Wählen Sie Ihre Fahrzeugkategorie</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { value: "Wohnmobil", label: "Wohnmobil", icon: Car, description: "Reisemobil mit eigenem Motor" },
                    { value: "Wohnwagen", label: "Wohnwagen", icon: Caravan, description: "Anhänger ohne eigenen Motor" },
                  ].map((type, index) => {
                    const Icon = type.icon;
                    const isSelected = formData.vehicleType === type.value;
                    return (
                      <button
                        key={type.value}
                        onClick={() => handleSelectionWithAutoNext("vehicleType", type.value)}
                        className={cn(
                          "relative p-8 rounded-2xl border-2 text-center transition-all duration-200 group animate-fade-in overflow-hidden",
                          isSelected
                            ? "border-primary bg-gradient-to-br from-primary/5 via-primary/10 to-teal-50 shadow-lg ring-1 ring-primary/30"
                            : "border-border/60 hover:border-primary/40 hover:shadow-md hover:bg-gradient-to-br hover:from-slate-50 hover:to-white"
                        )}
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className={cn(
                            "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200",
                            isSelected
                              ? "bg-primary text-white shadow-md"
                              : "bg-slate-100 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary"
                          )}>
                            <Icon className="w-8 h-8" />
                          </div>
                          <div>
                            <span className="font-bold block text-lg">{type.label}</span>
                            <span className="text-sm text-muted-foreground">{type.description}</span>
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

            {/* Step 2: Body Type */}
            {!showCalculation && step === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-1">Welcher Fahrzeugtyp?</h2>
                  <p className="text-muted-foreground">Wählen Sie den Typ Ihres {vehicleLabelNominativ}s aus</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentBodyTypes.map((type, index) => {
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

            {/* Step 3: Manufacturer/Model */}
            {!showCalculation && step === 3 && (
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
                      placeholder={isWohnwagen ? "z.B. De Luxe, Bianco, Touring..." : "z.B. B-Klasse MC, Trend, Ixeo..."}
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

            {/* Step 4: Year/Mileage (Mileage nur bei Wohnmobil) */}
            {!showCalculation && step === 4 && (
              <div className="space-y-6 animate-fade-in" onKeyDown={handleKeyDown}>
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-1">
                    {isWohnwagen ? "Baujahr" : "Baujahr & Kilometerstand"}
                  </h2>
                  <p className="text-muted-foreground">
                    {isWohnwagen
                      ? "Das Baujahr ist entscheidend für die Wertermittlung"
                      : "Diese Angaben sind entscheidend für die Wertermittlung"}
                  </p>
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
                  {/* Mileage with formatting – nur bei Wohnmobil */}
                  {!isWohnwagen && (
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
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Condition */}
            {!showCalculation && step === 5 && (
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

            {/* Step 6: Contact Details */}
            {!showCalculation && step === 6 && (
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
                  <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
                  <div ref={turnstileCallbackRef} />
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

            {/* Step 7: Results */}
            {!showCalculation && step === 7 && estimatedValue && (
              <div className="space-y-8 animate-fade-in">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Geschätzter Wert Ihres {vehicleLabelNominativ}s</h2>
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
                            wohnwagen: "Wohnwagen",
                            faltcaravan: "Faltcaravan",
                            mobilheim: "Mobilheim",
                          };
                          // Mapping: Wertrechner condition -> Wizard condition
                          const conditionMap: Record<string, string> = {
                            new: "Neuwertig",
                            excellent: "Sehr gepflegt",
                            good: "Gepflegt",
                            fair: "Gebrauchsspuren",
                            poor: "Reparaturbedürftig",
                          };
                          const params = new URLSearchParams();
                          params.set("source", "wertrechner");
                          if (formData.vehicleType) params.set("vehicleType", formData.vehicleType.toLowerCase());
                          if (formData.bodyType) params.set("bodyType", bodyTypeMap[formData.bodyType] || formData.bodyType);
                          if (formData.manufacturer) params.set("manufacturer", formData.manufacturer);
                          if (formData.model) params.set("model", formData.model);
                          if (formData.year) params.set("year", formData.year.toString());
                          if (formData.mileage && !isWohnwagen) params.set("mileage", formData.mileage.toString());
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
                        <span className="text-muted-foreground">Kategorie:</span>
                        <span className="font-medium">{formData.vehicleType}</span>
                        <span className="text-muted-foreground">Typ:</span>
                        <span className="font-medium">{currentBodyTypes.find((b) => b.value === formData.bodyType)?.label}</span>
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
                        {!isWohnwagen && (
                          <>
                            <span className="text-muted-foreground">Kilometerstand:</span>
                            <span className="font-medium">{parseInt(formData.mileage, 10).toLocaleString("de-DE")} km</span>
                          </>
                        )}
                        <span className="text-muted-foreground">Zustand:</span>
                        <span className="font-medium">{CONDITIONS.find((c) => c.value === formData.condition)?.label}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Navigation */}
            {!showCalculation && step < 6 && (
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

            {!showCalculation && step === 6 && (
              <div className="mt-6 pt-4 border-t border-border/40">
                <Button variant="outline" onClick={prevStep} className="w-full text-muted-foreground hover:text-foreground border-slate-200 hover:border-slate-300 rounded-xl h-11">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Zurück zu den Fahrzeugdaten
                </Button>
              </div>
            )}

            {!showCalculation && step === 7 && (
              <div className="mt-8 pt-6 border-t">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep(1);
                    setEstimatedValue(null);
                    setLeadSubmitted(false);
                    setMileageDisplay("");
                    setManufacturerFilter("");
                    setAiEstimate(null);
                    setAiLoading(false);
                    setFormData({
                      vehicleType: "", bodyType: "", manufacturer: "", model: "", year: "", mileage: "", condition: "", name: "", email: "", phone: "",
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
          {step <= 6 && !showCalculation && <TrustBadges />}

          {/* Alternative CTA */}
          {step < 6 && !showCalculation && (
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
