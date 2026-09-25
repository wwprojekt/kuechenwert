import type { LucideIcon } from "lucide-react";
import { CardStep, type CardOption } from "@/components/funnel/card-step";
import { KitchenFormPlan, hasKitchenFormPlan } from "@/components/kitchen/KitchenFormPlan";
import { EXTRA_APPLIANCE_ICONS, choiceIcon } from "@/components/funnel/funnel-a-icons";
import { WORKTOP_PICTOGRAMS, WORKTOP_TINTS } from "@/components/funnel/funnel-a-pictograms";
import { ImageCardStep, type ImageOption } from "@/components/funnel/image-card-step";
import { MultiCardStep } from "@/components/funnel/multi-card-step";
import { PlzStep } from "@/components/funnel/plz-step";
import { UNSURE, type ChoiceOption, type FunnelAAnswers } from "../catalog";
import { optionImage, type ChoiceField, type FunnelAChoiceStep, type FunnelAStep } from "../steps";
import { BudgetStep } from "./BudgetStep";

/** id der Frage (h1) in der FunnelShell. */
const QUESTION_ID = "funnel-question";

export type AnswerSetter = <K extends keyof FunnelAAnswers>(key: K, value: FunnelAAnswers[K]) => void;

interface StepContentProps {
  step: Exclude<FunnelAStep, { kind: "contact" }>;
  answers: FunnelAAnswers;
  onAnswer: AnswerSetter;
  /** Weiter zum nächsten Schritt (Auto-Advance, Enter in der PLZ). */
  onAdvance: () => void;
}

function renderIcon(Icon: LucideIcon | undefined) {
  return Icon ? <Icon aria-hidden="true" /> : undefined;
}

/**
 * Spalten so wählen, dass das Raster ohne Lücke aufgeht; „unsicher“ wird
 * dafür notfalls zur vollen Zeile unter dem Raster.
 */
function gridLayout(ids: string[]): { columns: 2 | 3; wideUnsure: boolean } {
  const fit = (n: number): 2 | 3 | null => (n === 4 ? 2 : n % 3 === 0 ? 3 : null);
  const all = fit(ids.length);
  if (all) return { columns: all, wideUnsure: false };
  const rest = ids.includes(UNSURE) ? fit(ids.length - 1) : null;
  return rest ? { columns: rest, wideUnsure: true } : { columns: 3, wideUnsure: false };
}

/** Felder mit gezeichneten Kacheln statt Fotos. */
const PICTOGRAM_FIELDS: ReadonlySet<ChoiceField> = new Set(["kitchen_form", "worktop_category"]);

function toImageOption(field: ChoiceField, option: ChoiceOption): ImageOption {
  const base = { id: option.id, label: option.label, description: option.hint };
  if (field === "worktop_category") {
    return { ...base, pictogram: WORKTOP_PICTOGRAMS[option.id], bgClass: WORKTOP_TINTS[option.id] };
  }
  if (field === "kitchen_form" && hasKitchenFormPlan(option.id)) {
    return { ...base, pictogram: <KitchenFormPlan form={option.id} /> };
  }
  const imageSrc = optionImage(field, option.id);
  return imageSrc ? { ...base, imageSrc } : { ...base, icon: renderIcon(choiceIcon(field, option.id)) };
}

function ChoiceContent({
  step,
  value,
  onSelect,
  onAdvance,
}: {
  step: FunnelAChoiceStep;
  value: string;
  onSelect: (id: string) => void;
  onAdvance: () => void;
}) {
  const withVisuals = PICTOGRAM_FIELDS.has(step.field) || step.options.some((o) => optionImage(step.field, o.id));
  if (withVisuals) {
    return (
      <ImageCardStep
        options={step.options.map((o) => toImageOption(step.field, o))}
        selected={value}
        onSelect={onSelect}
        onAutoAdvance={onAdvance}
        labelledBy={QUESTION_ID}
      />
    );
  }

  const { columns, wideUnsure } = gridLayout(step.options.map((o) => o.id));
  const options: CardOption[] = step.options.map((o) => ({
    id: o.id,
    label: o.label,
    description: o.hint,
    icon: renderIcon(choiceIcon(step.field, o.id)),
    swatches: o.swatches,
    wide: wideUnsure && o.id === UNSURE,
  }));
  return (
    <CardStep
      options={options}
      selected={value}
      onSelect={onSelect}
      onAutoAdvance={onAdvance}
      columns={columns}
      labelledBy={QUESTION_ID}
    />
  );
}

export function StepContent({ step, answers, onAnswer, onAdvance }: StepContentProps) {
  switch (step.kind) {
    case "choice":
      return (
        <ChoiceContent
          step={step}
          value={answers[step.field]}
          onSelect={(id) => onAnswer(step.field, id)}
          onAdvance={onAdvance}
        />
      );
    case "multi":
      return (
        <MultiCardStep
          options={step.options.map((o) => ({ ...o, icon: renderIcon(EXTRA_APPLIANCE_ICONS[o.id]) }))}
          selected={answers.extra_appliances}
          onSelectionChange={(ids) => onAnswer("extra_appliances", ids)}
          labelledBy={QUESTION_ID}
        />
      );
    case "budget":
      return <BudgetStep answers={answers} onChange={(value) => onAnswer("budget_eur", value)} />;
    case "plz":
      return (
        <PlzStep value={answers.postal_code} onChange={(value) => onAnswer("postal_code", value)} onSubmit={onAdvance} />
      );
  }
}
