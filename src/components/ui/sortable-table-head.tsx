/**
 * SortableTableHead – Klickbarer Tabellenkopf mit Sortier-Indikator.
 *
 * Zeigt einen Pfeil nach oben/unten wenn die Spalte aktiv sortiert wird,
 * und ein dezentes ArrowUpDown-Icon wenn nicht aktiv.
 *
 * Verwendung:
 *   <SortableTableHead
 *     field="current_bid"
 *     label="Aktuelles Gebot"
 *     sortField={sortField}
 *     sortDirection={sortDirection}
 *     onSort={handleSort}
 *   />
 */

import { TableHead } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { SortDirection } from "@/hooks/useTableSort";
import { cn } from "@/lib/utils";

interface SortableTableHeadProps {
  field: string;
  label: string;
  sortField: string;
  sortDirection: SortDirection;
  onSort: (field: string) => void;
  className?: string;
}

export function SortableTableHead({
  field,
  label,
  sortField,
  sortDirection,
  onSort,
  className,
}: SortableTableHeadProps) {
  const isActive = sortField === field;

  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none hover:bg-muted/50 transition-colors",
        isActive && "text-primary",
        className
      )}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        {isActive ? (
          sortDirection === "asc" ? (
            <ArrowUp className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
        )}
      </div>
    </TableHead>
  );
}
