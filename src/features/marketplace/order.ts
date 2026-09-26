/**
 * Auftragsverlauf nach dem Zuschlag (Tabelle kw_orders, Migration
 * 20260926132427_kw_order_lifecycle). Das Studio meldet die Etappen, die
 * Kundin bzw. der Kunde sieht sie auf der Projektseite.
 */

export type OrderStatus =
  | "awarded"
  | "contacted"
  | "measurement_scheduled"
  | "contract_signed"
  | "installation_scheduled"
  | "completed"
  | "cancelled";

/** Etappen, die das Studio über kw_dealer_order_update meldet. */
export type OrderStep = "contacted" | "measurement" | "contract" | "installation" | "completed" | "cancelled" | "note";

export type OrderEventType = OrderStep | "awarded" | "consumer_confirmed" | "problem_reported" | "reminder" | "escalated" | "completion_check";

export type CancelReason = "customer_withdrew" | "price_after_measurement" | "not_reachable" | "studio_declined" | "other";

export interface OrderEvent {
  event: OrderEventType;
  actor: "dealer" | "customer" | "admin" | "system";
  event_at: string | null;
  value_eur: number | null;
  /** Nur in der Studio-Sicht und nur für Studio-/Systemeinträge. */
  note: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  auction_id: string;
  status: OrderStatus;
  offer_price_eur: number;
  contract_value_eur: number | null;
  contacted_at: string | null;
  measurement_at: string | null;
  contract_signed_at: string | null;
  installation_at: string | null;
  completed_at: string | null;
  consumer_confirmed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: CancelReason | null;
  /** Nur in der Studio-Sicht. */
  cancel_note?: string | null;
  problem_reported_at: string | null;
  created_at: string;
  updated_at: string;
  can_confirm: boolean;
  events: OrderEvent[];
}

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  customer_withdrew: "Kund:in hat sich anders entschieden",
  price_after_measurement: "Preis nach dem Aufmaß nicht passend",
  not_reachable: "Kund:in nicht erreichbar",
  studio_declined: "Wir können den Auftrag nicht übernehmen",
  other: "Sonstiger Grund",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awarded: "Studio beauftragt",
  contacted: "Kontakt aufgenommen",
  measurement_scheduled: "Aufmaß vereinbart",
  contract_signed: "Kaufvertrag unterschrieben",
  installation_scheduled: "Montage geplant",
  completed: "Küche montiert",
  cancelled: "Nicht zustande gekommen",
};

export const ORDER_EVENT_LABELS: Record<OrderEventType, string> = {
  awarded: "Angebot angenommen",
  contacted: "Kontakt aufgenommen",
  measurement: "Aufmaß-Termin eingetragen",
  contract: "Kaufvertrag erfasst",
  installation: "Montagetermin eingetragen",
  completed: "Montage als abgeschlossen gemeldet",
  cancelled: "Als nicht zustande gekommen gemeldet",
  note: "Notiz",
  consumer_confirmed: "Montage von Kund:in bestätigt",
  problem_reported: "Anliegen an KüchenWert gemeldet",
  reminder: "Erinnerung an das Studio versendet",
  escalated: "An KüchenWert eskaliert",
  completion_check: "Rückfrage zur Montage an Kund:in",
};

const RANK: Record<OrderStatus, number> = {
  awarded: 0,
  contacted: 1,
  measurement_scheduled: 2,
  contract_signed: 3,
  installation_scheduled: 4,
  completed: 5,
  cancelled: -1,
};

export type MilestoneState = "done" | "scheduled" | "open";

export interface OrderMilestone {
  key: "awarded" | "measurement" | "contract" | "installation" | "completed";
  label: string;
  state: MilestoneState;
  date: string | null;
  /** Termine mit Uhrzeit (Aufmaß) oder als reines Datum (Montage). */
  withTime: boolean;
}

const isPast = (iso: string | null, now: Date) => !!iso && new Date(iso).getTime() <= now.getTime();

export function orderMilestones(order: Order, now: Date = new Date()): OrderMilestone[] {
  const rank = RANK[order.status];
  const completed = order.status === "completed";
  return [
    { key: "awarded", label: "Studio beauftragt", state: "done", date: order.created_at, withTime: false },
    {
      key: "measurement",
      label: "Aufmaß vor Ort",
      state: rank >= RANK.contract_signed || isPast(order.measurement_at, now) ? "done" : order.measurement_at ? "scheduled" : "open",
      date: order.measurement_at,
      withTime: true,
    },
    { key: "contract", label: "Kaufvertrag", state: order.contract_signed_at ? "done" : "open", date: order.contract_signed_at, withTime: false },
    {
      key: "installation",
      label: "Montage",
      state: completed ? "done" : order.installation_at ? "scheduled" : "open",
      date: order.installation_at,
      withTime: false,
    },
    {
      key: "completed",
      label: "Küche fertig",
      state: completed ? "done" : "open",
      date: order.consumer_confirmed_at ?? order.completed_at,
      withTime: false,
    },
  ];
}

/** Sinnvolle nächste Etappen fürs Studio; die erste ist die empfohlene. */
export function dealerNextSteps(order: Order): OrderStep[] {
  if (order.consumer_confirmed_at) return [];
  switch (order.status) {
    case "cancelled":
      return [];
    case "awarded":
      return ["measurement", "contacted"];
    case "contacted":
      return ["measurement"];
    case "measurement_scheduled":
      return ["contract", "measurement"];
    case "contract_signed":
      return ["installation"];
    case "installation_scheduled":
      return ["completed", "installation"];
    case "completed":
      return [];
  }
}

/** Das Studio kann jederzeit melden, dass der Auftrag nicht zustande kommt – außer nach der Bestätigung. */
export const canReportCancellation = (order: Order) => order.status !== "cancelled" && !order.consumer_confirmed_at;

/** Relative Abweichung des Kaufvertrags vom angenommenen Angebot, z. B. 0.06 für +6 %. */
export function contractDeviation(order: Pick<Order, "offer_price_eur" | "contract_value_eur">): number | null {
  if (!order.contract_value_eur || !order.offer_price_eur) return null;
  return (order.contract_value_eur - order.offer_price_eur) / order.offer_price_eur;
}

export function formatOrderDate(iso: string | null, withTime: boolean): string {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "long", year: "numeric" });
  if (!withTime) return day;
  return `${day}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
}
