import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FunnelSeo } from "@/components/funnel/funnel-seo";
import { errorMessage } from "@/features/marketplace/api-client";
import {
  generateRender,
  removePhoto,
  savePlanning,
  submitProject,
  uploadPhoto,
} from "@/features/planner/api";
import { PlannerShell } from "@/features/planner/PlannerShell";
import { PLANNER_STEPS, clearPlannerStorage, usePlanner, useRenderPolling, type PlannerStep } from "@/features/planner/state";
import { AppliancesStep } from "@/features/planner/steps/AppliancesStep";
import { ContactStep, type ContactValues } from "@/features/planner/steps/ContactStep";
import { EquipmentStep } from "@/features/planner/steps/EquipmentStep";
import { RoomStep } from "@/features/planner/steps/RoomStep";
import { StyleStep } from "@/features/planner/steps/StyleStep";
import { VisualizeStep } from "@/features/planner/steps/VisualizeStep";
import { useTurnstile } from "@/hooks/useTurnstile";
import { notifyKitchenFunnelLead } from "@/lib/funnelLeadNotify";
import { generateTransactionId, setEnhancedConversionFromForm, trackKitchenFunnelLead } from "@/lib/gadsConversionService";
import { trackMetaLead } from "@/lib/metaPixelService";
import { captureUtmParams, getStoredUtm } from "@/lib/utm";

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
  const { turnstileToken, resetTurnstile, turnstileCallbackRef } = useTurnstile();

  useRenderPolling(state.sessionToken, state.renders, planner.updateRender);

  useEffect(() => {
    captureUtmParams();
  }, []);

  const index = PLANNER_STEPS.findIndex((s) => s.id === state.step);

  const goTo = useCallback(
    (step: PlannerStep) => {
      const target = PLANNER_STEPS.findIndex((s) => s.id === step);
      setMaxVisited((m) => Math.max(m, target));
      planner.goTo(step);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [planner],
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

  const handleGenerate = useCallback(
    async (variant?: { label: string; hint: string }) => {
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
        planner.addRender({
          id: res.render_id,
          version: res.version,
          status: "pending",
          mode: res.mode,
          variant_label: variant?.label ?? null,
          image_url: null,
        });
      } catch (err) {
        setGenError(errorMessage(err));
      } finally {
        setGenerating(false);
      }
    },
    [planner, state.sessionToken, state.config, state.room, state.selectedPhotoPath, state.postalCode],
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
        landing_page: document.referrer ? document.referrer.slice(0, 300) : undefined,
      });

      const transactionId = generateTransactionId("funnel_c");
      notifyKitchenFunnelLead({
        funnel: "c",
        firstName: values.first_name,
        lastName: values.last_name,
        email: values.email,
        phone: values.phone,
        postalCode: values.postal_code,
        kitchenForm: state.room.form,
        transactionId,
      });
      await setEnhancedConversionFromForm({
        email: values.email,
        firstName: values.first_name,
        lastName: values.last_name,
        phone: values.phone,
        postalCode: values.postal_code,
      });
      await trackKitchenFunnelLead("c", transactionId);
      trackMetaLead({ content_name: "Funnel C", content_category: "Traumküche" });

      planner.markSubmitted();
      clearPlannerStorage();
      navigate(`/projekt/${res.project_token}?neu=1`, { replace: true });
    } catch (err) {
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
