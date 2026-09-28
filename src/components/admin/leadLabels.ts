import type { Database } from "@/integrations/supabase/types";

type LeadStatus = Database["public"]["Enums"]["lead_status"];

export type StatusBadge = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
};

// Spiegelt das Enum public.lead_status.
export const LEAD_STATUS_LABELS: Record<LeadStatus, StatusBadge> = {
  new: { label: "Neu", variant: "default" },
  qualified: { label: "Qualifiziert", variant: "secondary" },
  disqualified: { label: "Aussortiert", variant: "destructive" },
  matched: { label: "Zugeordnet", variant: "secondary" },
  in_auction: { label: "In Ausschreibung", variant: "secondary" },
  sold: { label: "Kontakt verkauft", variant: "secondary" },
  contacted: { label: "Kontaktiert", variant: "secondary" },
  appointment_set: { label: "Termin vereinbart", variant: "secondary" },
  offer_sent: { label: "Angebot gesendet", variant: "secondary" },
  closed_won: { label: "Gewonnen", variant: "default" },
  closed_lost: { label: "Verloren", variant: "outline" },
  disputed: { label: "Reklamiert", variant: "destructive" },
};

// Spiegelt die Check-Constraint lead_bids_status_check.
export const OFFER_STATUS_LABELS: Record<string, StatusBadge> = {
  active: { label: "Aktiv", variant: "default" },
  accepted: { label: "Angenommen", variant: "default" },
  withdrawn: { label: "Zurückgezogen", variant: "outline" },
  declined: { label: "Abgelehnt", variant: "outline" },
};

export function leadStatusBadge(status: string): StatusBadge {
  return LEAD_STATUS_LABELS[status as LeadStatus] ?? { label: status, variant: "outline" };
}

export function offerStatusBadge(status: string): StatusBadge {
  return OFFER_STATUS_LABELS[status] ?? { label: status, variant: "outline" };
}
