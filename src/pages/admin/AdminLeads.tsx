import { useState, useMemo } from "react";
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

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const FUNNEL_TYPE_LABELS: Record<string, string> = {
  a: "Lead-Gen",
  b: "Offer-Compare",
  traumkueche: "Traumkueche",
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Neu", variant: "default" },
  qualified: { label: "Qualifiziert", variant: "secondary" },
  auctioning: { label: "Auktion laeuft", variant: "secondary" },
  sold: { label: "Verkauft", variant: "secondary" },
  rejected: { label: "Abgelehnt", variant: "destructive" },
  archived: { label: "Archiviert", variant: "outline" },
};

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

export default function AdminLeads() {
  const [funnelFilter, setFunnelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
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

  const filtered = useMemo(() => {
    if (!leads) return [];
    return leads.filter((l) => {
      if (funnelFilter !== "all" && l.funnel_type !== funnelFilter) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = [
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
          Alle eingehenden Lead-Anfragen aus Funnels A / B / Traumkueche.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Gesamt</div>
          <div className="mt-1 text-2xl font-bold">{counts.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Funnel A (Lead-Gen)</div>
          <div className="mt-1 text-2xl font-bold">{counts.a}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Funnel B (Compare)</div>
          <div className="mt-1 text-2xl font-bold">{counts.b}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Traumkueche</div>
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
              <SelectItem value="a">Funnel A (Lead-Gen)</SelectItem>
              <SelectItem value="b">Funnel B (Compare)</SelectItem>
              <SelectItem value="traumkueche">Traumkueche</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
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
                <TableHead>Name</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>PLZ</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => {
                const status = STATUS_LABELS[lead.status] ?? { label: lead.status, variant: "outline" as const };
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
                      <Badge variant="outline">
                        {FUNNEL_TYPE_LABELS[lead.funnel_type] ?? lead.funnel_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
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
                    <TableCell className="text-right">
                      {formatEuro(lead.budget_midpoint)}
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
                    <div className="text-xs uppercase text-muted-foreground">Budget</div>
                    <div>{formatEuro(selected.budget_midpoint)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Kuechenform</div>
                    <div>{selected.kitchen_form ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Kuechenstil</div>
                    <div>{selected.kitchen_style ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Anlass</div>
                    <div>{selected.purchase_reason ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Wohnsituation</div>
                    <div>{selected.housing_type ?? "-"}</div>
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
                    <div className="text-xs uppercase text-muted-foreground">Consent Call / Marketing</div>
                    <div>
                      {selected.consent_call ? "Ja" : "Nein"} / {selected.consent_marketing ? "Ja" : "Nein"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">UTM</div>
                    <div className="truncate text-xs">
                      {[selected.utm_source, selected.utm_medium, selected.utm_campaign]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </div>
                  </div>
                </div>
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
