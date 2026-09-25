import { Crown, Gem, Sparkles, Star } from "lucide-react";
import {
  FRONT_COLORS,
  FRONT_MATERIALS,
  HANDLES,
  QUALITY_LEVELS,
  STYLES,
  type PlannerConfig,
  type QualityLevel,
} from "../core";
import { ChoiceGrid, Section, SwatchPicker } from "../components/choices";

const QUALITY_ICON: Record<QualityLevel, JSX.Element> = {
  budget: <Star className="h-5 w-5" />,
  mittel: <Sparkles className="h-5 w-5" />,
  premium: <Gem className="h-5 w-5" />,
  luxus: <Crown className="h-5 w-5" />,
};

export function StyleStep({ config, onChange }: { config: PlannerConfig; onChange: (patch: Partial<PlannerConfig>) => void }) {
  return (
    <div className="space-y-9">
      <Section title="Welche Qualitätsstufe passt zu Ihnen?" hint="Der größte Preisfaktor – Sie können sie jederzeit ändern.">
        <ChoiceGrid
          label="Qualitätsstufe"
          value={config.quality}
          onChange={(quality) => onChange({ quality })}
          columns="sm:grid-cols-2 lg:grid-cols-4"
          options={QUALITY_LEVELS.map((q) => ({
            id: q.id,
            label: q.label,
            hint: `${q.hint ?? ""}. ${q.brands}`,
            icon: QUALITY_ICON[q.id],
            badge: q.id === "mittel" ? "Beliebt" : undefined,
          }))}
        />
      </Section>

      <Section title="Welcher Stil gefällt Ihnen?">
        <ChoiceGrid
          label="Küchenstil"
          value={config.style}
          onChange={(style) => onChange({ style, handle: style === "modern_grifflos" ? "grifflos" : config.handle === "grifflos" ? "griffleiste" : config.handle })}
          size="lg"
          options={STYLES.map((s) => ({ id: s.id, label: s.label, hint: s.hint, image: `/images/planner/styles/${s.id}.webp` }))}
        />
      </Section>

      <Section title="Fronten" hint="Material und Oberfläche der Schranktüren.">
        <ChoiceGrid
          label="Frontmaterial"
          value={config.front}
          onChange={(front) => onChange({ front })}
          columns="sm:grid-cols-3 lg:grid-cols-5"
          size="sm"
          options={FRONT_MATERIALS.map((f) => ({ id: f.id, label: f.label, hint: f.hint }))}
        />
      </Section>

      <Section title="Frontfarbe">
        <SwatchPicker label="Frontfarbe" options={FRONT_COLORS} value={config.frontColor} onChange={(frontColor) => onChange({ frontColor })} />
      </Section>

      <Section title="Griffe">
        <ChoiceGrid
          label="Griffvariante"
          value={config.handle}
          onChange={(handle) => onChange({ handle })}
          columns="sm:grid-cols-4"
          size="sm"
          options={HANDLES.map((h) => ({ id: h.id, label: h.label }))}
        />
      </Section>
    </div>
  );
}
