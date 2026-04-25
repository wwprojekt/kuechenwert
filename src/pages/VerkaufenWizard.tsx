import { useState, useEffect, useRef } from "react";
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
import { useWizardTelemetry } from "@/hooks/useWizardTelemetry";

// Wizard-Schritte – einheitlich 8 Steps für alle Verkaufswege.
//
// Der Marketingphasen-Consent (AGB §6 / § 305c BGB) ist als kompakte
// Pflicht-Checkbox am Ende von Step 8 (AccountLocationStep) integriert,
// nur sichtbar für sale_channel ∈ {auction, instant_price}. Für 'station'
// existiert keine Marketingphase und damit auch keine Consent-Pflicht.
const STEPS = [
  { id: 1, name: "Fahrzeugtyp", description: "Was möchten Sie verkaufen?" },
  { id: 2, name: "Fahrzeugdaten", description: "Hersteller, Modell & mehr" },
  { id: 3, name: "Einschätzung", description: "Bessere Angebote erhalten" },
  { id: 4, name: "Details & Ausstattung", description: "Bessere Angebote erhalten" },
  { id: 5, name: "Kontakt", description: "Ihre Kontaktdaten" },
  { id: 6, name: "Fotos", description: "Verkaufschancen erhöhen" },
  { id: 7, name: "Verkaufsweg & Telefon", description: "Wie möchten Sie verkaufen?" },
  { id: 8, name: "Standort & Konto", description: "Letzter Schritt vor der Vermarktung" },
];

const VerkaufenWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [searchParams] = useSearchParams();
  const { formData, updateFormData, hydrateFormData, validateStep, validatePassword, submitForm, isSubmitting, fieldErrors, clearFieldErrors, getLastValidationErrorKeys } = useWizardForm();
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

  // Static 8-step list – Marketingphasen-Consent ist Inline-Checkbox in Step 8
  // statt eigener Step (siehe AccountLocationStep + step8Schema).
  const steps = STEPS;

  // Wizard-root-Container fuer delegiertes focusin/focusout-Listening der
  // neuen Telemetrie. Wir haengen den Ref an das <div role="region"> rund
  // um {renderStep()}, damit alle Inputs aller Steps automatisch erfasst
  // werden, ohne dass jede Step-Komponente angepasst werden muss.
  const wizardRootRef = useRef<HTMLDivElement | null>(null);
  const telemetry = useWizardTelemetry({
    sessionId,
    currentStep,
    totalSteps: STEPS.length,
    rootRef: wizardRootRef,
  });

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

    // Merge restored form data once. `hydrateFormData` macht einen pro-Feld-
    // Merge mit User-Edit-Schutz: Felder, die der User in der Zwischenzeit
    // bereits angefasst hat (z. B. weil er schneller war als der Supabase-
    // Round-Trip), werden NICHT überschrieben. Vorher führte das zu einem
    // „Bitte wählen Sie eine Aufbauart"-Fehler, obwohl der User längst eine
    // ausgewählt hatte (Race zwischen Klick und async Hydration).
    if (restoredFormData && !hasMergedRestoredRef.current) {
      hydrateFormData(restoredFormData);
      hasMergedRestoredRef.current = true;
    }

    if (!hasRestoredRef.current && initialStep && initialStep >= 1) {
      // Clamp gegen Alt-Sessions aus dem 9-Step-Refactor (2026-04-20):
      // Wenn ein User damals auf Step 9 abgebrochen ist, hat die DB
      // current_step=9. Heute gibt es nur noch 8 Steps – wir landen den User
      // sicher auf Step 8, der seinen Marketing-Consent jetzt inline enthält.
      const safeStep = Math.min(initialStep, STEPS.length);
      // Step-Restore-Race-Schutz: Wenn der User bereits manuell weitergeklickt
      // hat (currentStep != 1), darf der späte Hydration-Restore ihn nicht
      // zurückwerfen. Das passiert sonst bei Usern, die schnell genug klicken
      // bevor der Supabase-Fetch zurückkommt – sie würden ungewollt zurück
      // auf den alten Step springen und ihren Step-Fortschritt verlieren.
      if (currentStep === 1 && safeStep !== 1) {
        setCurrentStep(safeStep);
      }
      hasRestoredRef.current = true;
    }

    // Mark hydration as done so the step-guard can run without false-positives.
    setIsHydrated(true);
    // currentStep absichtlich nicht in deps: Wir wollen NICHT, dass spätere
    // Step-Wechsel diesen Effect re-triggern – die Refs (hasMergedRestoredRef,
    // hasRestoredRef) gewährleisten Single-Run-Semantik.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, initialStep, restoredFormData, hydrateFormData]);

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
    
    // Der `?step=N` URL-Parameter wird BEWUSST nicht mehr hier gesetzt.
    // Vorher fuehrte das zu „Geister-Sessions": Beim Klick auf einen
    // Cross-Device-Resume-Link (?step=7&...) sprang die UI sofort auf
    // Step 7 und der Auto-Save persistierte max_step_reached=7 mit
    // leerer formData, BEVOR der Step-Guard die Daten validieren konnte.
    // Im Admin-Lead-Funnel erschienen daraufhin Leads ohne Name, Email,
    // Telefon, ohne Fahrzeugdaten — als waeren sie auf Step 7 abgebrochen.
    //
    // Ab jetzt wird `?step=N` erst nach `isReady` ausgewertet und nur
    // dann angewendet, wenn KEINE Session aus der DB restored wurde
    // (siehe separater useEffect weiter unten). Recovery-Mails verlinken
    // ausserdem nicht mehr mit ?step=, sondern mit ?token=<resume_token>
    // — der Token-Lookup im Hook setzt `initialStep` direkt aus
    // `session.current_step`.

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
    // direkt zu Step 2 oder 3 springen (Fahrzeugdaten vervollständigen).
    //
    // Wohnwagen haben KEIN mileage-Feld (kein Motor/Tacho) — step2SchemaWohnwagen
    // verlangt es explizit nicht (siehe useWizardForm.ts), und DetailsStep
    // rendert das Mileage-Input nur für Wohnmobile. Daher wird mileage NUR
    // für Wohnmobile als Pflicht für den Step-3-Jump gefordert. Ohne diese
    // Differenzierung landeten Wohnwagen-Wertrechner-Leads immer nur auf
    // Step 2, obwohl ihre Daten vollständig waren — ein unnötiger Extra-Klick.
    if (source === 'wertrechner' && bodyType && !hasRestoredRef.current) {
      const isWohnwagenLead = (vehicleTypeParam || '').toLowerCase() === 'wohnwagen';
      const hasCompleteBasics = manufacturer && model && year && condition && (isWohnwagenLead || mileage);
      if (hasCompleteBasics) {
        setCurrentStep(3);
      } else {
        setCurrentStep(2);
      }
      hasRestoredRef.current = true;
    }
  }, [searchParams, updateFormData]);

  // Fallback-Resume aus altem `?step=N` URL-Parameter — laeuft NACH der
  // Session-Hydration. Wenn die Session-Restore (initialStep) bereits einen
  // Step gesetzt hat oder der User schon manuell weitergeklickt ist, wird
  // dieser Pfad uebersprungen. Verhindert Geister-Sessions (siehe Migration
  // 20260421140000_wizard_resume_token.sql).
  useEffect(() => {
    if (!isReady) return;
    if (hasRestoredRef.current) return;
    if (initialStep && initialStep > 1) return;

    const resumeStep = searchParams.get('step');
    if (!resumeStep) return;

    const stepNum = parseInt(resumeStep, 10);
    if (!Number.isFinite(stepNum) || stepNum < 1) return;

    // Clamp gegen Alt-Resume-Mails (z.B. ?step=9 aus dem 9-Step-Refactor 2026-04-20).
    const safeStep = Math.min(stepNum, STEPS.length);

    // Cap auf das, was die geladene formData wirklich stuetzt — so wird ein
    // alter `?step=7`-Link in einer leeren Session nie auf Step 7 gesetzt
    // (was die Geister-Sessions produziert hatte). Spiegelt die Logik des
    // Step-Guards weiter unten und der `effectiveMaxStep`-Funktion im Hook.
    const dataMax = !formData.bodyType
      ? 1
      : (!formData.manufacturer || !formData.model || !formData.year)
        ? 2
        : (!formData.customerName || !formData.customerEmail)
          ? 5
          : !formData.saleChannel
            ? 7
            : STEPS.length;
    const finalStep = Math.min(safeStep, dataMax);

    if (currentStep === 1 && finalStep > 1) {
      setCurrentStep(finalStep);
      hasRestoredRef.current = true;
    }
    // currentStep absichtlich nicht in deps — wir wollen diesen Restore nur
    // einmal nach Hydration anstossen, nicht bei jedem Step-Wechsel. Die
    // formData-Felder MUESSEN in den deps stehen, damit der Effect nach der
    // asynchronen Hydratisierung ein zweites Mal mit dem aktuellen Stand
    // laeuft und finalStep korrekt clampen kann.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isReady,
    initialStep,
    searchParams,
    formData.bodyType,
    formData.manufacturer,
    formData.model,
    formData.year,
    formData.customerName,
    formData.customerEmail,
    formData.saleChannel,
  ]);

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
    // Telefon ist Pflicht ab Step 8. Wir prüfen hier sowohl auf "leer" als
    // auch auf "syntaktisch unbrauchbar" (mind. 6 Ziffern, gültiges Format).
    // Sonst landet der User auf Step 8, klickt Submit, bekommt einen Toast
    // "Telefonnummer ungültig", sieht aber kein Phone-Feld weil das nur
    // auf Step 7 sichtbar ist – und ist verwirrt. Lieber direkt zurück
    // zu dem Step der das Phone-Feld zeigt.
    const phone = formData.customerPhone?.trim() ?? "";
    const phoneValid =
      phone.length >= 5 &&
      /^[+()\d\s\-/.]{6,}$/.test(phone) &&
      (phone.match(/\d/g) || []).length >= 6;
    if (!phoneValid && currentStep > 7) {
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

  // Auto-save progress (debounced inside the hook).
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
  const progressMap: Record<number, number> = { 1: 12, 2: 25, 3: 37, 4: 50, 5: 62, 6: 75, 7: 87, 8: 100 };
  const progress = progressMap[currentStep] || (currentStep / steps.length) * 100;

  // Scroll to the first invalid field after a failed validation. We wait one
  // animation frame so the field-error CSS classes are rendered first, then
  // pick whichever marker exists: aria-invalid, role=alert, or any of the
  // red-border conventions used across wizard steps.
  // Without this, the validation toast pops up but the actual error (e.g. the
  // marketing-consent checkbox 600px down on step 8) stays off-screen and
  // confuses the user.
  //
  // Selector covers:
  //   - aria-invalid="true"        a11y-conform (set in step 8 + step 5)
  //   - role="alert"               error message paragraphs (marketing consent)
  //   - .border-red-500            steps 2, 7, 8 input fields on error
  //   - .border-destructive        step 5 (QuickContactStep) input fields
  // We scope to the wizard container to avoid catching stale UI from other
  // areas of the page (e.g. status badges in the sidebar). The Card with
  // role="region" wraps every step's content.
  const scrollToFirstError = () => {
    requestAnimationFrame(() => {
      const wizardRoot =
        (document.querySelector('[role="region"][aria-live="polite"]') as HTMLElement | null) ?? document;
      const target = wizardRoot.querySelector(
        '[aria-invalid="true"], [role="alert"], .border-red-500, .border-destructive',
      ) as HTMLElement | null;
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable =
          target.tagName === "INPUT" || target.tagName === "BUTTON"
            ? target
            : (target.querySelector('input, button, [tabindex]:not([tabindex="-1"])') as HTMLElement | null);
        focusable?.focus({ preventScroll: true });
      }
    });
  };

  const handleNext = async () => {
    telemetry.logNextClicked();
    const isValid = await validateStep(currentStep);
    if (!isValid) {
      telemetry.logValidationFailed(getLastValidationErrorKeys());
      scrollToFirstError();
      return;
    }
    if (currentStep < steps.length) {
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
      telemetry.logBackClicked();
      clearFieldErrors();
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    telemetry.logSubmitClicked();
    // Validate the final step (8). step8Schema enthält den Marketing-Consent
    // bereits als conditional Pflichtfeld für auction + instant_price.
    const isValid = await validateStep(steps.length);
    if (!isValid) {
      telemetry.logValidationFailed(getLastValidationErrorKeys());
      scrollToFirstError();
      return;
    }

    // Additional password validation for guest submissions. If the user is
    // logged in we skip this – their password is already set.
    // validatePassword already shows its own toast with the exact error, so
    // we just bail out on failure.
    if (!currentUser) {
      const passwordValid = validatePassword(registerPassword, confirmPassword);
      if (!passwordValid) {
        telemetry.logValidationFailed(["registerPassword", "confirmPassword"]);
        scrollToFirstError();
        return;
      }
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
      telemetry.logSubmitSucceeded();
      await markCompleted();
      // Google Ads trackWizardCompleted() wird bereits in useWizardForm.ts aufgerufen
      // (mit korrekter Transaction ID für Deduplizierung).
      // Ein zweiter Aufruf hier würde eine Doppel-Conversion mit neuer Transaction ID erzeugen.
      // Meta Pixel: Lead Event bei Wizard-Abschluss
      const vehicleInfo = `${formData.manufacturer || ''} ${formData.model || ''} (${formData.year || ''}) - ${formData.bodyType || ''}`;
      trackMetaLead({ content_name: vehicleInfo, content_category: 'Wohnmobil-Verkauf' });
    } else {
      telemetry.logSubmitFailed();
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
      default:
        return null;
    }
  };

  // Step indicator labels for compact progress bar
  const isLastStep = currentStep === steps.length;

  // Contextual button labels – tell users what's next to reduce uncertainty.
  // Step 8 ist der finale Submit-Step → Label kommt hier nicht zum Einsatz
  // (isLastStep rendert stattdessen den Submit-Button mit eigenem Text).
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
            {/* Progress Indicator with step dots.
                Auf Mobile/Tablet zeigen wir zusätzlich den aktuellen Step-Namen
                links — vorher gab es nur "%" + Dots, was Nutzer zwang, Dots zu
                zählen, um zu wissen, wo sie stehen. Auf Desktop steht der
                Step-Name ohnehin in der Sidebar, daher dort kein Duplikat. */}
            <div className="mb-2 sm:mb-4 md:mb-6 animate-slide-up">
              <div className="flex justify-between items-center mb-1 gap-3 lg:justify-end">
                <span className="text-xs sm:text-sm font-medium text-foreground/80 truncate lg:hidden">
                  Schritt {currentStep} von {steps.length}
                  {steps[currentStep - 1]?.name && (
                    <>
                      <span className="text-muted-foreground"> · </span>
                      <span className="text-foreground">{steps[currentStep - 1].name}</span>
                    </>
                  )}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-primary shrink-0">
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
                    ref={wizardRootRef}
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

                {/* Bot-Protection (Honeypot + Turnstile) – einmalig zentral
                    gerendert, damit beide CTA-Blöcke (Desktop hidden sm:flex
                    und Mobile sm:hidden Sticky-Bottom) auf denselben Token
                    bzw. Honeypot-State zugreifen. Vorher wurde HoneypotField
                    in beiden Blöcken gerendert -> duplicate id="hp_website"
                    im DOM. Turnstile war zudem nur im Desktop-Block, sodass
                    Mobile-User effektiv ohne Cloudflare-Bot-Schutz
                    submitteten (Honeypot allein blieb wirksam). */}
                {isLastStep && (
                  <div className="mt-2">
                    <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
                    <div ref={turnstileCallbackRef} className="flex justify-center" />
                  </div>
                )}

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
                    <Button
                      size="lg"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="gradient-hero hover:gradient-hero-hover min-h-[52px] text-base"
                    >
                      {isSubmitting ? "Wird gesendet..." : "Kostenloses Angebot anfordern"}
                      <Check className="w-4 h-4 ml-2" />
                    </Button>
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
                        ? (currentUser ? "Bitte bestätigen Sie Ihre Kontaktdaten" : "Name, E-Mail und optional Telefon für schnelle Rückfragen")
                        : currentStep === 6
                        ? "Fotos erhöhen Ihre Verkaufschancen enorm!"
                        : currentStep === 7
                        ? "Fast geschafft – Verkaufsweg, Preis und Telefon"
                        : "Letzter Schritt – Standort & Konto!"}                 </span>
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
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gradient-hero hover:gradient-hero-hover w-full min-h-[48px] text-base"
          >
            {isSubmitting ? "Wird gesendet..." : "Angebot anfordern"}
            <Check className="w-4 h-4 ml-2" />
          </Button>
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
