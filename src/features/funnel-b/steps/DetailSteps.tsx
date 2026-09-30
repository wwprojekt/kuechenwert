import { Plus, Trash2 } from "lucide-react";
import { useMemo, useRef } from "react";
import { CardStep } from "@/components/funnel/card-step";
import { Combobox, type ComboboxOption } from "@/components/funnel/combobox";
import { FUNNEL_HEADING_ID } from "@/components/funnel/funnel-frame";
import { FINANCING_ICONS, HANDLE_TYPE_ICONS, SINK_MATERIAL_ICONS } from "@/components/funnel/funnel-b-icons";
import { MultiCardStep } from "@/components/funnel/multi-card-step";
import {
  APPLIANCE_BRANDS,
  APPLIANCE_CATEGORIES,
  EXTRAS_OPTIONS,
  FINANCING_OPTIONS,
  FRONT_CATEGORY_LABEL,
  FRONT_MATERIALS,
  HANDLE_TYPES,
  KITCHEN_BRANDS,
  SINK_BRANDS,
  SINK_MATERIALS,
  WORKTOP_DESIGNS,
  WORKTOP_MATERIALS,
} from "@/config/funnel-b-stammdaten";
import { Field } from "../Field";
import type { FunnelBData } from "../state";
import type { FunnelBStepProps } from "./OfferSteps";

type Props = Omit<FunnelBStepProps, "onAdvance">;

export function BrandStep({ data, update }: Props) {
  const options: ComboboxOption[] = KITCHEN_BRANDS.map((b) => ({ value: b.slug, label: b.name }));
  return (
    <div className="space-y-3">
      <Field label="Hersteller / Marke" hint={'Suchbar – tippen Sie z. B. „Nobilia".'}>
        <Combobox options={options} value={data.brand} onChange={(v) => update({ brand: v })} placeholder="– Bitte wählen –" ariaLabel="Hersteller / Marke" />
      </Field>
      {data.brand === "sonstiger" && (
        <Field label="Marke (Freitext)">
          <input type="text" className="input-field" value={data.brandCustom} onChange={(e) => update({ brandCustom: e.target.value })} />
        </Field>
      )}
    </div>
  );
}

export function FrontStep({ data, update }: Props) {
  const options: ComboboxOption[] = FRONT_MATERIALS.map((f) => ({
    value: f.name,
    label: f.name,
    description: f.description,
    group: FRONT_CATEGORY_LABEL[f.category],
  }));
  return (
    <div className="space-y-4 short:space-y-3">
      <Field label="Name der Front">
        <input
          type="text"
          className="input-field"
          placeholder="z. B. Riva, Sylt, Flash"
          value={data.frontName}
          onChange={(e) => update({ frontName: e.target.value })}
        />
      </Field>
      <Field label="Frontmaterial">
        <Combobox
          options={options}
          value={data.frontMaterialName}
          onChange={(v) => update({ frontMaterialName: v })}
          placeholder="– Bitte wählen –"
          ariaLabel="Frontmaterial"
        />
      </Field>
    </div>
  );
}

export function HandleStep({ data, update, onAdvance }: FunnelBStepProps) {
  return (
    <CardStep
      labelledBy={FUNNEL_HEADING_ID}
      columns={3}
      selected={data.handleType}
      onSelect={(v) => update({ handleType: v })}
      onAutoAdvance={onAdvance}
      options={HANDLE_TYPES.map((h) => ({ id: h.slug, label: h.name, description: h.description, icon: HANDLE_TYPE_ICONS[h.slug] }))}
    />
  );
}

/** Einzeilige Beschriftungen für zehn Materialien auf einem Handy-Bildschirm; gespeichert wird der Slug. */
const WORKTOP_SHORT: Record<string, string> = {
  granit: "Granit",
  marmor: "Marmor",
  keramik: "Keramik / Sinterstein",
  mineralwerkstoff: "Mineralwerkstoff",
};

