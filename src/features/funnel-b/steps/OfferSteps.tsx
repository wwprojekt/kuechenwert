import { CloudUpload, ListChecks, Mail, SkipForward } from "lucide-react";
import { CardStep } from "@/components/funnel/card-step";
import { FUNNEL_HEADING_ID } from "@/components/funnel/funnel-frame";
import { TIMEFRAME_ICONS_B } from "@/components/funnel/funnel-b-icons";
import { TIMEFRAMES } from "@/config/funnel-b-stammdaten";
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
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdvance();
      }}
      noValidate
      className="space-y-4 short:space-y-3"
    >
      <Field label="Angebotspreis (brutto) *" controlId="funnel-b-offer-price">
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
    </form>
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
          { id: "now", label: "Jetzt hochladen", description: "Angebot, Planung oder Fotos – als PDF oder Bild", icon: <CloudUpload /> },
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
        Ihre Unterlagen sieht zuerst nur unser Team. Studios zeigen wir sie erst ohne Namen und Kontaktdaten.
      </p>
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

export function DetailsChoiceStep({ data, update, onAdvance }: FunnelBStepProps) {
  const hasFiles = data.uploads.length > 0;
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
          {
            id: "nein",
            label: hasFiles ? "Nein, steht in meinen Unterlagen" : "Nein, direkt weiter",
            description: "Weiter zu Ihren Kontaktdaten",
            icon: <SkipForward />,
          },
          { id: "ja", label: "Ja, Details angeben", description: "Marke, Fronten, Geräte & Co. – ca. 2 Minuten", icon: <ListChecks /> },
        ]}
      />
    </div>
  );
}
