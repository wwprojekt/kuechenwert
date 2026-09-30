import { Crown, Gem, Sparkles, Star } from "lucide-react";
import { CardStep } from "@/components/funnel/card-step";
import { FUNNEL_HEADING_ID } from "@/components/funnel/funnel-frame";
import { ImageCardStep } from "@/components/funnel/image-card-step";
import { SwatchPicker } from "../components/choices";
import { FRONT_COLORS, FRONT_MATERIALS, HANDLES, QUALITY_LEVELS, STYLES, type PlannerConfig, type QualityLevel, type StyleId } from "../core";

export interface ConfigStepProps {
  config: PlannerConfig;
  onChange: (patch: Partial<PlannerConfig>) => void;
  onAdvance: () => void;
}

const QUALITY_ICON: Record<QualityLevel, JSX.Element> = {
  budget: <Star />,
  mittel: <Sparkles />,
  premium: <Gem />,
  luxus: <Crown />,
};

export function StyleStep({ config, onChange, onAdvance }: ConfigStepProps) {
  return (
    <ImageCardStep
      labelledBy={FUNNEL_HEADING_ID}
      selected={config.style}
      onSelect={(id) => {
        const style = id as StyleId;
        // Grifflos gehört zum Stil; wer davon weggeht, bekommt wieder Griffe.
        onChange({ style, handle: style === "modern_grifflos" ? "grifflos" : config.handle === "grifflos" ? "griffleiste" : config.handle });
      }}
      onAutoAdvance={onAdvance}
      options={STYLES.map((s) => ({ id: s.id, label: s.label, description: s.hint, imageSrc: `/images/planner/styles/${s.id}.webp` }))}
    />
  );
}

export function QualityStep({ config, onChange, onAdvance }: ConfigStepProps) {
  return (
    <CardStep
      labelledBy={FUNNEL_HEADING_ID}
      columns={2}
      selected={config.quality}
      onSelect={(id) => onChange({ quality: id as QualityLevel })}
      onAutoAdvance={onAdvance}
      options={QUALITY_LEVELS.map((q) => ({ id: q.id, label: q.label, description: q.brands, icon: QUALITY_ICON[q.id] }))}
    />
  );
}

export function FrontStep({ config, onChange, onAdvance }: ConfigStepProps) {
  return (
    <CardStep
      labelledBy={FUNNEL_HEADING_ID}
      mobileColumns={3}
      selected={config.front}
      onSelect={(id) => onChange({ front: id as PlannerConfig["front"] })}
      onAutoAdvance={onAdvance}
      options={FRONT_MATERIALS.map((f) => ({ id: f.id, label: f.label, description: f.hint }))}
    />
  );
}

export function FrontColorStep({ config, onChange, onAdvance }: ConfigStepProps) {
  return (
    <SwatchPicker
      label="Frontfarbe"
      options={FRONT_COLORS}
      value={config.frontColor}
      onChange={(frontColor) => onChange({ frontColor })}
      onAutoAdvance={onAdvance}
    />
  );
}

export function HandleStep({ config, onChange, onAdvance }: ConfigStepProps) {
  return (
    <CardStep
      labelledBy={FUNNEL_HEADING_ID}
      columns={2}
      mobileColumns={2}
      selected={config.handle}
      onSelect={(id) => onChange({ handle: id as PlannerConfig["handle"] })}
      onAutoAdvance={onAdvance}
      options={HANDLES.map((h) => ({ id: h.id, label: h.label }))}
    />
  );
}
