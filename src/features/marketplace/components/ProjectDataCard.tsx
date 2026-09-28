import { useMutation } from "@tanstack/react-query";
import { Download, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "../api-client";
import { deleteProjectData, exportProjectData } from "../project-api";
import { clearStoredProjectToken } from "../project-token";

function downloadJson(data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kuechenwert-meine-daten-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Auskunft (Art. 15/20 DSGVO) und Löschung (Art. 17 DSGVO) direkt auf der Projektseite. */
export function ProjectDataCard({ token }: { token: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  const exportData = useMutation({
    mutationFn: () => exportProjectData(token),
    onSuccess: (data) => downloadJson(data),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const erase = useMutation({
    mutationFn: () => deleteProjectData(token, email),
    onSuccess: () => {
      clearStoredProjectToken();
      setOpen(false);
      toast.success("Ihre Daten wurden gelöscht. Die Studios wurden informiert, dass das Projekt beendet ist.");
      navigate("/", { replace: true });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="rounded-2xl border bg-card p-5 text-sm">
      <p className="font-semibold text-foreground">Meine Daten</p>
      <p className="mt-1 text-muted-foreground">
        Laden Sie alle zu diesem Projekt gespeicherten Daten herunter oder lassen Sie sie löschen. Rechnungen an Studios bewahren wir
        gesetzlich auf; sie enthalten keine Kontaktdaten von Ihnen.
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => exportData.mutate()}
          disabled={exportData.isPending}
          className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60"
        >
          {exportData.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
          Daten herunterladen
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Daten löschen
        </button>
      </div>

      <AlertDialog open={open} onOpenChange={(next) => !erase.isPending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Projekt und Daten löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Ihr Projekt wird beendet, laufende Angebote werden abgesagt. Name, Kontaktdaten, Fotos und Dateien löschen wir endgültig. Das
              lässt sich nicht rückgängig machen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="erase-email">Zur Bestätigung: Ihre E-Mail-Adresse aus der Anfrage</Label>
            <Input id="erase-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={erase.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={erase.isPending || !email.includes("@")}
              onClick={(e) => {
                e.preventDefault();
                erase.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {erase.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
