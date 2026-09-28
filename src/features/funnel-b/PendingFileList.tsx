import { FileText, ImageIcon, X } from "lucide-react";
import { formatFileSize, leadFileLabel, leadFileType, type PendingLeadFile } from "./files";

interface PendingFileListProps {
  files: PendingLeadFile[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

/** Ausgewählte, noch nicht hochgeladene Dateien mit Kategorie und Größe. */
export function PendingFileList({ files, onRemove, disabled = false }: PendingFileListProps) {
  if (files.length === 0) return null;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
      {files.map((item) => {
        const isPdf = leadFileType(item.file) === "application/pdf";
        const Icon = isPdf ? FileText : ImageIcon;
        return (
          <li key={item.id} className="flex items-center gap-3 px-3 py-2">
            <Icon className="h-4 w-4 flex-none text-ink-muted" aria-hidden="true" />
            <span className="flex-none rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
              {leadFileLabel(item.category)}
            </span>
            <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
            <span className="flex-none text-xs text-ink-subtle">{formatFileSize(item.file.size)}</span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={disabled}
              className="flex-none rounded p-1 text-ink-muted hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              aria-label={`${item.file.name} entfernen`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
