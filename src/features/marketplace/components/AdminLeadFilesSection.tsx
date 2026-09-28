import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, EyeOff, FileText, Loader2, ShieldCheck, Upload } from "lucide-react";
import { useRef, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { leadFileLabel } from "@/features/funnel-b/files";
import { errorMessage } from "../api-client";
import { fetchLeadFiles, setLeadFileShared, uploadRedactedLeadFile, type AdminLeadFile } from "../admin-api";

/**
 * Unterlagen eines Leads im Admin: öffnen, für Studios freigeben (nur ohne
 * Namen und Kontaktdaten, so die Einwilligung) und geschwärzte Fassungen
 * ergänzen. Studios mit gekauftem Kontakt sehen ohnehin alle Dateien.
 */
export function AdminLeadFilesSection({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const queryKey = ["admin-lead-files", leadId];
  const files = useQuery({ queryKey, queryFn: () => fetchLeadFiles(leadId), staleTime: 30 * 60_000 });
  const [confirm, setConfirm] = useState<AdminLeadFile | null>(null);
  const [redactFor, setRedactFor] = useState<AdminLeadFile | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const share = useMutation({
    mutationFn: ({ file, shared }: { file: AdminLeadFile; shared: boolean }) => setLeadFileShared(file.id, shared),
    onSuccess: (_data, { shared }) => {
      toast.success(shared ? "Für Studios freigegeben." : "Freigabe zurückgenommen.");
      setConfirm(null);
      void qc.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const redact = useMutation({
    mutationFn: ({ category, file }: { category: string; file: File }) => uploadRedactedLeadFile(leadId, category, file),
    onSuccess: () => {
      toast.success("Geschwärzte Fassung hochgeladen. Bitte prüfen und dann freigeben.");
      void qc.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => setRedactFor(null),
  });

  const list = files.data ?? [];

  return (
    <section className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Unterlagen der Kund:in</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Studios sehen nur freigegebene Dateien, vor dem Kontaktkauf ohne Dateinamen. Freigeben nur, wenn keine Namen, Adressen,
        Telefonnummern oder E-Mail-Adressen zu sehen sind – sonst eine geschwärzte Fassung hochladen und diese freigeben.
      </p>

      {files.isLoading ? (
        <Loader2 className="mt-3 h-5 w-5 animate-spin text-muted-foreground" />
      ) : files.isError ? (
        <p className="mt-3 text-sm text-destructive">{errorMessage(files.error)}</p>
      ) : list.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Keine Dateien.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 rounded-md border p-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{f.file_name}</span>
                <Badge variant="secondary">{leadFileLabel(f.category)}</Badge>
                {f.shared_with_studios && (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
                    freigegeben
                  </Badge>
                )}
              </span>
              <span className="flex flex-none flex-wrap items-center gap-2">
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    Öffnen <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">nicht verfügbar</span>
                )}
                {f.shared_with_studios ? (
                  <Button size="sm" variant="outline" onClick={() => share.mutate({ file: f, shared: false })} disabled={share.isPending}>
                    <EyeOff className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Freigabe zurücknehmen
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setConfirm(f)} disabled={share.isPending}>
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Für Studios freigeben
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={redact.isPending}
                  onClick={() => {
                    setRedactFor(f);
                    fileInput.current?.click();
                  }}
                >
                  {redact.isPending && redactFor?.id === f.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Geschwärzte Fassung
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (file && redactFor) redact.mutate({ category: redactFor.category ?? "angebot", file });
          else setRedactFor(null);
        }}
      />

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Datei für Studios freigeben?</AlertDialogTitle>
            <AlertDialogDescription>
              Studios im Einzugsgebiet sehen „{confirm?.file_name}“ danach ohne Dateinamen. Bitte vorher prüfen: Sind auf allen Seiten keine
              Namen, Adressen, Telefonnummern oder E-Mail-Adressen der Kund:in zu sehen? Die Einwilligung erlaubt die Weitergabe nur ohne
              Namen und Kontaktdaten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && share.mutate({ file: confirm, shared: true })}>Geprüft – freigeben</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
