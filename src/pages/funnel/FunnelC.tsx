import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
  RefreshCcw,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { captureUtmParams, getStoredUtm } from "@/lib/utm";
import { notifyKitchenFunnelLead } from "@/lib/funnelLeadNotify";
import {
  generateTransactionId,
  setEnhancedConversionFromForm,
  trackKitchenFunnelLead,
} from "@/lib/gadsConversionService";
import { trackMetaLead } from "@/lib/metaPixelService";

/**
 * Funnel C — Traumkueche AI-Visualisierung
 *
 * 3-Schritte MVP:
 *   1. Spec waehlen (Form, Stil, Farbpalette, Material, Geraete-Segment)
 *   2. AI-Bild generieren lassen (FAL.ai Flux Pro via Edge Function)
 *   3. Lead-Capture (Name, Email, PLZ, Zeitrahmen) -> verknuepft die Session
 *      mit einem Lead-Datensatz und leitet auf /funnel/danke weiter.
 */

type SpecStep = "spec";
type RenderStep = "render";
type ContactStep = "contact";
type WizardStep = SpecStep | RenderStep | ContactStep;

const FORM_OPTIONS = [
  { value: "zeile", label: "Küchenzeile", desc: "Einzeilig, platzsparend" },
  { value: "l", label: "L-Form", desc: "Gute Flächennutzung in der Ecke" },
  { value: "u", label: "U-Form", desc: "Viel Stauraum & Arbeitsfläche" },
  { value: "insel", label: "Mit Kochinsel", desc: "Offener Wohn-Ess-Bereich" },
  { value: "parallel", label: "Parallel / Zweizeilig", desc: "Zwei gegenüberliegende Zeilen" },
  { value: "g", label: "G-Form", desc: "U-Form mit Halbinsel / Theke" },
] as const;

const STYLE_OPTIONS = [
  { value: "modern", label: "Modern", desc: "Grifflos, matt / Hochglanz" },
  { value: "landhaus", label: "Landhaus", desc: "Rahmenfronten, warm & klassisch" },
  { value: "minimalistisch", label: "Minimalistisch", desc: "Clean, reduziert, skandinavisch" },
  { value: "industrial", label: "Industrial", desc: "Schwarz, Metall, Betonoptik" },
  { value: "klassisch", label: "Klassisch", desc: "Zeitlos, elegant" },
  { value: "design", label: "Design / Luxus", desc: "Bulthaup, SieMatic, Poggenpohl" },
] as const;

const COLOR_OPTIONS = [
  { value: "warm", label: "Warm", desc: "Creme, Eiche, Beige" },
  { value: "cool", label: "Kühl", desc: "Grau, Weiß, Edelstahl" },
  { value: "bold", label: "Kontrast", desc: "Dunkelblau / Grün + Holz" },
  { value: "natural", label: "Natur", desc: "Holz & Stein" },
  { value: "mono", label: "Monochrom", desc: "Schwarz / Weiß / Anthrazit" },
] as const;

const FRONT_OPTIONS = [
  { value: "matt lacquer", label: "Mattlack" },
  { value: "high gloss", label: "Hochglanz" },
  { value: "real wood veneer", label: "Echtholz-Furnier" },
  { value: "solid wood", label: "Massivholz" },
  { value: "concrete look", label: "Betonoptik" },
  { value: "laminate", label: "Laminat / Melamin" },
] as const;

const WORKTOP_OPTIONS = [
  { value: "naturstein granit", label: "Naturstein (Granit)", tier: "premium" },
  { value: "quartz stone", label: "Quarzstein", tier: "premium" },
  { value: "dekton", label: "Dekton / Keramik", tier: "premium" },
  { value: "holz", label: "Massivholz-Arbeitsplatte", tier: "mid" },
  { value: "laminat", label: "Laminat / Schichtstoff", tier: "basic" },
  { value: "edelstahl", label: "Edelstahl", tier: "mid" },
] as const;

