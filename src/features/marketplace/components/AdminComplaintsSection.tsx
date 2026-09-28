import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "../api-client";
import { cancelComplaintInvoice, decideComplaint, fetchTenderComplaints, type AdminComplaint } from "../admin-api";
import { COMPLAINT_REASON_LABELS } from "../dealer-api";

const STATUS_BADGE: Record<AdminComplaint["status"], { label: string; variant: "outline" | "secondary" | "destructive" }> = {
  offen: { label: "Offen", variant: "outline" },
  anerkannt: { label: "Anerkannt", variant: "secondary" },
  abgelehnt: { label: "Abgelehnt", variant: "destructive" },
};

const dateTime = (iso: string) => new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });

/** Reklamationen gekaufter Kontakte einer Ausschreibung; Anerkennung storniert die Rechnung. */
export function AdminComplaintsSection({ auctionId }: { auctionId: string }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<{ complaint: AdminComplaint; accept: boolean } | null>(null);
  const [note, setNote] = useState("");

  const complaints = useQuery({ queryKey: ["admin-tender-complaints", auctionId], queryFn: () => fetchTenderComplaints(auctionId) });

  const decide = useMutation({
    mutationFn: async (input: { complaint: AdminComplaint; accept: boolean; note: string }) => {
      const decision = await decideComplaint(input.complaint.id, input.accept, input.note || null);
      if (input.accept && decision.invoice_cancellable && decision.invoice_id) {
        await cancelComplaintInvoice(decision.invoice_id);
      }
      return decision;
    },
    onSuccess: (decision, input) => {
      if (!input.accept) toast.success("Reklamation abgelehnt. Das Studio wird informiert.");
      else if (decision.invoice_paid) toast.warning("Reklamation anerkannt. Die Rechnung ist bereits bezahlt – bitte Erstattung veranlassen.");
      else toast.success("Reklamation anerkannt und Rechnung storniert.");
      setTarget(null);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["admin-tender-complaints", auctionId] });
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      void qc.invalidateQueries({ queryKey: ["admin-tender-complaints", auctionId] });
    },
  });

  const rows = complaints.data ?? [];
  if (complaints.isLoading || rows.length === 0) return null;

  return (
    <section className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-semibold">Reklamationen</h3>
      <ul className="space-y-3">
        {rows.map((c) => (
          <li key={c.id} className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{c.dealer_name}</span>
              <Badge variant={STATUS_BADGE[c.status].variant}>{STATUS_BADGE[c.status].label}</Badge>
            </div>
            <p className="mt-1">{COMPLAINT_REASON_LABELS[c.reason]}</p>
            {c.note && <p className="mt-1 text-muted-foreground">„{c.note}“</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              Eingegangen {dateTime(c.created_at)}
              {c.invoice_number && ` · Rechnung ${c.invoice_number} (${c.invoice_payment_status === "paid" ? "bezahlt" : c.invoice_status ?? "–"})`}
            </p>
            {c.decision_note && <p className="mt-1 text-xs">Entscheidung: {c.decision_note}</p>}
            {c.status === "offen" && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => setTarget({ complaint: c, accept: true })}>
                  <Check className="mr-1.5 h-4 w-4" aria-hidden="true" /> Anerkennen
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTarget({ complaint: c, accept: false })}>
                  <X className="mr-1.5 h-4 w-4" aria-hidden="true" /> Ablehnen
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={target !== null} onOpenChange={(v) => !v && !decide.isPending && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target?.accept ? "Reklamation anerkennen" : "Reklamation ablehnen"}</DialogTitle>
            <DialogDescription>
              {target?.accept
                ? "Die Rechnung für diesen Kontakt wird storniert; war sie schon versendet, erhält das Studio eine Storno-Mitteilung."
                : "Das Studio erhält Ihre Begründung per E-Mail."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="complaint-decision-note">{target?.accept ? "Hinweis an das Studio (optional)" : "Begründung (mindestens 10 Zeichen)"}</Label>
            <Textarea id="complaint-decision-note" value={note} maxLength={1000} rows={4} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={decide.isPending}>
              Zurück
            </Button>
            <Button
              disabled={decide.isPending || (!target?.accept && note.trim().length < 10)}
              onClick={() => target && decide.mutate({ complaint: target.complaint, accept: target.accept, note: note.trim() })}
            >
              {decide.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {target?.accept ? "Anerkennen" : "Ablehnen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
