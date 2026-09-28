import type { ReactNode } from "react";
import { AlertCircle, Info, KeyRound, Percent, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommissionTiers, useUnlockPriceRules } from "@/hooks/useStudioPricing";
import { BRAND } from "@/lib/brand";
import { CommissionCalculator } from "./CommissionCalculator";
import { StudioCommissionTable } from "./StudioCommissionTable";
import { UnlockPriceTable } from "./UnlockPriceTable";
import { unlockPriceBands } from "./studio-pricing";

interface QueryState {
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
}

const MAIL_LINK_CLASS = "font-medium text-primary underline-offset-4 hover:underline";

function PriceState({ query, isEmpty, children }: { query: QueryState; isEmpty: boolean; children: ReactNode }) {
  if (query.isPending) {
    return (
      <div role="status" className="space-y-3">
        <span className="sr-only">Preise werden geladen …</span>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="flex items-start gap-2 text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          Die Preise konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut oder schreiben Sie an{" "}
          {BRAND.supportEmail}.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Erneut versuchen
        </Button>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        <span>
          Die Preisliste wird gerade aktualisiert. Die aktuellen Konditionen nennen wir Ihnen gern unter{" "}
          <a href={`mailto:${BRAND.supportEmail}`} className={MAIL_LINK_CLASS}>
            {BRAND.supportEmail}
          </a>
          .
        </span>
      </p>
    );
  }
  return <>{children}</>;
}

/** Studio-Konditionen aus lead_commission_tiers und lead_pricing_rules (nur aktive Zeilen). */
export function StudioPricing() {
  const commission = useCommissionTiers();
  const unlock = useUnlockPriceRules();
  const tiers = commission.data ?? [];
  const bands = unlockPriceBands(unlock.data ?? []);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Percent className="h-5 w-5 text-primary" aria-hidden="true" />
              Provision bei Annahme
            </CardTitle>
            <CardDescription>Nur wenn die Kund:in Ihr Angebot annimmt – gestaffelt nach Angebotspreis.</CardDescription>
          </CardHeader>
          <CardContent>
            <PriceState query={commission} isEmpty={tiers.length === 0}>
              <StudioCommissionTable tiers={tiers} />
            </PriceState>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
              Kontaktfreischaltung (optional)
            </CardTitle>
            <CardDescription>
              Für eine Beratung vor der Entscheidung der Kund:in. Höchstens drei Studios je Projekt können den Kontakt freischalten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PriceState query={unlock} isEmpty={bands.length === 0}>
              <UnlockPriceTable bands={bands} />
            </PriceState>
          </CardContent>
        </Card>
      </div>
      {tiers.length > 0 && (
        <div className="mx-auto max-w-lg">
          <CommissionCalculator tiers={tiers} />
        </div>
      )}
    </div>
  );
}
