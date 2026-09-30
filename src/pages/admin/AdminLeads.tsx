import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Eye } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { formLabel, leadSummaryFromRow, styleLabel } from "@/features/funnel-a/catalog";
import { fetchShareConsents, fetchTenderStatuses } from "@/features/marketplace/admin-api";
import { AdminLeadConsents } from "@/features/marketplace/components/AdminLeadConsents";
import { AdminLeadPlanning } from "@/features/marketplace/components/AdminLeadPlanning";
import { AdminTenderPanel, TenderStatusBadge } from "@/features/marketplace/components/AdminTenderPanel";
import { ProjectAnswers } from "@/features/marketplace/components/ProjectAnswers";
import { LEAD_STATUS_LABELS, leadStatusBadge } from "@/components/admin/leadLabels";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const FUNNEL_TYPE_LABELS: Record<string, string> = {
  a: "A · Angebote",
  b: "B · Unterbieten",
  traumkueche: "C · Traumküche",
};

// Spiegelt die Check-Constraint auf leads.bot_check (Turnstile beim Absenden).
const BOT_CHECK_LABELS: Record<string, string> = {
  passed: "Bestanden",
  unverified: "Nicht bestanden – vor der Veröffentlichung prüfen",
  skipped: "Nicht geprüft",
};

const CLICK_ID_SOURCES: [keyof Lead, string][] = [
  ["gclid", "Google Ads"],
  ["gbraid", "Google Ads"],
  ["wbraid", "Google Ads"],
  ["msclkid", "Microsoft Ads"],
  ["fbclid", "Meta"],
];

function adClickSources(lead: Lead): string {
  const sources = new Set(CLICK_ID_SOURCES.filter(([key]) => lead[key]).map(([, label]) => label));
  return sources.size ? [...sources].join(", ") : "-";
}

