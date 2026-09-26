import { CalendarClock, CheckCircle2, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatOrderDate, orderMilestones, type Order } from "../order";

const euro = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

/** Etappen eines Auftrags (Beauftragung → Aufmaß → Kaufvertrag → Montage → fertig). */
export function OrderTimeline({ order, className }: { order: Order; className?: string }) {
  const steps = orderMilestones(order);
  return (
    <ol className={cn("space-y-4", className)}>
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-3">
          {i < steps.length - 1 && (
            <span aria-hidden className={cn("absolute left-4 top-9 h-[calc(100%-1.25rem)] w-px", s.state === "done" ? "bg-primary" : "bg-border")} />
          )}
          <span
            className={cn(
              "grid h-8 w-8 flex-none place-items-center rounded-full",
              s.state === "done" && "bg-primary text-primary-foreground",
              s.state === "scheduled" && "bg-primary/10 text-primary ring-1 ring-primary/40",
              s.state === "open" && "bg-muted text-muted-foreground",
            )}
          >
            {s.state === "done" ? <CheckCircle2 className="h-4 w-4" /> : s.state === "scheduled" ? <CalendarClock className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
            <span className="sr-only">{s.state === "done" ? "erledigt" : s.state === "scheduled" ? "geplant" : "offen"}</span>
          </span>
          <div className="min-w-0 pt-1">
            <p className={cn("text-sm font-semibold", s.state === "open" && "text-muted-foreground")}>{s.label}</p>
            {s.date && (
              <p className="text-xs text-muted-foreground">
                {s.state === "scheduled" ? "Geplant: " : ""}
                {formatOrderDate(s.date, s.withTime)}
              </p>
            )}
            {s.key === "contract" && order.contract_value_eur != null && (
              <p className="text-xs text-muted-foreground">Auftragswert {euro(order.contract_value_eur)}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
