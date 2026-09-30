/**
 * Beschriftungen fuer Rechnungen je Rechnungstyp.
 *
 * Gemeinsame Quelle fuer send-invoice-email und send-payment-reminder (Mail)
 * sowie generate-invoice-pdf (PDF), damit alle dieselbe Leistung und denselben
 * Projektbezug nennen. Rechnungen entstehen nur ueber kw_create_market_invoice:
 * Kontaktfreischaltung (lead_purchase) oder Vermittlungsprovision (lead_commission).
 */

export interface InvoiceLabelInput {
  invoice_type?: string | null;
  lead?: { postal_code?: string | null; city?: string | null } | null;
}

export interface InvoiceLabels {
  /** Ueberschrift der Referenzbox im PDF bzw. Label in der Mail. */
  referenceTitle: string;
  /** Inhalt der Referenzbox, z. B. "Küchenprojekt · PLZ 10115 Berlin". */
  referenceValue: string;
  /** Leistung in einem Wort, z. B. "Kontaktfreischaltung". */
  serviceLabel: string;
  /** Einleitungssatz, beginnt klein (folgt auf die Anrede). */
  intro: string;
  /** Positionsbeschreibung, falls die Rechnung keine eigenen Positionen hat. */
  fallbackItemDescription: string;
}

function projectReference(lead: InvoiceLabelInput["lead"]): string {
  const plz = lead?.postal_code?.trim();
  const city = lead?.city?.trim();
  if (plz && city) return `Küchenprojekt · PLZ ${plz} ${city}`;
  if (plz) return `Küchenprojekt · PLZ ${plz}`;
  return "Küchenprojekt";
}

export function describeInvoice(invoice: InvoiceLabelInput): InvoiceLabels {
  const reference = projectReference(invoice.lead);

  if (invoice.invoice_type === "lead_purchase") {
    return {
      referenceTitle: "Projekt",
      referenceValue: reference,
      serviceLabel: "Kontaktfreischaltung",
      intro: "anbei erhalten Sie Ihre Rechnung für die Freischaltung eines Kundenkontakts in der KüchenWert-Projekt-Börse.",
      fallbackItemDescription: `Kontaktfreischaltung ${reference}`,
    };
  }

  return {
    referenceTitle: "Projekt",
    referenceValue: reference,
    serviceLabel: "Vermittlungsprovision",
    intro: "anbei erhalten Sie Ihre Rechnung über die Vermittlungsprovision für das Küchenprojekt, bei dem die Kund:in Ihr Angebot angenommen hat.",
    fallbackItemDescription: `Vermittlungsprovision ${reference}`,
  };
}
