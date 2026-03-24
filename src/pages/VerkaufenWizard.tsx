import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import { generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check, Shield, Clock, Users } from "lucide-react";
import { VehicleStep } from "@/components/wizard/VehicleStep";
import { DetailsStep } from "@/components/wizard/DetailsStep";
import { EquipmentStep } from "@/components/wizard/EquipmentStep";
import { PhotosStep } from "@/components/wizard/PhotosStep";
import { ContactStep } from "@/components/wizard/ContactStep";
import { useWizardForm } from "@/hooks/useWizardForm";
import { useWizardSession } from "@/hooks/useWizardSession";
import { captureOrUpdateLead, updateLeadWizardProgress, markLeadWizardCompleted } from "@/lib/leadTrackingService";
import { trackWizardStarted, trackWizardStep, trackWizardCompleted, trackWizardAbandoned } from "@/lib/gadsConversionService";

const steps = [
  { id: 1, name: "Fahrzeug", description: "Was möchten Sie verkaufen?" },
  { id: 2, name: "Details", description: "Technische Angaben" },
  { id: 3, name: "Ausstattung", description: "Optional" },
  { id: 4, name: "Fotos", description: "Optional" },
  { id: 5, name: "Kontakt", description: "Angebot erhalten" },
];

const VerkaufenWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [searchParams] = useSearchParams();
  const { formData, updateFormData, validateStep, submitForm, isSubmitting, clearDraft } = useWizardForm();
  const { saveProgress, markCompleted, updateContactFromAuth, isReady } = useWizardSession();
  const hasRestoredRef = useRef(false);

  // Prefill form data from URL parameters
  useEffect(() => {
    const manufacturer = searchParams.get('manufacturer');
    const model = searchParams.get('model');
    const bodyType = searchParams.get('bodyType');
    const saleChannel = searchParams.get('saleChannel');
    const customerName = searchParams.get('customerName');
    const customerEmail = searchParams.get('customerEmail');
    const customerPhone = searchParams.get('customerPhone');
    
    const resumeStep = searchParams.get('step');
    if (resumeStep && !hasRestoredRef.current) {
      const stepNum = parseInt(resumeStep, 10);
      if (stepNum >= 1 && stepNum <= 5) {
        setCurrentStep(stepNum);
        hasRestoredRef.current = true;
      }
    }
    
    const updates: Partial<typeof formData> = {};
    if (manufacturer) updates.manufacturer = manufacturer;
    if (model) updates.model = model;
    if (bodyType) updates.bodyType = bodyType;
    if (saleChannel) updates.saleChannel = saleChannel;
    if (customerName) updates.customerName = customerName;
    if (customerEmail) updates.customerEmail = customerEmail;
    if (customerPhone) updates.customerPhone = customerPhone;
    
    if (Object.keys(updates).length > 0) {
      updateFormData(updates);
    }
  }, [searchParams, updateFormData]);

  // Google Ads: Wizard-Start tracken
  useEffect(() => {
    const source = searchParams.get('source') || 'direct';
    trackWizardStarted(source);
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

  // Ungerade Prozentwerte wirken authentischer und weniger konstruiert
  const progressMap: Record<number, number> = { 1: 17, 2: 39, 3: 58, 4: 76, 5: 100 };
  const progress = progressMap[currentStep] || (currentStep / steps.length) * 100;

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < steps.length) {
      updateLeadWizardProgress({
        step: currentStep + 1,
        formData: formData as unknown as Record<string, unknown>,
      });
      const nextStep = currentStep + 1;
      const nextStepInfo = steps[nextStep - 1];
      trackWizardStep(nextStep, nextStepInfo?.name || `Schritt ${nextStep}`);
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    const isValid = await validateStep(5);
    if (!isValid) return;

    // Update contact data in session before submit
    await updateContactFromAuth({
      email: formData.customerEmail,
      firstName: formData.customerName?.split(' ')[0],
      lastName: formData.customerName?.split(' ').slice(1).join(' '),
      phone: formData.customerPhone,
    });

    const success = await submitForm();
    if (success) {
      await markCompleted();
      markLeadWizardCompleted();
      const vehicleInfo = `${formData.manufacturer || ''} ${formData.model || ''} (${formData.year || ''}) - ${formData.bodyType || ''}`;
      trackWizardCompleted(vehicleInfo);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <VehicleStep formData={formData} updateFormData={updateFormData} />;
      case 2:
        return <DetailsStep formData={formData} updateFormData={updateFormData} />;
      case 3:
        return <EquipmentStep formData={formData} updateFormData={updateFormData} />;
      case 4:
        return <PhotosStep formData={formData} updateFormData={updateFormData} />;
      case 5:
        return <ContactStep formData={formData} updateFormData={updateFormData} />;
      default:
        return null;
    }
  };

  // Step indicator labels for compact progress bar
  const isLastStep = currentStep === steps.length;

  return (
    <PageLayout
      title="Wohnmobil verkaufen"
      description="Verkaufen Sie Ihr Wohnmobil schnell und einfach – kostenloses Angebot in 2 Minuten"
      keywords="wohnmobil verkaufen, wohnmobil bewertung, caravan verkaufen"
      canonicalPath="/verkaufen/wizard"
      structuredData={generateBreadcrumbSchema(getBreadcrumbsFromPath("/verkaufen/wizard"))}
    >
      {/* Hero */}
      <PageHero size="sm">
        <div className="text-center animate-fade-in max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-foreground mb-2 md:mb-4">
            Verkaufen Sie Ihr Wohnmobil
          </h1>
          <p className="text-muted-foreground text-sm md:text-lg max-w-2xl mx-auto">
            Kostenloses Angebot in nur 2 Minuten – unverbindlich und ohne Registrierungspflicht
          </p>
        </div>
      </PageHero>

      <div className="min-h-screen py-4 md:py-16 bg-muted/65">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Progress Indicator - nur Prozentbalken */}
            <div className="mb-4 md:mb-8 animate-slide-up">
              <div className="flex justify-end items-center mb-2">
                <span className="text-sm font-semibold text-primary">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="h-2.5 rounded-full" />
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Card - 2/3 width on desktop */}
              <div className="lg:col-span-2">
                <Card className="p-3 sm:p-4 md:p-8 shadow-elegant mb-4 md:mb-6 transition-all">
                  <div className="min-h-[200px] md:min-h-[400px]">{renderStep()}</div>
                </Card>

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
                    <Button
                      size="lg"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="gradient-hero hover:gradient-hero-hover w-full sm:w-auto order-1 sm:order-2"
                    >
                      {isSubmitting ? "Wird gesendet..." : "Kostenloses Angebot anfordern"}
                      <Check className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={handleNext}
                      className="gradient-hero hover:gradient-hero-hover w-full sm:w-auto order-1 sm:order-2"
                    >
                      {currentStep === 3 || currentStep === 4 ? "Weiter (optional)" : "Weiter"}
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
                      <span>Angebot innerhalb von 24 Stunden</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Über 500 geprüfte Händler</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Keine Registrierung nötig</span>
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
                    <strong>127 Händler</strong> suchen aktuell nach Wohnmobilen.
                    Durchschnittlich <strong>3 Angebote</strong> pro Fahrzeug innerhalb von 48h.
                  </p>
                </Card>

                {/* Time Estimate */}
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Geschätzte Restzeit: {Math.max(1, (steps.length - currentStep))} Min.
                    </span>
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
