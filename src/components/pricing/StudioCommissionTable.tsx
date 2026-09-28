import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type CommissionTier, formatCentsRange, formatEuro, formatPercent } from "./studio-pricing";

export function StudioCommissionTable({ tiers }: { tiers: CommissionTier[] }) {
  const showMax = tiers.some((tier) => tier.max_cents != null);
  return (
    <Table>
      <TableCaption className="text-left">
        Grundlage ist der angenommene Angebotspreis inkl. MwSt. Alle Provisionsbeträge netto zzgl. MwSt.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className="px-3">Angebotspreis</TableHead>
          <TableHead scope="col" className="px-3 text-right">Provision</TableHead>
          <TableHead scope="col" className="px-3 text-right">Mindestbetrag</TableHead>
          {showMax && <TableHead scope="col" className="px-3 text-right">Höchstbetrag</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tiers.map((tier) => (
          <TableRow key={tier.order_value_min_cents}>
            <TableCell className="px-3 font-medium">
              {formatCentsRange(tier.order_value_min_cents, tier.order_value_max_cents)}
            </TableCell>
            <TableCell className="px-3 text-right">{formatPercent(tier.percent)}</TableCell>
            <TableCell className="px-3 text-right">{formatEuro(tier.min_cents)}</TableCell>
            {showMax && (
              <TableCell className="px-3 text-right">{tier.max_cents == null ? "–" : formatEuro(tier.max_cents)}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
