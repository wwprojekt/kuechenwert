import { useId, useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { type CommissionTier, calculateCommission, formatEuroExact, formatPercent } from "./studio-pricing";

/** Steuersatz für Studios in Deutschland; EU-Studios rechnen per Reverse Charge ab. */
const VAT_PERCENT = 19;

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "font-semibold")}>
      <dt className={strong ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className={strong ? "text-primary" : "font-medium"}>{value}</dd>
    </div>
  );
}

export function CommissionCalculator({ tiers }: { tiers: CommissionTier[] }) {
  const inputId = useId();
  const [amountEur, setAmountEur] = useState(20000);
  const result = calculateCommission(tiers, Math.round(amountEur * 100));
  const vatCents = result ? Math.round((result.commissionCents * VAT_PERCENT) / 100) : 0;
  const notes = [result?.minApplied && "Mindestbetrag", result?.maxApplied && "Höchstbetrag"].filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5 text-primary" aria-hidden="true" />
          Provisionsrechner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor={inputId}>Angebotspreis inkl. MwSt. (€)</Label>
          <Input
            id={inputId}
            type="number"
            inputMode="decimal"
            min={0}
            step={500}
            value={amountEur || ""}
            onChange={(e) => setAmountEur(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1"
          />
        </div>
        <div aria-live="polite" className="pt-2 text-sm">
          {result ? (
            <dl className="space-y-2">
              <Line
                label={`Provision (${formatPercent(result.tier.percent)}${notes.length ? `, ${notes.join(", ")}` : ""})`}
                value={formatEuroExact(result.commissionCents)}
              />
              <Line label={`zzgl. ${VAT_PERCENT} % MwSt.`} value={formatEuroExact(vatCents)} />
              <Separator />
              <Line label="Rechnungsbetrag" value={formatEuroExact(result.commissionCents + vatCents)} strong />
            </dl>
          ) : (
            <p className="text-muted-foreground">
              {amountEur > 0
                ? "Für diesen Angebotspreis ist keine Staffel hinterlegt – sprechen Sie uns gern an."
                : "Geben Sie einen Angebotspreis ein, um die Provision zu berechnen."}
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Die Provision fällt nur an, wenn die Kund:in Ihr Angebot annimmt. Für Studios mit Sitz im EU-Ausland gilt das
          Reverse-Charge-Verfahren.
        </p>
      </CardContent>
    </Card>
  );
}
