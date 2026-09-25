import { APPLIANCES, APPLIANCE_LEVELS, EXTRAS, SERVICES, type ApplianceId, type PlannerConfig } from "../core";
import { ChoiceGrid, Section, ToggleChips } from "../components/choices";

type HobChoice = "induktion" | "gas" | "kochfeldabzug";
type CoolingChoice = "kuehl" | "side_by_side" | "keins";

const HOB_OPTIONS: Array<{ id: HobChoice; label: string; hint: string }> = [
  { id: "induktion", label: "Induktion", hint: "Schnell, präzise, leicht zu reinigen" },
  { id: "kochfeldabzug", label: "Induktion mit Abzug", hint: "Dunstabzug direkt im Kochfeld" },
  { id: "gas", label: "Gas", hint: "Für Wok- und Profiköche" },
];

const COOLING_OPTIONS: Array<{ id: CoolingChoice; label: string; hint: string }> = [
  { id: "kuehl", label: "Einbau-Kühlkombination", hint: "Hinter Möbelfronten integriert" },
  { id: "side_by_side", label: "Side-by-Side", hint: "Viel Platz, freistehend" },
  { id: "keins", label: "Vorhandenes Gerät", hint: "Kein neuer Kühlschrank" },
];

const OTHER_APPLIANCES: ApplianceId[] = [
  "backofen",
  "dampfgarer",
  "mikrowelle",
  "geschirrspueler",
  "kaffee",
  "weinkuehler",
  "waermeschublade",
];

export function AppliancesStep({ config, onChange }: { config: PlannerConfig; onChange: (patch: Partial<PlannerConfig>) => void }) {
  const has = (id: ApplianceId) => config.appliances.includes(id);
  const hob: HobChoice = has("kochfeldabzug") ? "kochfeldabzug" : has("gas") ? "gas" : "induktion";
  const cooling: CoolingChoice = has("side_by_side") ? "side_by_side" : has("kuehl") ? "kuehl" : "keins";

  const setAppliances = (next: ApplianceId[]) => onChange({ appliances: Array.from(new Set(next)) });
  const without = (...ids: ApplianceId[]) => config.appliances.filter((a) => !ids.includes(a));

  return (
    <div className="space-y-9">
      <Section title="Geräte-Klasse" hint="Bestimmt Ausstattung, Design und Preis aller Elektrogeräte.">
        <ChoiceGrid
          label="Geräte-Klasse"
          value={config.applianceLevel}
          onChange={(applianceLevel) => onChange({ applianceLevel })}
          columns="sm:grid-cols-2 lg:grid-cols-4"
          size="sm"
          options={APPLIANCE_LEVELS.map((l) => ({ id: l.id, label: l.label, hint: l.brands }))}
        />
      </Section>

      <Section title="Kochfeld">
        <ChoiceGrid
          label="Kochfeld"
          value={hob}
          onChange={(choice) => {
            const base = without("induktion", "gas", "kochfeldabzug");
            setAppliances(choice === "kochfeldabzug" ? base.filter((a) => a !== "haube").concat("kochfeldabzug") : [...base, choice]);
          }}
          columns="sm:grid-cols-3"
          size="sm"
          options={HOB_OPTIONS}
        />
        {hob !== "kochfeldabzug" && (
          <ToggleChips
            label="Dunstabzug"
            options={[{ id: "haube" as ApplianceId, label: "Dunstabzugshaube" }]}
            values={config.appliances.filter((a) => a === "haube")}
            onChange={(values) => setAppliances(values.includes("haube") ? [...without("haube"), "haube"] : without("haube"))}
          />
        )}
      </Section>

      <Section title="Kühlen">
        <ChoiceGrid
          label="Kühlgerät"
          value={cooling}
          onChange={(choice) => {
            const base = without("kuehl", "side_by_side");
            setAppliances(choice === "keins" ? base : [...base, choice]);
          }}
          columns="sm:grid-cols-3"
          size="sm"
          options={COOLING_OPTIONS}
        />
      </Section>

      <Section title="Weitere Geräte">
        <ToggleChips
          label="Weitere Geräte"
          options={APPLIANCES.filter((a) => OTHER_APPLIANCES.includes(a.id)).map((a) => ({ id: a.id, label: a.label }))}
          values={config.appliances.filter((a) => OTHER_APPLIANCES.includes(a))}
          onChange={(values) => setAppliances([...without(...OTHER_APPLIANCES), ...values])}
        />
      </Section>

      <Section title="Extras" hint="Komfort, der den Alltag leichter macht.">
        <ToggleChips
          label="Extras"
          options={EXTRAS.map((e) => ({ id: e.id, label: e.label, hint: e.hint }))}
          values={config.extras}
          onChange={(extras) => onChange({ extras })}
        />
      </Section>

      <Section title="Leistungen des Studios">
        <ToggleChips
          label="Leistungen"
          options={SERVICES.map((s) => ({ id: s.id, label: s.label, hint: s.hint }))}
          values={config.services}
          onChange={(services) => onChange({ services })}
        />
      </Section>
    </div>
  );
}
