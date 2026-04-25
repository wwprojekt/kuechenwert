/**
 * Invoice-Status-Helpers
 *
 * Konsistenz zwischen Client und Server für "Überfällig"-Semantik.
 *
 * Hintergrund (Fehlerprotokoll 25.04.2026):
 *   `invoices.due_date` ist vom Typ `date` (ohne Zeit), nicht `timestamp`.
 *   Der Server-Filter `.lt('due_date', new Date().toISOString())` wird von
 *   PostgREST/Postgres auf Tagesebene gecastet (`date < date(timestamp)`) und
 *   entspricht damit exakt `due_date < CURRENT_DATE`.
 *
 *   Naiver Client-Code (`new Date(inv.due_date) < new Date()`) verglich
 *   dagegen auf Millisekunden-Ebene: eine Rechnung mit `due_date = heute`
 *   lieferte `2026-04-25T00:00:00Z < 2026-04-25T09:11:00Z` = true und wurde
 *   fälschlich als überfällig gezählt. Resultat: KPI-Kachel und Badge zeigten
 *   "1 überfällig", die serverseitig gefilterte Liste blieb aber leer.
 *
 *   Fachlich korrekt: Eine Rechnung ist erst NACH dem Fälligkeitstag
 *   überfällig, nicht AM Fälligkeitstag selbst.
 *
 * UTC-Hinweis:
 *   DB-TimeZone ist UTC, `CURRENT_DATE` bezieht sich darauf. Der Client-Helper
 *   verwendet ebenfalls den UTC-Tag des `Date`-Objekts, um mit dem Server
 *   bitgenau zu matchen. Für deutsche UI unbedenklich: Berlin-Zeit und UTC
 *   unterscheiden sich maximal 1–2 h; der Tagesrollover ist ein akzeptabler
 *   Mikro-Drift, den auch die serverseitige Filterung hat.
 */

/**
 * Normalisiert einen beliebigen Datumsstring auf 'YYYY-MM-DD' (UTC-Tag).
 * Akzeptiert: 'YYYY-MM-DD', 'YYYY-MM-DDTHH:MM:SS.sssZ', Date-Objekt.
 */
function toYmdUtc(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * Ist die Rechnung überfällig?
 *
 * Tagesvergleich, identisch mit Server-Filter `due_date < CURRENT_DATE`.
 * Rechnungen, die HEUTE fällig sind, gelten als „fällig heute" und sind
 * NICHT überfällig.
 *
 * Gibt `false` für leere/ungültige Eingaben zurück (defensiv – eine Rechnung
 * ohne Fälligkeitsdatum ist definitionsgemäß nicht überfällig).
 */
export function isInvoiceOverdue(
  dueDate: string | Date | null | undefined,
  referenceDate: Date = new Date()
): boolean {
  if (!dueDate) return false;
  const due = toYmdUtc(dueDate);
  const today = toYmdUtc(referenceDate);
  return due < today;
}
