import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, PlusCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { errorMessage } from "../api-client";
import { AdminComplaintsSection } from "./AdminComplaintsSection";
import { AdminLeadFilesSection } from "./AdminLeadFilesSection";
import { AdminTenderActions } from "./AdminTenderActions";
import { AdminTenderBriefing } from "./AdminTenderBriefing";
import { TENDER_STATUS_LABELS, fetchAdminTender, openTenderAsAdmin, publishTenderAsAdmin } from "../admin-api";

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
 * hochgeladenen Unterlagen mit Freigabe für Studios.
 */
export function AdminTenderPanel({ leadId, funnelType, kitchenForm }: { leadId: string; funnelType: string; kitchenForm?: string | null }) {
  const qc = useQueryClient();
  const [notify, setNotify] = useState(false);
  const tender = useQuery({ queryKey: ["admin-lead-tender", leadId], queryFn: () => fetchAdminTender(leadId) });

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
                    ? "Nach dem Experten-Check veröffentlichen: Ergebnis unten im Briefing festhalten. Unterlagen sehen Studios nur, wenn Sie sie unten einzeln freigeben."
                    : "Nach Prüfung freigeben, damit Studios im Umkreis Angebote abgeben können."}
                </p>
                <Button size="sm" onClick={() => publish.mutate(t.id)} disabled={publish.isPending} className="flex-none">
                  {publish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
                  Veröffentlichen
                </Button>
              </div>
            )}
            <AdminTenderActions tender={t} onChanged={refresh} />
          </div>
        )}
      </section>

      <AdminTenderBriefing leadId={leadId} funnelType={funnelType} kitchenForm={kitchenForm} />

      {t && <AdminComplaintsSection auctionId={t.id} />}

      <AdminLeadFilesSection leadId={leadId} />
    </div>
  );
}