const APPLIANCE_OPTIONS = [
  { value: "budget", label: "Basis", desc: "z. B. Beko, Amica" },
  { value: "mittel", label: "Mittelklasse", desc: "Bosch, Siemens, AEG" },
  { value: "premium", label: "Premium", desc: "Miele, NEFF" },
  { value: "luxus", label: "Luxus", desc: "Gaggenau, Liebherr Monolith" },
] as const;

type Spec = {
  kitchen_form: string;
  kitchen_style: string;
  color_scheme: string;
  front_material: string;
  worktop_material: string;
  appliance_segment: string;
};

type PriceRange = { min_eur: number; max_eur: number };

type GenerateResponse = {
  ok: boolean;
  session_token: string;
  render_id: string;
  version: number;
  image_url: string;
  price_range: PriceRange | null;
  error?: string;
};

type SubmitResponse = {
  ok: boolean;
  lead_id?: string;
  error?: string;
};

type ContactData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  postalCode: string;
  timeframeMonths: string;
  consentCall: boolean;
  consentMarketing: boolean;
};

const INITIAL_SPEC: Spec = {
  kitchen_form: "",
  kitchen_style: "",
  color_scheme: "warm",
  front_material: "matt lacquer",
  worktop_material: "quartz stone",
  appliance_segment: "mittel",
};

const INITIAL_CONTACT: ContactData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  postalCode: "",
  timeframeMonths: "",
  consentCall: false,
  consentMarketing: false,
};

const STORAGE_KEY = "kw_funnel_c_state_v1";

type PersistedState = {
  step: WizardStep;
  spec: Spec;
  sessionToken: string | null;
  imageUrl: string | null;
  priceRange: PriceRange | null;
  version: number;
  contact: ContactData;
};

function loadPersisted(): Partial<PersistedState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedState>) : null;
  } catch {
    return null;
  }
}

function savePersisted(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota oder iframe-Restriktion; silent fail
  }
}

function clearPersisted(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // silent
  }
}

