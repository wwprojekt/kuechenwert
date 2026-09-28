import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FunnelSeo } from "@/components/funnel/funnel-seo";
import { ApiError, errorMessage } from "@/features/marketplace/api-client";
import { storeProjectToken } from "@/features/marketplace/project-token";
import {
  generateRender,
  removePhoto,
  savePlanning,
  submitProject,
  uploadPhoto,
} from "@/features/planner/api";
import { KITCHEN_FORMS, STYLES } from "@/features/planner/core";
import { PlannerShell } from "@/features/planner/PlannerShell";
import { PLANNER_STEPS, clearPlannerStorage, usePlanner, useRenderPolling, type PlannerStep } from "@/features/planner/state";
import { AppliancesStep } from "@/features/planner/steps/AppliancesStep";
import { ContactStep, type ContactValues } from "@/features/planner/steps/ContactStep";
import { EquipmentStep } from "@/features/planner/steps/EquipmentStep";
import { RoomStep } from "@/features/planner/steps/RoomStep";
import { StyleStep } from "@/features/planner/steps/StyleStep";
import { VisualizeStep } from "@/features/planner/steps/VisualizeStep";
import { useTurnstile } from "@/hooks/useTurnstile";
import { trackFunnelStep, trackFunnelSubmitError } from "@/lib/funnelAnalytics";
import { generateTransactionId, setEnhancedConversionFromForm, trackKitchenFunnelLead } from "@/lib/gadsConversionService";
import { trackMetaLead } from "@/lib/metaPixelService";
import { getConsentedClickIds } from "@/lib/clickIdService";
import { captureUtmParams, getEntryPath, getStoredUtm } from "@/lib/utm";

/**
 * Funnel C — Traumküche planen & visualisieren (Konfigurator v2).
 *
 * Raumfoto + Maße → Stil, Fronten, Arbeitsplatte, Geräte → KI-Visualisierung
 * im eigenen Raum + Live-Preisschätzung → Projekt mit Studio-Ausschreibung.
 */
