import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Send,
  Shield,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession, invokeWithAuth } from "@/lib/sessionGuard";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

// =====================================================================
// Admin: Google-Review-Outreach
// ---------------------------------------------------------------------
// Single-page control center for the broad "please review us on Google"
// outreach. Surfaces the queue stats, the most recent send batch, the
// suppression list, and lets the admin manually trigger a batch or
// suppress an address by hand.
// =====================================================================

type DeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "bounced"
  | "failed"
  | "suppressed"
  | "unsubscribed";

type StatusFilter = DeliveryStatus | "all";

interface ReviewRow {
  id: string;
  email: string;
  recipient_name: string | null;
  source: string;
  delivery_status: string;
  delivery_error: string | null;
  enqueued_at: string;
  scheduled_for: string;
  sent_at: string | null;
  unsubscribed_at: string | null;
  click_count: number;
  resend_message_id: string | null;
}

interface SuppressionRow {
  id: string;
  email: string;
  reason: string;
  source: string | null;
  notes: string | null;
  created_at: string;
}

interface StatsRow {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  suppressed: number;
  unsubscribed: number;
  click_total: number;
  click_unique: number;
  oldest_queued_at: string | null;
  last_sent_at: string | null;
}

const STATUS_META: Record<
  DeliveryStatus,
  { label: string; color: string; icon: typeof Clock }
> = {
  queued: { label: "In Warteschlange", color: "bg-slate-100 text-slate-800", icon: Clock },
  sent: { label: "Versendet", color: "bg-sky-100 text-sky-900", icon: Send },
  delivered: { label: "Zugestellt", color: "bg-emerald-100 text-emerald-900", icon: CheckCircle2 },
  bounced: { label: "Bounce", color: "bg-amber-100 text-amber-900", icon: XCircle },
  failed: { label: "Fehlgeschlagen", color: "bg-red-100 text-red-900", icon: XCircle },
  suppressed: { label: "Unterdrückt", color: "bg-fuchsia-100 text-fuchsia-900", icon: Shield },
  unsubscribed: { label: "Abgemeldet", color: "bg-zinc-200 text-zinc-800", icon: Ban },
};

const REVIEW_QUERY_KEY = ["admin-google-reviews-queue"] as const;
const STATS_QUERY_KEY = ["admin-google-reviews-stats"] as const;
const SUPPRESSIONS_QUERY_KEY = ["admin-email-suppressions"] as const;

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd.MM.yyyy HH:mm", { locale: de });
}

