import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, FolderUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  MAX_LEAD_FILES,
  MAX_LEAD_FILES_PER_PROJECT,
  leadFileCategoriesFor,
  leadFileLabel,
  type LeadFileCategory,
  type PendingLeadFile,
} from "@/features/funnel-b/files";
import { LeadFileDrop } from "@/features/funnel-b/LeadFileDrop";
import { PendingFileList } from "@/features/funnel-b/PendingFileList";
import { cn } from "@/lib/utils";
import { errorMessage } from "../api-client";
import { uploadProjectFiles, type ProjectFile } from "../project-api";

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

interface ProjectFilesCardProps {
  token: string;
  /** Unterbieten (b) lädt Angebot und Planung hoch, Anfrage und Planer Grundriss und Raumfotos. */
  funnelType: string;
  files: ProjectFile[];
  canUpload: boolean;
  className?: string;
}

const INTRO: Record<"offer" | "room", string> = {
  offer:
    "Laden Sie die Planung aus dem Küchenstudio hoch – Grundriss, Ansichten, Geräteliste; Handyfotos genügen. Dann bieten die Studios genau Ihre Küche an.",
  room: "Ein Grundriss oder Fotos Ihres Raums helfen den Studios, genauer zu planen – und Ihnen, Rückfragen zu sparen.",
};

/** Unterlagen zum Projekt: Übersicht und Nachreichen über den Projektlink. */
export function ProjectFilesCard({ token, funnelType, files, canUpload, className }: ProjectFilesCardProps) {
  const categories = leadFileCategoriesFor(funnelType);
  const qc = useQueryClient();
  const [pending, setPending] = useState<PendingLeadFile[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const upload = useMutation({
    mutationFn: () => uploadProjectFiles(token, pending, (done, total) => setProgress({ done, total })),
    onSuccess: ({ attached, failed }) => {
      setPending([]);
      void qc.invalidateQueries({ queryKey: ["kw-project", token] });
      if (failed > 0) {
        toast.warning(`${attached} von ${attached + failed} Dateien hochgeladen. Bitte versuchen Sie die übrigen noch einmal.`);
      } else {
        toast.success(attached === 1 ? "Datei hochgeladen – danke!" : `${attached} Dateien hochgeladen – danke!`);
      }
    },
    onSettled: () => setProgress(null),
  });

  const remaining = Math.min(MAX_LEAD_FILES, MAX_LEAD_FILES_PER_PROJECT - files.length) - pending.length;
  const addFiles = (category: LeadFileCategory, list: File[]) =>
    setPending((prev) => [
      ...prev,
      ...list.map((file) => ({ id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, category, file })),
    ]);

  return (
    <div className={cn("rounded-2xl border bg-card p-5", className)}>
      <div className="flex gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-primary/10 text-primary">
          <FolderUp className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-bold leading-snug">Ihre Unterlagen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {files.length === 0
              ? INTRO[funnelType === "b" ? "offer" : "room"]
              : "Diese Unterlagen liegen uns vor. Küchenstudios zeigen wir sie erst, wenn darauf keine Namen und Kontaktdaten mehr zu sehen sind."}
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <ul className="mt-4 divide-y rounded-lg border text-sm">
          {files.map((f, i) => (
            <li key={`${f.created_at}-${i}`} className="flex items-center gap-3 px-3 py-2">
              <FileText className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
              <span className="flex-none rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{leadFileLabel(f.category)}</span>
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="flex-none text-xs text-muted-foreground">{dateFormat.format(new Date(f.created_at))}</span>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <div className="mt-4 space-y-3">
          {categories.map((option) => (
            <LeadFileDrop
              key={option.value}
              option={option}
              count={pending.filter((p) => p.category === option.value).length}
              remaining={remaining}
              onFiles={(list) => addFiles(option.value, list)}
              disabled={upload.isPending}
            />
          ))}
          <PendingFileList files={pending} onRemove={(id) => setPending((prev) => prev.filter((p) => p.id !== id))} disabled={upload.isPending} />
          {upload.isError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errorMessage(upload.error)}
            </p>
          )}
          {progress && (
            <p role="status" className="text-sm text-muted-foreground">
              Wird hochgeladen … {progress.done} von {progress.total} fertig
            </p>
          )}
          <Button onClick={() => upload.mutate()} disabled={pending.length === 0 || upload.isPending} className="w-full sm:w-auto">
            {upload.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {pending.length > 1 ? `${pending.length} Dateien hochladen` : "Hochladen"}
          </Button>
          <p className="text-xs text-muted-foreground">PDF, JPG, PNG oder HEIC, je bis 20 MB.</p>
        </div>
      )}
    </div>
  );
}