export default function FunnelC() {
  const planner = usePlanner();
  const { state, estimate } = planner;
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [maxVisited, setMaxVisited] = useState(() => PLANNER_STEPS.findIndex((s) => s.id === state.step));
  const { waitForToken, resetTurnstile, turnstileCallbackRef } = useTurnstile();

  useRenderPolling(state.sessionToken, state.renders, planner.updateRender);

  useEffect(() => {
    captureUtmParams();
  }, []);

  // Einstiege wie /funnel/c?stil=landhaus&form=u (Stil-Kacheln, Ratgeber, Ads):
  // einmalig übernehmen und aus der URL entfernen, damit ein Reload spätere
  // Änderungen nicht überschreibt.
  const [searchParams, setSearchParams] = useSearchParams();
  const { patchConfig, setForm } = planner;
  useEffect(() => {
    const style = STYLES.find((s) => s.id === searchParams.get("stil"))?.id;
    const form = KITCHEN_FORMS.find((f) => f.id === searchParams.get("form"))?.id;
    if (!style && !form) return;
    if (style) patchConfig({ style });
    if (form) setForm(form);
    const next = new URLSearchParams(searchParams);
    next.delete("stil");
    next.delete("form");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, patchConfig, setForm]);

  const index = PLANNER_STEPS.findIndex((s) => s.id === state.step);

  useEffect(() => {
    trackFunnelStep("c", state.step, index, PLANNER_STEPS.length);
  }, [state.step, index]);

  // Der Schritt steht in der URL (?schritt=raum …): Die Zurück-Geste geht einen Schritt
  // zurück statt den Planer zu verlassen. Navigiert wird nur über die URL.
  const { goTo: setPlannerStep } = planner;
  const urlStep = PLANNER_STEPS.find((s) => s.id === searchParams.get("schritt"))?.id;
  const stepRef = useRef(state.step);
  useEffect(() => {
    stepRef.current = state.step;
  }, [state.step]);
  useEffect(() => {
    if (searchParams.has("stil") || searchParams.has("form")) return;
    if (!urlStep) {
      const params = new URLSearchParams(searchParams);
      params.set("schritt", stepRef.current);
      setSearchParams(params, { replace: true });
      return;
    }
    if (urlStep === stepRef.current) return;
    const target = PLANNER_STEPS.findIndex((s) => s.id === urlStep);
    setMaxVisited((m) => Math.max(m, target));
    setPlannerStep(urlStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [urlStep, searchParams, setSearchParams, setPlannerStep]);

  const goTo = useCallback(
    (step: PlannerStep) => {
      if (step === state.step) return;
      const params = new URLSearchParams(searchParams);
      params.set("schritt", step);
      setSearchParams(params);
    },
    [searchParams, setSearchParams, state.step],
  );

  const next = () => goTo(PLANNER_STEPS[Math.min(index + 1, PLANNER_STEPS.length - 1)]!.id);
  const back = () => goTo(PLANNER_STEPS[Math.max(index - 1, 0)]!.id);

  const utm = () => getStoredUtm() as Record<string, string>;

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

  // Sperre gegen Doppelstart (Auto-Start plus Klick), bevor der State nachzieht.
  const generatingRef = useRef(false);
  const handleGenerate = useCallback(
    async (variant?: { label: string; hint: string }) => {
      if (generatingRef.current) return;
      generatingRef.current = true;
      setGenerating(true);
      setGenError(null);
      try {
        const res = await generateRender({
          sessionToken: state.sessionToken,
          config: state.config,
          room: state.room,
          photoPath: state.selectedPhotoPath,
          postalCode: state.postalCode || null,
          variantHint: variant?.hint ?? null,
          variantLabel: variant?.label ?? null,
          utm: utm(),
        });
        planner.setSession(res.session_token);
        // Läuft die Visualisierung schon, liefert der Server dieselbe render_id zurück.
        if (!state.renders.some((r) => r.id === res.render_id)) {
          planner.addRender({
            id: res.render_id,
            version: res.version,
            status: "pending",
            mode: res.mode,
            variant_label: variant?.label ?? null,
            image_url: null,
          });
        }
      } catch (err) {
        setGenError(errorMessage(err));
      } finally {
        generatingRef.current = false;
        setGenerating(false);
      }
    },
    [planner, state.sessionToken, state.config, state.room, state.selectedPhotoPath, state.postalCode, state.renders],
  );

  const handleSubmit = async (values: ContactValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const saved = await savePlanning({
        sessionToken: state.sessionToken,
        config: state.config,
        room: state.room,
        postalCode: values.postal_code,
        utm: utm(),
      });
      planner.setSession(saved.session_token);
      const turnstileToken = await waitForToken();
      const res = await submitProject({
        session_token: saved.session_token,
        contact: {
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
          phone: values.phone,
          postal_code: values.postal_code,
          city: values.city || undefined,
        },
        consents: {
          share_with_studios: values.share_with_studios,
          contact_by_phone: values.contact_by_phone,
          marketing: values.marketing,
        },
        timeframe_months: Number(values.timeframe_months) || null,
        housing_type: values.housing_type,
        turnstile_token: turnstileToken,
        website: values.website,
        landing_page: getEntryPath() ?? window.location.pathname,
        click_ids: getConsentedClickIds(),
      });

      // Das Projekt steht: Tracking darf ab hier nichts mehr blockieren.
      if (!res.already_submitted) {
        try {
          const transactionId = generateTransactionId("funnel_c");
          await setEnhancedConversionFromForm({
            email: values.email,
            firstName: values.first_name,
            lastName: values.last_name,
            phone: values.phone,
            postalCode: values.postal_code,
          });
          await trackKitchenFunnelLead("c", transactionId);
          trackMetaLead({ content_name: "Funnel C", content_category: "Traumküche" });
        } catch (trackingError) {
          console.error("Funnel C tracking failed", trackingError);
        }
      }

      planner.markSubmitted();
      clearPlannerStorage();
      storeProjectToken(res.project_token);
      navigate("/projekt?neu=1", { replace: true });
    } catch (err) {
      trackFunnelSubmitError("c", err instanceof ApiError ? err.code ?? `http_${err.status}` : err instanceof Error ? err.name : "unknown");
      setSubmitError(errorMessage(err));
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  };

  const successRenders = state.renders.filter((r) => r.status === "success" && r.image_url);
  const activeRender = state.renders.find((r) => r.id === state.activeRenderId && r.image_url) ?? successRenders[successRenders.length - 1];
  const selectedPhoto = state.photos.find((p) => p.path === state.selectedPhotoPath) ?? null;
  const nextLabel = index === 3 ? "Visualisierung erstellen" : "Weiter";

  return (
    <>
      <FunnelSeo
        title="Traumküche planen & visualisieren"
        description="Laden Sie ein Foto Ihres Raums hoch, konfigurieren Sie Ihre Wunschküche und sehen Sie per KI, wie sie aussehen wird – mit realistischer Preisschätzung und Angeboten geprüfter Küchenstudios."
        canonicalPath="/funnel/c"
      />
      <PlannerShell
        step={state.step}
        maxVisitedIndex={Math.max(maxVisited, index)}
        estimate={estimate}
        onStep={goTo}
        onBack={back}
        onNext={next}
        nextLabel={nextLabel}
        showSummary={index <= 3}
      >
        {state.step === "raum" && (
          <RoomStep
            room={state.room}
            photos={state.photos}
            selectedPhotoPath={state.selectedPhotoPath}
            postalCode={state.postalCode}
            onForm={planner.setForm}
            onWall={planner.setWall}
            onRoom={planner.patchRoom}
            onPostalCode={planner.setPostalCode}
            onUpload={handleUpload}
            onRemovePhoto={handleRemovePhoto}
            onSelectPhoto={planner.selectPhoto}
          />
        )}
        {state.step === "stil" && <StyleStep config={state.config} onChange={planner.patchConfig} />}
        {state.step === "ausstattung" && <EquipmentStep config={state.config} onChange={planner.patchConfig} />}
        {state.step === "geraete" && <AppliancesStep config={state.config} onChange={planner.patchConfig} />}
        {state.step === "visualisierung" && (
          <VisualizeStep
            renders={state.renders}
            activeRenderId={state.activeRenderId}
            beforePhotoUrl={selectedPhoto?.url ?? null}
            estimate={estimate}
            wishes={state.config.wishes ?? ""}
            generating={generating}
            error={genError}
            onGenerate={handleGenerate}
            onSelectRender={planner.setActiveRender}
            onWishes={(wishes) => planner.patchConfig({ wishes })}
            onContinue={next}
          />
        )}
        {state.step === "kontakt" && (
          <ContactStep
            estimate={estimate}
            coverUrl={activeRender?.image_url ?? null}
            defaultPostalCode={state.postalCode}
            submitting={submitting}
            error={submitError}
            onSubmit={handleSubmit}
            turnstileRef={turnstileCallbackRef}
          />
        )}
      </PlannerShell>
    </>
  );
}
