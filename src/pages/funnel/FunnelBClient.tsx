import { BadgeEuro, Clock3, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FunnelFrame } from "@/components/funnel/funnel-frame";
import { FunnelTrustStrip } from "@/components/funnel/funnel-shell";
import { submitFunnelB } from "@/features/funnel-b/api";
import { loadFunnelB, serializeFunnelB, submissionFields, FUNNEL_B_STORAGE_KEY, type FunnelBData } from "@/features/funnel-b/state";
import { funnelBFlow, funnelBStep, guardFunnelBStep, isSkippable, missingIn, parseFunnelBStep, type FunnelBStepKey } from "@/features/funnel-b/steps";
import { ConsentStep, ContactStep, NameStep, PlzCityStep } from "@/features/funnel-b/steps/ContactSteps";
import {
  AppliancesStep,
  BrandStep,
  DownPaymentStep,
  ExtrasStep,
  FrontStep,
  HandleStep,
  NotesStep,
  PaymentStep,
  SinkBrandStep,
  SinkStep,
  WorktopNameStep,
  WorktopStep,
} from "@/features/funnel-b/steps/DetailSteps";
import {
  DetailsChoiceStep,
  DocumentsChoiceStep,
  KitchenFormStep,
  OfferIncludesStep,
  PriceStep,
  TimeframeStep,
  UploadStep,
} from "@/features/funnel-b/steps/OfferSteps";
import { ApiError, errorMessage } from "@/features/marketplace/api-client";
import { useFunnelTelemetry } from "@/hooks/useFunnelTelemetry";
import { useSupportPhone } from "@/hooks/useSupportPhone";
import { useTurnstile } from "@/hooks/useTurnstile";
import { getConsentedClickIds } from "@/lib/clickIdService";
import { trackFunnelStep, trackFunnelSubmitError } from "@/lib/funnelAnalytics";
import { generateTransactionId, setEnhancedConversionFromForm, trackKitchenFunnelLead } from "@/lib/gadsConversionService";
import { trackMetaLead } from "@/lib/metaPixelService";
import { clearSubmissionId, submissionIdFor } from "@/lib/submissionId";
import { getEntryPath, getStoredUtm } from "@/lib/utm";

const TRUST = [
  { icon: BadgeEuro, label: "Kostenlos & unverbindlich" },
  { icon: Clock3, label: "In ca. 3 Minuten fertig" },
  { icon: ShieldCheck, label: "Nur freigeschaltete Küchenstudios" },
];

/**
 * Funnel B („Angebot unterbieten“): eine Frage pro Bildschirm, Schritt in
 * ?schritt=<schlüssel>. Detailfragen nur auf Wunsch; Absenden über kw-lead-b,
 * danach Dateien über signierte URLs und die Danke-Seite.
 */
