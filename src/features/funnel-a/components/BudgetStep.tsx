import { Calculator } from "lucide-react";
import { useMemo } from "react";
import { BudgetSliderStep } from "@/components/funnel/budget-slider-step";
import { FUNNEL_A_BUDGET, estimateFunnelA, type FunnelAAnswers } from "../catalog";

const NUMBER = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

interface BudgetStepProps {
  answers: FunnelAAnswers;
  onChange: (value: number | null) => void;
}

/** Budget-Slider mit Preisanker aus den bisherigen Antworten. */
export function BudgetStep({ answers, onChange }: BudgetStepProps) {
  const estimate = useMemo(() => estimateFunnelA(answers), [answers]);

  return (
    <div className="space-y-7">
      <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 sm:px-5">
        <Calculator className="mt-0.5 h-5 w-5 flex-none text-brand-600" aria-hidden="true" />
        <p className="text-sm leading-snug text-foreground">
          Typisch für Ihre Auswahl:{" "}
          <strong className="whitespace-nowrap font-semibold tabular-nums text-brand-800">
            {NUMBER.format(estimate.min)} – {NUMBER.format(estimate.max)} €
          </strong>
          <span className="mt-0.5 block text-xs text-ink-muted">Markenküche inkl. Geräte, Lieferung &amp; Montage</span>
        </p>
      </div>

      <BudgetSliderStep
        value={answers.budget_eur}
        onChange={onChange}
        min={FUNNEL_A_BUDGET.min}
        max={FUNNEL_A_BUDGET.max}
        step={FUNNEL_A_BUDGET.step}
        defaultValue={FUNNEL_A_BUDGET.default}
      />
    </div>
  );
}
