import {
  ClipboardCheck,
  CloudUpload,
  Droplets,
  HelpCircle,
  ListChecks,
  Mail,
  MessagesSquare,
  PencilLine,
  Plug,
  Recycle,
  Refrigerator,
  Ruler,
  SkipForward,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { CardStep } from "@/components/funnel/card-step";
import { FUNNEL_HEADING_ID } from "@/components/funnel/funnel-frame";
import { TIMEFRAME_ICONS_B } from "@/components/funnel/funnel-b-icons";
import { ImageCardStep } from "@/components/funnel/image-card-step";
import { MultiCardStep } from "@/components/funnel/multi-card-step";
import { KitchenFormPlan, hasKitchenFormPlan } from "@/components/kitchen/KitchenFormPlan";
import {
  OFFER_INCLUDES,
  OFFER_INCLUDES_UNKNOWN,
  PLAN_CHANGES_TEXT_MAX,
  TIMEFRAMES,
  offerValidityRange,
  type PlanChangesSlug,
} from "@/config/funnel-b-stammdaten";
import { FORM_OPTIONS } from "@/features/funnel-a/catalog";
import { Field } from "../Field";
import { LEAD_FILE_CATEGORIES, MAX_LEAD_FILES, type LeadFileCategory } from "../files";
import { LeadFileDrop } from "../LeadFileDrop";
import { PendingFileList } from "../PendingFileList";
import type { FunnelBData, OfferDeliveryMethod } from "../state";

export interface FunnelBStepProps {
  data: FunnelBData;
  update: (patch: Partial<FunnelBData>) => void;
  onAdvance: () => void;
}

export function PriceStep({ data, update, onAdvance }: FunnelBStepProps) {
  const validity = offerValidityRange();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdvance();
      }}
      noValidate
      className="space-y-4 short:space-y-3"
    >
      <Field label="Genannter Preis (brutto) *" controlId="funnel-b-offer-price">
        <div className="relative max-w-xs">
          <input
            id="funnel-b-offer-price"
            name="existing_offer_price"
            type="number"
            inputMode="numeric"
            enterKeyHint="next"
            min={1}
            step={1}
            className="input-field pr-10 text-lg font-semibold tabular-nums"
            placeholder="z. B. 18000"
            value={data.existingOfferPriceEur}
            onChange={(e) => update({ existingOfferPriceEur: e.target.value })}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">€</span>
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr] short:gap-3">
        <Field label="Name des Küchenstudios (optional)" hint="Hilft beim Vergleich, wird den Studios nicht gezeigt.">
          <input
            type="text"
            name="existing_offer_studio"
            className="input-field"
            placeholder="z. B. Küchen Müller, Musterstadt"
            value={data.existingOfferStudio}
            onChange={(e) => update({ existingOfferStudio: e.target.value })}
          />
        </Field>
        <Field label="Preis gilt bis (optional)" controlId="funnel-b-offer-valid-until">
          <input
            id="funnel-b-offer-valid-until"
            type="date"
            name="offer_valid_until"
            className="input-field"
            min={validity.min}
            max={validity.max}
            value={data.offerValidUntil}
            onChange={(e) => update({ offerValidUntil: e.target.value })}
          />
        </Field>
      </div>
    </form>
  );
}

const INCLUDE_ICONS: Record<string, LucideIcon> = {
  appliances: Refrigerator,
  delivery: Truck,
  assembly: Wrench,
  sink: Droplets,
  removal: Recycle,
  connection: Plug,
  measurement: Ruler,
  [OFFER_INCLUDES_UNKNOWN]: HelpCircle,
};

const INCLUDE_OPTIONS = [
  ...OFFER_INCLUDES.map((o) => ({ id: o.slug, label: o.name })),
  { id: OFFER_INCLUDES_UNKNOWN, label: "Weiß ich nicht genau" },
].map((o) => {
  const Icon = INCLUDE_ICONS[o.id];
  return { ...o, icon: Icon ? <Icon aria-hidden="true" /> : undefined };
});

/** Leistungsumfang zum genannten Preis; „Weiß ich nicht genau“ schließt die übrigen Punkte aus. */
export function OfferIncludesStep({ data, update }: Omit<FunnelBStepProps, "onAdvance">) {
  const change = (next: string[]) => {
    const added = next.find((id) => !data.offerIncludes.includes(id));
    update({ offerIncludes: added === OFFER_INCLUDES_UNKNOWN ? [OFFER_INCLUDES_UNKNOWN] : next.filter((id) => id !== OFFER_INCLUDES_UNKNOWN) });
  };
  return <MultiCardStep labelledBy={FUNNEL_HEADING_ID} options={INCLUDE_OPTIONS} selected={data.offerIncludes} onSelectionChange={change} />;
}

export function KitchenFormStep({ data, update, onAdvance }: FunnelBStepProps) {
  return (
    <ImageCardStep
      labelledBy={FUNNEL_HEADING_ID}
      selected={data.kitchenForm}
      onSelect={(id) => update({ kitchenForm: id })}
      onAutoAdvance={onAdvance}
      options={FORM_OPTIONS.map((f) =>
        hasKitchenFormPlan(f.id)
          ? { id: f.id, label: f.label, description: f.hint, pictogram: <KitchenFormPlan form={f.id} /> }
          : { id: f.id, label: f.label, description: f.hint, icon: <MessagesSquare aria-hidden="true" /> },
      )}
    />
  );
}