function formatEuro(cents: number | null): string {
  if (cents == null) return "-";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const HOUSING_LABELS: Record<string, string> = { own: "Eigentum", rent: "Miete" };

/** Funnel C hat kein Budget der Kund:in, sondern die KI-Preisschätzung (Spanne aus dem Abschluss). */
function valueText(lead: Lead): string {
  const estimate = (lead.funnel_answers as { estimate?: { min?: unknown; max?: unknown } } | null)?.estimate;
  if (lead.funnel_type === "traumkueche" && typeof estimate?.min === "number" && typeof estimate?.max === "number") {
    return `${formatEuro(estimate.min)} – ${formatEuro(estimate.max)}`;
  }
  return formatEuro(lead.budget_midpoint);
}

export default function AdminLeads() {
  const [searchParams] = useSearchParams();
  const [funnelFilter, setFunnelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [selected, setSelected] = useState<Lead | null>(null);

  const { data: leads, isLoading, error } = useQuery({
    queryKey: ["admin-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const leadIds = useMemo(() => (leads ?? []).map((l) => l.id), [leads]);
  const { data: tenderStatuses } = useQuery({
    queryKey: ["admin-lead-tenders", leadIds],
    queryFn: () => fetchTenderStatuses(leadIds),
    enabled: leadIds.length > 0,
  });
  const { data: shareConsents } = useQuery({
    queryKey: ["admin-lead-share-consents", leadIds],
    queryFn: () => fetchShareConsents(leadIds),
    enabled: leadIds.length > 0,
  });

  const filtered = useMemo(() => {
    if (!leads) return [];
    return leads.filter((l) => {
      if (funnelFilter !== "all" && l.funnel_type !== funnelFilter) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = [
          l.id,
          l.first_name,
          l.last_name,
          l.email,
          l.phone,
          l.postal_code,
          l.city,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [leads, funnelFilter, statusFilter, search]);

  const counts = useMemo(() => {
    if (!leads) return { total: 0, a: 0, b: 0, traumkueche: 0 };
    return {
      total: leads.length,
      a: leads.filter((l) => l.funnel_type === "a").length,
      b: leads.filter((l) => l.funnel_type === "b").length,
      traumkueche: leads.filter((l) => l.funnel_type === "traumkueche").length,
    };
  }, [leads]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle Anfragen aus Funnel A, B und dem Traumküche-Konfigurator – inklusive Ausschreibung und Freigabe.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Gesamt</div>
          <div className="mt-1 text-2xl font-bold">{counts.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{FUNNEL_TYPE_LABELS.a}</div>
          <div className="mt-1 text-2xl font-bold">{counts.a}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{FUNNEL_TYPE_LABELS.b}</div>
          <div className="mt-1 text-2xl font-bold">{counts.b}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{FUNNEL_TYPE_LABELS.traumkueche}</div>
          <div className="mt-1 text-2xl font-bold">{counts.traumkueche}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Suche: Name, E-Mail, PLZ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={funnelFilter} onValueChange={setFunnelFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Funnels</SelectItem>
              <SelectItem value="a">{FUNNEL_TYPE_LABELS.a}</SelectItem>
              <SelectItem value="b">{FUNNEL_TYPE_LABELS.b}</SelectItem>
              <SelectItem value="traumkueche">{FUNNEL_TYPE_LABELS.traumkueche}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {Object.entries(LEAD_STATUS_LABELS).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-destructive">
            Fehler beim Laden: {error instanceof Error ? error.message : "Unbekannt"}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Keine Leads gefunden.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Funnel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ausschreibung</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>PLZ</TableHead>
                <TableHead className="text-right">Budget / Schätzung</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => {
                const status = leadStatusBadge(lead.status);
                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(lead)}
                  >
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(lead.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">
                          {FUNNEL_TYPE_LABELS[lead.funnel_type] ?? lead.funnel_type}
                        </Badge>
                        {lead.bot_check === "unverified" && <Badge variant="destructive">Ungeprüft</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <TenderStatusBadge status={tenderStatuses?.[lead.id]} shareConsent={shareConsents?.[lead.id]} />
                    </TableCell>
                    <TableCell>
                      {lead.first_name || lead.last_name
                        ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {lead.email && <div>{lead.email}</div>}
                      {lead.phone && <div className="text-muted-foreground">{lead.phone}</div>}
                    </TableCell>
                    <TableCell>{lead.postal_code}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {valueText(lead)}
                    </TableCell>
                    <TableCell className="text-right">{lead.score}</TableCell>
                    <TableCell>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Lead - {selected.first_name} {selected.last_name}
                </DialogTitle>
                <DialogDescription>
                  {FUNNEL_TYPE_LABELS[selected.funnel_type]} - {formatDateTime(selected.created_at)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <AdminTenderPanel leadId={selected.id} funnelType={selected.funnel_type} kitchenForm={selected.kitchen_form} />
                <AdminLeadConsents leadId={selected.id} />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">E-Mail</div>
                    <div>{selected.email ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Telefon</div>
                    <div>{selected.phone ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">PLZ</div>
                    <div>{selected.postal_code}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">
                      {selected.funnel_type === "traumkueche" ? "KI-Preisschätzung" : "Budget"}
                    </div>
                    <div>{valueText(selected)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Küchenform</div>
                    <div>{formLabel(selected.kitchen_form) ?? selected.kitchen_form ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Küchenstil</div>
                    <div>{styleLabel(selected.kitchen_style) ?? selected.kitchen_style ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Anlass</div>
                    <div>{selected.purchase_reason ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Wohnsituation</div>
                    <div>{(selected.housing_type && HOUSING_LABELS[selected.housing_type]) ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Zeitrahmen</div>
                    <div>
                      {selected.timeframe_months != null
                        ? `${selected.timeframe_months} Monate`
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Tier / Score</div>
                    <div>{selected.tier} / {selected.score}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">UTM</div>
                    <div className="truncate text-xs">
                      {[selected.utm_source, selected.utm_medium, selected.utm_campaign]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Werbeklick</div>
                    <div>{adClickSources(selected)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Sicherheitsprüfung</div>
                    <div className={selected.bot_check === "unverified" ? "text-destructive" : undefined}>
                      {selected.bot_check ? (BOT_CHECK_LABELS[selected.bot_check] ?? selected.bot_check) : "-"}
                    </div>
                  </div>
                </div>
                {selected.funnel_type === "traumkueche" && <AdminLeadPlanning lead={selected} />}
                <ProjectAnswers summary={leadSummaryFromRow(selected)} title="Angaben aus der Anfrage" wide />
                <div>
                  <div className="mb-2 text-xs uppercase text-muted-foreground">
                    Funnel-Antworten (JSONB)
                  </div>
                  <pre className="max-h-64 overflow-y-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(selected.funnel_answers, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