export default function FunnelC() {
  const navigate = useNavigate();
  const persisted = useMemo(() => loadPersisted(), []);

  const [step, setStep] = useState<WizardStep>(persisted?.step ?? "spec");
  const [spec, setSpec] = useState<Spec>(persisted?.spec ?? INITIAL_SPEC);

  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(persisted?.imageUrl ?? null);
  const [sessionToken, setSessionToken] = useState<string | null>(
    persisted?.sessionToken ?? null
  );
  const [priceRange, setPriceRange] = useState<PriceRange | null>(
    persisted?.priceRange ?? null
  );
  const [version, setVersion] = useState<number>(persisted?.version ?? 0);
  const [genError, setGenError] = useState<string | null>(null);

  const [contact, setContact] = useState<ContactData>(
    persisted?.contact ?? INITIAL_CONTACT
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    captureUtmParams();
  }, []);

  useEffect(() => {
    savePersisted({
      step,
      spec,
      sessionToken,
      imageUrl,
      priceRange,
      version,
      contact,
    });
  }, [step, spec, sessionToken, imageUrl, priceRange, version, contact]);

  const canGenerate = useMemo(
    () => Boolean(spec.kitchen_form && spec.kitchen_style),
    [spec]
  );

  async function handleGenerate(variantHint?: string) {
    if (!canGenerate || generating) return;
    setGenerating(true);
    setGenError(null);
    setImageUrl(null);
    setStep("render");
    try {
      const utm = getStoredUtm();
      const { data, error } = await supabase.functions.invoke<GenerateResponse>(
        "kw-planner-generate",
        {
          body: {
            session_token: sessionToken ?? undefined,
            spec,
            user_message: variantHint ? variantHint.trim() : undefined,
            utm,
          },
        }
      );
      if (error) throw new Error(error.message || "Netzwerkfehler");
      if (!data?.ok) throw new Error(data?.error || "Bild-Generierung fehlgeschlagen");
      setSessionToken(data.session_token);
      setImageUrl(data.image_url);
      setPriceRange(data.price_range);
      setVersion(data.version);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmitLead(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !sessionToken) return;
    if (!contact.firstName || !contact.lastName || !contact.email || !contact.postalCode) {
      setSubmitError("Bitte Vor-, Nachname, E-Mail und PLZ ausfüllen.");
      return;
    }
    if (!/^\d{5}$/.test(contact.postalCode)) {
      setSubmitError("PLZ muss 5 Ziffern haben.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data, error } = await supabase.functions.invoke<SubmitResponse>(
        "kw-planner-submit-lead",
        {
          body: {
            session_token: sessionToken,
            first_name: contact.firstName.trim(),
            last_name: contact.lastName.trim(),
            email: contact.email.trim().toLowerCase(),
            phone: contact.phone.trim() || undefined,
            postal_code: contact.postalCode.trim(),
            timeframe_months: contact.timeframeMonths
              ? Number(contact.timeframeMonths)
              : undefined,
            consent_call: contact.consentCall,
            consent_marketing: contact.consentMarketing,
          },
        }
      );
      if (error) throw new Error(error.message || "Netzwerkfehler");
      if (!data?.ok) throw new Error(data?.error || "Übermittlung fehlgeschlagen");
      const transactionId = generateTransactionId("funnel_c");
      notifyKitchenFunnelLead({
        funnel: "c",
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        postalCode: contact.postalCode,
        kitchenForm: spec.kitchen_form,
        transactionId,
      });
      await setEnhancedConversionFromForm({
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        postalCode: contact.postalCode,
      });
      await trackKitchenFunnelLead("c", transactionId);
      trackMetaLead({
        content_name: "Funnel C",
        content_category: "Traumküche",
      });
      clearPersisted();
      navigate("/funnel/danke?funnel=traumkueche");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout
      title={`Traumküchen-Planer (KI) | ${BRAND.name}`}
      description="Beschreiben Sie Ihre Wunsch-Küche – unsere KI generiert in 30-60 Sekunden ein fotorealistisches Bild und schätzt den Preis. Anschließend melden sich geprüfte Küchenstudios."
      canonicalPath="/funnel/c"
    >
      <section className="min-h-[70vh] py-10 sm:py-14 bg-gradient-to-b from-background via-muted/20 to-background">
        <div className="container max-w-5xl px-4 sm:px-6 lg:px-8">
          <HeaderBlock step={step} />

          {step === "spec" && (
            <SpecStepView
              spec={spec}
              setSpec={setSpec}
              canGenerate={canGenerate}
              onGenerate={() => handleGenerate()}
            />
          )}

          {step === "render" && (
            <RenderStepView
              generating={generating}
              imageUrl={imageUrl}
              genError={genError}
              priceRange={priceRange}
              version={version}
              onRegenerate={(variantHint) => handleGenerate(variantHint)}
              onBack={() => setStep("spec")}
              onContinue={() => setStep("contact")}
            />
          )}

          {step === "contact" && imageUrl && (
            <ContactStepView
              imageUrl={imageUrl}
              priceRange={priceRange}
              contact={contact}
              setContact={setContact}
              submitting={submitting}
              submitError={submitError}
              onSubmit={handleSubmitLead}
              onBack={() => setStep("render")}
            />
          )}
        </div>
      </section>
    </PageLayout>
  );
}

// ---------------------------------------------------------------------------
// Header / Stepper
// ---------------------------------------------------------------------------

function HeaderBlock({ step }: { step: WizardStep }) {
  const steps: Array<{ key: WizardStep; label: string }> = [
    { key: "spec", label: "Stil & Form" },
    { key: "render", label: "Bild generieren" },
    { key: "contact", label: "Angebote erhalten" },
  ];
  const activeIdx = steps.findIndex((s) => s.key === step);
  return (
    <div className="mb-8 text-center">
      <div className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-xs font-semibold text-primary mb-4">
        <Sparkles className="w-3.5 h-3.5 mr-1.5 fill-primary" />
        Traumküchen-KI · Beta
      </div>
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3">
        Ihre Traumküche in <span className="text-primary">60 Sekunden</span>
      </h1>
      <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
        Drei Klicks – KI-generiertes Bild Ihrer Wunsch-Küche und eine realistische
        Preisspanne. Passende Küchenstudios melden sich nur, wenn Sie das wollen.
      </p>

      <ol className="mt-8 grid grid-cols-3 gap-2 max-w-2xl mx-auto" aria-label="Fortschritt">
        {steps.map((s, i) => {
          const isActive = i === activeIdx;
          const isDone = i < activeIdx;
          return (
            <li
              key={s.key}
              className={[
                "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold border transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : isDone
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted/40 text-muted-foreground border-border",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  isActive
                    ? "bg-primary-foreground text-primary"
                    : isDone
                    ? "bg-primary text-primary-foreground"
                    : "bg-border text-foreground",
                ].join(" ")}
              >
                {isDone ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Spec
// ---------------------------------------------------------------------------

function SpecStepView({
  spec,
  setSpec,
  canGenerate,
  onGenerate,
}: {
  spec: Spec;
  setSpec: (s: Spec) => void;
  canGenerate: boolean;
  onGenerate: () => void;
}) {
  const update = (patch: Partial<Spec>) => setSpec({ ...spec, ...patch });

  return (
    <div className="space-y-8 bg-card border rounded-2xl shadow-sm p-6 sm:p-8">
      <CardSection
        title="Welche Form hat Ihre Küche?"
        hint="Pflicht – bestimmt Grundriss & Perspektive im Rendering."
      >
        <OptionGrid
          options={FORM_OPTIONS.map((o) => ({ value: o.value, label: o.label, desc: o.desc }))}
          value={spec.kitchen_form}
          onChange={(v) => update({ kitchen_form: v })}
        />
      </CardSection>

      <CardSection
        title="Welcher Stil gefällt Ihnen?"
        hint="Pflicht – prägt Fronten, Linie & Atmosphäre."
      >
        <OptionGrid
          options={STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label, desc: o.desc }))}
          value={spec.kitchen_style}
          onChange={(v) => update({ kitchen_style: v })}
        />
      </CardSection>

      <CardSection title="Farbwelt" hint="Optional – passt die Palette an.">
        <OptionGrid
          options={COLOR_OPTIONS.map((o) => ({ value: o.value, label: o.label, desc: o.desc }))}
          value={spec.color_scheme}
          onChange={(v) => update({ color_scheme: v })}
          cols={5}
        />
      </CardSection>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CardSection title="Fronten" compact>
          <SelectLite
            options={FRONT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={spec.front_material}
            onChange={(v) => update({ front_material: v })}
          />
        </CardSection>
        <CardSection title="Arbeitsplatte" compact>
          <SelectLite
            options={WORKTOP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={spec.worktop_material}
            onChange={(v) => update({ worktop_material: v })}
          />
        </CardSection>
        <CardSection title="Geräte-Segment" compact>
          <SelectLite
            options={APPLIANCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={spec.appliance_segment}
            onChange={(v) => update({ appliance_segment: v })}
          />
        </CardSection>
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-2">
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          Keine Kontaktdaten nötig · KI-Bild & Preisspanne sofort
        </p>
        <Button
          size="lg"
          className="gradient-hero hover:shadow-glow h-12 px-8 text-base font-semibold w-full sm:w-auto"
          disabled={!canGenerate}
          onClick={onGenerate}
        >
          <Wand2 className="mr-2 h-5 w-5" />
          Traumküche generieren
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Render
// ---------------------------------------------------------------------------

const VARIANT_HINTS: Array<{ label: string; hint: string }> = [
  { label: "Wärmeres Licht", hint: "warmer Tageslicht-Einfall, goldene Abendstimmung, einladend" },
  { label: "Dunklere Fronten", hint: "tiefe, dunkle Frontfarbe (Anthrazit / Tannengrün), elegant-matt" },
  { label: "Mehr Holz", hint: "deutlich mehr sichtbares Holz an Arbeitsplatte und Akzentmöbeln" },
  { label: "Messing-Akzente", hint: "hochwertige Messing-/Brass-Griffe und -Armaturen als Farbakzent" },
  { label: "Offener Grundriss", hint: "offene Wohnküche mit Blick in Ess-/Wohnbereich, großzügige Perspektive" },
];

function RenderStepView({
  generating,
  imageUrl,
  genError,
  priceRange,
  version,
  onRegenerate,
  onBack,
  onContinue,
}: {
  generating: boolean;
  imageUrl: string | null;
  genError: string | null;
  priceRange: PriceRange | null;
  version: number;
  onRegenerate: (variantHint?: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="bg-card border rounded-2xl shadow-sm p-6 sm:p-8">
      <div className="relative rounded-xl overflow-hidden border aspect-[3/2] bg-muted/40 mb-6">
        {generating && !imageUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground p-6 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-base font-semibold text-foreground">
              KI rendert Ihre Traumküche …
            </p>
            <p className="text-sm">
              Das dauert typischerweise 20-60 Sekunden. Bitte Tab offen lassen.
            </p>
          </div>
        )}
        {!generating && genError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-destructive p-6 text-center">
            <p className="text-base font-semibold">Fehler bei der Generierung</p>
            <p className="text-sm">{genError}</p>
          </div>
        )}
        {imageUrl && (
          <img
            src={imageUrl}
            alt={`Traumküchen-Visualisierung (Version ${version})`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
        )}
      </div>

      {priceRange && (
        <div className="rounded-xl border bg-primary/5 border-primary/20 p-4 mb-6 text-center">
          <p className="text-xs uppercase tracking-wider font-bold text-primary mb-1">
            Geschätzte Preisspanne
          </p>
          <p className="text-2xl font-extrabold text-foreground">
            {priceRange.min_eur.toLocaleString("de-DE")} €
            <span className="text-muted-foreground font-semibold mx-2">–</span>
            {priceRange.max_eur.toLocaleString("de-DE")} €
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Basierend auf Stil, Geräte-Segment, Arbeitsplatte & Form. Individuelles
            Angebot kommt vom Küchenstudio.
          </p>
        </div>
      )}

      {imageUrl && !generating && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Variante generieren mit …
          </p>
          <div className="flex flex-wrap gap-2">
            {VARIANT_HINTS.map((v) => (
              <button
                key={v.label}
                type="button"
                onClick={() => onRegenerate(v.hint)}
                disabled={generating}
                className="text-sm px-3 py-1.5 rounded-full border hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} disabled={generating}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Stil anpassen
        </Button>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => onRegenerate()}
            disabled={generating}
            className="h-12 px-6"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Neu generieren
          </Button>
          <Button
            size="lg"
            onClick={onContinue}
            disabled={generating || !imageUrl}
            className="gradient-hero h-12 px-6 font-semibold"
          >
            Angebote erhalten
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Contact
// ---------------------------------------------------------------------------

function ContactStepView({
  imageUrl,
  priceRange,
  contact,
  setContact,
  submitting,
  submitError,
  onSubmit,
  onBack,
}: {
  imageUrl: string;
  priceRange: PriceRange | null;
  contact: ContactData;
  setContact: (c: ContactData) => void;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  const upd = (patch: Partial<ContactData>) => setContact({ ...contact, ...patch });

  return (
    <form
      onSubmit={onSubmit}
      className="grid md:grid-cols-2 gap-6 bg-card border rounded-2xl shadow-sm p-6 sm:p-8"
    >
      <div className="space-y-4">
        <div className="rounded-xl overflow-hidden border aspect-[4/3]">
          <img
            src={imageUrl}
            alt="Ihre Traumküche"
            className="w-full h-full object-cover"
          />
        </div>
        {priceRange && (
          <div className="rounded-xl border bg-primary/5 border-primary/20 p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider font-bold text-primary">
              Geschätzter Preisrahmen
            </p>
            <p className="text-lg font-bold">
              {priceRange.min_eur.toLocaleString("de-DE")} – {priceRange.max_eur.toLocaleString("de-DE")} €
            </p>
          </div>
        )}
        <ul className="text-sm text-muted-foreground space-y-2">
          <li className="flex gap-2">
            <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            Bis zu 3 individuelle Angebote von geprüften Küchenstudios
          </li>
          <li className="flex gap-2">
            <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            Kostenlos, unverbindlich, keine Abnahmepflicht
          </li>
          <li className="flex gap-2">
            <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            DSGVO-konform – Studios sehen Ihre Kontaktdaten erst nach Freigabe
          </li>
        </ul>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Wohin senden wir die Angebote?</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName">Vorname *</Label>
            <Input
              id="firstName"
              value={contact.firstName}
              onChange={(e) => upd({ firstName: e.target.value })}
              required
              autoComplete="given-name"
            />
          </div>
          <div>
            <Label htmlFor="lastName">Nachname *</Label>
            <Input
              id="lastName"
              value={contact.lastName}
              onChange={(e) => upd({ lastName: e.target.value })}
              required
              autoComplete="family-name"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="email">E-Mail *</Label>
          <Input
            id="email"
            type="email"
            value={contact.email}
            onChange={(e) => upd({ email: e.target.value })}
            required
            autoComplete="email"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="phone">Telefon (optional)</Label>
            <Input
              id="phone"
              type="tel"
              value={contact.phone}
              onChange={(e) => upd({ phone: e.target.value })}
              autoComplete="tel"
            />
          </div>
          <div>
            <Label htmlFor="plz">PLZ *</Label>
            <Input
              id="plz"
              inputMode="numeric"
              pattern="\d{5}"
              maxLength={5}
              value={contact.postalCode}
              onChange={(e) => upd({ postalCode: e.target.value.replace(/\D/g, "") })}
              required
              autoComplete="postal-code"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="timeframe">Zeitrahmen (optional)</Label>
          <select
            id="timeframe"
            value={contact.timeframeMonths}
            onChange={(e) => upd({ timeframeMonths: e.target.value })}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Bitte wählen …</option>
            <option value="1">Sofort (innerhalb 4 Wochen)</option>
            <option value="3">In 1-3 Monaten</option>
            <option value="6">In 3-6 Monaten</option>
            <option value="12">In 6-12 Monaten</option>
            <option value="24">In 12+ Monaten / nur Inspiration</option>
          </select>
        </div>

        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              checked={contact.consentCall}
              onCheckedChange={(v) => upd({ consentCall: Boolean(v) })}
            />
            <span>
              Ich möchte von {BRAND.name} und passenden Küchenstudios per Telefon
              zu meinem Projekt kontaktiert werden.
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              checked={contact.consentMarketing}
              onCheckedChange={(v) => upd({ consentMarketing: Boolean(v) })}
            />
            <span className="text-muted-foreground">
              Ich möchte Inspiration & Trend-News zu Küchenplanung per E-Mail.
              (Jederzeit widerrufbar.)
            </span>
          </label>
        </div>

        {submitError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm px-3 py-2">
            {submitError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <Button variant="ghost" type="button" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="gradient-hero h-12 px-6 font-semibold w-full sm:w-auto"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gesendet …
              </>
            ) : (
              <>
                Kostenlose Angebote anfordern
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Mit dem Absenden akzeptieren Sie unsere{" "}
          <Link to="/datenschutz" className="underline">
            Datenschutzerklärung
          </Link>
          . Keine Kosten, keine Abnahmepflicht.
        </p>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CardSection({
  title,
  hint,
  compact,
  children,
}: {
  title: string;
  hint?: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className={compact ? "text-sm font-semibold" : "text-lg font-bold"}>{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function OptionGrid({
  options,
  value,
  onChange,
  cols = 3,
}: {
  options: ReadonlyArray<{ value: string; label: string; desc?: string }>;
  value: string;
  onChange: (v: string) => void;
  cols?: 3 | 5;
}) {
  const gridCols = cols === 5 ? "md:grid-cols-5" : "md:grid-cols-3";
  return (
    <div className={`grid grid-cols-2 ${gridCols} gap-3`}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "text-left p-3 rounded-lg border transition-all",
              active
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border hover:border-primary/40 hover:bg-muted/30",
            ].join(" ")}
          >
            <div className="font-semibold text-sm">{opt.label}</div>
            {opt.desc && (
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                {opt.desc}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SelectLite({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
