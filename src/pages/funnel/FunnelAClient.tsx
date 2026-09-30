import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FunnelShell } from "@/components/funnel/funnel-shell";
import { submitFunnelA, trackFunnelALead } from "@/features/funnel-a/api";
import { CONTACT_FORM_ID, ContactStep } from "@/features/funnel-a/components/ContactStep";
import { NAME_FORM_ID, NameStep } from "@/features/funnel-a/components/NameStep";
import { StepContent } from "@/features/funnel-a/components/StepContent";
import { useFunnelA } from "@/features/funnel-a/state";
import {
  FUNNEL_A_SLUGS,
  canLeaveStep,
  findStep,
  firstMissingStep,
  isStepAnswered,
  stepImages,
  stepIndex,
  stepPath,
  type FunnelAStepSlug,
} from "@/features/funnel-a/steps";
import { validateContact, type ContactErrors, type ValidContact } from "@/features/funnel-a/validation";
import { ApiError, errorMessage } from "@/features/marketplace/api-client";
import { storeProjectToken } from "@/features/marketplace/project-token";
import { useFunnelTelemetry } from "@/hooks/useFunnelTelemetry";
import { useTurnstile } from "@/hooks/useTurnstile";
import { getConsentedClickIds } from "@/lib/clickIdService";
import { trackFunnelStep, trackFunnelSubmitError } from "@/lib/funnelAnalytics";
import { trackLeadThankYou } from "@/lib/funnelThankYou";
import { clearSubmissionId, submissionIdFor } from "@/lib/submissionId";

const THANK_YOU_PATH = "/funnel/danke?funnel=a";

/**
 * Funnel A v2: ein Schritt pro URL, Antworten im sessionStorage (useFunnelA).
 * Absenden über kw-lead; danach Projektseite bzw. Danke-Seite.
 */
