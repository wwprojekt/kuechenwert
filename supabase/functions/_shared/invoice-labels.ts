/**
 * Beschriftungen fuer Rechnungen je Rechnungstyp.
 *
 * Gemeinsame Quelle fuer send-invoice-email (Mail) und generate-invoice-pdf
 * (PDF), damit beide dieselbe Leistung und denselben Projektbezug nennen.
 */

export const PENALTY_REASON_LABELS: Record<string, string> = {
  anderweitiger_verkauf: "Anderweitiger Verkauf während der Auktion",
  vorzeitige_ruecknahme: "Vorzeitige Rücknahme des Inserats",
  falsche_angaben: "Falsche oder irreführende Angaben",
};

export interface InvoiceLabelInput {
  invoice_type?: string | null;
  penalty_reason?: string | null;
  lead?: { postal_code?: string | null; city?: string | null } | null;
  auction?: { kitchen?: { manufacturer?: string | null; model?: string | null } | null } | null;
  items?: Array<{ description?: string | null }> | null;
}

export interface InvoiceLabels {
  isPenalty: boolean;
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
  const type = invoice.invoice_type ?? "commission";

  if (type === "seller_penalty") {
    const reason = (invoice.penalty_reason && PENALTY_REASON_LABELS[invoice.penalty_reason])
      || invoice.penalty_reason
      || "Vertragsstrafe";
    return {
      isPenalty: true,
      referenceTitle: "Vertragsstrafe",
      referenceValue: reason,
      serviceLabel: "Vertragsstrafe",
      intro: "hiermit erhalten Sie Ihre Rechnung über eine Vertragsstrafe gemäß § 8 Abs. 4 unserer AGB.",
      fallbackItemDescription: `Vertragsstrafe: ${reason}`,
    };
  }

  if (type === "lead_purchase") {
    const reference = projectReference(invoice.lead);
    return {
      isPenalty: false,
      referenceTitle: "Projekt",
      referenceValue: reference,
      serviceLabel: "Kontaktfreischaltung",
      intro: "anbei erhalten Sie Ihre Rechnung für die Freischaltung eines Kundenkontakts in der KüchenWert-Projekt-Börse.",
      fallbackItemDescription: `Kontaktfreischaltung ${reference}`,
    };
  }

  if (type === "lead_commission") {
    const reference = projectReference(invoice.lead);
    return {
      isPenalty: false,
      referenceTitle: "Projekt",
      referenceValue: reference,
      serviceLabel: "Vermittlungsprovision",
      intro: "anbei erhalten Sie Ihre Rechnung über die Vermittlungsprovision für das Küchenprojekt, bei dem die Kund:in Ihr Angebot angenommen hat.",
      fallbackItemDescription: `Vermittlungsprovision ${reference}`,
    };
  }

  const kitchen = invoice.auction?.kitchen;
  const kitchenName = [kitchen?.manufacturer, kitchen?.model].filter(Boolean).join(" ").trim();
  return {
    isPenalty: false,
    referenceTitle: kitchenName ? "Küche" : "Leistung",
    referenceValue: kitchenName || "Vermittlungsprovision",
    serviceLabel: "Vermittlungsprovision",
    intro: "anbei erhalten Sie Ihre Rechnung über die Vermittlungsprovision.",
    fallbackItemDescription: kitchenName ? `Vermittlungsprovision: ${kitchenName}` : "Vermittlungsprovision",
  };
}
