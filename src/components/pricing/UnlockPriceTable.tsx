import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type UnlockPriceBand, formatCentsRange, formatPriceSpan } from "./studio-pricing";

export function UnlockPriceTable({ bands }: { bands: UnlockPriceBand[] }) {
  return (
    <Table>
      <TableCaption className="text-left">
        Der genaue Preis richtet sich nach Budget und Qualität der Anfrage und wird Ihnen vor dem Kauf angezeigt. Alle Preise
        netto zzgl. MwSt.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className="px-3">Budget bzw. geschätzter Projektwert</TableHead>
          <TableHead scope="col" className="px-3 text-right">Preis je Freischaltung</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bands.map((band) => (
          <TableRow key={`${band.budgetMinCents}:${band.budgetMaxCents ?? "open"}`}>
            <TableCell className="px-3 font-medium">{formatCentsRange(band.budgetMinCents, band.budgetMaxCents)}</TableCell>
            <TableCell className="px-3 text-right">{formatPriceSpan(band.lowCents, band.highCents)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
