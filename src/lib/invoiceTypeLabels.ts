// Rechnungstypen des Marktplatzes (invoices.invoice_type).
const INVOICE_TYPE_LABELS: Record<string, string> = {
  lead_purchase: "Kontaktfreischaltung",
  lead_commission: "Vermittlungsprovision",
};

export function invoiceTypeLabel(type: string | null | undefined): string {
  if (!type) return "Rechnung";
  return INVOICE_TYPE_LABELS[type] ?? type;
}
