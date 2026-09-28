import { useMutation } from "@tanstack/react-query";
import { Ban, Clock, Loader2, StopCircle } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "../api-client";
import { runTenderAction, type AdminTender, type TenderAction } from "../admin-api";

const EXTEND_OPTIONS = [24, 48, 72, 168];

type Pending = { action: Exclude<TenderAction, "extend"> } | null;

/** Verlängern, vorzeitig beenden oder abbrechen – jeweils mit Audit-Log in der Datenbank. */
export function AdminTenderActions({ tender, onChanged }: { tender: AdminTender; onChanged: () => void }) {
  const [hours, setHours] = useState("48");
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");

  const run = useMutation({
    mutationFn: (input: { action: TenderAction; hours?: number; reason?: string }) =>
      runTenderAction(tender.id, input.action, { hours: input.hours, reason: input.reason }),
    onSuccess: (_data, input) => {
      toast.success(
        input.action === "extend"
          ? `Angebotsphase um ${input.hours} Stunden verlängert.`
          : input.action === "end_now"
            ? "Angebotsphase beendet – der Kunde kann jetzt entscheiden."
            : "Ausschreibung abgebrochen. Studios mit Angebot werden benachrichtigt.",
      );
      setPending(null);
      setReason("");
      onChanged();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const canCancel = ["draft", "active", "completed"].includes(tender.status);
  if (tender.status !== "active" && !canCancel) return null;

  return (
    <div className="flex flex-wrap items-end gap-2 border-t pt-3">
      {tender.status === "active" && (
        <>
          <div className="space-y-1">
            <Label htmlFor={`extend-${tender.id}`} className="text-xs text-muted-foreground">
              Verlängern um
            </Label>
            <div className="flex gap-2">
              <Select value={hours} onValueChange={setHours}>
                <SelectTrigger id={`extend-${tender.id}`} className="h-9 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXTEND_OPTIONS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h === 168 ? "7 Tage" : `${h} Std.`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate({ action: "extend", hours: Number(hours) })}>
                <Clock className="mr-1.5 h-4 w-4" aria-hidden="true" /> Verlängern
              </Button>
            </div>
          </div>
          <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => setPending({ action: "end_now" })}>
            <StopCircle className="mr-1.5 h-4 w-4" aria-hidden="true" /> Jetzt beenden
          </Button>
        </>
      )}
      {canCancel && (
        <Button size="sm" variant="outline" className="text-destructive" disabled={run.isPending} onClick={() => setPending({ action: "cancel" })}>
          <Ban className="mr-1.5 h-4 w-4" aria-hidden="true" /> Abbrechen
        </Button>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(v) => !v && !run.isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.action === "cancel" ? "Ausschreibung abbrechen?" : "Angebotsphase jetzt beenden?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.action === "cancel"
                ? "Offene Angebote werden abgelehnt, Studios mit Angebot erhalten eine Benachrichtigung. Das lässt sich nicht rückgängig machen."
                : "Es können keine weiteren Angebote abgegeben werden; der Kunde erhält die Übersicht zur Entscheidung."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending?.action === "cancel" && (
            <div className="space-y-1.5">
              <Label htmlFor={`cancel-reason-${tender.id}`}>Grund (intern, mindestens 5 Zeichen)</Label>
              <Textarea id={`cancel-reason-${tender.id}`} value={reason} maxLength={500} rows={3} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={run.isPending}>Zurück</AlertDialogCancel>
            <AlertDialogAction
              disabled={run.isPending || (pending?.action === "cancel" && reason.trim().length < 5)}
              onClick={(e) => {
                e.preventDefault();
                if (pending) run.mutate({ action: pending.action, reason: pending.action === "cancel" ? reason.trim() : undefined });
              }}
            >
              {run.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending?.action === "cancel" ? "Abbrechen" : "Beenden"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
