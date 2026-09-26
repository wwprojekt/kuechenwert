import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LifeBuoy, Loader2, PackageCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { errorMessage } from "../api-client";
import { ORDER_STATUS_LABELS, formatOrderDate, type Order } from "../order";
import { confirmOrder, reportOrderProblem, type ProjectView } from "../project-api";
import { OrderTimeline } from "./OrderTimeline";

const MIN_MESSAGE = 10;

interface Props {
  token: string;
  order: Order;
  studioName: string;
}

/** Auftragsverlauf auf der Projektseite der Kundin bzw. des Kunden. */
export function ProjectOrderCard({ token, order, studioName }: Props) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [message, setMessage] = useState("");
  const setView = (view: ProjectView) => qc.setQueryData(["kw-project", token], view);

  const confirm = useMutation({
    mutationFn: () => confirmOrder(token),
    onSuccess: (view) => {
      setView(view);
      setConfirmOpen(false);
      toast.success("Vielen Dank! Wir wünschen Ihnen viel Freude mit Ihrer neuen Küche.");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const report = useMutation({
    mutationFn: () => reportOrderProblem(token, message.trim()),
    onSuccess: (view) => {
      setView(view);
      setProblemOpen(false);
      setMessage("");
      toast.success("Danke – Ihr Anliegen ist bei uns angekommen. Wir melden uns persönlich bei Ihnen.");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const cancelled = order.status === "cancelled";
  const confirmed = !!order.consumer_confirmed_at;

  return (
    <div className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ihr Auftrag</p>
          <h2 className="mt-1 text-xl font-bold">{studioName}</h2>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", cancelled ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {cancelled ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Das Studio hat gemeldet, dass der Auftrag nicht zustande kommt. Wir melden uns bei Ihnen – gern helfen wir bei der Suche nach einem
          anderen Studio.
        </p>
      ) : (
        <OrderTimeline order={order} className="mt-5" />
      )}

      {confirmed && (
        <p className="mt-5 flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-sm font-medium text-primary">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
          Sie haben die Montage am {formatOrderDate(order.consumer_confirmed_at, false)} bestätigt. Viel Freude mit Ihrer neuen Küche!
        </p>
      )}

      {!cancelled && !confirmed && (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          {order.can_confirm && (
            <Button onClick={() => setConfirmOpen(true)}>
              <PackageCheck className="mr-2 h-4 w-4" /> Küche ist fertig montiert
            </Button>
          )}
          <Button variant="ghost" onClick={() => setProblemOpen(true)}>
            <LifeBuoy className="mr-2 h-4 w-4" /> Problem melden
          </Button>
        </div>
      )}
      {order.problem_reported_at && !confirmed && (
        <p className="mt-3 text-xs text-muted-foreground">
          Ihr Anliegen vom {formatOrderDate(order.problem_reported_at, false)} ist bei uns eingegangen – wir melden uns persönlich.
        </p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ist Ihre Küche fertig montiert?</AlertDialogTitle>
            <AlertDialogDescription>
              Mit Ihrer Bestätigung schließen wir den Auftrag ab. Offene Restarbeiten klären Sie bitte weiterhin direkt mit {studioName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirm.isPending}>Noch nicht</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirm.isPending}
              onClick={(e) => {
                e.preventDefault();
                confirm.mutate();
              }}
            >
              {confirm.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ja, alles fertig
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={problemOpen} onOpenChange={setProblemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Problem melden</DialogTitle>
            <DialogDescription>
              Ihre Nachricht geht an das KüchenWert-Team, nicht an das Studio. Wir melden uns persönlich und vermitteln bei Bedarf.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
            rows={5}
            placeholder="z. B. Das Studio hat sich noch nicht gemeldet, der Termin wurde verschoben …"
            aria-label="Ihre Nachricht"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProblemOpen(false)} disabled={report.isPending}>
              Abbrechen
            </Button>
            <Button onClick={() => report.mutate()} disabled={report.isPending || message.trim().length < MIN_MESSAGE}>
              {report.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Nachricht senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
