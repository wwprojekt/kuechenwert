import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ApiError, errorMessage } from "@/features/marketplace/api-client";
import { getStoredProjectToken, storeProjectToken } from "@/features/marketplace/project-token";
import { setProjectAiConsent } from "@/features/marketplace/project-api";
import { useFunnelTelemetry } from "@/hooks/useFunnelTelemetry";
import { useTurnstile } from "@/hooks/useTurnstile";
import { getConsentedClickIds } from "@/lib/clickIdService";
import { trackFunnelStep, trackFunnelSubmitError, trackPlannerFeedback, trackPlannerRender } from "@/lib/funnelAnalytics";
import { trackLeadThankYou } from "@/lib/funnelThankYou";
import { generateTransactionId, setEnhancedConversionFromForm, trackKitchenFunnelLead } from "@/lib/gadsConversionService";
import { trackMetaLead } from "@/lib/metaPixelService";
import { getEntryPath, getStoredUtm } from "@/lib/utm";
import {
  generateRender,
  removePhoto,
  requestOffers,
  savePlanning,
  sendRenderFeedback,
  submitProject,
  uploadPhoto,
  type PlannerRender,
  type RenderFeedback,
} from "./api";
import { KITCHEN_FORMS, STYLES } from "./core";
import { roomWallIssues } from "./estimate-gate";
import { isPlannerStep, nextStep, plannerProgress, previousStep, stepDef, type PlannerStep } from "./flow";
import { plannerRenderKey } from "./render-key";
import { fromSessionRender, usePlanner, useRenderPolling } from "./state";
import { validateLead, type LeadContact, type LeadErrors } from "./steps/LeadSteps";
import type { OffersRequest } from "./components/RequestOffersDialog";
import type { RenderPhase } from "./components/RenderProgress";
import type { VariantRequest } from "./components/VariantPanel";

const CONTACT_KEY = "kw_planner_contact";
/** So lange steht der Lade-Bildschirm mindestens, bevor die Lead-Fragen kommen. */
const VISUALIZE_MIN_MS = 4500;

const EMPTY_CONTACT: LeadContact = { first_name: "", last_name: "", email: "", phone: "", contact_by_phone: false };

function readContact(): LeadContact {
  try {
    const raw = sessionStorage.getItem(CONTACT_KEY);
    return raw ? { ...EMPTY_CONTACT, ...(JSON.parse(raw) as Partial<LeadContact>) } : EMPTY_CONTACT;
  } catch {
    return EMPTY_CONTACT;
  }
}

const utm = () => getStoredUtm() as Record<string, string>;

