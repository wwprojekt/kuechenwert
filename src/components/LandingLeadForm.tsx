import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, User, Mail, Phone, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vehicleTypes, popularManufacturers, bodyTypes } from "@/lib/vehicle-data";
import { captureOrUpdateLead } from "@/lib/leadTrackingService";
import { trackLandingPageLead, setEnhancedConversionFromForm } from "@/lib/gadsConversionService";
import { cn } from "@/lib/utils";

interface LandingLeadFormProps {
  className?: string;
}

export function LandingLeadForm({ className = "" }: LandingLeadFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [vehicleType, setVehicleType] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNextStep = async () => {
    const errors: string[] = [];
    if (!vehicleType) errors.push("Fahrzeugtyp");
    if (!manufacturer) errors.push("Marke");
    if (!bodyType) errors.push("Kategorie");

    if (errors.length > 0) {
      toast({
        title: "Pflichtfelder ausfüllen",
        description: `Bitte wählen Sie: ${errors.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // Sofort als partiellen Lead erfassen (nur Fahrzeugdaten)
    await captureOrUpdateLead({
      manufacturer,
      bodyType,
      source: "landing_page_partial",
      pageUrl: window.location.pathname,
    });

    setStep(2);
  };

  const handleSubmit = async () => {
    const errors: string[] = [];
    if (!customerName.trim()) errors.push("Name");
    if (!customerEmail.trim()) errors.push("E-Mail");
    if (!customerPhone.trim()) errors.push("Telefon");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (customerEmail && !emailRegex.test(customerEmail.trim())) {
      errors.push("Gültige E-Mail-Adresse");
    }

    if (errors.length > 0) {
      toast({
        title: "Pflichtfelder ausfüllen",
        description: `Bitte füllen Sie aus: ${errors.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Lead mit Kontaktdaten erfassen
    await captureOrUpdateLead({
      name: customerName.trim(),
      email: customerEmail.trim(),
      phone: customerPhone.trim(),
      manufacturer,
      bodyType,
      source: "landing_page",
      pageUrl: window.location.pathname,
    });

    // Google Ads: Enhanced Conversions + Landing Page Lead (Primäre Conversion)
    await setEnhancedConversionFromForm({ customerEmail, customerName, customerPhone });
    trackLandingPageLead(
      window.location.pathname,
      `${manufacturer} ${bodyType}`
    );

    const params = new URLSearchParams();
    if (vehicleType) params.set("vehicleType", vehicleType);
    if (manufacturer) params.set("manufacturer", manufacturer);
    if (bodyType) params.set("bodyType", bodyType);
    if (customerName) params.set("customerName", customerName);
    if (customerEmail) params.set("customerEmail", customerEmail);
    if (customerPhone) params.set("customerPhone", customerPhone);

    setIsSubmitting(false);
    navigate(`/verkaufen/wizard?${params.toString()}`);
  };

  return (
    <Card className={`p-6 border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5 ${className}`}>
      <div className="space-y-4">
        <div className="text-center mb-2">
          <h3 className="text-lg font-bold">Kostenlose Fahrzeugbewertung</h3>
          <p className="text-sm text-muted-foreground">In nur 2 Schritten zum besten Preis</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors",
            "bg-primary text-white"
          )}>
            1
          </div>
          <div className={cn(
            "flex-1 h-1 rounded-full transition-colors",
            step === 2 ? "bg-primary" : "bg-slate-200 dark:bg-slate-700"
          )} />
          <div className={cn(
            "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors",
            step === 2 ? "bg-primary text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
          )}>
            2
          </div>
        </div>

        {step === 1 ? (
          <>
            <div className="grid grid-cols-1 gap-3">
              <Select value={vehicleType} onValueChange={setVehicleType}>
                <SelectTrigger className="h-11 border-2">
                  <SelectValue placeholder="Fahrzeugtyp wählen" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={manufacturer} onValueChange={setManufacturer}>
                <SelectTrigger className="h-11 border-2">
                  <SelectValue placeholder="Marke wählen" />
                </SelectTrigger>
                <SelectContent>
                  {popularManufacturers.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={bodyType} onValueChange={setBodyType}>
                <SelectTrigger className="h-11 border-2">
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {bodyTypes.map((bt) => (
                    <SelectItem key={bt} value={bt}>
                      {bt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleNextStep}
              className="w-full gradient-hero hover:gradient-hero-hover h-12 text-base font-semibold"
              size="lg"
            >
              Weiter
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </>
        ) : (
          <>
            {/* Step 2: Contact Details */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Kontaktdaten
              </label>
              <div className="space-y-2.5">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <Input
                    type="text"
                    placeholder="Ihr Name*"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="pl-10 h-11 border-2"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="E-Mail-Adresse*"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="pl-10 h-11 border-2"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="tel"
                    placeholder="Telefonnummer*"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="pl-10 h-11 border-2"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full gradient-hero hover:gradient-hero-hover h-12 text-base font-semibold"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Wird geladen..." : "Kostenlos bewerten lassen"}
              {!isSubmitting && <ArrowRight className="ml-2 h-5 w-5" />}
            </Button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-center text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
            >
              ← Zurück zur Fahrzeugauswahl
            </button>
          </>
        )}

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            Kostenlos
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            Unverbindlich
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            Sicher
          </span>
        </div>
      </div>
    </Card>
  );
}
