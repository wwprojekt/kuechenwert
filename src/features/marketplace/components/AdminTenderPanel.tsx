import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Loader2, Megaphone, PlusCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { errorMessage } from "../api-client";
import {
  TENDER_STATUS_LABELS,
  fetchAdminTender,
  fetchLeadFiles,
  openTenderAsAdmin,
  publishTenderAsAdmin,
} from "../admin-api";

const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "–";
const euro = (n: number | null) =>
  n == null ? "–" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function TenderStatusBadge({ status }: { status: string | undefined }) {
  if (!status) return <span className="text-xs text-muted-foreground">keine</span>;
  const meta = TENDER_STATUS_LABELS[status] ?? { label: status, tone: "muted" as const };
  const cls =
    meta.tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : meta.tone === "active"
        ? "border-primary/30 bg-primary/10 text-primary"
        : meta.tone === "success"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "text-muted-foreground";
  return (
    <Badge variant="outline" className={`font-normal ${cls}`}>
      {meta.label}
    </Badge>
  );
}

/**
 * Ausschreibung eines Leads im Admin-Dialog: Status, Kennzahlen, Freigabe
 * (Funnel B startet nach dem Experten-Check als Entwurf) und die vom Kunden
 * hochgeladenen Dateien für die Prüfung.
 */
export function AdminTenderPanel({ leadId, funnelType }: { leadId: string; funnelType: string }) {
  const qc = useQueryClient();
  const [notify, setNotify] = useState(false);
  const tender = useQuery({ queryKey: ["admin-lead-tender", leadId], queryFn: () => fetchAdminTender(leadId) });
  const files = useQuery({ queryKey: ["admin-lead-files", leadId], queryFn: () => fetchLeadFiles(leadId), staleTime: 30 * 60_000 });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-lead-tender", leadId] });
    void qc.invalidateQueries({ queryKey: ["admin-lead-tenders"] });
    void qc.invalidateQueries({ queryKey: ["admin-leads"] });
  };

  const open = useMutation({
    mutationFn: () => openTenderAsAdmin(leadId, notify),
    onSuccess: () => {
      toast.success("Ausschreibung als Entwurf angelegt.");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const publish = useMutation({
    mutationFn: (auctionId: string) => publishTenderAsAdmin(auctionId),
    onSuccess: () => {
      toast.success("Ausschreibung veröffentlicht – passende Studios werden benachrichtigt.");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const t = tender.data;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Ausschreibung</h3>
          {t && <TenderStatusBadge status={t.status} />}
        </div>

        {tender.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : tender.isError ? (
          <p className="text-sm text-destructive">{errorMessage(tender.error)}</p>
        ) : !t ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Für diesen Lead gibt es noch keine Ausschreibung. Sie wird als Entwurf angelegt und erst nach Ihrer Freigabe für
              Studios sichtbar.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
              Kund:in per E-Mail den Projektlink schicken
            </label>
            <Button size="sm" onClick={() => open.mutate()} disabled={open.isPending}>
              {open.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Ausschreibung anlegen
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Laufzeit</dt>
                <dd>{t.duration_hours ? `${t.duration_hours} h` : "–"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Veröffentlicht</dt>
                <dd>{dateTime(t.published_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Angebotsende</dt>
                <dd>{dateTime(t.ends_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Angebote</dt>
                <dd>{t.offer_count}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Niedrigstes Angebot</dt>
                <dd>{euro(t.lowest_offer_eur)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Kontakte verkauft</dt>
                <dd>
                  {t.contact_purchases} / {t.max_contact_purchases ?? 3}
                  {t.contact_price_cents != null && (
                    <span className="text-muted-foreground"> · {euro(t.contact_price_cents / 100)} netto</span>
                  )}
                </dd>
              </div>
            </dl>
            {t.status === "draft" && (
              <div className="flex flex-col gap-2 rounded-md bg-amber-50 p-3 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs">
                  {funnelType === "b"
                    ? "Nach dem Experten-Check freigeben – das Studio-Angebot sollte keine Namen oder Kontaktdaten des Studios enthalten."
                    : "Nach Prüfung freigeben, damit Studios im Umkreis Angebote abgeben können."}
                </p>
                <Button size="sm" onClick={() => publish.mutate(t.id)} disabled={publish.isPending} className="flex-none">
                  {publish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
                  Veröffentlichen
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">Hochgeladene Dateien</h3>
        {files.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (files.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Dateien.</p>
        ) : (
          <ul className="space-y-2">
            {(files.data ?? []).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{f.file_name}</span>
                  {f.category && <Badge variant="secondary">{f.category}</Badge>}
                </span>
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex flex-none items-center gap-1 text-primary hover:underline">
                    Öffnen <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">nicht verfügbar</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