/** Steuerung von Funnel C: Schritte über ?schritt=, Visualisierung im Hintergrund, Lead vor Küche und Preis. */
export function usePlannerFunnel() {
  const planner = usePlanner();
  const { state, estimate } = planner;
  const [searchParams, setSearchParams] = useSearchParams();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [showWallErrors, setShowWallErrors] = useState(false);
  const [contact, setContact] = useState<LeadContact>(readContact);
  const [leadErrors, setLeadErrors] = useState<LeadErrors>({});
  const [honeypot, setHoneypot] = useState("");
  const [offersDialog, setOffersDialog] = useState(false);
  const [offersBusy, setOffersBusy] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [aiGranted, setAiGranted] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const { waitForToken, resetTurnstile, turnstileCallbackRef } = useTurnstile();
  const wallIssues = useMemo(() => roomWallIssues(state.room), [state.room]);

  const flow = useMemo(() => ({ unlocked: state.submitted, wantsOffers: state.offersChoice === null ? null : state.offersChoice === "ja" }), [state.submitted, state.offersChoice]);
  const step = state.step;
  const progress = plannerProgress(step, flow);

  useEffect(() => {
    try {
      sessionStorage.setItem(CONTACT_KEY, JSON.stringify(contact));
    } catch {
      /* ohne Storage bleibt der Stand im Speicher */
    }
  }, [contact]);

  // --- Visualisierungen -----------------------------------------------------
  const rendersRef = useRef(state.renders);
  rendersRef.current = state.renders;
  const renderStartedAt = useRef(new Map<string, number>());
  const { updateRender } = planner;
  const onRenderUpdate = useCallback(
    (id: string, patch: Partial<PlannerRender>) => {
      updateRender(id, patch);
      const render = rendersRef.current.find((r) => r.id === id);
      if (!render || (patch.status !== "success" && patch.status !== "failed")) return;
      const started = renderStartedAt.current.get(id);
      trackPlannerRender({
        status: patch.status,
        mode: render.mode,
        variant: !!render.base_render_id,
        seconds: started ? Math.round((Date.now() - started) / 1000) : null,
      });
    },
    [updateRender],
  );
  useRenderPolling(state.sessionToken, state.renders, onRenderUpdate);

  const successRenders = state.renders.filter((r) => r.status === "success" && r.image_url);
  const activeRender =
    state.renders.find((r) => r.id === state.activeRenderId && (r.image_url || r.status === "pending")) ??
    successRenders[successRenders.length - 1] ??
    state.renders[state.renders.length - 1] ??
    null;
  const currentKey = plannerRenderKey(state.config, state.room, state.selectedPhotoPath);
  // Unbekannter Schlüssel (ältere Planungen): nicht als veraltet markieren.
  const activeOutdated = !!activeRender?.config_key && activeRender.config_key !== currentKey;
  const latest = state.renders[state.renders.length - 1] ?? null;
  const renderPhase: RenderPhase = generating && !latest
    ? "starting"
    : !latest
      ? genError
        ? "failed"
        : "idle"
      : latest.status === "pending"
        ? "pending"
        : latest.status === "success"
          ? "ready"
          : "failed";
  // Nach einem Neuladen ist der Start unbekannt: ab dem ersten Sehen zählen.
  if (latest?.status === "pending" && !renderStartedAt.current.has(latest.id)) renderStartedAt.current.set(latest.id, Date.now());
  const renderStarted = latest ? (renderStartedAt.current.get(latest.id) ?? null) : null;

  // --- Schritte über die URL ------------------------------------------------
  const { current: stepNumber, total: stepTotal } = progress;
  const telemetry = useFunnelTelemetry({
    funnel: "c",
    step,
    stepIndex: stepNumber,
    stepLabel: stepDef(step).label,
    totalSteps: stepTotal,
  });
  useEffect(() => {
    trackFunnelStep("c", step, stepNumber, stepTotal);
  }, [step, stepNumber, stepTotal]);

  const { patchConfig, setForm, goTo: setPlannerStep, confirmStep } = planner;
  // Einstiege wie /funnel/c?stil=landhaus&form=u einmalig übernehmen.
  useEffect(() => {
    const style = STYLES.find((s) => s.id === searchParams.get("stil"))?.id;
    const form = KITCHEN_FORMS.find((f) => f.id === searchParams.get("form"))?.id;
    if (!style && !form) return;
    if (style) patchConfig({ style });
    if (form) setForm(form);
    const next = new URLSearchParams(searchParams);
    next.delete("stil");
    next.delete("form");
    if (form && !next.has("schritt")) next.set("schritt", "masse");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, patchConfig, setForm]);

  const rawUrlStep = searchParams.get("schritt");
  const urlStep = rawUrlStep && isPlannerStep(rawUrlStep) ? rawUrlStep : null;
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  const writeUrl = useCallback(
    (target: PlannerStep, replace = false) => {
      const params = new URLSearchParams(searchParams);
      params.set("schritt", target);
      setSearchParams(params, { replace });
    },
    [searchParams, setSearchParams],
  );
  useEffect(() => {
    if (searchParams.has("stil") || searchParams.has("form")) return;
    if (!urlStep) {
      writeUrl(stepRef.current, true);
      return;
    }
    if (urlStep !== stepRef.current) setPlannerStep(urlStep);
  }, [urlStep, searchParams, writeUrl, setPlannerStep]);

  const navigate = useCallback(
    (target: PlannerStep, replace = false) => {
      setBlocked(null);
      setPlannerStep(target);
      stepRef.current = target;
      writeUrl(target, replace);
    },
    [setPlannerStep, writeUrl],
  );

  // Schritte, die ohne Vorbedingung keinen Sinn ergeben, auf den passenden Schritt lenken.
  useEffect(() => {
    const kind = stepDef(step).kind;
    if (state.submitted && kind === "lead") navigate("ergebnis", true);
    else if (!state.submitted && step === "ergebnis") navigate(state.renders.length ? "angebote" : "plz", true);
    else if (!state.submitted && kind === "lead" && !/^\d{5}$/.test(state.postalCode)) navigate("plz", true);
  }, [step, state.submitted, state.postalCode, state.renders.length, navigate]);

  // --- Aktionen -------------------------------------------------------------
  const generatingRef = useRef(false);
  const handleGenerate = useCallback(
    async (variant?: VariantRequest) => {
      if (generatingRef.current) return;
      generatingRef.current = true;
      setGenerating(true);
      setGenError(null);
      // Varianten ändern das gewählte Bild, solange es zur aktuellen Planung passt.
      const base = variant && activeRender?.status === "success" && !activeOutdated ? activeRender : null;
      try {
        const res = await generateRender({
          sessionToken: state.sessionToken,
          config: state.config,
          room: state.room,
          photoPath: state.selectedPhotoPath,
          postalCode: state.postalCode || null,
          variantHint: variant?.hint ?? null,
          variantLabel: variant?.label ?? null,
          baseRenderId: base?.id ?? null,
          provenance: state.answered,
          utm: utm(),
        });
        planner.setSession(res.session_token);
        // Läuft die Visualisierung schon, liefert der Server dieselbe render_id zurück.
        if (!rendersRef.current.some((r) => r.id === res.render_id)) {
          renderStartedAt.current.set(res.render_id, Date.now());
          planner.addRender({
            id: res.render_id,
            version: res.version,
            status: "pending",
            mode: res.mode,
            variant_label: variant?.label ?? null,
            image_url: null,
            feedback: null,
            base_render_id: res.base_render_id ?? null,
            config_key: currentKey,
          });
        } else {
          planner.setActiveRender(res.render_id);
        }
      } catch (err) {
        setGenError(errorMessage(err));
      } finally {
        generatingRef.current = false;
        setGenerating(false);
      }
    },
    [
      planner,
      state.sessionToken,
      state.config,
      state.room,
      state.selectedPhotoPath,
      state.postalCode,
      state.answered,
      activeRender,
      activeOutdated,
      currentKey,
    ],
  );

  // Lade-Bildschirm: mindestens kurz sichtbar, dann weiter zu den Lead-Fragen.
  const vizEntered = useRef<number | null>(null);
  const autoStarted = useRef(false);
  useEffect(() => {
    if (step !== "visualisierung") {
      vizEntered.current = null;
      return;
    }
    vizEntered.current ??= Date.now();
    if (!autoStarted.current && !generating && state.renders.length === 0 && !genError) {
      autoStarted.current = true;
      void handleGenerate();
    }
    if (generating) return;
    const wait = Math.max(0, VISUALIZE_MIN_MS - (Date.now() - vizEntered.current));
    const t = window.setTimeout(() => navigate("angebote", true), genError ? Math.max(wait, 2500) : wait);
    return () => window.clearTimeout(t);
  }, [step, generating, genError, state.renders.length, handleGenerate, navigate]);

  // Auto-Weiter läuft zeitversetzt nach der Auswahl: dann zählt der neueste Stand, nicht der beim Klick.
  const latestRef = useRef({ step, state, flow, wallIssues });
  latestRef.current = { step, state, flow, wallIssues };

  const goNext = useCallback(() => {
    const { step, state, flow, wallIssues } = latestRef.current;
    if (step === "masse" && Object.keys(wallIssues).length > 0) {
      setShowWallErrors(true);
      const first = Object.keys(wallIssues)[0];
      telemetry.validationFailed(Object.keys(wallIssues).map((key) => `wall-${key}`));
      document.getElementById(`wall-${first}`)?.focus();
      setBlocked("Bitte prüfen Sie die Wandlängen.");
      return;
    }
    if (step === "plz") {
      if (!/^\d{5}$/.test(state.postalCode)) {
        telemetry.validationFailed(["funnel-plz"]);
        setBlocked("Bitte geben Sie Ihre fünfstellige Postleitzahl ein.");
        return;
      }
      telemetry.next();
      autoStarted.current = true;
      void handleGenerate();
      navigate(state.submitted ? "ergebnis" : "visualisierung");
      return;
    }
    if (step === "angebote" && !state.offersChoice) {
      telemetry.validationFailed(["angebote"]);
      setBlocked("Bitte wählen Sie Ja oder Nein.");
      return;
    }
    telemetry.next();
    confirmStep(step);
    navigate(nextStep(step, flow));
  }, [telemetry, handleGenerate, navigate, confirmStep]);

  const goBack = useCallback(() => {
    const { step, flow } = latestRef.current;
    const target = step === "angebote" ? "plz" : previousStep(step, flow);
    if (!target) return;
    telemetry.back();
    navigate(target);
  }, [telemetry, navigate]);

  const skipDetails = useCallback(() => {
    telemetry.next();
    navigate("plz");
  }, [telemetry, navigate]);

  const handleUpload = async (file: File) => {
    try {
      const res = await uploadPhoto(state.sessionToken, file, utm());
      planner.setSession(res.sessionToken);
      planner.setPhotos(res.photos, res.path);
      toast.success("Foto hochgeladen – die KI plant Ihre Küche in genau diesem Raum.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleRemovePhoto = async (path: string) => {
    if (!state.sessionToken) return;
    try {
      const res = await removePhoto(state.sessionToken, path);
      planner.setPhotos(res.photos);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleFeedback = async (renderId: string, value: RenderFeedback) => {
    const render = state.renders.find((r) => r.id === renderId);
    if (!state.sessionToken || !render) return;
    const previous = render.feedback ?? null;
    planner.updateRender(renderId, { feedback: value });
    trackPlannerFeedback(value, !!render.base_render_id);
    try {
      await sendRenderFeedback(state.sessionToken, renderId, value);
    } catch (err) {
      planner.updateRender(renderId, { feedback: previous });
      toast.error(errorMessage(err));
    }
  };

  const submitName = () => {
    const errors = validateLead(contact);
    const nameErrors = { first_name: errors.first_name, last_name: errors.last_name };
    setLeadErrors(nameErrors);
    if (nameErrors.first_name || nameErrors.last_name) {
      telemetry.validationFailed(Object.keys(nameErrors).filter((k) => nameErrors[k as keyof typeof nameErrors]));
      document.getElementById(nameErrors.first_name ? "first_name" : "last_name")?.focus();
      return;
    }
    goNext();
  };

  const submitLead = async () => {
    telemetry.submitClicked();
    const errors = validateLead(contact);
    setLeadErrors(errors);
    const failed = Object.keys(errors) as Array<keyof LeadErrors>;
    if (failed.length) {
      telemetry.validationFailed(failed);
      if (errors.first_name || errors.last_name) navigate("name");
      else document.getElementById(failed[0]!)?.focus();
      return;
    }
    const wantsOffers = state.offersChoice === "ja";
    setSubmitting(true);
    setSubmitError(null);
    try {
      const saved = await savePlanning({
        sessionToken: state.sessionToken,
        config: state.config,
        room: state.room,
        postalCode: state.postalCode,
        provenance: state.answered,
        utm: utm(),
      });
      planner.setSession(saved.session_token);
      const turnstileToken = await waitForToken();
      const res = await submitProject({
        session_token: saved.session_token,
        contact: {
          first_name: contact.first_name.trim(),
          last_name: contact.last_name.trim(),
          email: contact.email.trim(),
          phone: contact.phone.trim(),
          postal_code: state.postalCode,
        },
        request_offers: wantsOffers,
        consents: { share_with_studios: wantsOffers, contact_by_phone: contact.contact_by_phone, marketing: false, ai_training: false },
        active_render_id: activeRender?.status === "success" ? activeRender.id : null,
        timeframe_months: wantsOffers ? Number(state.timeframe) || null : null,
        housing_type: "unknown",
        turnstile_token: turnstileToken,
        website: honeypot,
        landing_page: getEntryPath() ?? window.location.pathname,
        click_ids: getConsentedClickIds(),
      });
      if (res.renders) planner.replaceRenders(res.renders.map(fromSessionRender));

      // Der Lead steht: Tracking darf ab hier nichts mehr blockieren.
      if (!res.already_submitted) {
        try {
          await setEnhancedConversionFromForm({
            email: contact.email,
            firstName: contact.first_name,
            lastName: contact.last_name,
            phone: contact.phone,
            postalCode: state.postalCode,
          });
          await trackKitchenFunnelLead("c", generateTransactionId("funnel_c"));
          trackMetaLead({ content_name: "Funnel C", content_category: wantsOffers ? "Traumküche mit Angeboten" : "Traumküche Visualisierung" });
          trackLeadThankYou("c");
        } catch (trackingError) {
          console.error("Funnel C tracking failed", trackingError);
        }
      }

      telemetry.submitSucceeded();
      storeProjectToken(res.project_token);
      planner.markSubmitted(res.offers_requested ?? wantsOffers);
      stepRef.current = "ergebnis";
      writeUrl("ergebnis", true);
    } catch (err) {
      const reason = err instanceof ApiError ? err.code ?? `http_${err.status}` : err instanceof Error ? err.name : "unknown";
      trackFunnelSubmitError("c", reason);
      telemetry.submitFailed(reason);
      setSubmitError(errorMessage(err));
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  };

  const confirmOffers = async (request: OffersRequest) => {
    if (!state.sessionToken) return;
    setOffersBusy(true);
    setOffersError(null);
    try {
      await requestOffers({ sessionToken: state.sessionToken, timeframeMonths: request.timeframeMonths, contactByPhone: request.contactByPhone });
      planner.markOffersRequested();
      setOffersDialog(false);
      toast.success("Geschafft! Studios aus Ihrer Region erstellen jetzt Ihre Angebote.");
    } catch (err) {
      setOffersError(errorMessage(err));
    } finally {
      setOffersBusy(false);
    }
  };

  const projectToken = state.submitted ? getStoredProjectToken() : null;
  const changeAiConsent = async (granted: boolean) => {
    if (!projectToken) return;
    setAiBusy(true);
    try {
      const view = await setProjectAiConsent(projectToken, granted);
      setAiGranted(view.ai_training?.granted === true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAiBusy(false);
    }
  };

  const startOver = () => {
    planner.reset();
    setContact(EMPTY_CONTACT);
    setGenError(null);
    autoStarted.current = false;
    navigate("form");
  };

  return {
    planner,
    state,
    estimate,
    step,
    flow,
    progress,
    blocked: step === "kontakt" ? submitError : blocked,
    wallIssues,
    showWallErrors,
    contact,
    setContact: (patch: Partial<LeadContact>) => setContact((c) => ({ ...c, ...patch })),
    leadErrors,
    honeypot,
    setHoneypot,
    turnstileCallbackRef,
    submitting,
    generating,
    genError,
    renderPhase,
    renderStarted,
    activeRender,
    activeOutdated,
    offersDialog,
    setOffersDialog,
    offersBusy,
    offersError,
    aiTraining: projectToken && state.photos.length > 0 ? { granted: aiGranted, busy: aiBusy, onChange: changeAiConsent } : null,
    actions: {
      goNext,
      goBack,
      navigate,
      skipDetails,
      handleUpload,
      handleRemovePhoto,
      handleGenerate,
      handleFeedback,
      submitName,
      submitLead,
      confirmOffers,
      startOver,
    },
  };
}

export type PlannerFunnel = ReturnType<typeof usePlannerFunnel>;
