/**
 * Rechnungs-Ableitungen (kanonischer Display-Status + Derived-Properties)
 *
 * Zentraler Helper für ALLES, was sich aus einer Rechnung ableiten lässt:
 * Status-Badge, Restbetrag, Progress, Action-Enables. Wird von AdminFinancials,
 * MyInvoices und künftigen Views (Timeline, Exports) konsumiert.
 *
 * Motivation (Audit 25.04.2026):
 *   Bisher hatten AdminFinancials.getStatusBadge, MyInvoices.getStatusBadge,
 *   filteredInvoices.matchesStatus, overdueInvoicesLocal und jede Button-
 *   Disable-Logik je eine eigene Interpretation der Felder status /
 *   payment_status. Folge:
 *     - Dealer sah stornierte Rechnungen als "Offen/Überfällig" (payment_status='cancelled'
 *       fiel aus dem Switch-default in MyInvoices).
 *     - "Offener Betrag"-KPI beim Dealer enthielt stornierte Beträge.
 *     - "Zahlung erfassen"-Button war bei stornierter Rechnung klickbar
 *       (Server blockte, aber UX irreführend).
 *     - paymentProgress konnte NaN werden bei gross_amount=0.
 *
 *   Statt jedes Symptom einzeln zu fixen, wird hier die Ableitung einmal
 *   korrekt gemacht und überall konsumiert. Neue Zustände ("refunded",
 *   "disputed" …) müssen dann nur an einer Stelle hinzugefügt werden.
 *
 * Konsistenz mit Server:
 *   `displayStatus='cancelled'` hat Priorität über alle payment_status-Werte,
 *   weil `cancel-invoice` immer beide Felder setzt (supabase/functions/
 *   cancel-invoice/index.ts L156–157) und die Stornierung das fachlich
 *   dominante Ereignis ist.
 *
 *   `isOverdue`/`daysOverdue` stützen sich auf den Tagesvergleich in
 *   `isInvoiceOverdue` (src/lib/invoiceStatus.ts) — identisch mit dem
 *   Server-Filter `.lt('due_date', now())` → `date < CURRENT_DATE`.
 */

import { isInvoiceOverdue } from "./invoiceStatus";

/**
 * Mindestmenge an Feldern, die für die Ableitung gebraucht werden.
 * Absichtlich minimal gehalten, damit sowohl Admin-Queries (`select('*')`)
 * als auch Dealer-Queries (typisiertes Interface) ohne Cast durchgereicht
 * werden können.
 *
 * Numerische Felder dürfen auch als `string` reinkommen: Supabase liefert
 * Postgres `numeric(…)` per default als String zurück.
 */
export interface InvoiceLike {
  status?: string | null;
  payment_status?: string | null;
  gross_amount?: number | string | null;
  amount_paid?: number | string | null;
  due_date?: string | Date | null;
}

/**
 * Kanonischer Display-Status.
 *
 * Priorität (höchste zuerst):
 *   cancelled > paid > partial > overdue > open
 *
 * `partial` > `overdue`: Eine teilbezahlte überfällige Rechnung wird als
 * "Teilbezahlt" gebadget, die Überfälligkeit ist über `isOverdue`/
 * `daysOverdue` separat verfügbar (z.B. im Mahnungs-Tab oder Progress-
 * Farbcode). Das entspricht dem bisherigen Admin-Verhalten und verhindert,
 * dass eine Teilzahlung durch das Überfällig-Label optisch "vergessen"
 * wird.
 */
export type InvoiceDisplayStatus =
  | "cancelled"
  | "paid"
  | "partial"
  | "overdue"
  | "open";

export interface InvoiceDerived {
  displayStatus: InvoiceDisplayStatus;
  /** gross - paid, nie negativ, auf 2 Nachkommastellen gerundet. */
  remainingAmount: number;
  /** 0..100, nie NaN (auch bei gross=0). */
  paymentProgress: number;
  /**
   * True, wenn die Rechnung überfällig wäre (Tagesvergleich due_date < heute)
   * UND noch aktiv ist UND nicht voll bezahlt. Genau das Kriterium, das auch
   * die Überfällig-Filter und KPI-Kacheln nutzen.
   */
  isOverdue: boolean;
  /**
   * Anzahl Tage zwischen due_date und heute. 0 wenn nicht überfällig oder
   * storniert. Ganzzahlig abgerundet.
   */
  daysOverdue: number;
  /** gross - paid > 0 UND active UND nicht bereits paid. */
  canRecordPayment: boolean;
  /** Server-Semantik: paid kann nicht storniert werden (cancel-invoice L145). */
  canCancel: boolean;
  /** Nur für aktive, nicht vollbezahlte Rechnungen sinnvoll. */
  canSendReminder: boolean;
  /** Für stornierte Rechnungen wird das PDF eingefroren. */
  canRegeneratePdf: boolean;
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeDaysOverdue(
  dueDate: string | Date | null | undefined,
  now: Date,
): number {
  if (!dueDate) return 0;
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const ms = now.getTime() - due.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Kanonische Rechnungs-Ableitung. Pure, ohne Seiteneffekte.
 */
export function deriveInvoice(
  invoice: InvoiceLike,
  now: Date = new Date(),
): InvoiceDerived {
  const gross = toNumber(invoice.gross_amount);
  const paid = toNumber(invoice.amount_paid);
  const remaining = roundCents(Math.max(0, gross - paid));
  const paymentProgress =
    gross > 0 ? Math.min(100, Math.max(0, (paid / gross) * 100)) : 0;

  const isCancelled = invoice.status === "cancelled";
  const isPaid = invoice.payment_status === "paid";
  const isPartial = invoice.payment_status === "partial";
  const overdueRaw = isInvoiceOverdue(invoice.due_date, now);

  let displayStatus: InvoiceDisplayStatus;
  if (isCancelled) displayStatus = "cancelled";
  else if (isPaid) displayStatus = "paid";
  else if (isPartial) displayStatus = "partial";
  else if (overdueRaw) displayStatus = "overdue";
  else displayStatus = "open";

  const isActive = !isCancelled;
  const isOverdue = overdueRaw && isActive && !isPaid;
  const daysOverdue = isOverdue ? computeDaysOverdue(invoice.due_date, now) : 0;

  return {
    displayStatus,
    remainingAmount: remaining,
    paymentProgress,
    isOverdue,
    daysOverdue,
    // remaining ist bereits centgenau gerundet; `> 0` schließt damit exakt
    // vollbezahlte Rechnungen aus, erlaubt aber die Erfassung eines letzten
    // Cents. `> 0.01` hätte den 1-ct-Restbetrag fälschlich gesperrt, obwohl
    // record-invoice-payment diesen problemlos akzeptiert.
    canRecordPayment: isActive && !isPaid && remaining > 0,
    canCancel: isActive && !isPaid,
    canSendReminder: isActive && !isPaid,
    canRegeneratePdf: isActive,
  };
}
