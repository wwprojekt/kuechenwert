import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "../api-client";
import { fetchDealerOrder, updateDealerOrder } from "../dealer-api";
import { CANCEL_REASON_LABELS, ORDER_EVENT_LABELS, ORDER_STATUS_LABELS, contractDeviation, formatOrderDate, type OrderStep } from "../order";
import { DealerOrderActions, type OrderUpdateInput } from "./DealerOrderActions";
import { OrderTimeline } from "./OrderTimeline";

const euro = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

const SUCCESS: Record<OrderStep, string> = {
  contacted: "Gespeichert – danke für die schnelle Kontaktaufnahme.",
  measurement: "Aufmaß-Termin gespeichert. Die Kundin bzw. der Kunde wird per E-Mail informiert.",
  contract: "Kaufvertrag erfasst.",
  installation: "Montagetermin gespeichert. Die Kundin bzw. der Kunde wird per E-Mail informiert.",
  completed: "Montage als abgeschlossen gemeldet. Wir bitten die Kundin bzw. den Kunden um eine kurze Bestätigung.",
  cancelled: "Gemeldet. KüchenWert meldet sich bei Ihnen und bei der Kundin bzw. dem Kunden.",
  note: "Notiz gespeichert.",
};

/** Auftragsstatus nach dem Zuschlag im Studio-Portal. */
export function DealerOrderPanel({ auctionId }: { auctionId: string }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["dealer-order", auctionId], queryFn: () => fetchDealerOrder(auctionId), refetchInterval: 120_000 });
  const update = useMutation({
    mutationFn: (input: OrderUpdateInput) => updateDealerOrder({ auctionId, ...input }),
    onSuccess: (order, input) => {
      qc.setQueryData(["dealer-order", auctionId], order);
      void qc.invalidateQueries({ queryKey: ["dealer-projects"] });
      toast.success(SUCCESS[input.step]);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (query.isLoading) {
    return (
      <div className="flex justify-center rounded-2xl border bg-card p-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (query.isError) {
    return <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{errorMessage(query.error)}</div>;
  }
  const order = query.data;
  if (!order) return null;

  const deviation = contractDeviation(order);
  const history = [...order.events].reverse();

  return (
    <div className="rounded-2xl border border-primary/40 bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold">
          <ClipboardList className="h-4 w-4 text-primary" /> Auftrag
        </h2>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{ORDER_STATUS_LABELS[order.status]}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Halten Sie den Stand aktuell: Die Kundin bzw. der Kunde sieht die Etappen auf der Projektseite und wird per E-Mail informiert.
      </p>

      {order.status === "cancelled" ? (
        <p className="mt-4 rounded-lg bg-muted p-3 text-sm">
          Am {formatOrderDate(order.cancelled_at, false)} als nicht zustande gekommen gemeldet
          {order.cancel_reason ? `: ${CANCEL_REASON_LABELS[order.cancel_reason]}` : ""}
          {order.cancel_note ? ` – ${order.cancel_note}` : ""}
        </p>
      ) : (
        <OrderTimeline order={order} className="mt-4" />
      )}

      {deviation != null && Math.abs(deviation) > 0.1 && (
        <p className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs">
          Der Auftragswert weicht um {deviation > 0 ? "+" : ""}
          {Math.round(deviation * 100)} % vom angenommenen Angebot ({euro(order.offer_price_eur)}) ab. KüchenWert gleicht die Provisionsrechnung ab.
        </p>
      )}

      <DealerOrderActions key={`${order.status}-${order.updated_at}`} order={order} pending={update.isPending} onSubmit={(input) => update.mutate(input)} />

      {history.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold">Verlauf ({history.length})</summary>
          <ul className="mt-2 space-y-2">
            {history.map((e, i) => (
              <li key={`${e.created_at}-${i}`} className="border-l-2 border-border pl-3">
                <p className="font-medium">
                  {ORDER_EVENT_LABELS[e.event]}
                  {e.event_at ? `: ${formatOrderDate(e.event_at, e.event === "measurement")}` : ""}
                  {e.value_eur != null ? ` · ${euro(e.value_eur)}` : ""}
                </p>
                {e.note && <p className="text-muted-foreground">{e.note}</p>}
                <p className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
