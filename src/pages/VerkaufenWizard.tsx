import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { logger } from "@/lib/logger";
import { useSearchParams } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import { generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";
import { Card } from "@/components/ui/card";
import { SiteLogo } from "@/components/SiteLogo";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { VehicleTypeStep } from "@/components/wizard/VehicleTypeStep";
import { VehicleInfoStep } from "@/components/wizard/VehicleInfoStep";
import { QuickContactStep } from "@/components/wizard/QuickContactStep";
import { DetailsStep } from "@/components/wizard/DetailsStep";
import { EquipmentStep } from "@/components/wizard/EquipmentStep";
import { PhotosStep } from "@/components/wizard/PhotosStep";
import { SaleChannelStep } from "@/components/wizard/SaleChannelStep";
import { AccountLocationStep } from "@/components/wizard/AccountLocationStep";
import { useWizardForm } from "@/hooks/useWizardForm";
import { supabase } from "@/integrations/supabase/client";
import { useWizardSession } from "@/hooks/useWizardSession";
import { captureOrUpdateLead, updateLeadWizardProgress, markLeadWizardCompleted } from "@/lib/leadTrackingService";
import { trackWizardStarted, trackWizardStep, trackWizardAbandoned } from "@/lib/gadsConversionService";
import { trackMetaInitiateCheckout, trackMetaWizardStep, trackMetaLead } from "@/lib/metaPixelService";
import { useTurnstile } from "@/hooks/useTurnstile";
import { HoneypotField, useHoneypot } from "@/components/ui/HoneypotField";

const steps = [
  { id: 1, name: "Fahrzeugtyp", description: "Was möchten Sie verkaufen?" },
  { id: 2, name: "Fahrzeugdaten", description: "Hersteller, Modell & mehr" },
  { id: 3, name: "Details", description: "Technische Angaben" },
  { id: 4, name: "Ausstattung", description: "Optional" },
  { id: 5, name: "Kontakt", description: "Ihre Kontaktdaten" },
  { id: 6, name: "Fotos", description: "Verkaufschancen erhöhen" },
  { id: 7, name: "Verkaufsweg", description: "Wie möchten Sie verkaufen?" },
  { id: 8, name: "Abschluss", description: "Standort & Konto" },
];

const VerkaufenWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [searchParams] = useSearchParams();
  const { formData, updateFormData, validateStep, submitForm, isSubmitting, clearDraft, fieldErrors, clearFieldErrors } = useWizardForm();
  const { saveProgress, markCompleted, updateContactFromAuth, isReady } = useWizardSession();
  const hasRestoredRef = useRef(false);
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { turnstileToken, turnstileReady, resetTurnstile, turnstileCallbackRef } = useTurnstile();
  const [honeypotValue, setHoneypotValue, isHoneypotBot] = useHoneypot();

  // Check if user is already authenticated and prefill profile data
  useEffect(() => {
    const loadUserAndProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user || null;
      setCurrentUser(user);

      if (!user) return;

      // Load profile data for prefill (only if form fields are still empty)
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone, address_street, address_zip, address_city, address_country')
          .eq('id', user.id)
          .single();

        if (!profile) return;

        const updates: Partial<typeof formData> = {};

        // Name: nur vorausfüllen wenn noch leer
        const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
        if (fullName && !formData.customerName) {
          updates.customerName = fullName;
        }

        // E-Mail: aus Auth-User (immer vorhanden)
        if (user.email && !formData.customerEmail) {
          updates.customerEmail = user.email;
        }

        // Telefon: aus Profil
        if (profile.phone && !formData.customerPhone) {
          updates.customerPhone = profile.phone;
        }

        // Adresse: address_street enthält "Straße Hausnummer" kombiniert
        if (profile.address_street && !formData.street) {
          const streetParts = profile.address_street.trim();
          // Hausnummer ist typischerweise das letzte Element (z.B. "Musterstraße 12a")
          const match = streetParts.match(/^(.+?)\s+(\d+\S*)$/);
          if (match) {
            updates.street = match[1];
            updates.houseNumber = match[2];
          } else {
            // Kein klares Muster: gesamten String als Straße verwenden
            updates.street = streetParts;
          }
        }

        if (profile.address_zip && !formData.zipCode) {
          updates.zipCode = profile.address_zip;
        }
        if (profile.address_city && !formData.city) {
          updates.city = profile.address_city;
        }
        if (profile.address_country && !formData.country) {
          updates.country = profile.address_country;
        }

        if (Object.keys(updates).length > 0) {
          updateFormData(updates);
          logger.info('Wizard: Profildaten vorausgefüllt', { fields: Object.keys(updates) });
        }
      } catch (err) {
        logger.warn('Wizard: Profil-Prefill fehlgeschlagen (nicht kritisch)', err);
      }
    };

    loadUserAndProfile();
  }, []);

  // Prefill form data from URL parameters
  useEffect(() => {
    const manufacturer = searchParams.get('manufacturer');
    const model = searchParams.get('model');
    const bodyType = searchParams.get('bodyType');
    const saleChannel = searchParams.get('saleChannel');
    const customerName = searchParams.get('customerName');
    const customerEmail = searchParams.get('customerEmail');
    const customerPhone = searchParams.get('customerPhone');
    const year = searchParams.get('year');
    const mileage = searchParams.get('mileage');
    const condition = searchParams.get('condition');
    const source = searchParams.get('source');
    
    const resumeStep = searchParams.get('step');
    if (resumeStep && !hasRestoredRef.current) {
      const stepNum = parseInt(resumeStep, 10);
      if (stepNum >= 1 && stepNum <= 8) {
        setCurrentStep(stepNum);
        hasRestoredRef.current = true;
      }
    }
    
    const vehicleTypeParam = searchParams.get('vehicleType');

    const updates: Partial<typeof formData> = {};
    // vehicleType von Startseite übernehmen (wohnmobil → Wohnmobil, wohnwagen → Wohnwagen)
    if (vehicleTypeParam) {
      const normalized = vehicleTypeParam.toLowerCase();
      if (normalized === 'wohnwagen') {
        updates.vehicleType = 'Wohnwagen';
      } else if (normalized === 'wohnmobil') {
        updates.vehicleType = 'Wohnmobil';
      }
    }
    if (manufacturer) updates.manufacturer = manufacturer;
    if (model) updates.model = model;
    if (bodyType) updates.bodyType = bodyType;
    if (saleChannel) updates.saleChannel = saleChannel;
    if (customerName) updates.customerName = customerName;
    if (customerEmail) updates.customerEmail = customerEmail;
    if (customerPhone) updates.customerPhone = customerPhone;
    if (year) updates.year = parseInt(year);
    if (mileage) updates.mileage = parseInt(mileage);
    if (condition) updates.condition = condition;
    
    if (Object.keys(updates).length > 0) {
      updateFormData(updates);
    }

    // Wenn Daten vom Wertrechner kommen (bodyType + manufacturer vorhanden),
    // direkt zu Step 2 springen (Fahrzeugdaten vervollständigen)
    if (source === 'wertrechner' && bodyType && !hasRestoredRef.current) {
      // Wenn auch manufacturer, model, year, mileage, condition vorhanden → Step 3 (Details & Technik)
      if (manufacturer && model && year && mileage && condition) {
        setCurrentStep(3);
      } else if (manufacturer) {
        setCurrentStep(2);
      } else {
        setCurrentStep(2);
      }
      hasRestoredRef.current = true;
    }
  }, [searchParams, updateFormData]);

  // Step-Guard: Verhindert, dass Nutzer per URL-Parameter (z.B. ?step=8) Steps überspringen
  // und dann beim Submit ungültige Daten an die Datenbank senden.
  // Prüft kritische Pflichtfelder aus vorherigen Steps und setzt zurück zum frühesten fehlenden Step.
  useEffect(() => {
    if (currentStep >= 2 && !formData.bodyType) {
      setCurrentStep(1);
    } else if (currentStep >= 8 && !formData.saleChannel) {
      // sale_channel ist Pflicht (Step 7) – ohne gültigen Wert → DB-Enum-Fehler
      setCurrentStep(7);
    } else if (currentStep >= 6 && (!formData.customerName || !formData.customerEmail)) {
      // Kontaktdaten werden in Step 5 erfasst
      setCurrentStep(5);
    }
  }, [currentStep, formData.bodyType, formData.saleChannel, formData.customerName, formData.customerEmail]);

  // Google Ads: Wizard-Start tracken
  useEffect(() => {
    const source = searchParams.get('source') || 'direct';
    trackWizardStarted(source);
    // Meta Pixel: InitiateCheckout bei Wizard-Start
    trackMetaInitiateCheckout({ content_name: 'Verkaufs-Wizard', content_category: 'Wohnmobil' });
  }, []);

  // Auto-save progress
  useEffect(() => {
    if (isReady) {
      saveProgress(currentStep, formData, steps.length);
    }
  }, [currentStep, formData, steps.length, saveProgress, isReady]);

  // Save progress on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveProgress(currentStep, formData, steps.length);
      if (currentStep < steps.length) {
        const currentStepInfo = steps[currentStep - 1];
        trackWizardAbandoned(currentStep, currentStepInfo?.name || `Schritt ${currentStep}`);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentStep, formData, steps.length, saveProgress]);

  // Capture lead when user reaches Step 5 (Quick Contact) and provides email
  useEffect(() => {
    if (currentStep >= 5 && formData.customerEmail && formData.customerName) {
      captureOrUpdateLead({
        name: formData.customerName,
        email: formData.customerEmail,
        manufacturer: formData.manufacturer,
        model: formData.model,
        bodyType: formData.bodyType,
        source: 'wizard_quick_contact',
        pageUrl: window.location.pathname,
      });
    }
  }, [currentStep, formData.customerEmail, formData.customerName]);

  // Ungerade Prozentwerte wirken authentischer und weniger konstruiert
  const progressMap: Record<number, number> = { 1: 8, 2: 20, 3: 33, 4: 45, 5: 57, 6: 69, 7: 82, 8: 100 };
  const progress = progressMap[currentStep] || (currentStep / steps.length) * 100;

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < steps.length) {
      const nextStep = currentStep + 1;

      // Bei Step 5 → 6: Lead SOFORT erfassen (Name + E-Mail sind jetzt vorhanden)
      if (currentStep === 5 && formData.customerEmail && formData.customerName) {
        // Lead sofort in quick_leads erfassen
        await captureOrUpdateLead({
          name: formData.customerName,
          email: formData.customerEmail,
          manufacturer: formData.manufacturer,
          model: formData.model,
          bodyType: formData.bodyType,
          source: 'wizard_quick_contact',
          pageUrl: window.location.pathname,
        });

        // Wizard-Session sofort (ohne Debounce) mit Kontaktdaten aktualisieren
        await updateContactFromAuth({
          email: formData.customerEmail,
          firstName: formData.customerName?.split(' ')[0],
          lastName: formData.customerName?.split(' ').slice(1).join(' '),
        });
      }

      updateLeadWizardProgress({
        step: nextStep,
        formData: formData as unknown as Record<string, unknown>,
      });
      const nextStepInfo = steps[nextStep - 1];
      trackWizardStep(nextStep, nextStepInfo?.name || `Schritt ${nextStep}`);
      // Meta Pixel: Wizard-Schritt tracken
      trackMetaWizardStep(nextStep, nextStepInfo?.name || `Schritt ${nextStep}`);
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      clearFieldErrors();
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    const isValid = await validateStep(8);
    if (!isValid) return;

    // Update contact data in session before submit
    await updateContactFromAuth({
      email: formData.customerEmail,
      firstName: formData.customerName?.split(' ')[0],
      lastName: formData.customerName?.split(' ').slice(1).join(' '),
      phone: formData.customerPhone,
    });

    const success = await submitForm(registerPassword || undefined, {
      turnstileToken,
      honeypot: honeypotValue,
    });
    if (success) {
      await markCompleted();
      markLeadWizardCompleted();
      // Google Ads trackWizardCompleted() wird bereits in useWizardForm.ts aufgerufen
      // (mit korrekter Transaction ID für Deduplizierung).
      // Ein zweiter Aufruf hier würde eine Doppel-Conversion mit neuer Transaction ID erzeugen.
      // Meta Pixel: Lead Event bei Wizard-Abschluss
      const vehicleInfo = `${formData.manufacturer || ''} ${formData.model || ''} (${formData.year || ''}) - ${formData.bodyType || ''}`;
      trackMetaLead({ content_name: vehicleInfo, content_category: 'Wohnmobil-Verkauf' });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <VehicleTypeStep formData={formData} updateFormData={updateFormData} fieldErrors={fieldErrors} />;
      case 2:
        return <VehicleInfoStep formData={formData} updateFormData={updateFormData} fieldErrors={fieldErrors} />;
      case 3:
        return <DetailsStep formData={formData} updateFormData={updateFormData} fieldErrors={fieldErrors} />;
      case 4:
        return <EquipmentStep formData={formData} updateFormData={updateFormData} />;
      case 5:
        return <QuickContactStep formData={formData} updateFormData={updateFormData} isAuthenticated={!!currentUser} fieldErrors={fieldErrors} />;
      case 6:
        return <PhotosStep formData={formData} updateFormData={updateFormData} />;
      case 7:
        return <SaleChannelStep formData={formData} updateFormData={updateFormData} fieldErrors={fieldErrors} />;
      case 8:
        return <AccountLocationStep
          formData={formData}
          updateFormData={updateFormData}
          registerPassword={registerPassword}
          setRegisterPassword={setRegisterPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          isAuthenticated={!!currentUser}
          fieldErrors={fieldErrors}
        />;
      default:
        return null;
    }
  };

  // Step indicator labels for compact progress bar
  const isLastStep = currentStep === steps.length;

  // Determine button labels based on step
  const getNextButtonLabel = () => {
    if (currentStep === 1) return formData.bodyType ? "Weiter zu Fahrzeugdaten" : "Weiter";
    if (currentStep === 2) return "Weiter zu technischen Details";
    if (currentStep === 4) return "Weiter (optional)";
    if (currentStep === 6) return formData.photos.length > 0 ? `Weiter mit ${formData.photos.length} Foto${formData.photos.length !== 1 ? 's' : ''}` : "Weiter ohne Fotos";
    return "Weiter";
  };

  return (
    <PageLayout
      title="Wohnmobil-Verkauf starten – Angebot in 2 Min."
      description="Verkaufen Sie Ihr Wohnmobil schnell und einfach – kostenloses Angebot in 2 Minuten"
      keywords="wohnmobil verkaufen, wohnmobil bewertung, caravan verkaufen"
      canonicalPath="/verkaufen/wizard"
      structuredData={generateBreadcrumbSchema(getBreadcrumbsFromPath("/verkaufen/wizard"))}
      hideHeader
      hideFooter
    >
      {/* Kompakter Wizard-Header mit Logo (da globaler Header ausgeblendet) */}
      <div className="bg-gradient-to-b from-cyan-50/80 via-sky-50/40 to-muted/65 pt-3 pb-2 md:pt-4 md:pb-3 border-b border-border/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-2">
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <SiteLogo variant="icon-text" />
            </a>
            <a href="/verkaufen" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" />
              Zurück zur Übersicht
            </a>
          </div>
          <div className="text-center">
            <h1 className="text-base md:text-xl font-bold text-foreground">
              Verkaufen Sie Ihr Wohnmobil
            </h1>
            <p className="text-muted-foreground text-xs mt-0.5">
              Kostenloses Angebot in nur 2 Minuten
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-screen py-4 md:py-8 bg-muted/65">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Progress Indicator with step labels */}
            <div className="mb-4 md:mb-8 animate-slide-up">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs md:text-sm font-medium text-foreground">
                  Schritt {currentStep} von {steps.length}: <span className="text-primary">{steps[currentStep - 1]?.name}</span>
                </span>
                <span className="text-sm font-semibold text-primary">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="h-2.5 rounded-full" />
              {/* Compact step dots on desktop */}
              <div className="hidden md:flex justify-between mt-2 px-1">
                {steps.map((step) => (
                  <div key={step.id} className="flex flex-col items-center gap-0.5">
                    <div className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      step.id < currentStep ? "bg-primary" : step.id === currentStep ? "bg-primary ring-2 ring-primary/30" : "bg-muted-foreground/20"
                    )} />
                    <span className={cn(
                      "text-[10px] leading-tight",
                      step.id <= currentStep ? "text-primary font-medium" : "text-muted-foreground"
                    )}>
                      {step.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Card - 2/3 width on desktop */}
              <div className="lg:col-span-2">
                <Card className="p-3 sm:p-4 md:p-8 shadow-elegant mb-4 md:mb-6 transition-all">
                  <div className="min-h-[180px] md:min-h-[350px]">{renderStep()}</div>
                </Card>

                {/* Mobile Trust Signals (hidden on desktop where sidebar is visible) */}
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground lg:hidden py-2">
                  <span className="flex items-center gap-1">
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    100% kostenlos
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-green-500" />
                    DSGVO-konform
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    Unverbindlich
                  </span>
                </div>

                {/* Navigation Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handlePrevious}
                    disabled={currentStep === 1}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Zurück
                  </Button>

                  {isLastStep ? (
                    <>
                      <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
                      <div ref={turnstileCallbackRef} />
                      <Button
                        size="lg"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="gradient-hero hover:gradient-hero-hover w-full sm:w-auto order-1 sm:order-2"
                      >
                        {isSubmitting ? "Wird gesendet..." : "Kostenloses Angebot anfordern"}
                        <Check className="w-4 h-4 ml-2" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="lg"
                      onClick={handleNext}
                      className="gradient-hero hover:gradient-hero-hover w-full sm:w-auto order-1 sm:order-2"
                    >
                      {getNextButtonLabel()}
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Sidebar - 1/3 width on desktop, hidden on mobile for steps 1-2 */}
              <div className="space-y-4 hidden lg:block">
                {/* Vehicle Summary (shown from step 2 onwards) */}
                {currentStep >= 2 && formData.manufacturer && (
                  <Card className="p-4 bg-primary/5 border-primary/20">
                    <h3 className="text-sm font-semibold mb-2">Ihr Fahrzeug</h3>
                    <p className="text-sm text-foreground">
                      {formData.manufacturer} {formData.model}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formData.year && `${formData.year} · `}
                      {formData.bodyType && `${formData.bodyType} · `}
                      {formData.mileage && `${formData.mileage.toLocaleString('de-DE')} km`}
                    </p>
                  </Card>
                )}

                {/* Trust Signals */}
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Ihre Vorteile
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>100% kostenlos & unverbindlich</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Geprüfte Händler deutschlandweit</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Eigenes Dashboard zur Verwaltung</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Datenschutz nach DSGVO</span>
                    </li>
                  </ul>
                </Card>

                {/* Social Proof */}
                <Card className="p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-green-600" />
                    <h3 className="text-sm font-semibold text-green-800 dark:text-green-200">
                      Aktuelle Nachfrage
                    </h3>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    <strong>Geprüfte Händler</strong> suchen aktuell nach Wohnmobilen.
                    Durchschnittlich <strong>mehrere Angebote</strong> pro Fahrzeug innerhalb von 48h.
                  </p>
                </Card>

                {/* Positive Verstärkung statt Zeitschätzung */}
                <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                      {currentStep <= 2
                        ? "Nur noch wenige Angaben bis zum Angebot"
                        : currentStep <= 4
                        ? (currentUser ? "Ihre Profildaten wurden automatisch übernommen" : "Gleich können Sie Ihre Kontaktdaten eingeben")
                        : currentStep === 5
                        ? (currentUser ? "Bitte bestätigen Sie Ihre Kontaktdaten" : "Fast geschafft – nur noch Name und E-Mail")
                        : currentStep === 6
                        ? "Fotos erhöhen Ihre Verkaufschancen enorm!"
                        : currentStep === 7
                        ? "Fast geschafft – wählen Sie Ihren Verkaufsweg"
                        : "Letzter Schritt – Standort & Konto!"}                 </span>
                  </div>
                </Card>
              </div>
            </div>

            {/* Help Text */}
            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>
                Benötigen Sie Hilfe?{" "}
                <a href="/kontakt" className="text-primary hover:underline">
                  Kontaktieren Sie uns
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default VerkaufenWizard;
