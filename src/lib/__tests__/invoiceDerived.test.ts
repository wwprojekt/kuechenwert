import { describe, expect, it } from "vitest";
import { deriveInvoice } from "../invoiceDerived";

const NOW = new Date("2026-09-28T12:00:00Z");

describe("deriveInvoice", () => {
  it("zeigt Entwürfe nie als überfällig und sperrt Zahlung und Mahnung", () => {
    const d = deriveInvoice({ status: "draft", payment_status: "pending", gross_amount: 58.31, due_date: "2026-09-01" }, NOW);
    expect(d.displayStatus).toBe("draft");
    expect(d.isOverdue).toBe(false);
    expect(d.canRecordPayment).toBe(false);
    expect(d.canSendReminder).toBe(false);
    expect(d.canCancel).toBe(true);
  });

  it("priorisiert Storno vor Entwurf", () => {
    expect(deriveInvoice({ status: "cancelled", payment_status: "cancelled", gross_amount: 10 }, NOW).displayStatus).toBe("cancelled");
  });

  it("erkennt überfällige ausgestellte Rechnungen", () => {
    const d = deriveInvoice({ status: "sent", payment_status: "pending", gross_amount: "100.00", due_date: "2026-09-20" }, NOW);
    expect(d.displayStatus).toBe("overdue");
    expect(d.isOverdue).toBe(true);
    expect(d.daysOverdue).toBe(8);
    expect(d.canRecordPayment).toBe(true);
  });

  it("berechnet Restbetrag und Fortschritt bei Teilzahlung", () => {
    const d = deriveInvoice({ status: "sent", payment_status: "partial", gross_amount: 100, amount_paid: 40, due_date: "2026-10-10" }, NOW);
    expect(d.displayStatus).toBe("partial");
    expect(d.remainingAmount).toBe(60);
    expect(d.paymentProgress).toBe(40);
  });
});