export function FunnelAClient({ slug }: { slug: FunnelAStepSlug }) {
  const navigate = useNavigate();
  const { answers, contact, setAnswer, patchContact, clear } = useFunnelA();
  const { waitForToken, resetTurnstile, turnstileCallbackRef } = useTurnstile();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameAttempted, setNameAttempted] = useState(false);

  const step = findStep(slug);
  const index = stepIndex(slug);
  const prevSlug = index > 0 ? FUNNEL_A_SLUGS[index - 1] : undefined;
  const nextSlug = index < FUNNEL_A_SLUGS.length - 1 ? FUNNEL_A_SLUGS[index + 1] : undefined;
  const missingSlug = firstMissingStep(answers);
  const telemetry = useFunnelTelemetry({
    funnel: "a",
    step: slug,
    stepIndex: index,
    stepLabel: step.eyebrow,
    totalSteps: FUNNEL_A_SLUGS.length,
  });

  const contactCheck = validateContact(contact);
  const nameErrors: ContactErrors = contactCheck.ok
    ? {}
    : { first_name: contactCheck.errors.first_name, last_name: contactCheck.errors.last_name };
  const nameValid = !nameErrors.first_name && !nameErrors.last_name;

  useEffect(() => {
    trackFunnelStep("a", slug, index, FUNNEL_A_SLUGS.length);
    setSubmitError(null);
  }, [slug, index]);

  const goTo = useCallback((target: FunnelAStepSlug) => navigate(stepPath(target)), [navigate]);
  const goNext = useCallback(() => {
    if (!nextSlug) return;
    telemetry.next();
    goTo(nextSlug);
  }, [goTo, nextSlug, telemetry]);
  const goBack = useCallback(() => {
    if (!prevSlug) return;
    telemetry.back();
    goTo(prevSlug);
  }, [goTo, prevSlug, telemetry]);

  const submitName = () => {
    setNameAttempted(true);
    if (!nameValid) {
      telemetry.validationFailed(Object.keys(nameErrors).filter((k) => nameErrors[k as keyof ContactErrors]));
      document.getElementById(nameErrors.first_name ? "kontakt-first_name" : "kontakt-last_name")?.focus();
      return;
    }
    goNext();
  };

  // Fotos des nächsten Schritts vorladen, damit die Kacheln sofort vollständig erscheinen.
  useEffect(() => {
    if (!nextSlug) return;
    for (const src of stepImages(findStep(nextSlug))) {
      const image = new Image();
      image.src = src;
    }
  }, [nextSlug]);

  const handleSubmit = async (valid: ValidContact, website: string) => {
    telemetry.submitClicked();
    if (missingSlug) {
      telemetry.validationFailed([missingSlug]);
      goTo(missingSlug);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const turnstileToken = await waitForToken();
      const result = await submitFunnelA({
        answers,
        contact: valid,
        turnstileToken,
        website,
        submissionId: submissionIdFor("a"),
        clickIds: getConsentedClickIds(),
      });
      clear();
      clearSubmissionId("a");
      telemetry.submitSucceeded();
      // Ohne Token (Honeypot) gibt es keinen Lead – also auch keine Conversion.
      if (!result.project_token) {
        navigate(THANK_YOU_PATH, { replace: true });
        return;
      }
      await trackFunnelALead(valid, answers);
      trackLeadThankYou("a");
      storeProjectToken(result.project_token);
      navigate("/projekt?neu=1", { replace: true });
    } catch (err) {
      // Lead angelegt, nur der Projektlink fehlt: Den verschickt der Server per E-Mail.
      if (err instanceof ApiError && err.code === "project_link") {
        clear();
        clearSubmissionId("a");
        telemetry.submitSucceeded();
        await trackFunnelALead(valid, answers);
        navigate(THANK_YOU_PATH, { replace: true });
        return;
      }
      const reason = err instanceof ApiError ? err.code ?? `http_${err.status}` : "network";
      trackFunnelSubmitError("a", reason);
      telemetry.submitFailed(reason);
      setSubmitError(errorMessage(err));
      resetTurnstile();
      setSubmitting(false);
    }
  };

  const nextLabel = step.kind === "choice" && !step.required && !isStepAnswered(step, answers) ? "Überspringen" : "Weiter";
  const blockedHint = step.kind === "plz" ? "Bitte geben Sie Ihre fünfstellige Postleitzahl ein." : "Bitte wählen Sie eine Antwort aus.";
  const submit =
    step.kind === "contact"
      ? { form: CONTACT_FORM_ID, label: "Kostenlos Angebote erhalten", busy: submitting, busyLabel: "Wird gesendet …" }
      : step.kind === "name"
        ? { form: NAME_FORM_ID, label: "Weiter", busy: false, busyLabel: "" }
        : undefined;

  return (
    <FunnelShell
      currentStep={index}
      totalSteps={FUNNEL_A_SLUGS.length}
      question={step.question}
      hint={step.hint}
      hintAlways={step.kind === "plz"}
      onBack={goBack}
      onNext={submit ? undefined : goNext}
      canProceed={canLeaveStep(step, answers)}
      blockedHint={blockedHint}
      onBlocked={() => telemetry.validationFailed([step.kind === "contact" || step.kind === "name" ? slug : step.field])}
      nextLabel={nextLabel}
      submit={submit}
      error={step.kind === "contact" ? submitError : null}
    >
      {step.kind === "contact" ? (
        <ContactStep
          contact={contact}
          onChange={patchContact}
          onSubmit={handleSubmit}
          onInvalid={(fields) => {
            telemetry.submitClicked();
            telemetry.validationFailed(fields);
          }}
          onMissingName={() => {
            setNameAttempted(true);
            goTo("name");
          }}
          submitting={submitting}
          turnstileRef={turnstileCallbackRef}
          missing={missingSlug ? { label: findStep(missingSlug).eyebrow, onFix: () => goTo(missingSlug) } : null}
        />
      ) : step.kind === "name" ? (
        <NameStep contact={contact} onChange={patchContact} errors={nameAttempted ? nameErrors : {}} onSubmit={submitName} />
      ) : (
        <StepContent step={step} answers={answers} onAnswer={setAnswer} onAdvance={goNext} />
      )}
    </FunnelShell>
  );
}
