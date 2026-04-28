import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { supabase } from "@/integrations/supabase/client";
import { getStoredUtm } from "@/lib/utm";
import {
  Plus,
  Trash2,
  FileUp,
  ShieldCheck,
  Lightbulb,
  Phone,
  Mail,
  CloudUpload,
  AlertCircle,
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
  /** Wie wird das Studio-Angebot uebermittelt? "now" = Upload jetzt, "later" = Per E-Mail nachreichen */
  offerDeliveryMethod: OfferDeliveryMethod;
  uploads: { id: string; category: "angebot" | "grundriss" | "kueche_bild"; file: File }[];

  postalCode: string;
  city: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  salutation: "frau" | "herr" | "divers" | "";
  consentCall: boolean;
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
  consentCall: false,
  consentMarketing: false,
};

const STEPS = [
  { label: "Ihre Situation", description: "Wann soll die Küche geliefert oder montiert werden?" },
  { label: "Korpus & Fronten", description: "Welche Marke, welches Material, welcher Grifftyp?" },
  { label: "Arbeitsplatte", description: "Material und – falls bekannt – die genaue Bezeichnung." },
  { label: "Geräte", description: "Welche Geräte sind im Angebot? Marke und Modell, falls bekannt." },
  { label: "Sanitär & Müllsystem", description: "Spüle, Material, Mülltrennsystem ja/nein." },
  { label: "Ausstattung & Zubehör", description: "Steckdosen, Beleuchtung, Besteckeinsatz, Sonstiges." },
  { label: "Lieferung & Zahlung", description: "Liefermodus, Anzahlung, Finanzierungswunsch." },
  { label: "Vorhandenes Angebot", description: "Wer hat angeboten, wieviel kostet es, optional Upload." },
  { label: "Ihre Kontaktdaten", description: "Damit wir uns für den Experten-Check melden können." },
];

const TOTAL = STEPS.length;

