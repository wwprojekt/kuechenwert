import { useState, useEffect, useRef, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
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
import { MarketingPhaseStep } from "@/components/wizard/MarketingPhaseStep";
import { useWizardForm } from "@/hooks/useWizardForm";
import { supabase } from "@/integrations/supabase/client";
import { useWizardSession } from "@/hooks/useWizardSession";
import { trackWizardStarted, trackWizardStep, trackWizardAbandoned } from "@/lib/gadsConversionService";
import { trackMetaInitiateCheckout, trackMetaWizardStep, trackMetaLead } from "@/lib/metaPixelService";
import { trackEvent } from "@/lib/analyticsService";
import { resolveManufacturer } from "@/lib/vehicle-data";
import { useTurnstile } from "@/hooks/useTurnstile";
import { HoneypotField, useHoneypot } from "@/components/ui/HoneypotField";
import { ensureValidRLSSession } from "@/lib/sessionGuard";

// Wizard-Schritte
//
// Bei sale_channel = 'station' wird Step 9 (Marketingphase) übersprungen –
// Submit erfolgt direkt aus Step 8. Die `getActiveSteps()`-Funktion liefert
// das passende Step-Array je nach gewähltem Channel zurück, damit die
// Progress-Bar und der Step-Counter korrekt sind.
const ALL_STEPS = [
  { id: 1, name: "Fahrzeugtyp", description: "Was möchten Sie verkaufen?" },
  { id: 2, name: "Fahrzeugdaten", description: "Hersteller, Modell & mehr" },
  { id: 3, name: "Einschätzung", description: "Bessere Angebote erhalten" },
  { id: 4, name: "Details & Ausstattung", description: "Bessere Angebote erhalten" },
  { id: 5, name: "Kontakt", description: "Ihre Kontaktdaten" },
  { id: 6, name: "Fotos", description: "Verkaufschancen erhöhen" },
  { id: 7, name: "Verkaufsweg & Telefon", description: "Wie möchten Sie verkaufen?" },
  { id: 8, name: "Standort & Konto", description: "Letzter Schritt vor der Vermarktung" },
  { id: 9, name: "Vermarktung bestätigen", description: "Mindesterlös-Garantie + Veröffentlichung" },
];

const getActiveSteps = (saleChannel: string) => {
  // Station-Channel hat kein Marketingphasen-Modell → Step 9 entfällt.
  if (saleChannel === "station") return ALL_STEPS.slice(0, 8);
  return ALL_STEPS;
};

const VerkaufenWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [searchParams] = useSearchParams();
  const { formData, updateFormData, validateStep, validatePassword, submitForm, isSubmitting, fieldErrors, clearFieldErrors } = useWizardForm();
  const { saveProgress, markCompleted, updateContactFromAuth, isReady, sessionId, anonymousId, initialStep, restoredFormData } = useWizardSession();
  const hasRestoredRef = useRef(false);
  // Tracks whether session-hydration finished. The step-guard MUST NOT run
  // before this flips true – otherwise it bounces resumed users back to
  // step 2 with empty fields (because formData is still {}).
  const [isHydrated, setIsHydrated] = useState(false);
  const hasMergedRestoredRef = useRef(false);
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { turnstileToken, turnstileCallbackRef } = useTurnstile();
  const [honeypotValue, setHoneypotValue] = useHoneypot();

  // Dynamische Step-Liste: bei sale_channel='station' nur 8 Schritte
  // (Step 9 / Marketingphase entfällt – Submit erfolgt aus Step 8).
  const steps = useMemo(() => getActiveSteps(formData.saleChannel), [formData.saleChannel]);

  // H1: Restore form data + step the user was on when they left. Only runs
  // when the session finishes loading and the user did not already land on
  // a specific step via URL (?step=X, ?source=wertrechner, …).
  //
  // ORDER MATTERS: we merge form_data into the wizard FIRST, then restore the
  // step. Otherwise the step-guard below sees an empty formData and bounces
  // the user back to step 2. This caused ~30 % of resumed sessions to abandon
  // (analyzed via wizard_sessions: stuck-on-step-2 with all required fields
  // empty).
  useEffect(() => {
    if (!isReady) return;

    // Merge restored form data once, even if no step restore is needed.
    if (restoredFormData && !hasMergedRestoredRef.current) {
      updateFormData(restoredFormData);
      hasMergedRestoredRef.current = true;
    }

    if (!hasRestoredRef.current && initialStep && initialStep >= 1 && initialStep <= 8) {
      setCurrentStep(initialStep);
      hasRestoredRef.current = true;
    }

    // Mark hydration as done so the step-guard can run without false-positives.
    setIsHydrated(true);
  }, [isReady, initialStep, restoredFormData, updateFormData]);

  // Check if user is already authenticated and prefill profile data.
  // Listens to auth state changes so a user who logs in DURING the wizard
  // (e.g. via magic link in another tab) still gets their profile prefilled.
  useEffect(() => {
    let cancelled = false;

    const loadUserAndProfile = async (user: User | null) => {
      if (cancelled) return;
      setCurrentUser(user);

      if (!user) return;

      try {
        const sessionValid = await ensureValidRLSSession();
        if (!sessionValid || cancelled) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone, address_street, address_zip, address_city, address_country')
          .eq('id', user.id)
          .single();

        if (!profile || cancelled) return;

        const updates: Partial<typeof formData> = {};

        const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
        if (fullName && !formData.customerName) {
          updates.customerName = fullName;
        }

        if (user.email && !formData.customerEmail) {
          updates.customerEmail = user.email;
        }

        if (profile.phone && !formData.customerPhone) {
          updates.customerPhone = profile.phone;
        }

        // address_street stores "Straße Hausnummer" combined – split on the
        // last whitespace-delimited token that starts with a digit.
        if (profile.address_street && !formData.street) {
          const streetParts = profile.address_street.trim();
          const match = streetParts.match(/^(.+?)\s+(\d+\S*)$/);
          if (match) {
            updates.street = match[1];
            updates.houseNumber = match[2];
          } else {
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

        if (Object.keys(updates).length > 0 && !cancelled) {
          updateFormData(updates);
          logger.info('Wizard: Profildaten vorausgefüllt', { fields: Object.keys(updates) });
        }
      } catch (err) {
        logger.warn('Wizard: Profil-Prefill fehlgeschlagen (nicht kritisch)', err);
      }
    };

    supabase.auth.getUser().then(({ data }) => loadUserAndProfile(data.user || null));

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserAndProfile(session?.user || null);
    });

    return () => {
      cancelled = true;
      authSubscription.subscription.unsubscribe();
    };
    // We intentionally exclude formData/updateFormData here: they change
    // frequently and re-running the prefill on every keystroke would wipe
    // user edits. The only trigger we care about is the auth state itself,
    // which is handled via onAuthStateChange above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Trim + Alias-Resolution, damit URL-Params (z.B. vom Wertrechner oder
    // iOS-Smart-Space via Share-Link) keine kaputten Werte wie "Bürstner "
    // oder "Sunligth " in form_data schreiben. Ohne Trim matcht später
    // manufacturerModels["Bürstner "] nicht und die Modell-Liste ist leer.
    if (manufacturer) {
      const trimmed = manufacturer.trim();
      if (trimmed) {
        const resolved = resolveManufacturer(trimmed);
        updates.manufacturer = resolved !== trimmed ? resolved : trimmed;
      }
    }
    if (model) {
      const trimmed = model.trim();
      if (trimmed) updates.model = trimmed;
    }
    if (bodyType) {
      const trimmed = bodyType.trim();
      if (trimmed) updates.bodyType = trimmed;
    }
    if (saleChannel) {
      const trimmed = saleChannel.trim();
      if (trimmed) updates.saleChannel = trimmed;
    }
    if (customerName) {
      const trimmed = customerName.trim();
      if (trimmed) updates.customerName = trimmed;
    }
    if (customerEmail) {
      const trimmed = customerEmail.trim();
      if (trimmed) updates.customerEmail = trimmed;
    }
    if (customerPhone) {
      const trimmed = customerPhone.trim();
      if (trimmed) updates.customerPhone = trimmed;
    }
    if (year) updates.year = parseInt(year);
    if (mileage) updates.mileage = parseInt(mileage);
    if (condition) {
      const trimmed = condition.trim();
      if (trimmed) updates.condition = trimmed;
    }
    
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
  // Prüft ALLE kritischen Pflichtfelder aus vorherigen Steps und setzt zurück zum
  // frühesten fehlenden Step. Die Reihenfolge ist wichtig – wir springen zum ersten
  // fehlenden Pflichtfeld, nicht zum letzten.
  //
  // WICHTIG: erst aktiv NACH der Hydration, damit ein Resume mit
  // `current_step = 4` nicht in der Sekunde, in der formData noch {} ist,
  // zurück auf Step 2 gebounct wird. Das war die Ursache für die hohe
  // Abbruchrate auf Step 2 nach dem Wizard-Refactor 2026-04-16.
  useEffect(() => {
    if (!isHydrated) return;
    if (!formData.bodyType && currentStep > 1) {
      setCurrentStep(1);
      return;
    }
    if ((!formData.manufacturer || !formData.model || !formData.year) && currentStep > 2) {
      // Wohnwagen haben keinen Mileage-Check, aber Manufacturer/Modell/Jahr sind immer Pflicht.
      setCurrentStep(2);
      return;
    }
    if ((!formData.customerName || !formData.customerEmail) && currentStep > 5) {
      setCurrentStep(5);
      return;
    }
    if (!formData.saleChannel && currentStep > 7) {
      setCurrentStep(7);
      return;
    }
    // Step 9 (Marketingphase) ist nur für auction/instant_price erreichbar.
    // Falls der User per URL-Hack mit station auf Step 9 landet → zurück auf 8
    // (das ist dort der finale Submit-Step).
    if (currentStep === 9 && formData.saleChannel === "station") {
      setCurrentStep(8);
      return;
    }
    // Telefon ist Pflicht ab Step 8 (wird in Step 7 erfasst). Schutz gegen
    // ?step=8 / ?step=9 URL-Hacks bei leerem Telefon-Feld.
    if (!formData.customerPhone && currentStep > 7) {
      setCurrentStep(7);
    }
  }, [
    isHydrated,
    currentStep,
    formData.bodyType,
    formData.manufacturer,
    formData.model,
    formData.year,
    formData.customerName,
    formData.customerEmail,
    formData.saleChannel,
    formData.customerPhone,
  ]);

  // Google Ads: Wizard-Start tracken.
  // We intentionally run this only once on mount – searchParams.get('source')
  // is read via ref semantics (the URL at mount time is the one that
  // actually triggered the wizard).
  useEffect(() => {
    const source = searchParams.get('source') || 'direct';
    trackWizardStarted(source);
    trackMetaInitiateCheckout({ content_name: 'Verkaufs-Wizard', content_category: 'Wohnmobil' });
    trackEvent('wizard_started', { category: 'wizard', properties: { source } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save progress. steps.length wechselt dynamisch zwischen 8 und 9
  // (abhängig von sale_channel) – muss daher als Dependency mitwandern,
  // damit total_steps in wizard_sessions korrekt aktualisiert wird, wenn
  // der User den Channel wechselt.
  useEffect(() => {
    if (isReady) {
      saveProgress(currentStep, formData, steps.length);
    }
  }, [currentStep, formData, saveProgress, isReady, steps.length]);

  // Save progress on page unload / tab hide. We pass { immediate: true } so
  // the save is flushed synchronously (the regular debounced save would be
  // cancelled by the unload event).
  //
  // Why three listeners:
  //  - beforeunload      → desktop tab close / reload
  //  - pagehide          → iOS Safari (beforeunload is unreliable there)
  //  - visibilitychange  → mobile app-switch (WhatsApp, push notifications …)
  //
  // We guard against duplicate fires with a ref so the abandoned-tracking
  // event only runs once per unload.
  useEffect(() => {
    let fired = false;
    const flushAndTrack = () => {
      if (fired) return;
      fired = true;
      saveProgress(currentStep, formData, steps.length, { immediate: true });
      if (currentStep < steps.length) {
        const currentStepInfo = steps[currentStep - 1];
        trackWizardAbandoned(currentStep, currentStepInfo?.name || `Schritt ${currentStep}`);
        trackEvent('wizard_abandoned', { category: 'wizard', value: currentStep, properties: { step: currentStep, stepName: currentStepInfo?.name } });
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushAndTrack();
    };

    window.addEventListener('beforeunload', flushAndTrack);
    window.addEventListener('pagehide', flushAndTrack);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', flushAndTrack);
      window.removeEventListener('pagehide', flushAndTrack);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentStep, formData, saveProgress, steps]);

  // Higher starting percentage reduces abandonment psychology.
  // Map ist auf 9 Schritte ausgelegt (auction/instant_price). Bei station
  // (8 Schritte) wird Step 8 = 100 % verwendet – greift Fallback unten.
  const progressMap: Record<number, number> = steps.length === 9
    ? { 1: 11, 2: 22, 3: 33, 4: 44, 5: 55, 6: 66, 7: 77, 8: 88, 9: 100 }
    : { 1: 12, 2: 25, 3: 37, 4: 50, 5: 62, 6: 75, 7: 87, 8: 100 };
  const progress = progressMap[currentStep] || (currentStep / steps.length) * 100;

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < steps.length) {
      const nextStep = currentStep + 1;

      // Bei Step 5 → 6: Wizard-Session sofort (ohne Debounce) mit Kontaktdaten
      // aktualisieren, damit der Lead auch dann erhalten bleibt, wenn der User
      // danach abbricht.
      if (currentStep === 5 && formData.customerEmail && formData.customerName) {
        await updateContactFromAuth({
          email: formData.customerEmail,
          firstName: formData.customerName?.split(' ')[0],
          lastName: formData.customerName?.split(' ').slice(1).join(' '),
        });
      }

      const nextStepInfo = steps[nextStep - 1];
      trackWizardStep(nextStep, nextStepInfo?.name || `Schritt ${nextStep}`);
      trackMetaWizardStep(nextStep, nextStepInfo?.name || `Schritt ${nextStep}`);
      trackEvent('wizard_step', { category: 'wizard', label: nextStepInfo?.name, value: nextStep, properties: { step: nextStep, bodyType: formData.bodyType } });
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
    // Validate FINAL step (8 für station, 9 für auction/instant_price) sowie
    // Step 8 als zusätzliche Sicherheit gegen URL-Hacks (?step=9), damit
    // Standort/Konto immer mitgeprüft werden.
    const finalStep = steps.length;
    if (finalStep === 9) {
      const step8Valid = await validateStep(8);
      if (!step8Valid) return;
    }
    const isValid = await validateStep(finalStep);
    if (!isValid) return;

    // Additional password validation for guest submissions. If the user is
    // logged in we skip this – their password is already set.
    // validatePassword already shows its own toast with the exact error, so
    // we just bail out on failure.
    if (!currentUser) {
      const passwordValid = validatePassword(registerPassword, confirmPassword);
      if (!passwordValid) return;
    }

    // Update contact data in session before submit
    await updateContactFromAuth({
      email: formData.customerEmail,
      firstName: formData.customerName?.split(' ')[0],
      lastName: formData.customerName?.split(' ').slice(1).join(' '),
      phone: formData.customerPhone,
    });

    const success = await submitForm(
      registerPassword || undefined,
      { turnstileToken, honeypot: honeypotValue },
      { existingSessionId: sessionId, anonymousId },
    );
    if (success) {
      await markCompleted();
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
        return <VehicleTypeStep formData={formData} updateFormData={updateFormData} fieldErrors={fieldErrors} onAutoAdvance={handleNext} />;
      case 2:
        return <VehicleInfoStep formData={formData} updateFormData={updateFormData} fieldErrors={fieldErrors} />;
      case 3:
        return <DetailsStep formData={formData} updateFormData={updateFormData} fieldErrors={fieldErrors} />;
      case 4:
        return <EquipmentStep formData={formData} updateFormData={updateFormData} />;
      case 5:
        return <QuickContactStep formData={formData} updateFormData={updateFormData} isAuthenticated={!!currentUser} fieldErrors={fieldErrors} />;
      case 6:
        return <PhotosStep formData={formData} updateFormData={updateFormData} onSkipPhotos={handleNext} />;
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
      case 9:
        return <MarketingPhaseStep formData={formData} updateFormData={updateFormData} fieldErrors={fieldErrors} />;
      default:
        return null;
    }
  };

  // Step indicator labels for compact progress bar
  const isLastStep = currentStep === steps.length;

  // Contextual button labels – tell users what's next to reduce uncertainty
  const getNextButtonLabel = () => {
    switch (currentStep) {
      case 1: return "Weiter zu Fahrzeugdaten";
      case 2: return "Weiter zur Einschätzung";
      case 3: return "Weiter zu Ausstattung";
      case 4: return "Weiter zu Kontakt";
      case 5: return "Weiter zu Fotos";
      case 6: return formData.photos.length > 0
        ? `Weiter mit ${formData.photos.length} Foto${formData.photos.length !== 1 ? 's' : ''}`
        : "Weiter ohne Fotos";
      case 7: return "Weiter zu Standort & Konto";
      case 8: return formData.saleChannel === "station" ? "Inserat veröffentlichen" : "Weiter zur Vermarktung";
      default: return "Weiter";
    }
  };

  return (
    <PageLayout
      title={formData.bodyType === 'Wohnwagen'
        ? 'Wohnwagen-Verkauf starten – Angebot in 2 Min.'
        : 'Wohnmobil-Verkauf starten – Angebot in 2 Min.'}
      description={formData.bodyType === 'Wohnwagen'
        ? 'Verkaufen Sie Ihren Wohnwagen schnell und einfach – kostenloses Angebot in 2 Minuten'
        : 'Verkaufen Sie Ihr Wohnmobil schnell und einfach – kostenloses Angebot in 2 Minuten'}
      keywords="wohnmobil verkaufen, wohnwagen verkaufen, wohnmobil bewertung, caravan verkaufen"
      canonicalPath="/verkaufen/wizard"
      structuredData={generateBreadcrumbSchema(getBreadcrumbsFromPath("/verkaufen/wizard"))}
      hideHeader
      hideFooter
    >
      {/* Kompakter Wizard-Header mit Logo (da globaler Header ausgeblendet) */}
      <div className="bg-gradient-to-b from-cyan-50/80 via-sky-50/40 to-muted/65 pt-2 pb-1.5 sm:pt-3 sm:pb-2 md:pt-4 md:pb-3 border-b border-border/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-0 sm:mb-2">
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <SiteLogo variant="icon-text" />
            </a>
            <a href="/verkaufen" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" />
              Zurück zur Übersicht
            </a>
          </div>
          <div className="text-center">
            <h1 className="text-sm sm:text-base md:text-xl font-bold text-foreground">
              {formData.bodyType === 'Wohnwagen'
                ? 'Verkaufen Sie Ihren Wohnwagen'
                : 'Verkaufen Sie Ihr Wohnmobil'}
            </h1>
            <p className="text-muted-foreground text-[11px] sm:text-xs mt-0.5">
              Kostenloses Angebot in nur 2 Minuten
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-screen py-2 sm:py-4 md:py-8 bg-muted/65">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Progress Indicator with step dots */}
            <div className="mb-2 sm:mb-4 md:mb-6 animate-slide-up">
              <div className="flex justify-end items-center mb-1">
                <span className="text-xs sm:text-sm font-semibold text-primary">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="h-1.5 sm:h-2.5 rounded-full" />
              {/* Step dots – clickable visual orientation */}
              <div className="flex items-center justify-center gap-1.5 mt-1.5 sm:mt-2">
                {steps.map((step, i) => (
                  <div
                    key={step.id}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      i + 1 === currentStep
                        ? "w-6 bg-primary"
                        : i + 1 < currentStep
                          ? "w-1.5 bg-primary/60"
                          : "w-1.5 bg-border"
                    )}
                    title={step.name}
                  />
                ))}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Card - 2/3 width on desktop */}
              <div className="lg:col-span-2">
                <Card className="p-2.5 sm:p-4 md:p-8 shadow-elegant mb-4 md:mb-6 transition-all">
                  <div
                    role="region"
                    aria-live="polite"
                    aria-atomic="false"
                    aria-label={`Schritt ${currentStep} von ${steps.length}: ${steps[currentStep - 1]?.name ?? ''}`}
                    className="min-h-[180px] md:min-h-[350px]"
                  >
                    {renderStep()}
                  </div>
                </Card>

                {/* Mobile vehicle summary (above trust signals on small screens) */}
                {currentStep >= 3 && formData.manufacturer && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-sm lg:hidden">
                    <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="text-primary font-medium truncate">
                      {formData.manufacturer} {formData.model}
                      {formData.year ? ` · ${formData.year}` : ''}
                    </span>
                  </div>
                )}

                {/* Mobile Trust Signals (hidden on desktop where sidebar is visible).
                    flex-wrap avoids overflow on 320px screens. */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground lg:hidden py-2">
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

                {/* Navigation Buttons — desktop inline, mobile sticky bottom */}
                <div className="hidden sm:flex gap-4 justify-between">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handlePrevious}
                    disabled={currentStep === 1}
                    className="min-h-[48px]"
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
                        className="gradient-hero hover:gradient-hero-hover min-h-[52px] text-base"
                      >
                        {isSubmitting ? "Wird gesendet..." : "Kostenloses Angebot anfordern"}
                        <Check className="w-4 h-4 ml-2" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="lg"
                      onClick={handleNext}
                      className="gradient-hero hover:gradient-hero-hover min-h-[52px] text-base"
                    >
                      {getNextButtonLabel()}
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Sidebar - 1/3 width on desktop, hidden on mobile */}
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
                        ? "Fast geschafft – Verkaufsweg, Preis und Telefon"
                        : currentStep === 8
                        ? (formData.saleChannel === "station"
                            ? "Letzter Schritt – Standort & Konto!"
                            : "Vorletzter Schritt – Standort & Konto")
                        : "Letzter Schritt – Vermarktung bestätigen!"}                 </span>
                  </div>
                </Card>
              </div>
            </div>

            {/* Help Text */}
            <div className="mt-8 pb-24 sm:pb-8 text-center text-sm text-muted-foreground">
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

      {/* Mobile sticky bottom navigation.
          Layout-Pattern (Typeform/Stripe-Checkout): primary CTA full-width,
          back action as a small text-link above. Avoids the unbalanced
          tiny-arrow + huge-button look and prevents collision with the
          floating WhatsApp bubble (which is also hidden on this route). */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t shadow-lg px-3 pt-2 pb-3 safe-bottom sm:hidden">
        {currentStep > 1 && (
          <div className="flex justify-center mb-1.5">
            <button
              type="button"
              onClick={handlePrevious}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Zurück
            </button>
          </div>
        )}
        {isLastStep ? (
          <>
            <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="gradient-hero hover:gradient-hero-hover w-full min-h-[48px] text-base"
            >
              {isSubmitting ? "Wird gesendet..." : "Angebot anfordern"}
              <Check className="w-4 h-4 ml-2" />
            </Button>
          </>
        ) : (
          <Button
            size="lg"
            onClick={handleNext}
            className="gradient-hero hover:gradient-hero-hover w-full min-h-[48px] text-base"
          >
            {getNextButtonLabel()}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </PageLayout>
  );
};

export default VerkaufenWizard;
