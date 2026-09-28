import { ExternalLink, FileText, ImageIcon } from "lucide-react";
import { leadFileLabel } from "@/features/funnel-b/files";
import type { DealerProjectMedia } from "../dealer-api";

interface DealerProjectDocumentsProps {
  documents: DealerProjectMedia[];
  urls: Record<string, string>;
  loading: boolean;
  /** Kontakt gekauft oder Zuschlag: alle Unterlagen inkl. Dateinamen. */
  full: boolean;
}

/** Browser zeigen HEIC/HEIF meist nicht an; solche Bilder nur als Link anbieten. */
const previewable = (type: string | undefined) => !!type && type.startsWith("image/") && !/hei[cf]/.test(type);

/** Unterlagen der Kundin bzw. des Kunden in der Projektansicht des Studios. */
export function DealerProjectDocuments({ documents, urls, loading, full }: DealerProjectDocumentsProps) {
  if (documents.length === 0) return null;
  const numbers = new Map<string, number>();
  const labelled = documents.map((doc) => {
    const label = leadFileLabel(doc.category);
    const n = (numbers.get(label) ?? 0) + 1;
    numbers.set(label, n);
    return { doc, title: doc.name ?? `${label} ${n}` };
  });

  return (
    <div className="rounded-2xl border bg-card p-5">
      <h2 className="font-bold">Unterlagen</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {full
          ? "Alle Unterlagen der Kundin bzw. des Kunden, auch das Originalangebot."
          : "Vom KüchenWert-Team geprüft und ohne Namen und Kontaktdaten freigegeben. Weitere Unterlagen sehen Sie nach der Kontaktfreischaltung."}
      </p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {labelled.map(({ doc, title }) => {
          const url = urls[doc.path];
          const Icon = doc.type === "application/pdf" ? FileText : ImageIcon;
          return (
            <li key={doc.path} className="overflow-hidden rounded-xl border">
              {url && previewable(doc.type) && (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                </a>
              )}
              <div className="flex items-center justify-between gap-2 p-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{title}</span>
                </span>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex flex-none items-center gap-1 font-medium text-primary hover:underline">
                    Öffnen <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="flex-none text-xs text-muted-foreground">{loading ? "wird geladen …" : "nicht verfügbar"}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
