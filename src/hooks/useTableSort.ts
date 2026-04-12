/**
 * useTableSort – Wiederverwendbarer Hook für Tabellen-Sortierung.
 *
 * Unterstützt:
 * - Strings (case-insensitive)
 * - Zahlen
 * - Datumswerte (ISO-Strings)
 * - Null/undefined Werte (immer am Ende)
 * - Verschachtelte Pfade (z.B. "vehicle.manufacturer")
 * - Benutzerdefinierte Accessor-Funktionen
 *
 * Verwendung:
 *   const { sortField, sortDirection, handleSort, sortData } = useTableSort<Auction>('end_time', 'asc');
 *   const sorted = sortData(auctions, { end_time: (a) => a.end_time });
 */

import { useState, useCallback, useMemo } from "react";

export type SortDirection = "asc" | "desc";

interface UseTableSortReturn<T> {
  sortField: string;
  sortDirection: SortDirection;
  handleSort: (field: string) => void;
  sortData: (data: T[], accessors?: Record<string, (item: T) => unknown>) => T[];
}

/**
 * Löst einen verschachtelten Pfad auf (z.B. "vehicle.seller.email")
 */
function getNestedValue(obj: any, path: string): unknown {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

export function useTableSort<T = any>(
  defaultField: string = "",
  defaultDirection: SortDirection = "asc"
): UseTableSortReturn<T> {
  const [sortField, setSortField] = useState(defaultField);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField]
  );

  const sortData = useCallback(
    (data: T[], accessors?: Record<string, (item: T) => unknown>): T[] => {
      if (!sortField || !data) return data || [];

      return [...data].sort((a, b) => {
        let aVal: unknown;
        let bVal: unknown;

        if (accessors?.[sortField]) {
          aVal = accessors[sortField](a);
          bVal = accessors[sortField](b);
        } else {
          aVal = getNestedValue(a, sortField);
          bVal = getNestedValue(b, sortField);
        }

        // Null/undefined immer ans Ende
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // Strings: case-insensitive
        if (typeof aVal === "string" && typeof bVal === "string") {
          const cmp = aVal.localeCompare(bVal, "de", { sensitivity: "base" });
          return sortDirection === "asc" ? cmp : -cmp;
        }

        // Zahlen
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        }

        // Datum-Strings (ISO)
        const dateA = new Date(String(aVal)).getTime();
        const dateB = new Date(String(bVal)).getTime();
        if (!isNaN(dateA) && !isNaN(dateB)) {
          return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
        }

        // Fallback: String-Vergleich
        const cmp = String(aVal).localeCompare(String(bVal), "de", { sensitivity: "base" });
        return sortDirection === "asc" ? cmp : -cmp;
      });
    },
    [sortField, sortDirection]
  );

  return { sortField, sortDirection, handleSort, sortData };
}
