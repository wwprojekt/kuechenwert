import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FunnelShell } from "@/components/funnel/funnel-shell";
import { CardStep } from "@/components/funnel/card-step";
import { ImageCardStep } from "@/components/funnel/image-card-step";
import { MultiCardStep } from "@/components/funnel/multi-card-step";
import { PlzStep } from "@/components/funnel/plz-step";
import {
  ContactStep,
  isContactComplete,
} from "@/components/funnel/contact-step";
import {
  BudgetSliderStep,
  isBudgetValid,
} from "@/components/funnel/budget-slider-step";
import {
  PhoneStep,
  isPhoneStepComplete,
} from "@/components/funnel/phone-step";
import {
  FUNNEL_A_ID,
  FUNNEL_A_STEPS,
  FUNNEL_A_OCCASIONS,
  FUNNEL_A_HOUSING,
  FUNNEL_A_KITCHEN_FORMS,
  FUNNEL_A_SIZES,
  FUNNEL_A_STYLES,
  FUNNEL_A_COLORS,
  FUNNEL_A_WORKTOP_CATEGORIES,
  FUNNEL_A_COOKTOPS,
  FUNNEL_A_OVENS,
  FUNNEL_A_COOKSTYLES,
  FUNNEL_A_TIMEFRAMES,
  FUNNEL_A_BUDGET_SLIDER,
  createEmptyFunnelAData,
  type FunnelAData,
  type FunnelAStammdaten,
} from "@/config/funnel-a";
import { getStoredUtm } from "@/lib/utm";
import {
  generateTransactionId,
  setEnhancedConversionFromForm,
  trackKitchenFunnelLead,
} from "@/lib/gadsConversionService";
import { trackMetaLead } from "@/lib/metaPixelService";
import {
  OCCASION_ICONS,
  HOUSING_ICONS,
  SIZE_ICONS,
  TIMEFRAME_ICONS,
  COLOR_ICONS,
  COOKTOP_ICONS,
  OVEN_ICONS,
  COOKSTYLE_ICONS,
} from "@/components/funnel/funnel-a-icons";
import {
  KITCHEN_FORM_PICTOGRAMS,
  WORKTOP_PICTOGRAMS,
} from "@/components/funnel/funnel-a-pictograms";

const STORAGE_KEY = "kw_funnel_a";