function StatusBadge({ status }: { status: string }) {
  const meta =
    STATUS_META[status as DeliveryStatus] ?? {
      label: status,
      color: "bg-muted",
      icon: Clock,
    };
  const Icon = meta.icon;
  return (
    <Badge className={`${meta.color} text-xs gap-1 inline-flex`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

export default function AdminGoogleReviews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [confirmTrigger, setConfirmTrigger] = useState<null | "real" | "dry">(
    null,
  );
  const [suppressEmail, setSuppressEmail] = useState("");
  const [suppressNotes, setSuppressNotes] = useState("");
  const [testEmail, setTestEmail] = useState("");

  // ── Stats ────────────────────────────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: STATS_QUERY_KEY,
    queryFn: async (): Promise<StatsRow | null> => {
      const ok = await ensureValidRLSSession();
      if (!ok) return null;
      const { data, error } = await supabase.rpc("get_google_review_stats");
      if (error) throw error;
      return (data as StatsRow) ?? null;
    },
    staleTime: 15_000,
  });

  // ── Queue list ───────────────────────────────────────────────────
  const {
    data: rows = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [...REVIEW_QUERY_KEY, statusFilter],
    queryFn: async (): Promise<ReviewRow[]> => {
      const ok = await ensureValidRLSSession();
      if (!ok) return [];
      let q = supabase
        .from("google_review_requests")
        .select(
          "id, email, recipient_name, source, delivery_status, delivery_error, enqueued_at, scheduled_for, sent_at, unsubscribed_at, click_count, resend_message_id",
        )
        .order("enqueued_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") {
        q = q.eq("delivery_status", statusFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ReviewRow[];
    },
    staleTime: 15_000,
  });

  // ── Suppressions list (shown below) ──────────────────────────────
  const { data: suppressions = [] } = useQuery({
    queryKey: SUPPRESSIONS_QUERY_KEY,
    queryFn: async (): Promise<SuppressionRow[]> => {
      const ok = await ensureValidRLSSession();
      if (!ok) return [];
      const { data, error } = await supabase
        .from("email_suppressions")
        .select("id, email, reason, source, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as SuppressionRow[];
    },
    staleTime: 30_000,
  });

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      [r.email, r.recipient_name, r.source]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  // ── Trigger send ─────────────────────────────────────────────────
  const triggerMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await invokeWithAuth(
        "send-google-review-request",
        {
          body: {
            batch_size: 50,
            top_up: true,
            min_age_days: 14,
            dry_run: dryRun,
          },
        },
      );
      if (error) throw error;
      return data as {
        enqueued?: number;
        sent?: number;
        failed?: number;
        batch?: number;
        would_send?: number;
        dry_run?: boolean;
      };
    },
    onSuccess: (data, dryRun) => {
      if (dryRun) {
        toast({
          title: "Test-Lauf erfolgreich",
          description: `Würde ${data.would_send ?? 0} Mails versenden (${
            data.enqueued ?? 0
          } neu in die Warteschlange).`,
        });
      } else {
        toast({
          title: "Batch verarbeitet",
          description: `Versendet: ${data.sent ?? 0} · Fehler: ${
            data.failed ?? 0
          } · Batch: ${data.batch ?? 0} · Neu eingereiht: ${data.enqueued ?? 0}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: REVIEW_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY });
      setConfirmTrigger(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Senden fehlgeschlagen",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // ── Test send to single address ──────────────────────────────────
  const testSendMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await invokeWithAuth(
        "send-google-review-request",
        {
          body: {
            top_up: false,
            dry_run: false,
            only_email: email.trim().toLowerCase(),
          },
        },
      );
      if (error) throw error;
      return data as {
        only_email?: string;
        sent?: number;
        failed?: number;
        error?: string;
      };
    },
    onSuccess: (data) => {
      const ok = (data?.sent ?? 0) > 0;
      toast({
        title: ok ? "Test-Mail versendet" : "Test-Mail fehlgeschlagen",
        description: ok
          ? `Eine Mail an ${data.only_email} wurde via Resend abgeschickt. Bitte Posteingang + Spam prüfen.`
          : data?.error ?? "Unbekannter Fehler beim Test-Versand.",
        variant: ok ? "default" : "destructive",
      });
      if (ok) setTestEmail("");
      queryClient.invalidateQueries({ queryKey: REVIEW_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Test-Versand fehlgeschlagen",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // ── Manual suppress ──────────────────────────────────────────────
  const suppressMutation = useMutation({
    mutationFn: async (input: { email: string; notes?: string }) => {
      const ok = await ensureValidRLSSession();
      if (!ok) throw new Error("Sitzung ungültig — bitte erneut anmelden.");
      const { error } = await supabase.rpc("admin_add_email_suppression", {
        p_email: input.email.trim(),
        p_reason: "manual",
        p_notes: input.notes?.trim() ? input.notes.trim() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Adresse unterdrückt",
        description: "Die Adresse erhält keine weitere Outreach-Mail.",
      });
      setSuppressEmail("");
      setSuppressNotes("");
      queryClient.invalidateQueries({ queryKey: SUPPRESSIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: REVIEW_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Unterdrücken fehlgeschlagen",
        description: msg,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-sky-600" />
            Google-Review-Outreach
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tägliche Outreach-Mails an alle bekannten Kontaktpunkte (Profile,
            Wizard-Sessions, Wertrechner-Leads, Kontaktformular,
            Kaufanfragen, Fahrzeugfragen). Pro Adresse maximal{" "}
            <strong>einmal</strong>, nur für Datensätze ≥&nbsp;14 Tage alt.
            Automatisch gestoppt bei Bounce, Spam-Beschwerde oder Abmeldung.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Gesamt in Queue" value={stats?.total ?? 0} />
            <StatTile label="Wartet" value={stats?.queued ?? 0} accent="amber" />
            <StatTile label="Versendet" value={stats?.sent ?? 0} accent="sky" />
            <StatTile
              label="Zugestellt"
              value={stats?.delivered ?? 0}
              accent="emerald"
            />
            <StatTile label="Bounce" value={stats?.bounced ?? 0} accent="amber" />
            <StatTile label="Fehler" value={stats?.failed ?? 0} accent="red" />
            <StatTile
              label="Unterdrückt"
              value={stats?.suppressed ?? 0}
              accent="fuchsia"
            />
            <StatTile
              label="Abgemeldet"
              value={stats?.unsubscribed ?? 0}
              accent="zinc"
            />
            <StatTile
              label="Klicks (gesamt)"
              value={stats?.click_total ?? 0}
              accent="sky"
            />
            <StatTile
              label="Klicks (unique)"
              value={stats?.click_unique ?? 0}
              accent="sky"
            />
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div>Letzter Versand: {formatDateTime(stats?.last_sent_at)}</div>
            <div>
              Ältester Queue-Eintrag: {formatDateTime(stats?.oldest_queued_at)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manuell auslösen</CardTitle>
          <p className="text-xs text-muted-foreground">
            Der tägliche Cron läuft automatisch um <strong>11:00 UTC</strong>{" "}
            (Batch 50). Vor dem ersten Massen-Versand bitte unbedingt eine
            Test-Mail an die eigene Adresse schicken.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Single-target test send (always available, safest) */}
          <div className="rounded-md border border-dashed bg-muted/30 p-3">
            <Label
              htmlFor="test-email"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              1. Test-Mail an eine bestimmte Adresse
            </Label>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <Input
                id="test-email"
                type="email"
                placeholder="ihre-test@kuechenwert.de"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => testSendMutation.mutate(testEmail)}
                disabled={
                  !testEmail.trim() ||
                  !/^\S+@\S+\.\S+$/.test(testEmail.trim()) ||
                  testSendMutation.isPending
                }
              >
                {testSendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-1.5" />
                )}
                Test-Mail senden
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Sendet die echte Vorlage an genau eine Adresse. Ignoriert den
              14-Tage-Filter, respektiert aber die Suppression-Liste.
            </p>
          </div>

          {/* Mass trigger */}
          <div>
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              2. Batch-Versand
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmTrigger("dry")}
                disabled={triggerMutation.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Test-Lauf (kein Versand)
              </Button>
              <Button
                size="sm"
                onClick={() => setConfirmTrigger("real")}
                disabled={triggerMutation.isPending}
              >
                <Send className="h-4 w-4 mr-1.5" />
                50 Mails jetzt versenden
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versand-Historie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="queued">Wartet</SelectItem>
                <SelectItem value="sent">Versendet</SelectItem>
                <SelectItem value="delivered">Zugestellt</SelectItem>
                <SelectItem value="bounced">Bounce</SelectItem>
                <SelectItem value="failed">Fehler</SelectItem>
                <SelectItem value="suppressed">Unterdrückt</SelectItem>
                <SelectItem value="unsubscribed">Abgemeldet</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="E-Mail, Name oder Quelle…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-Mail</TableHead>
                  <TableHead className="w-[140px]">Name</TableHead>
                  <TableHead className="w-[120px]">Quelle</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[140px]">Eingereiht</TableHead>
                  <TableHead className="w-[140px]">Versendet</TableHead>
                  <TableHead className="w-[80px]">Klicks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin inline-block" />
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Keine Einträge.
                    </TableCell>
                  </TableRow>
                )}
                {filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">
                      <div className="font-medium truncate max-w-[260px]" title={row.email}>
                        {row.email}
                      </div>
                      {row.delivery_error && (
                        <div className="text-[11px] text-red-600 truncate max-w-[260px]" title={row.delivery_error}>
                          {row.delivery_error}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.recipient_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]">
                        {row.source}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.delivery_status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(row.enqueued_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(row.sent_at)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-center">
                      {row.click_count > 0 ? (
                        <span className="font-semibold text-emerald-700">
                          {row.click_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Suppressions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-fuchsia-600" />
            E-Mail-Suppression-Liste
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Globale Blockliste — Adressen hier werden von <em>jedem</em>{" "}
            zukünftigen Outreach-Versand übersprungen.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="suppress-email" className="text-xs">
                Adresse manuell unterdrücken
              </Label>
              <Input
                id="suppress-email"
                type="email"
                placeholder="user@example.com"
                value={suppressEmail}
                onChange={(e) => setSuppressEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suppress-notes" className="text-xs">
                Interne Notiz (optional)
              </Label>
              <Textarea
                id="suppress-notes"
                rows={1}
                placeholder="z. B. „Kunde hat telefonisch widersprochen 21.04."
                value={suppressNotes}
                onChange={(e) => setSuppressNotes(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              onClick={() =>
                suppressMutation.mutate({
                  email: suppressEmail,
                  notes: suppressNotes,
                })
              }
              disabled={
                !suppressEmail.trim() ||
                !/^\S+@\S+\.\S+$/.test(suppressEmail.trim()) ||
                suppressMutation.isPending
              }
            >
              {suppressMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4 mr-1.5" />
              )}
              Unterdrücken
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-Mail</TableHead>
                  <TableHead className="w-[120px]">Grund</TableHead>
                  <TableHead className="w-[140px]">Quelle</TableHead>
                  <TableHead>Notiz</TableHead>
                  <TableHead className="w-[140px]">Erfasst</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppressions.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-6 text-muted-foreground text-xs"
                    >
                      Noch keine Adressen unterdrückt.
                    </TableCell>
                  </TableRow>
                )}
                {suppressions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm font-medium truncate max-w-[260px]" title={s.email}>
                      {s.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {s.reason}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.source ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[280px]" title={s.notes ?? undefined}>
                      {s.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(s.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirm trigger dialog */}
      <AlertDialog
        open={confirmTrigger !== null}
        onOpenChange={(open) => !open && setConfirmTrigger(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTrigger === "dry"
                ? "Test-Lauf starten?"
                : "Jetzt 50 Mails versenden?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTrigger === "dry" ? (
                <>
                  Es wird kein E-Mail versendet — die Funktion füllt nur die
                  Warteschlange auf und meldet zurück, wie viele Mails versendet
                  würden.
                </>
              ) : (
                <>
                  Bis zu <strong>50 reale E-Mails</strong> werden sofort über
                  Resend versendet. Empfänger erhalten genau einmal eine
                  Anfrage. Diese Aktion lässt sich nicht zurücknehmen.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                triggerMutation.mutate(confirmTrigger === "dry")
              }
              disabled={triggerMutation.isPending}
            >
              {triggerMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : confirmTrigger === "dry" ? (
                "Test-Lauf starten"
              ) : (
                "Jetzt versenden"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <ExternalLink className="h-3 w-3" />
        Google-Bewertungslink:&nbsp;
        <a
          href="https://share.google/eu7uLZRpBLgeQkqhH"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          share.google/eu7uLZRpBLgeQkqhH
        </a>
      </p>
    </div>
  );
}

const ACCENT_CLASSES: Record<string, string> = {
  amber: "bg-amber-50 text-amber-900 border-amber-200",
  sky: "bg-sky-50 text-sky-900 border-sky-200",
  emerald: "bg-emerald-50 text-emerald-900 border-emerald-200",
  red: "bg-red-50 text-red-900 border-red-200",
  fuchsia: "bg-fuchsia-50 text-fuchsia-900 border-fuchsia-200",
  zinc: "bg-zinc-50 text-zinc-800 border-zinc-200",
  default: "bg-muted/40 text-foreground border-border",
};

function StatTile({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: number;
  accent?: keyof typeof ACCENT_CLASSES;
}) {
  const cls = ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.default;
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums leading-tight mt-0.5">
        {value.toLocaleString("de-DE")}
      </div>
    </div>
  );
}