const STORAGE_KEY = "kw_funnel_b";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/** Persist nur JSON-serialisierbare Felder, keine File-Objekte. */
function serializeForStorage(data: FunnelBData): string {
  const { uploads: _u, ...rest } = data;
  void _u;
  return JSON.stringify(rest);
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
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FunnelBData>(() => ({
    ...initialData,
    ...loadSaved(),
    uploads: [], // nie aus storage rehydrieren
  }));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      case 7: {
        const priceOk = Number(data.existingOfferPriceEur) > 0;
        if (!priceOk) return false;
        if (data.offerDeliveryMethod === "later") return true;
        if (data.offerDeliveryMethod === "now") {
          const hasKuecheBild = data.uploads.some(
            (u) => u.category === "kueche_bild",
          );
          return hasKuecheBild;
        }
        return false;
      }
      case 8:
        return (
          /^\d{5}$/.test(data.postalCode) &&
          data.firstName.trim().length > 1 &&
          data.lastName.trim().length > 1 &&
          /\S+@\S+\.\S+/.test(data.email) &&
          data.phone.trim().length >= 6 &&
          data.consentCall
        );
      default:
        return true;
    }
  }, [step, data]);

  const handleNext = useCallback(async () => {
    if (step < TOTAL - 1) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const utm = getStoredUtm();

      const priceCents = data.existingOfferPriceEur
        ? Math.round(Number(data.existingOfferPriceEur) * 100)
        : null;

      const { data: inserted, error: insertError } = await supabase
        .from("leads")
        .insert({
          funnel_type: "b",
          postal_code: data.postalCode,
          city: data.city || null,
          first_name: data.firstName || null,
          last_name: data.lastName || null,
          email: data.email || null,
          phone: data.phone || null,
          kitchen_form: null,
          kitchen_style: null,
          purchase_reason: null,
          housing_type: null,
          budget_midpoint: priceCents,
          timeframe_months:
            TIMEFRAMES.find((t) => t.slug === data.timeframe)?.months ?? null,
          delivery_mode: data.deliveryMode || null,
          payment_financing: data.paymentFinancing || null,
          payment_financing_apr: data.paymentFinancingApr
            ? Number(data.paymentFinancingApr)
            : null,
          payment_financing_months: data.paymentFinancingMonths
            ? Number(data.paymentFinancingMonths)
            : null,
          payment_down_payment_percent: data.paymentDownPaymentPercent
            ? Number(data.paymentDownPaymentPercent)
            : null,
          has_existing_offer: true,
          existing_offer_studio: data.existingOfferStudio || null,
          existing_offer_price_cents: priceCents,
          waste_separation_system:
            data.wasteSeparationSystem === "yes"
              ? true
              : data.wasteSeparationSystem === "no"
                ? false
                : null,
          special_wishes: data.extras,
          consent_call: data.consentCall,
          consent_marketing: data.consentMarketing,
          funnel_answers: {
            brand: data.brand,
            brandCustom: data.brandCustom,
            frontName: data.frontName,
            frontMaterialName: data.frontMaterialName,
            handleType: data.handleType,
            worktopMaterial: data.worktopMaterial,
            worktopDesign: data.worktopDesign,
            worktopDesignCustom: data.worktopDesignCustom,
            appliances: data.appliances,
            sinkBrand: data.sinkBrand,
            sinkMaterial: data.sinkMaterial,
            sinkDesignation: data.sinkDesignation,
            extrasNotes: data.extrasNotes,
            salutation: data.salutation,
            offerDeliveryMethod: data.offerDeliveryMethod,
            timeframeSlug: data.timeframe,
          },
          utm_source: utm.utm_source ?? null,
          utm_medium: utm.utm_medium ?? null,
          utm_campaign: utm.utm_campaign ?? null,
          utm_term: utm.utm_term ?? null,
          utm_content: utm.utm_content ?? null,
          user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
          landing_page:
            typeof window !== "undefined" ? window.location.pathname : null,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      const leadId = inserted.id;

      for (const { category, file } of data.uploads) {
        const ext = file.name.split(".").pop() ?? "bin";
        const safe = file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .slice(0, 60);
        const path = `${leadId}/${category}-${crypto.randomUUID()}-${safe}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("lead-files")
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (uploadError) {
          console.error("Upload failed", uploadError);
          continue;
        }

        await supabase.from("lead_files").insert({
          lead_id: leadId,
          file_url: path,
          file_name: file.name,
          file_type: file.type || "application/octet-stream",
          file_size_bytes: file.size,
          category,
        });
      }

      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* storage not available */
      }
      navigate(`/funnel/danke?funnel=b&id=${leadId}`);
    } catch (e) {
      console.error("Funnel B submit error", e);
      setSubmitError(e instanceof Error ? e.message : "Unbekannter Fehler");
      setSubmitting(false);
    }
  }, [step, data, navigate]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const goNext = useCallback(() => {
    setStep((s) => Math.min(TOTAL - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const sidebar = (
    <>
      <div className="card text-sm">
        <div className="flex items-center gap-2 text-brand-700">
          <Lightbulb className="h-4 w-4" />
          <span className="font-semibold text-ink">Tipp</span>
        </div>
        <p className="mt-2 text-ink-muted">{TIPS[step]}</p>
      </div>
      <div className="card text-sm">
        <div className="flex items-center gap-2 text-accent-700">
          <ShieldCheck className="h-4 w-4" />
          <span className="font-semibold text-ink">Verbindliche Auktion</span>
        </div>
        <p className="mt-2 text-ink-muted">
          Nach unserem Experten-Check stellen wir Ihre Anfrage neutralisiert für
          72&nbsp;h ein. Verifizierte Händler unterbieten den Preis Ihres Studios –
          Sie nehmen das beste Gebot verbindlich an.
        </p>
      </div>
      <div className="card text-sm">
        <div className="flex items-center gap-2 text-brand-700">
          <Phone className="h-4 w-4" />
          <span className="font-semibold text-ink">Brauchen Sie Hilfe?</span>
        </div>
        <p className="mt-2 text-ink-muted">
          Rufen Sie uns an:{" "}
          <a href="tel:+4900000000" className="font-medium text-brand-700 hover:underline">
            +49 (0) 000 00 00 00
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
      {step === 0 && <Step0 data={data} update={update} goNext={goNext} />}
      {step === 1 && <Step1 data={data} update={update} />}
      {step === 2 && <Step2 data={data} update={update} />}
      {step === 3 && <Step3 data={data} update={update} />}
      {step === 4 && <Step4 data={data} update={update} />}
      {step === 5 && <Step5 data={data} update={update} />}
      {step === 6 && <Step6 data={data} update={update} />}
      {step === 7 && <Step7 data={data} update={update} />}
      {step === 8 && <Step8 data={data} update={update} />}

      {submitError && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {submitError}
        </p>
      )}
    </FunnelBShell>
  );
}

const TIPS = [
  "Je konkreter der Zeitrahmen, desto besser können Händler Liefertermin und Montage kalkulieren. Fester Liefertermin steigert oft den Rabatt.",
  "Wenn Sie Marke oder Material nicht sicher wissen: einfach 'Sonstiger / weiß ich nicht' wählen. Unser Experte ergänzt das im Telefonat.",
  "Die Bezeichnung der Arbeitsplatte (z. B. „Calacatta Roma\") finden Sie meist auf Ihrem schriftlichen Angebot. Optional!",
  "Marke + Modell pro Gerät steigert die Vergleichbarkeit. Beispiele: „Bosch HBG675BS1\", „Miele DGC 7460\".",
  "Spülen-Material und -Marke beeinflussen den Preis stark. Mülltrennsysteme sind oft separat kalkuliert.",
  "Beleuchtung und Steckdosen-Lösungen sind häufige „versteckte\" Posten – hier verlangen Studios oft hohe Aufschläge.",
  "Anzahlung und Finanzierungsbedingungen sind verhandelbar. Geben Sie an, was Ihr Studio Ihnen angeboten hat.",
  "Sie haben Angebot & Grundriss nicht zur Hand? Kein Problem – wir senden Ihnen nach der Anfrage einen sicheren Upload-Link per E-Mail.",
  "Wir rufen Sie binnen 24h an – das ist Pflichtschritt vor jeder Auktion. SMS oder E-Mail-Termine sind möglich.",
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
          <div key={a.id} className="rounded-lg border border-slate-200 bg-surface-soft p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase text-ink-subtle">
                {APPLIANCE_CATEGORY_ICON} Gerät {i + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
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
                      selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"
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

function Step7({ data, update }: StepProps) {
  const addFile = (category: "angebot" | "grundriss" | "kueche_bild", file: File) => {
    update({
      uploads: [
        ...data.uploads,
        {
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          category,
          file,
        },
      ],
    });
  };
  const remove = (id: string) => {
    update({ uploads: data.uploads.filter((u) => u.id !== id) });
  };
  const formatBytes = (b: number) => `${(b / 1024 / 1024).toFixed(2)} MB`;

  return (
    <div className="space-y-6">
      <Field
        label="Angebotspreis Ihres Küchenstudios *"
        hint="Pflicht. Brutto in Euro – das werden die Händler in der Auktion unterbieten."
      >
        <div className="relative max-w-xs">
          <input
            type="number"
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
        hint="Optional. Hilft uns bei Quervergleichen, wird Händlern nicht gezeigt."
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
        label="Wie möchten Sie uns das Bild Ihrer geplanten Küche zukommen lassen? *"
        hint="Pflicht. Mindestens ein Bild der geplanten Küche. Angebot und Grundriss sind optional, helfen den Händlern aber bei einem präziseren Gegenangebot."
      >
        <CardGroup
          columns={2}
          options={[
            {
              value: "now",
              label: "Jetzt hochladen",
              description: "Ich habe das Bild (und evtl. Angebot / Grundriss) zur Hand",
              icon: <CloudUpload className="h-5 w-5" />,
            },
            {
              value: "later",
              label: "Per E-Mail nachreichen",
              description: "Ich erhalte einen sicheren Upload-Link",
              icon: <Mail className="h-5 w-5" />,
            },
          ]}
          value={data.offerDeliveryMethod}
          onChange={(v) =>
            update({ offerDeliveryMethod: v as OfferDeliveryMethod })
          }
        />
      </Field>

      {data.offerDeliveryMethod === "now" && (
        <div className="space-y-3">
          <UploadDrop
            label="Bild der geplanten Küche *"
            description="Pflicht. JPG / PNG. Max. 10 MB."
            accept="image/*"
            onFile={(f) => addFile("kueche_bild", f)}
            done={data.uploads.some((u) => u.category === "kueche_bild")}
          />
          <UploadDrop
            label="Schriftliches Angebot hochladen"
            description="Optional. PDF oder Bild. Max. 10 MB."
            accept="application/pdf,image/*"
            onFile={(f) => addFile("angebot", f)}
            done={data.uploads.some((u) => u.category === "angebot")}
          />
          <UploadDrop
            label="Grundriss hochladen"
            description="Optional. PDF oder Bild. Max. 10 MB."
            accept="application/pdf,image/*"
            onFile={(f) => addFile("grundriss", f)}
            done={data.uploads.some((u) => u.category === "grundriss")}
          />

          {data.uploads.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-surface-soft p-4">
              <div className="mb-2 text-xs font-semibold uppercase text-ink-subtle">
                Hochgeladen ({data.uploads.length})
              </div>
              <ul className="space-y-1 text-sm">
                {data.uploads.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">
                      <span className="chip mr-2">{u.category}</span>
                      {u.file.name}{" "}
                      <span className="text-xs text-ink-subtle">
                        ({formatBytes(u.file.size)})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(u.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Entfernen
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {data.offerDeliveryMethod === "later" && (
        <div className="flex items-start gap-3 rounded-lg border border-accent-200 bg-accent-50 p-4 text-sm">
          <Mail className="mt-0.5 h-5 w-5 flex-none text-accent-700" />
          <div className="text-ink-muted">
            <div className="font-medium text-ink">Upload-Link per E-Mail</div>
            <p className="mt-1">
              Direkt nach Abschluss dieses Formulars erhalten Sie eine E-Mail mit
              einem sicheren Upload-Link für das Bild Ihrer geplanten Küche (Pflicht)
              sowie optional Angebot und Grundriss. Ihre Auktion startet, sobald das
              Bild eingegangen ist.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Step8({ data, update }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="PLZ *">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
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
            className="input-field"
            value={data.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
          />
        </Field>
        <Field label="Nachname *">
          <input
            type="text"
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
            className="input-field"
            value={data.email}
            onChange={(e) => update({ email: e.target.value })}
          />
        </Field>
        <Field label="Telefon *" hint="Wir rufen Sie für den Experten-Check an.">
          <input
            type="tel"
            className="input-field"
            value={data.phone}
            onChange={(e) => update({ phone: e.target.value })}
          />
        </Field>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-surface-soft p-4 text-sm">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 flex-none accent-brand-700"
            checked={data.consentCall}
            onChange={(e) => update({ consentCall: e.target.checked })}
          />
          <span className="text-ink-muted">
            <strong className="text-ink">Pflicht:</strong> Ich willige ein, dass mich KüchenWert
            telefonisch zur Klärung meines Angebots kontaktiert. Ich kann diese Einwilligung
            jederzeit widerrufen.
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
            Optional: Ich möchte Tipps und Marktinformationen rund um meinen Küchenkauf per
            E-Mail erhalten.
          </span>
        </label>
        <p className="text-xs text-ink-subtle">
          Mit Absenden bestätigen Sie unsere{" "}
          <a href="/datenschutz" className="underline">
            Datenschutzerklärung
          </a>{" "}
          und{" "}
          <a href="/agb" className="underline">
            AGB
          </a>
          .
        </p>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* SHARED FIELD HELPERS                                                     */
/* ====================================================================== */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label-field">{label}</label>
      {children}
      {hint && <p className="helper-text">{hint}</p>}
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
                  : "border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-card-hover",
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
                    selected ? "text-brand-900" : "text-black",
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
                : "border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-card-hover",
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
                  selected ? "text-brand-900" : "text-black",
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

function UploadDrop({
  label,
  description,
  accept,
  onFile,
  done = false,
}: {
  label: string;
  description?: string;
  accept?: string;
  onFile: (f: File) => void;
  done?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function acceptFile(f: File) {
    setError(null);
    if (f.size > MAX_UPLOAD_BYTES) {
      setError(`Datei ist zu groß (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximal 10 MB erlaubt.`);
      return;
    }
    onFile(f);
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) acceptFile(f);
        }}
        className={clsx(
          "flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed p-4 transition",
          done
            ? "border-accent-400 bg-accent-50"
            : dragOver
              ? "border-brand-500 bg-brand-50"
              : "border-slate-300 bg-surface-soft hover:border-brand-300 hover:bg-white",
        )}
      >
        <FileUp
          className={clsx(
            "h-5 w-5 flex-none",
            done ? "text-accent-700" : "text-brand-700",
          )}
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-ink">{label}</div>
          {description && <div className="text-xs text-ink-muted">{description}</div>}
        </div>
        <span className="btn-ghost text-xs">
          {done ? "Weitere Datei" : dragOver ? "Loslassen" : "Datei wählen"}
        </span>
        <input
          type="file"
          className="sr-only"
          accept={accept}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) acceptFile(f);
            e.currentTarget.value = "";
          }}
        />
      </label>
      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}
