import { CardStep } from "@/components/funnel/card-step";
import { FUNNEL_HEADING_ID } from "@/components/funnel/funnel-frame";
import { MultiCardStep } from "@/components/funnel/multi-card-step";
import { APPLIANCES, APPLIANCE_LEVELS, EXTRAS, SERVICES, type ApplianceId, type PlannerConfig, type QualityLevel } from "../core";
import type { ConfigStepProps } from "./DesignSteps";

type HobChoice = "induktion" | "gas" | "kochfeldabzug";
type CoolingChoice = "kuehl" | "side_by_side" | "keins";

const HOB_OPTIONS: Array<{ id: HobChoice; label: string }> = [
  { id: "induktion", label: "Induktion" },
  { id: "kochfeldabzug", label: "Induktion mit Abzug" },
  { id: "gas", label: "Gas" },
];

const COOLING_OPTIONS: Array<{ id: CoolingChoice; label: string }> = [
  { id: "kuehl", label: "Einbau-Kühlschrank" },
  { id: "side_by_side", label: "Side-by-Side" },
  { id: "keins", label: "Vorhandenes Gerät" },
];

const OTHER_APPLIANCES: ApplianceId[] = ["backofen", "dampfgarer", "mikrowelle", "geschirrspueler", "kaffee", "weinkuehler", "waermeschublade"];

function GroupLabel({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="mb-2 text-sm font-semibold text-foreground">
      {children}
    </p>
  );
}

function useAppliances(config: PlannerConfig, onChange: (patch: Partial<PlannerConfig>) => void) {
  const has = (id: ApplianceId) => config.appliances.includes(id);
  const set = (next: ApplianceId[]) => onChange({ appliances: Array.from(new Set(next)) });
  const without = (...ids: ApplianceId[]) => config.appliances.filter((a) => !ids.includes(a));
  return { has, set, without };
}

export function ApplianceLevelStep({ config, onChange, onAdvance }: ConfigStepProps) {
  return (
    <CardStep
      labelledBy={FUNNEL_HEADING_ID}
      columns={2}
      selected={config.applianceLevel}
      onSelect={(id) => onChange({ applianceLevel: id as QualityLevel })}
      onAutoAdvance={onAdvance}
      options={APPLIANCE_LEVELS.map((l) => ({ id: l.id, label: l.label, description: l.brands }))}
    />
  );
}

export function CookingStep({ config, onChange }: Omit<ConfigStepProps, "onAdvance">) {
  const { has, set, without } = useAppliances(config, onChange);
  const hob: HobChoice = has("kochfeldabzug") ? "kochfeldabzug" : has("gas") ? "gas" : "induktion";
  const cooling: CoolingChoice = has("side_by_side") ? "side_by_side" : has("kuehl") ? "kuehl" : "keins";

  return (
    <div className="space-y-5 short:space-y-3">
      <div>
        <GroupLabel id="kochfeld-label">Kochfeld</GroupLabel>
        <CardStep
          labelledBy="kochfeld-label"
          mobileColumns={3}
          selected={hob}
          onSelect={(id) => {
            const base = without("induktion", "gas", "kochfeldabzug");
            set(id === "kochfeldabzug" ? base.filter((a) => a !== "haube").concat("kochfeldabzug") : [...base, id as ApplianceId]);
          }}
          options={HOB_OPTIONS}
        />
        {hob !== "kochfeldabzug" && (
          <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3.5 text-sm font-medium">
            <input
              type="checkbox"
              data-track="haube"
              checked={has("haube")}
              onChange={(e) => set(e.target.checked ? [...without("haube"), "haube"] : without("haube"))}
              className="h-5 w-5 flex-none cursor-pointer rounded border-input accent-primary"
            />
            Mit Dunstabzugshaube
          </label>
        )}
      </div>
      <div>
        <GroupLabel id="kuehlen-label">Kühlen</GroupLabel>
        <CardStep
          labelledBy="kuehlen-label"
          mobileColumns={3}
          selected={cooling}
          onSelect={(id) => {
            const base = without("kuehl", "side_by_side");
            set(id === "keins" ? base : [...base, id as ApplianceId]);
          }}
          options={COOLING_OPTIONS}
        />
      </div>
    </div>
  );
}

export function MoreAppliancesStep({ config, onChange }: Omit<ConfigStepProps, "onAdvance">) {
  const { set, without } = useAppliances(config, onChange);
  return (
    <MultiCardStep
      labelledBy={FUNNEL_HEADING_ID}
      options={APPLIANCES.filter((a) => OTHER_APPLIANCES.includes(a.id)).map((a) => ({ id: a.id, label: a.label }))}
      selected={config.appliances.filter((a) => OTHER_APPLIANCES.includes(a))}
      onSelectionChange={(values) => set([...without(...OTHER_APPLIANCES), ...values])}
    />
  );
}

export function ExtrasStep({ config, onChange }: Omit<ConfigStepProps, "onAdvance">) {
  return (
    <MultiCardStep
      labelledBy={FUNNEL_HEADING_ID}
      options={EXTRAS.map((e) => ({ id: e.id, label: e.label }))}
      selected={config.extras}
      onSelectionChange={(extras) => onChange({ extras })}
    />
  );
}

export function ServicesStep({ config, onChange }: Omit<ConfigStepProps, "onAdvance">) {
  return (
    <MultiCardStep
      labelledBy={FUNNEL_HEADING_ID}
      options={SERVICES.map((s) => ({ id: s.id, label: s.label }))}
      selected={config.services}
      onSelectionChange={(services) => onChange({ services })}
    />
  );
}