export default function FunnelBClient() {
  const navigate = useNavigate();
  const phone = useSupportPhone();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<FunnelBData>(loadFunnelB);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [blocked, setBlocked] = useState<string | null>(null);
  const { waitForToken, resetTurnstile, turnstileCallbackRef } = useTurnstile();

  const requested = parseFunnelBStep(searchParams.get("schritt"));
  const guarded = guardFunnelBStep(requested, data);
  const flow = useMemo(() => funnelBFlow(data), [data]);
  // Ein Schritt, der im aktuellen Pfad nicht vorkommt (z. B. Details bei „Nein“), führt zum nächsten passenden.
  const step: FunnelBStepKey = flow.includes(guarded) ? guarded : (flow.find((k) => k === "plz") ?? "preis");
  const index = Math.max(0, flow.indexOf(step));
  const total = flow.length;
  const def = funnelBStep(step);

  const goToStep = useCallback(
    (next: FunnelBStepKey, replace = false) => {
      setBlocked(null);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === "preis") params.delete("schritt");
          else params.set("schritt", next);
          return params;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (step !== requested) goToStep(step, true);
  }, [step, requested, goToStep]);

  const telemetry = useFunnelTelemetry({ funnel: "b", step, stepIndex: index, stepLabel: def.question, totalSteps: total });

  useEffect(() => {
    trackFunnelStep("b", step, index, total);
    setSubmitError(null);
  }, [step, index, total]);

  useEffect(() => {
    try {
      sessionStorage.setItem(FUNNEL_B_STORAGE_KEY, serializeFunnelB(data));
    } catch {
      /* quota / privacy mode */
    }
  }, [data]);

  const update = useCallback((patch: Partial<FunnelBData>) => setData((prev) => ({ ...prev, ...patch })), []);
  const hasProgress = step !== "preis" || Number(data.existingOfferPriceEur) > 0 || data.uploads.length > 0;

  // Auto-Weiter feuert kurz nach der Auswahl: dann gelten Stand und Pfad von jetzt, nicht vom Klick.
  const latest = useRef({ step, data });
  latest.current = { step, data };

  const submit = useCallback(async () => {
    const current = latest.current.data;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const turnstileToken = await waitForToken();
      setUploadProgress(current.uploads.length > 0 ? { done: 0, total: current.uploads.length } : null);
      const { failedUploads, studiosInArea, reviewRequired } = await submitFunnelB({
        data: submissionFields(current),
        uploads: current.uploads,
        onUploadProgress: (done, count) => setUploadProgress({ done, total: count }),
        turnstileToken,
        website: honeypot,
        submissionId: submissionIdFor("b"),
        clickIds: getConsentedClickIds(),
        utm: getStoredUtm(),
        landingPage: getEntryPath() ?? window.location.pathname,
      });
      clearSubmissionId("b");
      telemetry.submitSucceeded();
      try {
        sessionStorage.removeItem(FUNNEL_B_STORAGE_KEY);
      } catch {
        /* storage not available */
      }
      // Die Anfrage ist gespeichert: Tracking darf ab hier nichts mehr blockieren.
      try {
        await setEnhancedConversionFromForm({
          email: current.email,
          firstName: current.firstName,
          lastName: current.lastName,
          phone: current.phone,
          postalCode: current.postalCode,
        });
        await trackKitchenFunnelLead("b", generateTransactionId("funnel_b"));
        trackMetaLead({ content_name: "Funnel B", content_category: "Angebot unterbieten" });
      } catch (trackingError) {
        console.error("Funnel B tracking failed", trackingError);
      }
      if (failedUploads > 0) {
        toast.warning(
          "Ihre Anfrage ist angekommen, aber nicht alle Dateien konnten hochgeladen werden. Sie können sie über den Projektlink aus Ihrer E-Mail nachreichen.",
          { duration: 12000 },
        );
      }
      const thanks = new URLSearchParams({ funnel: "b" });
      if (studiosInArea !== null) thanks.set("studios", String(studiosInArea));
      if (reviewRequired) thanks.set("pruefung", "1");
      navigate(`/funnel/danke?${thanks.toString()}`, { replace: true });
    } catch (e) {
      console.error("Funnel B submit error", e);
      const reason = e instanceof ApiError ? e.code ?? `http_${e.status}` : "network";
      trackFunnelSubmitError("b", reason);
      telemetry.submitFailed(reason);
      resetTurnstile();
      // Prüffehler des Servers (4xx) sind verständlich formuliert; alles andere nicht.
      setSubmitError(
        e instanceof ApiError && e.status !== undefined && e.status >= 400 && e.status < 500
          ? errorMessage(e)
          : `Ihre Anfrage konnte gerade nicht gesendet werden. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es noch einmal. Klappt es weiterhin nicht, rufen Sie uns an: ${phone.display}.`,
      );
      setSubmitting(false);
      setUploadProgress(null);
    }
  }, [waitForToken, honeypot, telemetry, navigate, resetTurnstile, phone.display]);

  const handleNext = useCallback(() => {
    const { step: current, data: now } = latest.current;
    if (current === "einwilligung") telemetry.submitClicked();
    const missing = missingIn(current, now);
    if (missing.length > 0) {
      setBlocked(missing[0]!.message);
      telemetry.validationFailed(missing.map((m) => m.key));
      const el = document.getElementById(missing[0]!.target);
      (el?.matches("input, button, select, textarea") ? el : el?.querySelector<HTMLElement>("input, button, select, textarea"))?.focus();
      return;
    }
    if (current === "einwilligung") {
      void submit();
      return;
    }
    const path = funnelBFlow(now);
    const next = path[path.indexOf(current) + 1];
    if (!next) return;
    telemetry.next();
    goToStep(next);
  }, [telemetry, submit, goToStep]);

  const handleBack = useCallback(() => {
    const { step: current, data: now } = latest.current;
    const path = funnelBFlow(now);
    const prev = path[path.indexOf(current) - 1];
    if (!prev) return;
    telemetry.back();
    goToStep(prev);
  }, [telemetry, goToStep]);

  const skipDetails = () => {
    telemetry.next();
    goToStep("plz");
  };

  const props = { data, update, onAdvance: handleNext };
  const CONTENT: Record<FunnelBStepKey, ReactNode> = {
    preis: <PriceStep {...props} />,
    leistungsumfang: <OfferIncludesStep {...props} />,
    unterlagen: <DocumentsChoiceStep {...props} />,
    hochladen: <UploadStep {...props} />,
    kuechenform: <KitchenFormStep {...props} />,
    zeitrahmen: <TimeframeStep {...props} />,
    details: <DetailsChoiceStep {...props} />,
    marke: <BrandStep {...props} />,
    fronten: <FrontStep {...props} />,
    griffe: <HandleStep {...props} />,
    arbeitsplatte: <WorktopStep {...props} />,
    "arbeitsplatte-name": <WorktopNameStep {...props} />,
    geraete: <AppliancesStep {...props} />,
    spuele: <SinkStep {...props} />,
    "spuele-marke": <SinkBrandStep {...props} />,
    extras: <ExtrasStep {...props} />,
    notizen: <NotesStep {...props} />,
    zahlung: <PaymentStep {...props} />,
    anzahlung: <DownPaymentStep {...props} />,
    plz: <PlzCityStep {...props} />,
    name: <NameStep {...props} />,
    kontakt: <ContactStep {...props} />,
    einwilligung: <ConsentStep {...props} honeypot={honeypot} onHoneypot={setHoneypot} turnstileRef={turnstileCallbackRef} />,
  };

  const optionalEmpty = isSkippable(step, data);
  const progressHint = submitting && uploadProgress ? `Unterlagen werden hochgeladen … ${uploadProgress.done} von ${uploadProgress.total}` : null;

  return (
    <FunnelFrame
      stepKey={step}
      current={index}
      total={total}
      heading={def.question}
      hint={def.hint}
      hintAlways={step === "preis" || step === "kontakt"}
      guardExit={hasProgress}
      guardUnload={hasProgress}
      nav={{
        onBack: index > 0 ? handleBack : undefined,
        onNext: handleNext,
        nextLabel: step === "einwilligung" ? "Anfrage absenden" : optionalEmpty ? "Überspringen" : "Weiter",
        busy: submitting,
        busyLabel: progressHint ?? "Wird gesendet …",
        blockedHint: submitError ?? blocked,
      }}
      below={<FunnelTrustStrip items={TRUST} />}
    >
      {CONTENT[step]}
      {def.detail && (
        <button
          type="button"
          onClick={skipDetails}
          className="mt-3 inline-flex min-h-9 items-center text-sm font-medium text-primary underline-offset-4 hover:underline short:mt-2"
        >
          Details überspringen
        </button>
      )}
    </FunnelFrame>
  );
}
