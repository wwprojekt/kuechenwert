/**
 * Quick Auction Form Component
 * Allows users to quickly start creating an auction from the homepage
 * Updated: Styled with gray input backgrounds for better visual hierarchy
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Gavel, Plus, Zap, MapPin, User, Mail, Phone, ArrowRight, CheckCircle } from 'lucide-react';
import { Constants } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { captureOrUpdateLead } from '@/lib/leadTrackingService';
import { trackLeadContactData } from '@/lib/gadsConversionService';
import { manufacturerModels, popularManufacturers } from '@/lib/vehicle-data';

type SaleChannel = 'auction' | 'instant' | 'station' | '';

interface QuickAuctionFormProps {
  className?: string;
  variant?: 'hero' | 'compact';
}

// Custom styled input with strong visual presence
const GrayInput = ({ className, ...props }: React.ComponentProps<typeof Input>) => (
  <Input
    className={cn(
      "bg-slate-50 dark:bg-secondary border-2 border-slate-200 dark:border-border hover:border-primary/30 focus:border-primary focus:bg-white dark:focus:bg-card",
      "transition-all duration-200 shadow-sm hover:shadow focus:shadow-md",
      "placeholder:text-slate-400 dark:placeholder:text-muted-foreground h-11",
      className
    )}
    {...props}
  />
);

// Custom styled select trigger with strong visual presence
const GraySelectTrigger = ({ className, children, ...props }: React.ComponentProps<typeof SelectTrigger>) => (
  <SelectTrigger
    className={cn(
      "bg-slate-50 dark:bg-secondary border-2 border-slate-200 dark:border-border hover:border-primary/30 focus:border-primary focus:bg-white dark:focus:bg-card",
      "transition-all duration-200 shadow-sm hover:shadow focus:shadow-md h-11",
      "[&>span]:text-slate-600 dark:[&>span]:text-slate-300 [&[data-state=open]]:bg-white dark:[&[data-state=open]]:bg-card [&[data-state=open]]:border-primary",
      className
    )}
    {...props}
  >
    {children}
  </SelectTrigger>
);

export const QuickAuctionForm = ({ className = '', variant = 'hero' }: QuickAuctionFormProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [bodyType, setBodyType] = useState('');
  const [saleChannel, setSaleChannel] = useState<SaleChannel>('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Reset model when manufacturer changes
  useEffect(() => {
    setModel('');
  }, [manufacturer]);

  // Get available models for selected manufacturer
  const availableModels = manufacturer ? manufacturerModels[manufacturer] || [] : [];

  // Capture lead in database via central tracking service
  const captureLead = async () => {
    await captureOrUpdateLead({
      name: customerName.trim(),
      email: customerEmail.trim(),
      phone: customerPhone.trim(),
      manufacturer,
      model,
      bodyType,
      saleChannel: saleChannel || undefined,
      source: 'hero_form',
      pageUrl: window.location.pathname,
    });
  };

  // Capture partial lead (vehicle info only) for abandoned form recovery
  const capturePartialLead = async () => {
    await captureOrUpdateLead({
      manufacturer,
      model,
      bodyType,
      source: 'hero_form_partial',
      pageUrl: window.location.pathname,
    });
  };

  const handleNextStep = async () => {
    const errors: string[] = [];
    if (!manufacturer) errors.push("Hersteller");
    if (!model) errors.push("Modell");
    if (!bodyType) errors.push("Aufbauart");

    if (errors.length > 0) {
      toast({
        title: "Pflichtfelder ausfüllen",
        description: `Bitte füllen Sie aus: ${errors.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // Capture partial lead for follow-up on abandoned forms
    // WICHTIG: await damit die Lead-ID gespeichert wird bevor Schritt 2 angezeigt wird
    await capturePartialLead();

    setStep(2);
  };

  const handleContinue = async () => {
    // Validate contact fields
    const errors: string[] = [];
    if (!customerName.trim()) errors.push("Name");
    if (!customerEmail.trim()) errors.push("E-Mail");
    if (!customerPhone.trim()) errors.push("Telefon");

    // Email format validation
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

    // Capture lead before navigating
    await captureLead();

    // Google Ads: Lead-Conversion tracken
    trackLeadContactData('hero_form', `${manufacturer} ${model} - ${bodyType}`);

    // Create URL with prefilled data for the wizard
    const searchParams = new URLSearchParams();
    
    if (manufacturer) searchParams.set('manufacturer', manufacturer);
    if (model) searchParams.set('model', model);
    if (bodyType) searchParams.set('bodyType', bodyType);
    if (saleChannel) {
      // Map to wizard sale channel values
      const channelMap: Record<SaleChannel, string> = {
        'auction': 'auction',
        'instant': 'instant_price',
        'station': 'station',
        '': ''
      };
      searchParams.set('saleChannel', channelMap[saleChannel]);
    }
    if (customerName) searchParams.set('customerName', customerName);
    if (customerEmail) searchParams.set('customerEmail', customerEmail);
    if (customerPhone) searchParams.set('customerPhone', customerPhone);
    
    setIsSubmitting(false);
    navigate(`/verkaufen/wizard?${searchParams.toString()}`);
  };

  const bodyTypeOptions = Constants.public.Enums.motorhome_body_type;

  const handleCompactSubmit = async () => {
    const errors: string[] = [];
    if (!manufacturer) errors.push("Hersteller");
    if (!bodyType) errors.push("Aufbauart");

    if (errors.length > 0) {
      toast({
        title: "Pflichtfelder ausfüllen",
        description: `Bitte füllen Sie aus: ${errors.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    const searchParams = new URLSearchParams();
    if (manufacturer) searchParams.set('manufacturer', manufacturer);
    if (bodyType) searchParams.set('bodyType', bodyType);
    navigate(`/verkaufen/wizard?${searchParams.toString()}`);
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Select value={manufacturer} onValueChange={setManufacturer}>
          <GraySelectTrigger className="w-40">
            <SelectValue placeholder="Hersteller" />
          </GraySelectTrigger>
          <SelectContent>
            {popularManufacturers.map((brand) => (
              <SelectItem key={brand} value={brand}>
                {brand}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={bodyType} onValueChange={setBodyType}>
          <GraySelectTrigger className="w-40">
            <SelectValue placeholder="Aufbauart" />
          </GraySelectTrigger>
          <SelectContent>
            {bodyTypeOptions.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button onClick={handleCompactSubmit} size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const saleChannelOptions = [
    { 
      id: 'auction' as SaleChannel, 
      label: 'Auktion', 
      icon: Gavel,
      description: 'Höchstgebot'
    },
    { 
      id: 'instant' as SaleChannel, 
      label: 'Sofortpreis', 
      icon: Zap,
      description: 'Festpreis'
    },
    { 
      id: 'station' as SaleChannel, 
      label: 'Station', 
      icon: MapPin,
      description: 'Vor Ort'
    },
  ];

  return (
    <Card className={`p-6 lg:p-8 bg-white/85 dark:bg-card/90 backdrop-blur-md shadow-2xl border-0 rounded-2xl ${className}`}>
      <div className="space-y-5">
        {/* Header - Left aligned, compact */}
        <div className="pb-1">
          <h3 className="font-bold text-xl lg:text-2xl text-foreground">Kostenlos inserieren</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            In nur 2 Minuten zum Verkaufsinserat
          </p>
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
            {/* Step 1: Vehicle Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Hersteller*
                </label>
                <Select value={manufacturer} onValueChange={setManufacturer}>
                  <GraySelectTrigger>
                    <SelectValue placeholder="Auswählen" />
                  </GraySelectTrigger>
                  <SelectContent>
                    {popularManufacturers.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Modell*
                </label>
                <Select 
                  value={model} 
                  onValueChange={setModel}
                  disabled={!manufacturer}
                >
                  <GraySelectTrigger className={!manufacturer ? "opacity-50 cursor-not-allowed" : ""}>
                    <SelectValue placeholder={manufacturer ? "Modell wählen" : "Erst Hersteller wählen"} />
                  </GraySelectTrigger>
                  <SelectContent>
                    {availableModels.map((modelName) => (
                      <SelectItem key={modelName} value={modelName}>
                        {modelName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Aufbauart*
                </label>
                <Select value={bodyType} onValueChange={setBodyType}>
                  <GraySelectTrigger>
                    <SelectValue placeholder="Aufbauart wählen" />
                  </GraySelectTrigger>
                  <SelectContent>
                    {bodyTypeOptions.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sale Channel Selection - 3 small buttons */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Verkaufsweg
              </label>
              <div className="grid grid-cols-3 gap-2">
                {saleChannelOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = saleChannel === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSaleChannel(option.id)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200",
                        "hover:border-primary/50 hover:bg-primary/5 hover:shadow-md",
                        isSelected 
                          ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20" 
                          : "border-slate-200 bg-slate-50 shadow-sm"
                      )}
                    >
                      <Icon className={cn(
                        "h-5 w-5 mb-1",
                        isSelected ? "text-primary" : "text-slate-500"
                      )} />
                      <span className={cn(
                        "text-xs font-semibold",
                        isSelected ? "text-primary" : "text-slate-700"
                      )}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Next Step Button */}
            <Button 
              onClick={handleNextStep} 
              className="w-full gradient-hero hover:shadow-glow h-12 text-base font-semibold rounded-xl group"
              size="lg"
            >
              Weiter
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </>
        ) : (
          <>
            {/* Step 2: Contact Details */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Kontaktdaten
              </label>
              <div className="space-y-2.5">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <GrayInput
                    type="text"
                    placeholder="Ihr Name*"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <GrayInput
                    type="email"
                    placeholder="E-Mail-Adresse*"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <GrayInput
                    type="tel"
                    placeholder="Telefonnummer*"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            
            {/* Submit Button */}
            <Button 
              onClick={handleContinue} 
              className="w-full gradient-hero hover:shadow-glow h-12 text-base font-semibold rounded-xl group"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Wird geladen..." : "Jetzt kostenlos starten"}
              {!isSubmitting && <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />}
            </Button>

            {/* Back link */}
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-center text-sm text-slate-500 hover:text-primary transition-colors"
            >
              ← Zurück zur Fahrzeugauswahl
            </button>
          </>
        )}
        
        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500 pt-1">
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
};

export default QuickAuctionForm;
