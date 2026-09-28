// Spiegelt die Check-Constraint invoices_invoice_type_check.
const INVOICE_TYPE_LABELS: Record<string, string> = {
  lead_purchase: "Kontaktfreischaltung",
  lead_commission: "Vermittlungsprovision",
  commission: "Provision",
  seller_penalty: "Vertragsstrafe",
};

/** Rechnungen ohne invoice_type stammen aus der Zeit vor den Marktplatz-Typen. */
export function invoiceTypeLabel(type: string | null | undefined): string {
  const key = type || "commission";
  return INVOICE_TYPE_LABELS[key] ?? key;
}