export function DocumentsChoiceStep({ data, update, onAdvance }: FunnelBStepProps) {
  return (
    <div id="funnel-b-offer-delivery">
      <CardStep
        labelledBy={FUNNEL_HEADING_ID}
        columns={2}
        mobileColumns={1}
        selected={data.offerDeliveryMethod}
        onSelect={(v) => update({ offerDeliveryMethod: v as OfferDeliveryMethod })}
        onAutoAdvance={onAdvance}
        options={[
          { id: "now", label: "Ja, jetzt hochladen", description: "Handyfotos oder PDF – dann entfallen die Detailfragen", icon: <CloudUpload /> },
          { id: "later", label: "Später nachreichen", description: "Über Ihren persönlichen Projektlink aus der E-Mail", icon: <Mail /> },
        ]}
      />
    </div>
  );
}

export function UploadStep({ data, update }: Omit<FunnelBStepProps, "onAdvance">) {
  const remaining = MAX_LEAD_FILES - data.uploads.length;
  const addFiles = (category: LeadFileCategory, files: File[]) =>
    update({
      uploads: [
        ...data.uploads,
        ...files.map((file) => ({ id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, category, file })),
      ],
    });
  return (
    <div id="funnel-b-uploads" className="space-y-2.5">
      {LEAD_FILE_CATEGORIES.map((option) => (
        <LeadFileDrop
          key={option.value}
          option={option}
          count={data.uploads.filter((u) => u.category === option.value).length}
          remaining={remaining}
          onFiles={(files) => addFiles(option.value, files)}
        />
      ))}
      <PendingFileList files={data.uploads} onRemove={(id) => update({ uploads: data.uploads.filter((u) => u.id !== id) })} />
      <p className="text-xs leading-snug text-ink-muted">
        Ihre Unterlagen sieht zuerst nur unser Team, beim Auslesen hilft eine KI in der EU. Studios zeigen wir sie erst ohne Namen und
        Kontaktdaten.
      </p>
    </div>
  );
}

/** Planung genau so anbieten lassen oder Änderungen beschreiben (z. B. andere Geräte). */
export function PlanChangesStep({ data, update, onAdvance }: FunnelBStepProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const focusText = useRef(false);
  // Auto-Weiter läuft nach dem Klick: dann zählt die neue Auswahl („Ja“ wartet auf den Text).
  const latest = useRef(data.planChanges);
  latest.current = data.planChanges;
  const wantsChanges = data.planChanges === "changes";

  useEffect(() => {
    if (!wantsChanges || !focusText.current) return;
    focusText.current = false;
    textRef.current?.focus();
  }, [wantsChanges]);

  return (
    <div className="space-y-3">
      <div id="funnel-b-plan-changes">
        <CardStep
          labelledBy={FUNNEL_HEADING_ID}
          columns={2}
          mobileColumns={1}
          selected={data.planChanges}
          onSelect={(v) => {
            focusText.current = v === "changes";
            update({ planChanges: v as PlanChangesSlug });
          }}
          onAutoAdvance={() => {
            if (latest.current === "none") onAdvance();
          }}
          options={[
            { id: "none", label: "Nein, genau so", description: "Die Studios bieten Ihre Planung 1:1 an", icon: <ClipboardCheck /> },
            { id: "changes", label: "Ja, etwas ändern", description: "Zum Beispiel andere Geräte oder Arbeitsplatte", icon: <PencilLine /> },
          ]}
        />
      </div>
      {wantsChanges && (
        <Field label="Was soll anders sein?" hint="Telefonnummern, E-Mail-Adressen und Links entfernen wir automatisch.">
          <textarea
            ref={textRef}
            id="funnel-b-plan-changes-text"
            name="plan_changes_text"
            rows={3}
            maxLength={PLAN_CHANGES_TEXT_MAX}
            className="input-field h-auto min-h-[5.5rem] py-3 xshort:min-h-[4.5rem]"
            placeholder="z. B. Geräte von Siemens statt Bosch, Arbeitsplatte in Eiche"
            value={data.planChangesText}
            onChange={(e) => update({ planChangesText: e.target.value })}
          />
        </Field>
      )}
    </div>
  );
}

export function TimeframeStep({ data, update, onAdvance }: FunnelBStepProps) {
  return (
    <CardStep
      labelledBy={FUNNEL_HEADING_ID}
      columns={2}
      selected={data.timeframe}
      onSelect={(v) => update({ timeframe: v })}
      onAutoAdvance={onAdvance}
      options={TIMEFRAMES.map((t, i) => ({ id: t.slug, label: t.name, icon: TIMEFRAME_ICONS_B[t.slug], wide: i === TIMEFRAMES.length - 1 }))}
    />
  );
}

/** Nur ohne hochgeladene Planung: Mit Planung entfallen die Detailfragen ganz (funnelBFlow). */
export function DetailsChoiceStep({ data, update, onAdvance }: FunnelBStepProps) {
  return (
    <div id="funnel-b-details">
      <CardStep
        labelledBy={FUNNEL_HEADING_ID}
        columns={2}
        mobileColumns={1}
        selected={data.wantsDetails}
        onSelect={(v) => update({ wantsDetails: v as FunnelBData["wantsDetails"] })}
        onAutoAdvance={onAdvance}
        options={[
          { id: "nein", label: "Nein, direkt weiter", description: "Weiter zu Ihren Kontaktdaten", icon: <SkipForward /> },
          { id: "ja", label: "Ja, Details angeben", description: "Marke, Fronten, Geräte & Co. – ca. 2 Minuten", icon: <ListChecks /> },
        ]}
      />
    </div>
  );
}
