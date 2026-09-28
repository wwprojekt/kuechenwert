import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "../api-client";
import { COMPLAINT_REASON_LABELS, fetchComplaintStatus, fileComplaint, type ComplaintReason } from "../dealer-api";

const complaintSchema = z
  .object({
    reason: z.enum(["nicht_erreichbar", "falsche_kontaktdaten", "kein_kuechenprojekt", "doppelt", "sonstiges"], {
      errorMap: () => ({ message: "Bitte einen Grund auswählen." }),
    }),
    note: z.string().trim().max(1000, "Höchstens 1.000 Zeichen."),
  })
  .refine((v) => v.reason !== "sonstiges" || v.note.length >= 10, {
    message: "Bitte beschreiben Sie den Grund in mindestens 10 Zeichen.",
    path: ["note"],
  });

const STATUS_TEXT = {
  offen: "Ihre Reklamation wird geprüft. Wir melden uns innerhalb von 5 Werktagen.",
  anerkannt: "Ihre Reklamation wurde anerkannt. Die Rechnung für diesen Kontakt wird storniert.",
  abgelehnt: "Ihre Reklamation wurde geprüft und nicht anerkannt.",
} as const;

const date = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Reklamation eines gekauften Kontakts (bis 14 Tage nach der Freischaltung). */
export function ContactComplaintCard({ auctionId }: { auctionId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ComplaintReason | "">("");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const status = useQuery({ queryKey: ["dealer-complaint", auctionId], queryFn: () => fetchComplaintStatus(auctionId) });

  const submit = useMutation({
    mutationFn: (input: { reason: ComplaintReason; note: string }) => fileComplaint(auctionId, input.reason, input.note || null),
    onSuccess: (data) => {
      qc.setQueryData(["dealer-complaint", auctionId], data);
      setOpen(false);
      toast.success("Reklamation eingegangen. Wir melden uns innerhalb von 5 Werktagen.");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const s = status.data;
  if (!s || (!s.complaint && !s.can_file)) return null;

  const onSubmit = () => {
    const parsed = complaintSchema.safeParse({ reason, note });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen.");
      return;
    }
    setFieldError(null);
    submit.mutate({ reason: parsed.data.reason as ComplaintReason, note: parsed.data.note ?? "" });
  };

  return (
    <div className="rounded-2xl border bg-card p-5 text-sm">
      {s.complaint ? (
        <>
          <p className="flex items-center gap-2 font-semibold">
            <Flag className="h-4 w-4 text-primary" aria-hidden="true" /> Reklamation vom {date(s.complaint.created_at)}
          </p>
          <p className="mt-1 text-muted-foreground">{COMPLAINT_REASON_LABELS[s.complaint.reason]}</p>
          <p className="mt-3">{STATUS_TEXT[s.complaint.status]}</p>
          {s.complaint.decision_note && <p className="mt-2 text-muted-foreground">{s.complaint.decision_note}</p>}
        </>
      ) : (
        <>
          <p className="font-semibold">Stimmt mit dem Kontakt etwas nicht?</p>
          <p className="mt-1 text-muted-foreground">Sie können den gekauften Kontakt bis zum {date(s.deadline)} reklamieren.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
            <Flag className="mr-2 h-4 w-4" aria-hidden="true" /> Kontakt reklamieren
          </Button>
        </>
      )}

      <Dialog open={open} onOpenChange={(v) => !submit.isPending && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kontakt reklamieren</DialogTitle>
            <DialogDescription>
              Wir prüfen jede Reklamation. Wird sie anerkannt, stornieren wir die Rechnung für diesen Kontakt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={reason} onValueChange={(v) => setReason(v as ComplaintReason)} aria-label="Grund der Reklamation">
              {(Object.keys(COMPLAINT_REASON_LABELS) as ComplaintReason[]).map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <RadioGroupItem value={key} id={`complaint-${key}`} />
                  <Label htmlFor={`complaint-${key}`} className="font-normal">
                    {COMPLAINT_REASON_LABELS[key]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div className="space-y-1.5">
              <Label htmlFor="complaint-note">Beschreibung {reason === "sonstiges" ? "(Pflicht)" : "(optional)"}</Label>
              <Textarea
                id="complaint-note"
                value={note}
                maxLength={1000}
                rows={4}
                onChange={(e) => setNote(e.target.value)}
                placeholder="z. B. wann und wie Sie den Kunden zu erreichen versucht haben"
              />
            </div>
            {fieldError && (
              <p className="text-sm text-destructive" role="alert">
                {fieldError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submit.isPending}>
              Abbrechen
            </Button>
            <Button onClick={onSubmit} disabled={submit.isPending}>
              {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reklamation senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
