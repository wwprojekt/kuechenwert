import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FunnelShell } from "@/components/funnel/funnel-shell";
import { submitFunnelA, trackFunnelALead } from "@/features/funnel-a/api";
import { ContactStep } from "@/features/funnel-a/components/ContactStep";
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
import type { ValidContact } from "@/features/funnel-a/validation";
import { ApiError, errorMessage } from "@/features/marketplace/api-client";
import { useTurnstile } from "@/hooks/useTurnstile";

const THANK_YOU_PATH = "/funnel/danke?funnel=a";

/**
 * Funnel A v2: ein Schritt pro URL, Antworten im sessionStorage (useFunnelA).
 * Absenden über kw-lead; danach Projektseite bzw. Danke-Seite.
 */
export function FunnelAClient({ slug }: { slug: FunnelAStepSlug }) {
  const navigate = useNavigate();
  const { answers, contact, setAnswer, patchContact, clear } = useFunnelA();
  const { turnstileToken, resetTurnstile, turnstileCallbackRef } = useTurnstile();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const step = findStep(slug);
  const index = stepIndex(slug);
  const prevSlug = index > 0 ? FUNNEL_A_SLUGS[index - 1] : undefined;
  const nextSlug = index < FUNNEL_A_SLUGS.length - 1 ? FUNNEL_A_SLUGS[index + 1] : undefined;
  const missingSlug = firstMissingStep(answers);

  const goTo = useCallback((target: FunnelAStepSlug) => navigate(stepPath(target)), [navigate]);
  const goNext = useCallback(() => {
    if (nextSlug) goTo(nextSlug);
  }, [goTo, nextSlug]);
  const goBack = useCallback(() => {
    if (prevSlug) goTo(prevSlug);
  }, [goTo, prevSlug]);

  // Fotos des nächsten Schritts vorladen, damit die Kacheln sofort vollständig erscheinen.
  useEffect(() => {
    if (!nextSlug) return;
    for (const src of stepImages(findStep(nextSlug))) {
      const image = new Image();
      image.src = src;
    }
  }, [nextSlug]);

  const handleSubmit = async (valid: ValidContact, website: string) => {
    if (missingSlug) {
      goTo(missingSlug);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitFunnelA({ answers, contact: valid, turnstileToken, website });
      clear();
      // Ohne Token (Honeypot) gibt es keinen Lead – also auch keine Conversion.
      if (!result.project_token) {
        navigate(THANK_YOU_PATH, { replace: true });
        return;
      }
      await trackFunnelALead(valid, answers);
      navigate(`/projekt/${result.project_token}?neu=1`, { replace: true });
    } catch (err) {
      // Lead angelegt, nur der Projektlink fehlt: Den verschickt der Server per E-Mail.
      if (err instanceof ApiError && err.code === "project_link") {
        clear();
        await trackFunnelALead(valid, answers);
        navigate(THANK_YOU_PATH, { replace: true });
        return;
      }
      setSubmitError(errorMessage(err));
      resetTurnstile();
      setSubmitting(false);
    }
  };

  const nextLabel = step.kind === "choice" && !step.required && !isStepAnswered(step, answers) ? "Überspringen" : "Weiter";

  return (
    <FunnelShell
      currentStep={index}
      totalSteps={FUNNEL_A_SLUGS.length}
      eyebrow={step.eyebrow}
      question={step.question}
      hint={step.hint}
      onBack={goBack}
      onNext={step.kind === "contact" ? undefined : goNext}
      canProceed={canLeaveStep(step, answers)}
      nextLabel={nextLabel}
    >
      {step.kind === "contact" ? (
        <ContactStep
          contact={contact}
          onChange={patchContact}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={submitError}
          turnstileRef={turnstileCallbackRef}
          missing={missingSlug ? { label: findStep(missingSlug).eyebrow, onFix: () => goTo(missingSlug) } : null}
        />
      ) : (
        <StepContent step={step} answers={answers} onAnswer={setAnswer} onAdvance={goNext} />
      )}
    </FunnelShell>
  );
}
