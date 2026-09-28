import { AlertCircle, CheckCircle2, FileUp } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { leadFileProblem, type LeadFileCategoryOption } from "./files";

interface LeadFileDropProps {
  option: LeadFileCategoryOption;
  /** Bereits ausgewählte Dateien dieser Kategorie. */
  count: number;
  /** Noch freie Plätze insgesamt. */
  remaining: number;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

/** Upload-Fläche für eine Kategorie: mehrere Dateien per Auswahl oder Drag & Drop. */
export function LeadFileDrop({ option, count, remaining, onFiles, disabled = false }: LeadFileDropProps) {
  const [dragOver, setDragOver] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const descriptionId = useId();
  const full = remaining <= 0;

  function accept(list: FileList | null) {
    if (!list || list.length === 0) return;
    const found: string[] = [];
    const valid: File[] = [];
    for (const file of Array.from(list)) {
      const problem = leadFileProblem(file, option.value);
      if (problem) found.push(problem);
      else valid.push(file);
    }
    if (valid.length > remaining) {
      found.push(`Es passen noch ${remaining} ${remaining === 1 ? "Datei" : "Dateien"} dazu; die übrigen wurden nicht übernommen.`);
      valid.splice(remaining);
    }
    setProblems(found);
    if (valid.length) onFiles(valid);
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !full) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && !full) accept(e.dataTransfer.files);
        }}
        className={cn(
          "flex items-center gap-3 rounded-lg border-2 border-dashed p-4 transition",
          disabled || full ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          count > 0
            ? "border-brand-400 bg-brand-50"
            : dragOver
              ? "border-brand-500 bg-brand-50"
              : "border-slate-300 bg-surface-soft hover:border-brand-300 hover:bg-white",
        )}
      >
        {count > 0 ? (
          <CheckCircle2 className="h-5 w-5 flex-none text-brand-700" aria-hidden="true" />
        ) : (
          <FileUp className="h-5 w-5 flex-none text-brand-700" aria-hidden="true" />
        )}
        <div className="flex-1">
          <div className="text-sm font-medium text-ink">
            {option.label}
            {count > 0 && <span className="ml-2 text-xs font-normal text-brand-700">{count} ausgewählt</span>}
          </div>
          <div id={descriptionId} className="text-xs text-ink-muted">
            {option.description}
          </div>
        </div>
        <span className="btn-ghost text-xs">{dragOver ? "Loslassen" : count > 0 ? "Weitere wählen" : "Dateien wählen"}</span>
        <input
          type="file"
          multiple
          className="sr-only"
          accept={option.accept}
          disabled={disabled || full}
          aria-describedby={descriptionId}
          onChange={(e) => {
            accept(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </label>
      {problems.length > 0 && (
        <ul className="mt-1.5 space-y-1" role="alert">
          {problems.map((p) => (
            <li key={p} className="flex items-start gap-1.5 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
