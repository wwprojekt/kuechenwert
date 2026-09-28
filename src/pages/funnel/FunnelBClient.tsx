import { cloneElement, isValidElement, useState, useMemo, useCallback, useEffect, useId, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { clsx } from "clsx";
import { toast } from "sonner";
import { submitFunnelB } from "@/features/funnel-b/api";
import { LEAD_FILE_CATEGORIES, MAX_LEAD_FILES, type LeadFileCategory, type PendingLeadFile } from "@/features/funnel-b/files";
import { LeadFileDrop } from "@/features/funnel-b/LeadFileDrop";
import { PendingFileList } from "@/features/funnel-b/PendingFileList";
import { ApiError, errorMessage } from "@/features/marketplace/api-client";
import { useTurnstile } from "@/hooks/useTurnstile";
import { useSupportPhone } from "@/hooks/useSupportPhone";
import { BRAND } from "@/lib/brand";
import { getConsentedClickIds } from "@/lib/clickIdService";
import { trackFunnelStep, trackFunnelSubmitError } from "@/lib/funnelAnalytics";
import { clearSubmissionId, submissionIdFor } from "@/lib/submissionId";
import { getEntryPath, getStoredUtm } from "@/lib/utm";
import {
  generateTransactionId,
  setEnhancedConversionFromForm,
  trackKitchenFunnelLead,
} from "@/lib/gadsConversionService";
import { trackMetaLead } from "@/lib/metaPixelService";
import {
  Plus,
  Trash2,
  ShieldCheck,
  Lightbulb,
  Phone,
  Mail,
  CloudUpload,
} from "lucide-react";
import { FunnelBShell } from "@/components/funnel/funnel-b-shell";
import { Combobox, type ComboboxOption } from "@/components/funnel/combobox";
import {
  TIMEFRAME_ICONS_B,
  HANDLE_TYPE_ICONS,
  WORKTOP_ICONS,
  SINK_MATERIAL_ICONS,
  WASTE_SEP_ICONS,
  DELIVERY_ICONS,
  FINANCING_ICONS,
  APPLIANCE_CATEGORY_ICON,
} from "@/components/funnel/funnel-b-icons";
import {
  KITCHEN_BRANDS,
  FRONT_MATERIALS,
  FRONT_CATEGORY_LABEL,
  HANDLE_TYPES,
  WORKTOP_MATERIALS,
  WORKTOP_DESIGNS,
  APPLIANCE_CATEGORIES,
  APPLIANCE_BRANDS,
  SINK_BRANDS,
  SINK_MATERIALS,
  EXTRAS_OPTIONS,
  TIMEFRAMES,
  DELIVERY_MODES,
  FINANCING_OPTIONS,
} from "@/config/funnel-b-stammdaten";

/* ====================================================================== */
/* STATE                                                                    */
/* ====================================================================== */

type OfferDeliveryMethod = "" | "now" | "later";

type FunnelBData = {
  timeframe: string;

  brand: string;
  brandCustom: string;
  frontName: string;
  frontMaterialName: string;
  handleType: string;

  worktopMaterial: string;
  worktopDesign: string;
  worktopDesignCustom: string;

  appliances: {
    id: string;
    categorySlug: string;
    brandSlug: string;
    model: string;
  }[];

  sinkBrand: string;
  sinkMaterial: string;
  sinkDesignation: string;
  wasteSeparationSystem: "yes" | "no" | "unknown" | "";

  extras: string[];
  extrasNotes: string;

  deliveryMode: string;
  paymentDownPaymentPercent: string;
  paymentFinancing: string;
  paymentFinancingApr: string;
  paymentFinancingMonths: string;

  existingOfferStudio: string;
  existingOfferPriceEur: string;
  /** Unterlagen: "now" = jetzt hochladen, "later" = später über den Projektlink nachreichen */
  offerDeliveryMethod: OfferDeliveryMethod;
  uploads: PendingLeadFile[];

  postalCode: string;
  city: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  salutation: "frau" | "herr" | "divers" | "";
  /** Weitergabe an Studios (Pflicht, Einwilligungszweck share_with_studios). */
  consentShare: boolean;
  /** Rückruf durch KüchenWert zum Experten-Check (Pflicht). */
  consentCall: boolean;
  /** Anrufe durch Studios, die den Kontakt erhalten (optional). */
  consentStudioCall: boolean;
  consentMarketing: boolean;
};

const initialData: FunnelBData = {
  timeframe: "",
  brand: "",
  brandCustom: "",
  frontName: "",
  frontMaterialName: "",
  handleType: "",
  worktopMaterial: "",
  worktopDesign: "",
  worktopDesignCustom: "",
  appliances: [],
  sinkBrand: "",
  sinkMaterial: "",
  sinkDesignation: "",
  wasteSeparationSystem: "",
  extras: [],
  extrasNotes: "",
  deliveryMode: "",
  paymentDownPaymentPercent: "",
  paymentFinancing: "",
  paymentFinancingApr: "",
  paymentFinancingMonths: "",
  existingOfferStudio: "",
  existingOfferPriceEur: "",
  offerDeliveryMethod: "",
  uploads: [],
  postalCode: "",
  city: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  salutation: "",
  consentShare: false,
  consentCall: false,
  consentStudioCall: false,
  consentMarketing: false,
};

const STEPS = [
  { label: "Ihr Angebot", description: "Was kostet Ihr Angebot – und haben Sie Angebot oder Planung zur Hand?" },
  { label: "Ihre Situation", description: "Wann soll die Küche geliefert oder montiert werden?" },
  { label: "Korpus & Fronten", description: "Welche Marke, welches Material, welcher Grifftyp?" },
  { label: "Arbeitsplatte", description: "Material und – falls bekannt – die genaue Bezeichnung." },
  { label: "Geräte", description: "Welche Geräte sind im Angebot? Marke und Modell, falls bekannt." },
  { label: "Sanitär & Müllsystem", description: "Spüle, Material, Mülltrennsystem ja/nein." },
  { label: "Ausstattung & Zubehör", description: "Steckdosen, Beleuchtung, Besteckeinsatz, Sonstiges." },
  { label: "Lieferung & Zahlung", description: "Liefermodus, Anzahlung, Finanzierungswunsch." },
  { label: "Ihre Kontaktdaten", description: "Damit wir uns für den Experten-Check melden können." },
];

const TOTAL = STEPS.length;

/** ?schritt=1…9 → Index 0…8; alles andere → erster Schritt. */
function parseStep(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= TOTAL ? n - 1 : 0;
}

const STORAGE_KEY = "kw_funnel_b";
/** Persist nur JSON-serialisierbare Felder, keine File-Objekte. */
function serializeForStorage(data: FunnelBData): string {
  const { uploads: _u, ...rest } = data;
  void _u;
  return JSON.stringify(rest);
}

/** Schritt „Ihr Angebot“ vollständig: Preis und entweder Unterlagen oder „später nachreichen“. */
function isOfferReady(data: FunnelBData): boolean {
  if (!(Number(data.existingOfferPriceEur) > 0)) return false;
  if (data.offerDeliveryMethod === "later") return true;
  return data.offerDeliveryMethod === "now" && data.uploads.length > 0;
}

function loadSaved(): Partial<FunnelBData> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/* ====================================================================== */
/* PAGE                                                                     */
/* ====================================================================== */

export default function FunnelBClient() {
  const navigate = useNavigate();
  const phone = useSupportPhone();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<FunnelBData>(() => ({
    ...initialData,
    ...loadSaved(),
    uploads: [], // nie aus storage rehydrieren
  }));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const { waitForToken, resetTurnstile, turnstileCallbackRef } = useTurnstile();
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Schritt steht in der URL, damit Zurück-Geste und Neuladen im Funnel bleiben.
  // Kontaktdaten erst, wenn das Angebot vollständig ist (Uploads überstehen kein Neuladen).
  const requestedStep = parseStep(searchParams.get("schritt"));
  const step = requestedStep === TOTAL - 1 && !isOfferReady(data) ? 0 : requestedStep;
  const goToStep = useCallback(
    (next: number, replace = false) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next <= 0) params.delete("schritt");
          else params.set("schritt", String(next + 1));
          return params;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (step !== requestedStep) goToStep(step, true);
  }, [step, requestedStep, goToStep]);

  useEffect(() => {
    trackFunnelStep("b", STEPS[step].label, step, TOTAL);
  }, [step]);

  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  useEffect(() => {
    if (submitError) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [submitError]);

  // auto-persist bei jeder Aenderung (File-Objekte ausgeschlossen)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(STORAGE_KEY, serializeForStorage(data));
    } catch {
      /* quota / privacy mode */
    }
  }, [data]);

  const update = useCallback((patch: Partial<FunnelBData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const canProceed = useMemo(() => {
    switch (step) {
      case 0:
        return isOfferReady(data);
      case 8:
        return (
          /^\d{5}$/.test(data.postalCode) &&
          data.firstName.trim().length > 1 &&
          data.lastName.trim().length > 1 &&
          /\S+@\S+\.\S+/.test(data.email) &&
          data.phone.trim().length >= 6 &&
          data.consentShare &&
          data.consentCall
        );
      default:
        return true;
    }
  }, [step, data]);

  const handleNext = useCallback(async () => {
    if (step < TOTAL - 1) {
      goToStep(step + 1);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const { uploads, ...fields } = data;
      const turnstileToken = await waitForToken();
      setUploadProgress(uploads.length > 0 ? { done: 0, total: uploads.length } : null);
      const { failedUploads, studiosInArea, reviewRequired } = await submitFunnelB({
        data: fields,
        uploads,
        onUploadProgress: (done, total) => setUploadProgress({ done, total }),
        turnstileToken,
        website: honeypot,
        submissionId: submissionIdFor("b"),
        clickIds: getConsentedClickIds(),
        utm: getStoredUtm(),
        landingPage: getEntryPath() ?? (typeof window !== "undefined" ? window.location.pathname : null),
      });
      clearSubmissionId("b");

      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* storage not available */
      }

      // Die Anfrage ist gespeichert: Tracking darf ab hier nichts mehr blockieren,
      // sonst sendet der Nutzer nach einer Fehlermeldung ein zweites Mal ab.
      try {
        const transactionId = generateTransactionId("funnel_b");
        await setEnhancedConversionFromForm({
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          postalCode: data.postalCode,
        });
        await trackKitchenFunnelLead("b", transactionId);
        trackMetaLead({
          content_name: "Funnel B",
          content_category: "Angebot unterbieten",
        });
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
      trackFunnelSubmitError("b", e instanceof ApiError ? e.code ?? `http_${e.status}` : "network");
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
  }, [step, data, navigate, goToStep, phone.display, waitForToken, honeypot, resetTurnstile]);

  const handleBack = useCallback(() => goToStep(Math.max(0, step - 1)), [goToStep, step]);

  const goNext = useCallback(() => goToStep(Math.min(TOTAL - 1, step + 1)), [goToStep, step]);

  const sidebar = (
    <>
      <div className="rounded-2xl border border-border bg-card p-5 text-sm shadow-card">
        <div className="flex items-center gap-2 text-brand-700">
          <Lightbulb className="h-4 w-4" />
          <span className="font-semibold text-ink">Tipp</span>
        </div>
        <p className="mt-2 text-ink-muted">{TIPS[step]}</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 text-sm shadow-card">
        <div className="flex items-center gap-2 text-brand-700">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span className="font-semibold text-ink">So geht es weiter</span>
        </div>
        <p className="mt-2 text-ink-muted">
          Nach Ihrer Anfrage besprechen wir Ihr Angebot kurz telefonisch. Danach stellen wir es ohne
          Ihren Namen 72&nbsp;Stunden lang freigeschalteten Küchenstudios aus Ihrer Region vor, die es
          unterbieten können – Ihre Unterlagen nur ohne Namen und Kontaktdaten. Ob Sie ein Angebot
          annehmen, entscheiden Sie frei.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 text-sm shadow-card">
        <div className="flex items-center gap-2 text-brand-700">
          <Phone className="h-4 w-4" aria-hidden="true" />
          <span className="font-semibold text-ink">Brauchen Sie Hilfe?</span>
        </div>
        <p className="mt-2 text-ink-muted">
          Rufen Sie uns an:{" "}
          <a href={phone.href} className="link-inline text-brand-700 decoration-brand-700/70 hover:decoration-brand-700">
            {phone.display}
          </a>
        </p>
      </div>
    </>
  );

  const stepDef = STEPS[step];
  return (
    <FunnelBShell
      currentStep={step}
      totalSteps={TOTAL}
      stepLabel={stepDef.label}
      stepDescription={stepDef.description}
      onBack={handleBack}
      onNext={handleNext}
      canProceed={canProceed}
      isFinalStep={step === TOTAL - 1}
      isSubmitting={submitting}
      sidebar={sidebar}
    >
      {step > 0 && step < TOTAL - 1 && (
        <SkipDetails hasFiles={data.uploads.length > 0} onSkip={() => goToStep(TOTAL - 1)} />
      )}
      {step === 0 && <OfferStep data={data} update={update} />}
      {step === 1 && <Step0 data={data} update={update} goNext={goNext} />}
      {step === 2 && <Step1 data={data} update={update} />}
      {step === 3 && <Step2 data={data} update={update} />}
      {step === 4 && <Step3 data={data} update={update} />}
      {step === 5 && <Step4 data={data} update={update} />}
      {step === 6 && <Step5 data={data} update={update} />}
      {step === 7 && <Step6 data={data} update={update} />}
      {step === 8 && (
        <Step8
          data={data}
          update={update}
          honeypot={honeypot}
          onHoneypot={setHoneypot}
          turnstileRef={turnstileCallbackRef}
        />
      )}

      {submitting && uploadProgress && (
        <p role="status" className="mt-4 text-sm text-ink-muted">
          Unterlagen werden hochgeladen … {uploadProgress.done} von {uploadProgress.total} fertig
        </p>
      )}

      {submitError && (
        <p ref={errorRef} role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-medium text-destructive">
          {submitError}
        </p>
      )}
    </FunnelBShell>
  );
}

const TIPS = [
  "Viele Studios geben Angebot und Planung als PDF mit. Handyfotos der Seiten reichen auch – Hauptsache, Positionen, Maße und Preise sind lesbar.",
  "Je konkreter der Zeitrahmen, desto besser können Küchenstudios Liefertermin und Montage kalkulieren. Ein fester Liefertermin steigert oft den Rabatt.",
  "Wenn Sie Marke oder Material nicht sicher wissen: einfach 'Sonstiger / weiß ich nicht' wählen. Unser Experte ergänzt das im Telefonat.",
  "Die Bezeichnung der Arbeitsplatte (z. B. „Calacatta Roma\") finden Sie meist auf Ihrem schriftlichen Angebot. Optional!",
  "Marke + Modell pro Gerät steigert die Vergleichbarkeit. Beispiele: „Bosch HBG675BS1\", „Miele DGC 7460\".",
  "Spülen-Material und -Marke beeinflussen den Preis stark. Mülltrennsysteme sind oft separat kalkuliert.",
  "Beleuchtung und Steckdosen-Lösungen sind häufige „versteckte\" Posten – hier verlangen Studios oft hohe Aufschläge.",
  "Anzahlung und Finanzierungsbedingungen sind verhandelbar. Geben Sie an, was Ihr Studio Ihnen angeboten hat.",
  "Wir rufen Sie werktags an, bevor wir Ihr Angebot Küchenstudios vorstellen. Passt Ihnen eine bestimmte Uhrzeit, schreiben Sie uns gern eine E-Mail.",
];

/* ====================================================================== */
/* STEP COMPONENTS                                                          */
/* ====================================================================== */

type StepProps = {
  data: FunnelBData;
  update: (patch: Partial<FunnelBData>) => void;
};

function Step0({ data, update, goNext }: StepProps & { goNext: () => void }) {
  return (
    <div className="space-y-6">
      <Field
        label="Wann soll die Küche geliefert/montiert werden?"
        hint="Optional – hilft bei Verfügbarkeitsprüfung."
      >
        <CardGroup
          columns={2}
          options={TIMEFRAMES.map((t) => ({
            value: t.slug,
            label: t.name,
            icon: TIMEFRAME_ICONS_B[t.slug],
          }))}
          value={data.timeframe}
          onChange={(v) => update({ timeframe: v })}
          onAutoAdvance={goNext}
        />
      </Field>
    </div>
  );
}

function Step1({ data, update }: StepProps) {
  const brandOptions: ComboboxOption[] = KITCHEN_BRANDS.map((b) => ({
    value: b.slug,
    label: b.name,
  }));

  const frontMaterialOptions: ComboboxOption[] = FRONT_MATERIALS.map((f) => ({
    value: f.name,
    label: f.name,
    description: f.description,
    group: FRONT_CATEGORY_LABEL[f.category],
  }));

  return (
    <div className="space-y-6">
      <Field
        label="Hersteller / Marke der Küche"
        hint={'Optional. Suchbar – tippen Sie z. B. „Nobilia".'}
      >
        <Combobox
          options={brandOptions}
          value={data.brand}
          onChange={(v) => update({ brand: v })}
          placeholder="– Bitte wählen –"
        />
        {data.brand === "sonstiger" && (
          <input
            type="text"
            placeholder="Marke (Freitext)"
            className="input-field mt-2"
            value={data.brandCustom}
            onChange={(e) => update({ brandCustom: e.target.value })}
          />
        )}
      </Field>

      <Field
        label="Name der Front"
        hint={'Optional. Bezeichnung der Front laut Angebot, z. B. „Riva", „Sylt", „Flash".'}
      >
        <input
          type="text"
          className="input-field"
          placeholder="z. B. Riva, Sylt, Flash"
          value={data.frontName}
          onChange={(e) => update({ frontName: e.target.value })}
        />
      </Field>

      <Field
        label="Frontmaterial"
        hint="Optional. Nach Kategorien gruppiert (Kunststoff, Lack, Echtholz …)."
      >
        <Combobox
          options={frontMaterialOptions}
          value={data.frontMaterialName}
          onChange={(v) => update({ frontMaterialName: v })}
          placeholder="– Bitte wählen –"
        />
      </Field>

      <Field label="Grifftyp" hint="Optional.">
        <CardGroup
          columns={2}
          options={HANDLE_TYPES.map((h) => ({
            value: h.slug,
            label: h.name,
            description: h.description,
            icon: HANDLE_TYPE_ICONS[h.slug],
          }))}
          value={data.handleType}
          onChange={(v) => update({ handleType: v })}
        />
      </Field>
    </div>
  );
}

function Step2({ data, update }: StepProps) {
  const designs = useMemo(() => {
    if (!data.worktopMaterial) return [];
    return WORKTOP_DESIGNS.filter((d) => d.materialSlug === data.worktopMaterial);
  }, [data.worktopMaterial]);

  const designOptions: ComboboxOption[] = designs.map((d) => ({
    value: d.name,
    label: d.name,
    badge: d.manufacturer,
  }));

  return (
    <div className="space-y-6">
      <Field label="Material der Arbeitsplatte" hint="Optional.">
        <CardGroup
          columns={2}
          options={WORKTOP_MATERIALS.map((m) => ({
            value: m.slug,
            label: m.name,
            description: m.description,
            icon: WORKTOP_ICONS[m.slug],
          }))}
          value={data.worktopMaterial}
          onChange={(v) =>
            update({ worktopMaterial: v, worktopDesign: "", worktopDesignCustom: "" })
          }
        />
      </Field>

      {data.worktopMaterial && designs.length > 0 && (
        <Field label="Bekannte Bezeichnungen" hint="Optional – wählen oder unten Freitext.">
          <Combobox
            options={designOptions}
            value={data.worktopDesign}
            onChange={(v) => update({ worktopDesign: v })}
            placeholder="– Keine Auswahl –"
          />
        </Field>
      )}

      <Field
        label="Eigene Bezeichnung / Notiz"
        hint={'Optional. Z. B. „Eiche massiv geölt" oder spezifischer Code vom Studio.'}
      >
        <input
          type="text"
          className="input-field"
          placeholder="z. B. Calacatta Roma 12 mm"
          value={data.worktopDesignCustom}
          onChange={(e) => update({ worktopDesignCustom: e.target.value })}
        />
      </Field>
    </div>
  );
}

function Step3({ data, update }: StepProps) {
  const addAppliance = () => {
    update({
      appliances: [
        ...data.appliances,
        {
          id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          categorySlug: "",
          brandSlug: "",
          model: "",
        },
      ],
    });
  };
  const remove = (id: string) => {
    update({ appliances: data.appliances.filter((a) => a.id !== id) });
  };
  const upd = (id: string, patch: Partial<(typeof data.appliances)[number]>) => {
    update({
      appliances: data.appliances.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  };

  const categoryOptions: ComboboxOption[] = APPLIANCE_CATEGORIES.map((c) => ({
    value: c.slug,
    label: c.name,
  }));
  const brandOptions: ComboboxOption[] = APPLIANCE_BRANDS.map((b) => ({
    value: b.slug,
    label: b.name,
  }));

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">
        Geräte sind komplett optional. Klicken Sie auf{" "}
        <span className="font-medium">„Gerät hinzufügen"</span>, um eine Position einzutragen.
      </p>

      <div className="space-y-3">
        {data.appliances.map((a, i) => (
          <div key={a.id} className="rounded-xl border border-border bg-surface-soft p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase text-ink-subtle">
                {APPLIANCE_CATEGORY_ICON} Gerät {i + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-xs font-medium text-destructive hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" /> Entfernen
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="label-field">Typ</label>
                <Combobox
                  options={categoryOptions}
                  value={a.categorySlug}
                  onChange={(v) => upd(a.id, { categorySlug: v })}
                  placeholder="– Wählen –"
                />
              </div>
              <div>
                <label className="label-field">Marke</label>
                <Combobox
                  options={brandOptions}
                  value={a.brandSlug}
                  onChange={(v) => upd(a.id, { brandSlug: v })}
                  placeholder="– Wählen –"
                />
              </div>
              <div>
                <label className="label-field">Modell / Bezeichnung</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="z. B. HBG675BS1"
                  value={a.model}
                  onChange={(e) => upd(a.id, { model: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addAppliance} className="btn-secondary">
        <Plus className="h-4 w-4" /> Gerät hinzufügen
      </button>
    </div>
  );
}

function Step4({ data, update }: StepProps) {
  const sinkBrandOptions: ComboboxOption[] = SINK_BRANDS.map((b) => ({
    value: b.slug,
    label: b.name,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Spülen-Marke" hint="Optional.">
          <Combobox
            options={sinkBrandOptions}
            value={data.sinkBrand}
            onChange={(v) => update({ sinkBrand: v })}
            placeholder="– Wählen –"
          />
        </Field>

        <Field label="Bezeichnung / Modell" hint={'Optional. z. B. „Blanco Subline 500-U".'}>
          <input
            type="text"
            className="input-field"
            value={data.sinkDesignation}
            onChange={(e) => update({ sinkDesignation: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Spülen-Material" hint="Optional.">
        <CardGroup
          columns={2}
          options={SINK_MATERIALS.map((m) => ({
            value: m.slug,
            label: m.name,
            icon: SINK_MATERIAL_ICONS[m.slug],
          }))}
          value={data.sinkMaterial}
          onChange={(v) => update({ sinkMaterial: v })}
        />
      </Field>

      <Field label="Mülltrennsystem" hint="Optional.">
        <CardGroup
          columns={3}
          options={[
            { value: "yes", label: "Ja, vorgesehen", icon: WASTE_SEP_ICONS.yes },
            { value: "no", label: "Nein, kein System", icon: WASTE_SEP_ICONS.no },
            { value: "unknown", label: "Weiß ich nicht", icon: WASTE_SEP_ICONS.unknown },
          ]}
          value={data.wasteSeparationSystem}
          onChange={(v) =>
            update({ wasteSeparationSystem: v as FunnelBData["wasteSeparationSystem"] })
          }
        />
      </Field>
    </div>
  );
}

function Step5({ data, update }: StepProps) {
  const toggle = (slug: string) => {
    if (data.extras.includes(slug)) {
      update({ extras: data.extras.filter((s) => s !== slug) });
    } else {
      update({ extras: [...data.extras, slug] });
    }
  };
  return (
    <div className="space-y-6">
      <Field
        label="Welche Extras sind im Angebot enthalten?"
        hint="Mehrfachauswahl möglich – alles optional."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {EXTRAS_OPTIONS.map((e) => {
            const selected = data.extras.includes(e.slug);
            return (
              <label
                key={e.slug}
                className={`card-clickable !p-4 ${selected ? "is-selected" : ""}`}
                data-selected={selected}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selected}
                  onChange={() => toggle(e.slug)}
                />
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 h-5 w-5 flex-none rounded border-2 ${
                      selected ? "border-brand-700 bg-brand-700" : "border-input bg-card"
                    }`}
                    aria-hidden="true"
                  >
                    {selected && (
                      <svg className="h-full w-full text-white" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6.5L5 9L9.5 4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ink">{e.name}</div>
                    {e.description && (
                      <div className="mt-0.5 text-xs text-ink-muted">{e.description}</div>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </Field>

      <Field label="Sonstige Komponenten / Notizen" hint="Optional. Alles, was wir noch wissen sollten.">
        <textarea
          rows={3}
          className="input-field"
          placeholder="z. B. Spritzschutz aus Glas, USB-Dosen in Schublade, ..."
          value={data.extrasNotes}
          onChange={(e) => update({ extrasNotes: e.target.value })}
        />
      </Field>
    </div>
  );
}

function Step6({ data, update }: StepProps) {
  return (
    <div className="space-y-6">
      <Field label="Wie soll geliefert werden?" hint="Optional.">
        <CardGroup
          columns={2}
          options={[
            ...DELIVERY_MODES.map((d) => ({
              value: d.slug,
              label: d.name,
              icon: DELIVERY_ICONS[d.slug],
            })),
            {
              value: "unknown",
              label: "Weiß ich nicht",
              icon: DELIVERY_ICONS.unknown,
            },
          ]}
          value={data.deliveryMode}
          onChange={(v) => update({ deliveryMode: v })}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Anzahlung in %" hint="Optional. Was Ihr Studio fordert (z. B. 30 %).">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            className="input-field"
            placeholder="z. B. 30"
            value={data.paymentDownPaymentPercent}
            onChange={(e) => update({ paymentDownPaymentPercent: e.target.value })}
          />
        </Field>

        <Field label="Zahlungsmodalitäten" hint="Optional.">
          <CardGroup
            columns={1}
            options={FINANCING_OPTIONS.map((f) => ({
              value: f.slug,
              label: f.name,
              icon: FINANCING_ICONS[f.slug],
            }))}
            value={data.paymentFinancing}
            onChange={(v) => update({ paymentFinancing: v })}
          />
        </Field>
      </div>

      {data.paymentFinancing === "with_interest" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Effektivzins (% p. a.)" hint="Optional.">
            <input
              type="number"
              min={0}
              step={0.1}
              className="input-field"
              placeholder="z. B. 4.9"
              value={data.paymentFinancingApr}
              onChange={(e) => update({ paymentFinancingApr: e.target.value })}
            />
          </Field>
          <Field label="Laufzeit (Monate)" hint="Optional.">
            <input
              type="number"
              min={1}
              step={1}
              className="input-field"
              placeholder="z. B. 36"
              value={data.paymentFinancingMonths}
              onChange={(e) => update({ paymentFinancingMonths: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function OfferStep({ data, update }: StepProps) {
  const remaining = MAX_LEAD_FILES - data.uploads.length;
  const addFiles = (category: LeadFileCategory, files: File[]) => {
    update({
      uploads: [
        ...data.uploads,
        ...files.map((file) => ({
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          category,
          file,
        })),
      ],
    });
  };
  const remove = (id: string) => {
    update({ uploads: data.uploads.filter((u) => u.id !== id) });
  };

  return (
    <div className="space-y-6">
      <Field
        label="Angebotspreis Ihres Küchenstudios *"
        hint="Pflicht. Bruttopreis in Euro – diesen Preis sollen die Küchenstudios unterbieten."
        controlId="funnel-b-offer-price"
      >
        <div className="relative max-w-xs">
          <input
            id="funnel-b-offer-price"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            className="input-field pr-10"
            placeholder="z. B. 18000"
            value={data.existingOfferPriceEur}
            onChange={(e) => update({ existingOfferPriceEur: e.target.value })}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
            €
          </span>
        </div>
      </Field>

      <Field
        label="Name des Küchenstudios"
        hint="Optional. Hilft uns beim Vergleich, wird den Küchenstudios nicht gezeigt."
      >
        <input
          type="text"
          className="input-field"
          placeholder="z. B. Küchen Müller GmbH, Musterstadt"
          value={data.existingOfferStudio}
          onChange={(e) => update({ existingOfferStudio: e.target.value })}
        />
      </Field>

      <Field
        label="Angebot und Planung *"
        hint="Mit Ihren Unterlagen können wir genau vergleichen – und Sie können die Detailfragen danach überspringen."
      >
        <CardGroup
          columns={2}
          options={[
            {
              value: "now",
              label: "Jetzt hochladen",
              description: "Angebot, Planung oder Fotos – als PDF oder Bild",
              icon: <CloudUpload className="h-5 w-5" />,
            },
            {
              value: "later",
              label: "Später nachreichen",
              description: "Über Ihren persönlichen Projektlink aus der E-Mail",
              icon: <Mail className="h-5 w-5" />,
            },
          ]}
          value={data.offerDeliveryMethod}
          onChange={(v) => update({ offerDeliveryMethod: v as OfferDeliveryMethod })}
        />
      </Field>

      {data.offerDeliveryMethod === "now" && (
        <div className="space-y-3">
          {LEAD_FILE_CATEGORIES.map((option) => (
            <LeadFileDrop
              key={option.value}
              option={option}
              count={data.uploads.filter((u) => u.category === option.value).length}
              remaining={remaining}
              onFiles={(files) => addFiles(option.value, files)}
            />
          ))}
          <PendingFileList files={data.uploads} onRemove={remove} />
          <p className="text-xs text-ink-muted">
            Mindestens eine Datei, höchstens {MAX_LEAD_FILES}, je bis 20 MB (PDF, JPG, PNG, HEIC). Ihre Unterlagen
            sieht zuerst nur unser Team. Küchenstudios zeigen wir sie erst, wenn darauf keine Namen und
            Kontaktdaten mehr zu sehen sind.
          </p>
        </div>
      )}

      {data.offerDeliveryMethod === "later" && (
        <div className="flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm">
          <Mail className="mt-0.5 h-5 w-5 flex-none text-brand-700" aria-hidden="true" />
          <div className="text-ink-muted">
            <div className="font-medium text-ink">Unterlagen später nachreichen</div>
            <p className="mt-1">
              Nach dem Absenden bekommen Sie per E-Mail Ihren persönlichen Projektlink. Dort können Sie Angebot,
              Planung oder Fotos jederzeit hochladen – auch bequem vom Computer aus. Küchenstudios stellen wir Ihr
              Angebot vor, nachdem wir es im Experten-Check mit Ihnen besprochen haben.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Die Detailschritte sind freiwillig; wer alles in den Unterlagen hat, springt direkt zu den Kontaktdaten. */
function SkipDetails({ hasFiles, onSkip }: { hasFiles: boolean; onSkip: () => void }) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-ink-muted">
        {hasFiles
          ? "Alle weiteren Fragen sind freiwillig. Stehen die Details in Ihren Unterlagen, können Sie direkt weiter."
          : "Alle weiteren Fragen sind freiwillig. Was Sie nicht wissen, klären wir im Experten-Check."}
      </p>
      <button type="button" onClick={onSkip} className="btn-ghost flex-none text-sm font-medium text-brand-800">
        Direkt zu den Kontaktdaten
      </button>
    </div>
  );
}

function Step8({
  data,
  update,
  honeypot,
  onHoneypot,
  turnstileRef,
}: StepProps & {
  honeypot: string;
  onHoneypot: (value: string) => void;
  turnstileRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="PLZ *">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            autoComplete="postal-code"
            className="input-field"
            placeholder="12345"
            value={data.postalCode}
            onChange={(e) =>
              update({ postalCode: e.target.value.replace(/\D/g, "").slice(0, 5) })
            }
          />
        </Field>
        <Field label="Stadt" hint="Optional, ergänzen wir aus PLZ.">
          <input
            type="text"
            autoComplete="address-level2"
            className="input-field"
            value={data.city}
            onChange={(e) => update({ city: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Anrede" hint="Optional.">
        <CardGroup
          columns={3}
          options={[
            { value: "frau", label: "Frau" },
            { value: "herr", label: "Herr" },
            { value: "divers", label: "Divers" },
          ]}
          value={data.salutation}
          onChange={(v) => update({ salutation: v as FunnelBData["salutation"] })}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Vorname *">
          <input
            type="text"
            autoComplete="given-name"
            className="input-field"
            value={data.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
          />
        </Field>
        <Field label="Nachname *">
          <input
            type="text"
            autoComplete="family-name"
            className="input-field"
            value={data.lastName}
            onChange={(e) => update({ lastName: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="E-Mail *">
          <input
            type="email"
            autoComplete="email"
            className="input-field"
            value={data.email}
            onChange={(e) => update({ email: e.target.value })}
          />
        </Field>
        <Field label="Telefon *" hint="Wir rufen Sie für den Experten-Check an.">
          <input
            type="tel"
            autoComplete="tel"
            className="input-field"
            value={data.phone}
            onChange={(e) => update({ phone: e.target.value })}
          />
        </Field>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-surface-soft p-4 text-sm">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 flex-none accent-brand-700"
            checked={data.consentShare}
            onChange={(e) =>
              update(
                e.target.checked
                  ? { consentShare: true }
                  : { consentShare: false, consentStudioCall: false },
              )
            }
          />
          <span className="text-ink-muted">
            <strong className="text-ink">Pflicht:</strong> KüchenWert darf mein Angebot und meine
            Unterlagen ohne Namen und Kontaktdaten an Küchenstudios in meiner Region weitergeben,
            damit sie es unterbieten. Meine Kontaktdaten und die vollständigen Unterlagen erhalten
            höchstens drei Studios für Rückfragen sowie das Studio, dessen Angebot ich annehme.
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 flex-none accent-brand-700"
            checked={data.consentCall}
            onChange={(e) => update({ consentCall: e.target.checked })}
          />
          <span className="text-ink-muted">
            <strong className="text-ink">Pflicht:</strong> KüchenWert darf mich zur Klärung meines
            Angebots anrufen (Experten-Check).
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 flex-none accent-brand-700"
            checked={data.consentStudioCall}
            disabled={!data.consentShare}
            onChange={(e) => update({ consentStudioCall: e.target.checked })}
          />
          <span className="text-ink-muted">
            Optional: Küchenstudios, die meine Kontaktdaten erhalten, dürfen mich auch
            telefonisch kontaktieren.
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 flex-none accent-brand-700"
            checked={data.consentMarketing}
            onChange={(e) => update({ consentMarketing: e.target.checked })}
          />
          <span className="text-ink-muted">
            Optional: KüchenWert darf mir Tipps und Marktinformationen rund um meinen
            Küchenkauf per E-Mail schicken.
          </span>
        </label>
        <p className="text-xs text-ink-subtle">
          Einwilligungen können Sie jederzeit widerrufen, z. B. per E-Mail an{" "}
          <a href={`mailto:${BRAND.supportEmail}`} className="underline">
            {BRAND.supportEmail}
          </a>
          . Es gelten unsere{" "}
          <a href="/agb" className="underline">
            AGB
          </a>
          . Wie wir Ihre Daten verarbeiten, erklärt die{" "}
          <a href="/datenschutz" className="underline">
            Datenschutzerklärung
          </a>
          .
        </p>
      </div>

      <div className="sr-only" aria-hidden="true">
        <label htmlFor="funnel-b-website">Website</label>
        <input
          id="funnel-b-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => onHoneypot(e.target.value)}
        />
      </div>
      <div ref={turnstileRef} />
    </div>
  );
}

/* ====================================================================== */
/* SHARED FIELD HELPERS                                                     */
/* ====================================================================== */

const LABELLED_CONTROLS = new Set(["input", "select", "textarea"]);

/**
 * Beschriftetes Feld. Ein einzelnes input/select/textarea bekommt Label und Hinweis
 * per id; steckt das Feld in einem Wrapper, verweist controlId auf das innere Feld.
 * Alles andere (Kachelgruppen, Combobox) wird als benannte Gruppe ausgezeichnet.
 */
function Field({
  label,
  hint,
  controlId,
  children,
}: {
  label: string;
  hint?: string;
  controlId?: string;
  children: React.ReactNode;
}) {
  const baseId = useId();
  const hintId = hint ? `${baseId}-hint` : undefined;
  const hintNode = hint && (
    <p id={hintId} className="helper-text">
      {hint}
    </p>
  );
  const control =
    !controlId && isValidElement<{ id?: string; "aria-describedby"?: string }>(children) &&
    typeof children.type === "string" && LABELLED_CONTROLS.has(children.type)
      ? children
      : null;

  if (control || controlId) {
    const id = controlId ?? control?.props.id ?? `${baseId}-control`;
    return (
      <div>
        <label htmlFor={id} className="label-field">
          {label}
        </label>
        {control ? cloneElement(control, { id, "aria-describedby": hintId }) : children}
        {hintNode}
      </div>
    );
  }

  return (
    <div role="group" aria-labelledby={`${baseId}-label`} aria-describedby={hintId}>
      <p id={`${baseId}-label`} className="label-field">
        {label}
      </p>
      {children}
      {hintNode}
    </div>
  );
}

interface CardGroupOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface CardGroupProps {
  options: CardGroupOption[];
  value: string;
  onChange: (v: string) => void;
  columns?: 1 | 2 | 3;
  /** Auto-Advance Delay in ms; default 250. Nur aktiv wenn onAutoAdvance gesetzt. */
  autoAdvanceMs?: number;
  onAutoAdvance?: () => void;
}

function CardGroup({
  options,
  value,
  onChange,
  columns = 1,
  autoAdvanceMs = 250,
  onAutoAdvance,
}: CardGroupProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auf schmalen Spalten (columns=1) behalten wir Icon links + Text rechts —
  // bei mehreren Spalten schalten wir auf "Quiz-Card": Icon-Bubble zentriert oben,
  // Text darunter — identischer Look wie Funnel A (kuechenportal-Style).
  const colClass =
    columns === 3
      ? "grid-cols-2 sm:grid-cols-3"
      : columns === 2
        ? "grid-cols-2"
        : "";
  const isVertical = columns !== 1;

  function handleClick(v: string) {
    onChange(v);
    if (onAutoAdvance && autoAdvanceMs > 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onAutoAdvance, autoAdvanceMs);
    }
  }

  return (
    <div className={clsx("grid gap-3 sm:gap-4", colClass)}>
      {options.map((o) => {
        const selected = o.value === value;

        if (isVertical) {
          return (
            <button
              type="button"
              key={`${o.value}-${o.label}`}
              onClick={() => handleClick(o.value)}
              aria-pressed={selected}
              className={clsx(
                "group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 px-4 py-6 text-center transition-all",
                selected
                  ? "border-brand-500 bg-brand-50 shadow-card-active ring-4 ring-brand-500/15"
                  : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover",
              )}
            >
              {o.icon && (
                <div
                  className={clsx(
                    "grid h-14 w-14 place-items-center rounded-full transition",
                    selected
                      ? "bg-brand-500 text-white"
                      : "bg-brand-50 text-brand-600 group-hover:bg-brand-100",
                  )}
                >
                  <span className="[&>svg]:h-7 [&>svg]:w-7">{o.icon}</span>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span
                  className={clsx(
                    "font-display text-[15px] font-bold leading-tight sm:text-base",
                    selected ? "text-brand-900" : "text-foreground",
                  )}
                >
                  {o.label}
                </span>
                {o.description && (
                  <span className="text-xs leading-relaxed text-ink-muted">
                    {o.description}
                  </span>
                )}
              </div>
            </button>
          );
        }

        // 1-Spalten-Layout: kompakter, horizontal — fuer Listen wie
        // Wohnsituation-Sub-Optionen. Icon links, Text rechts,
        // aber modernisiert ohne den alten Check-Haken.
        return (
          <button
            type="button"
            key={`${o.value}-${o.label}`}
            onClick={() => handleClick(o.value)}
            aria-pressed={selected}
            className={clsx(
              "group flex items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left transition-all",
              selected
                ? "border-brand-500 bg-brand-50 shadow-card-active ring-4 ring-brand-500/15"
                : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover",
            )}
          >
            {o.icon && (
              <div
                className={clsx(
                  "grid h-12 w-12 flex-none place-items-center rounded-full transition",
                  selected
                    ? "bg-brand-500 text-white"
                    : "bg-brand-50 text-brand-600 group-hover:bg-brand-100",
                )}
              >
                <span className="[&>svg]:h-6 [&>svg]:w-6">{o.icon}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div
                className={clsx(
                  "font-display text-[15px] font-bold leading-tight",
                  selected ? "text-brand-900" : "text-foreground",
                )}
              >
                {o.label}
              </div>
              {o.description && (
                <div className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  {o.description}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
