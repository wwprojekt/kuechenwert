import { CardStep } from "@/components/funnel/card-step";
import { FUNNEL_HEADING_ID } from "@/components/funnel/funnel-frame";
import { NumberStepper, SwatchPicker } from "../components/choices";
import { SINKS, TAPS, WALL_CABINETS, WORKTOPS, WORKTOP_COLORS, type PlannerConfig } from "../core";
import type { ConfigStepProps } from "./DesignSteps";

function GroupLabel({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="mb-2 text-sm font-semibold text-foreground">
      {children}
    </p>
  );
}

export function WorktopStep({ config, onChange, onAdvance }: ConfigStepProps) {
  return (
    <CardStep
      labelledBy={FUNNEL_HEADING_ID}
      columns={3}
      selected={config.worktop}
      onSelect={(id) => onChange({ worktop: id as PlannerConfig["worktop"] })}
      onAutoAdvance={onAdvance}
      options={WORKTOPS.map((w) => ({ id: w.id, label: w.label, description: w.hint }))}
    />
  );
}

export function WorktopColorStep({ config, onChange, onAdvance }: ConfigStepProps) {
  return (
    <SwatchPicker
      label="Farbe der Arbeitsplatte"
      options={WORKTOP_COLORS}
      value={config.worktopColor}
      onChange={(worktopColor) => onChange({ worktopColor })}
      onAutoAdvance={onAdvance}
    />
  );
}

export function CabinetStep({ config, onChange }: Omit<ConfigStepProps, "onAdvance">) {
  return (
    <div className="space-y-5 short:space-y-3">
      <div>
        <GroupLabel id="oberschraenke-label">Oberhalb der Arbeitsfläche</GroupLabel>
        <CardStep
          labelledBy="oberschraenke-label"
          mobileColumns={3}
          selected={config.wallCabinets}
          onSelect={(id) => onChange({ wallCabinets: id as PlannerConfig["wallCabinets"] })}
          options={WALL_CABINETS.map((w) => ({ id: w.id, label: w.label, description: w.hint }))}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Hochschränke</p>
          <p className="text-xs text-muted-foreground">Für Backofen, Kühlschrank und Vorräte, je 60 cm</p>
        </div>
        <NumberStepper label="Anzahl Hochschränke" value={config.tallUnits} min={0} max={6} onChange={(tallUnits) => onChange({ tallUnits })} />
      </div>
    </div>
  );
}

export function SinkStep({ config, onChange }: Omit<ConfigStepProps, "onAdvance">) {
  return (
    <div className="space-y-5 short:space-y-3">
      <div>
        <GroupLabel id="spuele-label">Spüle</GroupLabel>
        <CardStep
          labelledBy="spuele-label"
          mobileColumns={3}
          selected={config.sink}
          onSelect={(id) => onChange({ sink: id as PlannerConfig["sink"] })}
          options={SINKS.map((s) => ({ id: s.id, label: s.label }))}
        />
      </div>
      <div>
        <GroupLabel id="armatur-label">Armatur</GroupLabel>
        <CardStep
          labelledBy="armatur-label"
          mobileColumns={3}
          selected={config.tap}
          onSelect={(id) => onChange({ tap: id as PlannerConfig["tap"] })}
          options={TAPS.map((t) => ({ id: t.id, label: t.label, description: t.hint }))}
        />
      </div>
    </div>
  );
}
