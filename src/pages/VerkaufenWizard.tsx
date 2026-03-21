import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { VehicleDetailsStep } from "@/components/wizard/VehicleDetailsStep";
import { TechnicalDetailsStep } from "@/components/wizard/TechnicalDetailsStep";
import { DimensionsStep } from "@/components/wizard/DimensionsStep";
import { InteriorFeaturesStep } from "@/components/wizard/InteriorFeaturesStep";
import { VehicleFeaturesStep } from "@/components/wizard/VehicleFeaturesStep";
import { PhotoUploadStep } from "@/components/wizard/PhotoUploadStep";
import { DefectsStep } from "@/components/wizard/DefectsStep";
import { SaleChannelStep } from "@/components/wizard/SaleChannelStep";
import { AppointmentStep } from "@/components/wizard/AppointmentStep";
import { AuthenticationStep } from "@/components/wizard/AuthenticationStep";
import { ReviewStep } from "@/components/wizard/ReviewStep";
import { useWizardForm } from "@/hooks/useWizardForm";
import { useWizardSession } from "@/hooks/useWizardSession";
import { useMemo, useCallback, useRef } from "react";
import { captureOrUpdateLead, updateLeadWizardProgress, markLeadWizardCompleted } from "@/lib/leadTrackingService";
import { ContactDataModal } from "@/components/ContactDataModal";

const baseSteps = [
  { id: 1, name: "Fahrzeugdetails", description: "Grundinformationen" },
  { id: 2, name: "Technik", description: "Technische Daten" },
  { id: 3, name: "Abmessungen", description: "Maße & Kapazität" },
  { id: 4, name: "Innenraum", description: "Innenausstattung" },
  { id: 5, name: "Ausstattung", description: "Zusatzausstattung" },
  { id: 6, name: "Fotos", description: "Mindestens 4 Bilder" },
  { id: 7, name: "Mängel", description: "Bekannte Mängel angeben" },
  { id: 8, name: "Verkaufsweg", description: "Wie möchten Sie verkaufen?" },
];

const appointmentStep = { id: 9, name: "Termin", description: "Übergabetermin vereinbaren" };
// Review comes BEFORE Auth - user sees summary first, then authenticates to submit
const reviewStep = { id: 10, name: "Überprüfung", description: "Letzte Kontrolle" };
const authStep = { id: 11, name: "Anmeldung", description: "Konto erstellen & absenden" };

const VerkaufenWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [searchParams] = useSearchParams();
  const { formData, updateFormData, validateStep, submitForm, isSubmitting } = useWizardForm();
  const { saveProgress, markCompleted, isReady } = useWizardSession();
  const hasRestoredRef = useRef(false);

  // Kontaktdaten-Gate: Modal anzeigen wenn keine Kontaktdaten vorhanden
  const hasContactData = !!(searchParams.get('customerName') || searchParams.get('customerEmail') || formData.customerName || formData.customerEmail);
  const [showContactModal, setShowContactModal] = useState(!hasContactData);

  // Prefill form data from URL parameters (including contact data from hero/landing forms)
  useEffect(() => {
    const manufacturer = searchParams.get('manufacturer');
    const model = searchParams.get('model');
    const bodyType = searchParams.get('bodyType');
    const saleChannel = searchParams.get('saleChannel');
    const customerName = searchParams.get('customerName');
    const customerEmail = searchParams.get('customerEmail');
    const customerPhone = searchParams.get('customerPhone');
    
    // Check if resuming from a specific step (from resume email link)
    const resumeStep = searchParams.get('step');
    if (resumeStep && !hasRestoredRef.current) {
      const stepNum = parseInt(resumeStep, 10);
      if (stepNum >= 1 && stepNum <= 11) {
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

  // Dynamically determine steps based on sale channel
  const steps = useMemo(() => {
    const needsAppointment = formData.saleChannel === 'station';
    
    if (needsAppointment) {
      return [...baseSteps, appointmentStep, reviewStep, authStep];
    }
    return [...baseSteps, { ...reviewStep, id: 9 }, { ...authStep, id: 10 }];
  }, [formData.saleChannel]);

  // Auto-save progress whenever step or formData changes (only when session is ready)
  useEffect(() => {
    if (isReady) {
      saveProgress(currentStep, formData, steps.length);
    }
  }, [currentStep, formData, steps.length, saveProgress, isReady]);

  // Save progress on page unload (browser close/navigate away)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use synchronous approach for beforeunload
      saveProgress(currentStep, formData, steps.length);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentStep, formData, steps.length, saveProgress]);

  // Handle authentication completion - Auth is now final step, so auto-submit
  const handleAuthenticated = useCallback(async () => {
    const needsAppointment = formData.saleChannel === 'station';
    const authStepNumber = needsAppointment ? 11 : 10;
    if (currentStep === authStepNumber) {
      await submitForm();
      // Mark the wizard session as completed
      await markCompleted();
    }
  }, [formData.saleChannel, currentStep, submitForm, markCompleted]);

  const progress = (currentStep / steps.length) * 100;

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < steps.length) {
      // Lead-Fortschritt tracken bei jedem Schritt-Wechsel
      updateLeadWizardProgress({
        step: currentStep + 1,
        formData: formData as unknown as Record<string, unknown>,
      });
      const nextStep = currentStep + 1;
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
    await submitForm();
    await markCompleted();
    // Lead als abgeschlossen markieren
    markLeadWizardCompleted();
  };

  const renderStep = () => {
    const needsAppointment = formData.saleChannel === 'station';
    
    switch (currentStep) {
      case 1:
        return <VehicleDetailsStep formData={formData} updateFormData={updateFormData} />;
      case 2:
        return <TechnicalDetailsStep formData={formData} updateFormData={updateFormData} />;
      case 3:
        return <DimensionsStep formData={formData} updateFormData={updateFormData} />;
      case 4:
        return <InteriorFeaturesStep formData={formData} updateFormData={updateFormData} />;
      case 5:
        return <VehicleFeaturesStep formData={formData} updateFormData={updateFormData} />;
      case 6:
        return <PhotoUploadStep formData={formData} updateFormData={updateFormData} />;
      case 7:
        return <DefectsStep formData={formData} updateFormData={updateFormData} onAutoNext={handleNext} />;
      case 8:
        return <SaleChannelStep formData={formData} updateFormData={updateFormData} onAutoNext={handleNext} />;
      case 9:
        if (needsAppointment) {
          return <AppointmentStep formData={formData} updateFormData={updateFormData} />;
        }
        return <ReviewStep formData={formData} />;
      case 10:
        if (needsAppointment) {
          return <ReviewStep formData={formData} />;
        }
        return <AuthenticationStep onAuthenticated={handleAuthenticated} prefillEmail={formData.customerEmail} prefillName={formData.customerName} prefillPhone={formData.customerPhone} />;
      case 11:
        if (needsAppointment) {
          return <AuthenticationStep onAuthenticated={handleAuthenticated} prefillEmail={formData.customerEmail} prefillName={formData.customerName} prefillPhone={formData.customerPhone} />;
        }
        return null;
      default:
        return null;
    }
  };

  return (
    <PageLayout
      title="Wohnmobil verkaufen"
      description="Verkaufen Sie Ihr Wohnmobil schnell und einfach mit unserem Schritt-für-Schritt-Assistenten"
      keywords="wohnmobil verkaufen, wohnmobil verkaufsassistent, online verkaufen"
      canonicalPath="/verkaufen/wizard"
    >
      {/* Kontaktdaten-Modal als Gate - wird angezeigt wenn Nutzer direkt zum Wizard kommt */}
      <ContactDataModal
        open={showContactModal}
        onOpenChange={setShowContactModal}
        source="wizard_direct"
        additionalParams={Object.fromEntries(searchParams.entries())}
      />
          {/* Header */}
      <PageHero size="sm">
        <div className="text-center animate-fade-in max-w-4xl mx-auto">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Verkaufen Sie Ihr Wohnmobil
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              Folgen Sie unserem einfachen Assistenten und verkaufen Sie Ihr Wohnmobil in wenigen Minuten
            </p>
          </div>
      </PageHero>

      <div className="min-h-screen py-8 md:py-16 bg-muted/20">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Progress Bar */}
          <div className="mb-8 animate-slide-up">
            <div className="flex justify-between items-center mb-2">
              <div>
                <span className="text-sm font-medium text-foreground">
                  {steps[currentStep - 1].name}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {steps[currentStep - 1].description}
                </span>
              </div>
              <span className="text-sm font-semibold text-primary">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Form Card */}
          <Card className="p-4 md:p-8 shadow-elegant mb-8 transition-all">
            <div className="min-h-[400px]">{renderStep()}</div>
          </Card>

          {/* Navigation Buttons */}
          {(() => {
            const needsAppointment = formData.saleChannel === 'station';
            const authStepNumber = needsAppointment ? 11 : 10;
            const isAuthStep = currentStep === authStepNumber;
            
            return (
              <div className="flex flex-col sm:flex-row gap-4 justify-between animate-slide-up">
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

                {!isAuthStep && (
                  currentStep < steps.length ? (
                    <Button
                      size="lg"
                      onClick={handleNext}
                      className="gradient-hero hover:gradient-hero-hover w-full sm:w-auto order-1 sm:order-2"
                    >
                      Weiter
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="gradient-hero hover:gradient-hero-hover w-full sm:w-auto order-1 sm:order-2"
                    >
                      {isSubmitting ? "Wird gesendet..." : "Angebot einreichen"}
                      <Check className="w-4 h-4 ml-2" />
                    </Button>
                  )
                )}
              </div>
            );
          })()}

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
    </PageLayout>
  );
};

export default VerkaufenWizard;