function loadSaved(): Partial<FunnelAData> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persist(data: FunnelAData) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function FunnelAClient({
  stepSlug,
  initialPlz,
  stammdaten,
}: {
  stepSlug: string;
  initialPlz: string;
  stammdaten: FunnelAStammdaten;
}) {
  const navigate = useNavigate();
  const stepIndex = FUNNEL_A_STEPS.findIndex((s) => s.slug === stepSlug);
  const step = FUNNEL_A_STEPS[stepIndex];

  const [data, setData] = useState<FunnelAData>(() => {
    const saved = loadSaved();
    const base = createEmptyFunnelAData();
    return {
      ...base,
      ...saved,
      ...(initialPlz ? { plz: initialPlz } : {}),
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    persist(data);
  }, [data]);

  const update = useCallback(
    (patch: Partial<FunnelAData>) =>
      setData((prev) => ({ ...prev, ...patch })),
    [],
  );

  const goNext = useCallback(() => {
    if (stepIndex < FUNNEL_A_STEPS.length - 1) {
      navigate(`/funnel/a/${FUNNEL_A_STEPS[stepIndex + 1].slug}`);
    }
  }, [stepIndex, navigate]);

  const goBack = useCallback(() => {
    if (stepIndex > 0) {
      navigate(`/funnel/a/${FUNNEL_A_STEPS[stepIndex - 1].slug}`);
    } else {
      navigate("/");
    }
  }, [stepIndex, navigate]);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const housingType = FUNNEL_A_HOUSING.find((h) => h.id === data.housing)
        ?.housing_type;
      const timeframeMonths = FUNNEL_A_TIMEFRAMES.find(
        (t) => t.id === data.timeframe,
      )?.months ?? null;
      const budgetEur = data.budget || FUNNEL_A_BUDGET_SLIDER.default;
      const utm = getStoredUtm();

      const frontMaterialNames = data.frontMaterialIds
        .map((id) => stammdaten.frontMaterials.find((f) => f.id === id)?.name)
        .filter((x): x is string => Boolean(x));
      const applianceBrandNames = data.applianceBrandIds
        .map(
          (id) => stammdaten.applianceBrands.find((b) => b.id === id)?.name,
        )
        .filter((x): x is string => Boolean(x));

      const funnelAnswers: Record<string, unknown> = {
        salutation: data.salutation || null,
        kitchen_size: data.size || null,
        color_preference: data.color || null,
        worktop_category: data.worktopCategory || null,
        cooktop_type: data.cooktop || null,
        oven_placement: data.oven || null,
        cooking_style: data.cookstyle || null,
        front_material_ids: data.frontMaterialIds,
        front_material_names: frontMaterialNames,
        appliance_brand_ids: data.applianceBrandIds,
        appliance_brand_names: applianceBrandNames,
        timeframe: data.timeframe || null,
        budget_source: "slider",
      };

      // Wenn User eingeloggt ist, Lead mit Account verknuepfen -> Dashboard
      // kann "Meine Anfragen" zeigen. Guest-Submits (user_id=null) bleiben
      // ueber RLS-Policy erlaubt (anon insert, siehe kw_lead_insert_policies).
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id ?? null;

      const { error } = await supabase.from("leads").insert({
        funnel_type: FUNNEL_A_ID,
        funnel_variant: "A",
        user_id: userId,
        // status, tier, score: DB-Defaults greifen
        postal_code: data.plz,
        housing_type: housingType ?? null,
        kitchen_form: data.kitchenForm || null,
        kitchen_style: data.style || null,
        purchase_reason: data.occasion || null,
        timeframe_months: timeframeMonths,
        budget_midpoint: budgetEur,
        first_name: data.firstName || null,
        last_name: data.lastName || null,
        email: data.email || null,
        phone: data.phone || null,
        consent_call: data.consentCall,
        consent_marketing: data.consentMarketing,
        funnel_answers: funnelAnswers,
        utm_source: utm.utm_source ?? null,
        utm_medium: utm.utm_medium ?? null,
        utm_campaign: utm.utm_campaign ?? null,
        utm_content: utm.utm_content ?? null,
        utm_term: utm.utm_term ?? null,
        landing_page: typeof window !== "undefined" ? window.location.pathname : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });

      if (error) {
        throw new Error(error.message || "Senden fehlgeschlagen");
      }

      const transactionId = generateTransactionId("funnel_a");
      await setEnhancedConversionFromForm({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        postalCode: data.plz,
      });
      await trackKitchenFunnelLead("a", transactionId);
      trackMetaLead({
        content_name: "Funnel A",
        content_category: "Küchenanfrage",
      });

      sessionStorage.removeItem(STORAGE_KEY);
      navigate("/funnel/danke?funnel=a");
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Senden fehlgeschlagen",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function canProceed(): boolean {
    switch (step.slug) {
      case "anlass":
        return !!data.occasion;
      case "wohnsituation":
        return !!data.housing;
      case "kuechenform":
        return !!data.kitchenForm;
      case "groesse":
        return !!data.size || !step.required;
      case "stil":
        return !!data.style || !step.required;
      case "farbe":
      case "arbeitsplatte":
      case "kochfeld":
      case "backofen":
      case "kochstil":
      case "fronten":
      case "geraete":
        return true;
      case "zeitrahmen":
        return !!data.timeframe;
      case "budget":
        return isBudgetValid(
          data.budget || FUNNEL_A_BUDGET_SLIDER.default,
          FUNNEL_A_BUDGET_SLIDER.min,
          FUNNEL_A_BUDGET_SLIDER.max,
        );
      case "plz":
        return /^\d{5}$/.test(data.plz);
      case "kontakt":
        return isContactComplete(
          {
            salutation: data.salutation,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            consentCall: data.consentCall,
            consentMarketing: data.consentMarketing,
          },
          "without-phone",
        );
      case "telefon":
        return isPhoneStepComplete({
          phone: data.phone,
          consentCall: data.consentCall,
          consentMarketing: data.consentMarketing,
        });
      default:
        return false;
    }
  }

  const isFinal = step.slug === "telefon";

  // Für optionale Stammdaten-Steps: "Überspringen"-Label statt "Weiter",
  // wenn der Nutzer nichts ausgewählt hat.
  const isOptionalSkip =
    (step.slug === "fronten" && data.frontMaterialIds.length === 0) ||
    (step.slug === "geraete" && data.applianceBrandIds.length === 0);

  return (
    <FunnelShell
      currentStep={stepIndex}
      totalSteps={FUNNEL_A_STEPS.length}
      stepLabel={step.label}
      stepDescription={step.description}
      onBack={goBack}
      onNext={isFinal ? handleSubmit : goNext}
      canProceed={canProceed()}
      isFinalStep={isFinal}
      isSubmitting={submitting}
      submitLabel="Kostenlose Angebote anfordern"
      nextLabel={isOptionalSkip ? "Überspringen" : undefined}
    >
      {step.slug === "anlass" && (
        <CardStep
          options={FUNNEL_A_OCCASIONS.map((o) => ({
            id: o.id,
            label: o.label,
            description: o.description,
            icon: OCCASION_ICONS[o.id],
          }))}
          selected={data.occasion}
          onSelect={(id) => update({ occasion: id })}
          onAutoAdvance={goNext}
          columns={3}
        />
      )}

      {step.slug === "wohnsituation" && (
        <CardStep
          options={FUNNEL_A_HOUSING.map((h) => ({
            id: h.id,
            label: h.label,
            description: h.description,
            icon: HOUSING_ICONS[h.id],
          }))}
          selected={data.housing}
          onSelect={(id) => update({ housing: id })}
          onAutoAdvance={goNext}
          columns={3}
        />
      )}

      {step.slug === "kuechenform" && (
        <ImageCardStep
          options={FUNNEL_A_KITCHEN_FORMS.map((f) => ({
            id: f.id,
            label: f.label,
            description: f.description,
            bgClass: f.bgClass,
            pictogram: KITCHEN_FORM_PICTOGRAMS[f.id],
          }))}
          selected={data.kitchenForm ? [data.kitchenForm] : []}
          onSelectionChange={(ids) => update({ kitchenForm: ids[0] ?? "" })}
          autoAdvanceMs={300}
          onAutoAdvance={goNext}
          columns={3}
        />
      )}

      {step.slug === "groesse" && (
        <CardStep
          options={FUNNEL_A_SIZES.map((s) => ({
            id: s.id,
            label: s.label,
            description: s.description,
            icon: SIZE_ICONS[s.id],
          }))}
          selected={data.size}
          onSelect={(id) => update({ size: id })}
          onAutoAdvance={goNext}
          columns={3}
        />
      )}

      {step.slug === "stil" && (
        <ImageCardStep
          options={FUNNEL_A_STYLES.map((s) => ({
            id: s.id,
            label: s.label,
            description: s.description,
            bgClass: s.bgClass,
            // Echte Küchenfotos (statt SVG-Pictogramm): KP-Style,
            // macht den Step sofort premium & konkret.
            imageSrc: s.imageSrc,
          }))}
          selected={data.style ? [data.style] : []}
          onSelectionChange={(ids) => update({ style: ids[0] ?? "" })}
          autoAdvanceMs={300}
          onAutoAdvance={goNext}
          columns={3}
        />
      )}

      {step.slug === "farbe" && (
        <CardStep
          options={FUNNEL_A_COLORS.map((c) => ({
            id: c.id,
            label: c.label,
            description: c.description,
            icon: COLOR_ICONS[c.id],
          }))}
          selected={data.color}
          onSelect={(id) => update({ color: id })}
          onAutoAdvance={goNext}
          columns={3}
        />
      )}

      {step.slug === "arbeitsplatte" && (
        <ImageCardStep
          options={FUNNEL_A_WORKTOP_CATEGORIES.map((w) => ({
            id: w.id,
            label: w.label,
            description: w.description,
            bgClass: w.bgClass,
            pictogram: WORKTOP_PICTOGRAMS[w.id],
          }))}
          selected={data.worktopCategory ? [data.worktopCategory] : []}
          onSelectionChange={(ids) =>
            update({ worktopCategory: ids[0] ?? "" })
          }
          autoAdvanceMs={300}
          onAutoAdvance={goNext}
          columns={3}
        />
      )}

      {step.slug === "kochfeld" && (
        <CardStep
          options={FUNNEL_A_COOKTOPS.map((c) => ({
            id: c.id,
            label: c.label,
            description: c.description,
            icon: COOKTOP_ICONS[c.id],
          }))}
          selected={data.cooktop}
          onSelect={(id) => update({ cooktop: id })}
          onAutoAdvance={goNext}
          columns={2}
        />
      )}

      {step.slug === "backofen" && (
        <CardStep
          options={FUNNEL_A_OVENS.map((o) => ({
            id: o.id,
            label: o.label,
            description: o.description,
            icon: OVEN_ICONS[o.id],
          }))}
          selected={data.oven}
          onSelect={(id) => update({ oven: id })}
          onAutoAdvance={goNext}
          columns={2}
        />
      )}

      {step.slug === "kochstil" && (
        <CardStep
          options={FUNNEL_A_COOKSTYLES.map((c) => ({
            id: c.id,
            label: c.label,
            description: c.description,
            icon: COOKSTYLE_ICONS[c.id],
          }))}
          selected={data.cookstyle}
          onSelect={(id) => update({ cookstyle: id })}
          onAutoAdvance={goNext}
          columns={3}
        />
      )}

      {step.slug === "fronten" && (
        <>
          <div className="mb-5 rounded-lg border border-neutral-200 bg-surface-soft px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
            <strong className="font-semibold text-ink">Kein Muss.</strong>{" "}
            Überspringen Sie diesen Schritt — der Küchenplaner empfiehlt beim
            Termin passende Fronten. Wer schon Favoriten hat, wählt bis zu 3.
          </div>
          <MultiCardStep
            options={stammdaten.frontMaterials.map((f) => ({
              id: f.id,
              label: f.name,
            }))}
            selected={data.frontMaterialIds}
            onSelectionChange={(ids) => update({ frontMaterialIds: ids })}
            maxSelections={3}
            columns={2}
          />
        </>
      )}

      {step.slug === "geraete" && (
        <>
          <div className="mb-5 rounded-lg border border-neutral-200 bg-surface-soft px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
            <strong className="font-semibold text-ink">Kein Muss.</strong> Wenn
            Sie offen sind, einfach überspringen. Sonst bis zu 4 bevorzugte
            Marken markieren.
          </div>
          <MultiCardStep
            options={stammdaten.applianceBrands.map((b) => ({
              id: b.id,
              label: b.name,
            }))}
            selected={data.applianceBrandIds}
            onSelectionChange={(ids) => update({ applianceBrandIds: ids })}
            maxSelections={4}
            columns={3}
          />
        </>
      )}

      {step.slug === "zeitrahmen" && (
        <CardStep
          options={FUNNEL_A_TIMEFRAMES.map((t) => ({
            id: t.id,
            label: t.label,
            icon: TIMEFRAME_ICONS[t.id],
          }))}
          selected={data.timeframe}
          onSelect={(id) => update({ timeframe: id })}
          onAutoAdvance={goNext}
          columns={3}
        />
      )}

      {step.slug === "budget" && (
        <BudgetSliderStep
          value={data.budget}
          onChange={(v) => update({ budget: v })}
          min={FUNNEL_A_BUDGET_SLIDER.min}
          max={FUNNEL_A_BUDGET_SLIDER.max}
          step={FUNNEL_A_BUDGET_SLIDER.step}
          defaultValue={FUNNEL_A_BUDGET_SLIDER.default}
        />
      )}

      {step.slug === "plz" && (
        <PlzStep value={data.plz} onChange={(plz) => update({ plz })} />
      )}

      {step.slug === "kontakt" && (
        <ContactStep
          variant="without-phone"
          data={{
            salutation: data.salutation,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            consentCall: data.consentCall,
            consentMarketing: data.consentMarketing,
          }}
          onChange={(patch) => update(patch as Partial<FunnelAData>)}
        />
      )}

      {step.slug === "telefon" && (
        <>
          <PhoneStep
            data={{
              phone: data.phone,
              consentCall: data.consentCall,
              consentMarketing: data.consentMarketing,
            }}
            onChange={(patch) => update(patch as Partial<FunnelAData>)}
          />
          {submitError && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </p>
          )}
        </>
      )}
    </FunnelShell>
  );
}