export function WorktopStep({ data, update, onAdvance }: FunnelBStepProps) {
  return (
    <CardStep
      labelledBy={FUNNEL_HEADING_ID}
      columns={3}
      compact
      selected={data.worktopMaterial}
      onSelect={(v) => update({ worktopMaterial: v, worktopDesign: "", worktopDesignCustom: "" })}
      onAutoAdvance={onAdvance}
      options={WORKTOP_MATERIALS.map((m) => ({ id: m.slug, label: WORKTOP_SHORT[m.slug] ?? m.name }))}
    />
  );
}

export function WorktopNameStep({ data, update }: Props) {
  const designs = useMemo(() => WORKTOP_DESIGNS.filter((d) => d.materialSlug === data.worktopMaterial), [data.worktopMaterial]);
  return (
    <div className="space-y-4 short:space-y-3">
      {designs.length > 0 && (
        <Field label="Bekannte Bezeichnungen">
          <Combobox
            options={designs.map((d) => ({ value: d.name, label: d.name, badge: d.manufacturer }))}
            value={data.worktopDesign}
            onChange={(v) => update({ worktopDesign: v })}
            placeholder="– Keine Auswahl –"
            ariaLabel="Bekannte Bezeichnungen"
          />
        </Field>
      )}
      <Field label="Eigene Bezeichnung / Notiz">
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

export function AppliancesStep({ data, update }: Props) {
  const categories: ComboboxOption[] = APPLIANCE_CATEGORIES.map((c) => ({ value: c.slug, label: c.name }));
  const brands: ComboboxOption[] = APPLIANCE_BRANDS.map((b) => ({ value: b.slug, label: b.name }));
  const upd = (id: string, patch: Partial<FunnelBData["appliances"][number]>) =>
    update({ appliances: data.appliances.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const add = () =>
    update({
      appliances: [...data.appliances, { id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, categorySlug: "", brandSlug: "", model: "" }],
    });

  return (
    <div className="space-y-3">
      {data.appliances.map((a, i) => (
        <div key={a.id} className="rounded-xl border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-ink-muted">Gerät {i + 1}</span>
            <button
              type="button"
              onClick={() => update({ appliances: data.appliances.filter((x) => x.id !== a.id) })}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-xs font-medium text-destructive hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Entfernen
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <Combobox options={categories} value={a.categorySlug} onChange={(v) => upd(a.id, { categorySlug: v })} placeholder="Typ" ariaLabel={`Gerät ${i + 1}: Typ`} />
            <Combobox options={brands} value={a.brandSlug} onChange={(v) => upd(a.id, { brandSlug: v })} placeholder="Marke" ariaLabel={`Gerät ${i + 1}: Marke`} />
            <input
              type="text"
              aria-label={`Gerät ${i + 1}: Modell`}
              className="input-field col-span-2 md:col-span-1"
              placeholder="Modell, z. B. HBG675BS1"
              value={a.model}
              onChange={(e) => upd(a.id, { model: e.target.value })}
            />
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="btn-secondary">
        <Plus className="h-4 w-4" aria-hidden="true" /> Gerät hinzufügen
      </button>
    </div>
  );
}

export function SinkStep({ data, update, onAdvance }: FunnelBStepProps) {
  return (
    <CardStep
      labelledBy={FUNNEL_HEADING_ID}
      columns={3}
      selected={data.sinkMaterial}
      onSelect={(v) => update({ sinkMaterial: v })}
      onAutoAdvance={onAdvance}
      options={SINK_MATERIALS.map((m, i) => ({ id: m.slug, label: m.name, icon: SINK_MATERIAL_ICONS[m.slug], wide: i === SINK_MATERIALS.length - 1 }))}
    />
  );
}

export function SinkBrandStep({ data, update }: Props) {
  return (
    <div className="space-y-4 short:space-y-3">
      <Field label="Spülen-Marke">
        <Combobox
          options={SINK_BRANDS.map((b) => ({ value: b.slug, label: b.name }))}
          value={data.sinkBrand}
          onChange={(v) => update({ sinkBrand: v })}
          placeholder="– Wählen –"
          ariaLabel="Spülen-Marke"
        />
      </Field>
      <Field label="Bezeichnung / Modell">
        <input
          type="text"
          className="input-field"
          placeholder="z. B. Blanco Subline 500-U"
          value={data.sinkDesignation}
          onChange={(e) => update({ sinkDesignation: e.target.value })}
        />
      </Field>
    </div>
  );
}

/** Kurze Beschriftungen, damit alle Extras auf einen Handy-Bildschirm passen; gespeichert wird der Slug. */
const EXTRA_SHORT: Record<string, string> = {
  steckdosen: "Steckdosen / USB",
  besteckeinsatz: "Besteckeinsatz",
  beleuchtung_unterboden: "LED unter Oberschränken",
  beleuchtung_innen: "Licht im Schrank",
  ausziehauszug: "Apothekerauszug",
  "eckschrank-karussell": "Eckschrank-Lösung",
  abfallsystem: "Mülltrennsystem",
  kraeuterregal: "Gewürzregal",
  "rueckwand-glas": "Glas-Rückwand",
  sockelschublade: "Sockel-Schubladen",
};

export function ExtrasStep({ data, update }: Props) {
  return (
    <MultiCardStep
      labelledBy={FUNNEL_HEADING_ID}
      options={EXTRAS_OPTIONS.map((e) => ({ id: e.slug, label: EXTRA_SHORT[e.slug] ?? e.name }))}
      selected={data.extras}
      onSelectionChange={(extras) => update({ extras })}
    />
  );
}

export function NotesStep({ data, update }: Props) {
  return (
    <textarea
      aria-label="Sonstige Komponenten / Notizen"
      rows={4}
      className="input-field h-auto min-h-[7rem] py-3 xshort:min-h-[5rem]"
      placeholder="z. B. Spritzschutz aus Glas, USB-Dosen in der Schublade …"
      value={data.extrasNotes}
      onChange={(e) => update({ extrasNotes: e.target.value })}
    />
  );
}

export function PaymentStep({ data, update, onAdvance }: FunnelBStepProps) {
  const withInterest = data.paymentFinancing === "with_interest";
  // Auto-Weiter läuft nach dem Klick: dann zählt die neue Auswahl (mit Zinsen fragt noch nach Details).
  const latest = useRef(data.paymentFinancing);
  latest.current = data.paymentFinancing;
  return (
    <div className="space-y-4 short:space-y-3">
      <CardStep
        labelledBy={FUNNEL_HEADING_ID}
        columns={3}
        selected={data.paymentFinancing}
        onSelect={(v) => update({ paymentFinancing: v })}
        onAutoAdvance={() => {
          if (latest.current !== "with_interest") onAdvance();
        }}
        autoAdvanceMs={300}
        options={FINANCING_OPTIONS.map((f) => ({ id: f.slug, label: f.name, icon: FINANCING_ICONS[f.slug] }))}
      />
      {withInterest && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Effektivzins (% p. a.)">
            <input type="number" min={0} step={0.1} className="input-field" placeholder="z. B. 4.9" value={data.paymentFinancingApr} onChange={(e) => update({ paymentFinancingApr: e.target.value })} />
          </Field>
          <Field label="Laufzeit (Monate)">
            <input type="number" min={1} step={1} className="input-field" placeholder="z. B. 36" value={data.paymentFinancingMonths} onChange={(e) => update({ paymentFinancingMonths: e.target.value })} />
          </Field>
        </div>
      )}
    </div>
  );
}

export function DownPaymentStep({ data, update }: Props) {
  return (
    <Field label="Anzahlung in %">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        step={1}
        className="input-field max-w-[12rem]"
        placeholder="z. B. 30"
        value={data.paymentDownPaymentPercent}
        onChange={(e) => update({ paymentDownPaymentPercent: e.target.value })}
      />
    </Field>
  );
}
