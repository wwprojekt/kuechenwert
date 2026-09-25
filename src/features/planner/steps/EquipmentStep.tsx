import { SINKS, TAPS, WALL_CABINETS, WORKTOPS, WORKTOP_COLORS, type PlannerConfig } from "../core";
import { ChoiceGrid, NumberStepper, Section, SwatchPicker } from "../components/choices";

export function EquipmentStep({ config, onChange }: { config: PlannerConfig; onChange: (patch: Partial<PlannerConfig>) => void }) {
  return (
    <div className="space-y-9">
      <Section title="Arbeitsplatte" hint="Täglich im Einsatz – Material entscheidet über Pflege und Preis.">
        <ChoiceGrid
          label="Arbeitsplatte"
          value={config.worktop}
          onChange={(worktop) => onChange({ worktop })}
          columns="sm:grid-cols-3 lg:grid-cols-4"
          size="sm"
          options={WORKTOPS.map((w) => ({ id: w.id, label: w.label, hint: w.hint }))}
        />
      </Section>

      <Section title="Farbe der Arbeitsplatte">
        <SwatchPicker label="Farbe der Arbeitsplatte" options={WORKTOP_COLORS} value={config.worktopColor} onChange={(worktopColor) => onChange({ worktopColor })} />
      </Section>

      <Section title="Oberhalb der Arbeitsfläche">
        <ChoiceGrid
          label="Oberschränke"
          value={config.wallCabinets}
          onChange={(wallCabinets) => onChange({ wallCabinets })}
          columns="sm:grid-cols-3"
          size="sm"
          options={WALL_CABINETS.map((w) => ({ id: w.id, label: w.label, hint: w.hint }))}
        />
      </Section>

      <Section title="Hochschränke" hint="Für Backofen auf Augenhöhe, Kühlschrank und Vorräte – je 60 cm breit.">
        <NumberStepper label="Anzahl Hochschränke" value={config.tallUnits} min={0} max={6} onChange={(tallUnits) => onChange({ tallUnits })} />
      </Section>

      <div className="grid gap-9 md:grid-cols-2">
        <Section title="Spüle">
          <ChoiceGrid
            label="Spüle"
            value={config.sink}
            onChange={(sink) => onChange({ sink })}
            columns="grid-cols-1 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3"
            size="sm"
            options={SINKS.map((s) => ({ id: s.id, label: s.label }))}
          />
        </Section>
        <Section title="Armatur">
          <ChoiceGrid
            label="Armatur"
            value={config.tap}
            onChange={(tap) => onChange({ tap })}
            columns="grid-cols-1 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3"
            size="sm"
            options={TAPS.map((t) => ({ id: t.id, label: t.label, hint: t.hint }))}
          />
        </Section>
      </div>
    </div>
  );
}
