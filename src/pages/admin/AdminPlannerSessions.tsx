import { useMemo, useState } from "react";
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
import { Loader2, Eye, ExternalLink } from "lucide-react";

/**
 * AdminPlannerSessions — Uebersicht ueber Funnel-C (Traumkueche-AI) Sessions.
 *
 * Zeigt alle planner_sessions inkl. aktuelles Rendering + verknuepfter Lead.
 * Useful fuer: Quality-Check der AI-Bilder, Prompt-Debug, Lead-Konversion.
 */

const SESSION_STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "outline" },
  active: { label: "Aktiv", variant: "default" },
  completed: { label: "Lead erfasst", variant: "secondary" },
  abandoned: { label: "Abgebrochen", variant: "outline" },
  error: { label: "Fehler", variant: "destructive" },
};

const RENDER_STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "outline" },
  success: { label: "OK", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
};

const STORAGE_PUBLIC_BASE =
  "https://gzqayoalwtmypndrmqes.supabase.co/storage/v1/object/public/planner-renders/";

type SessionRow = {
  id: string;
  session_token: string;
  status: string;
  spec: Record<string, unknown> | null;
  lead_id: string | null;
  current_render_id: string | null;
  price_range_min_cents: number | null;
  price_range_max_cents: number | null;
  contact_captured_at: string | null;
  created_at: string;
  updated_at: string;
  ip_address: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

type RenderRow = {
  id: string;
  session_id: string;
  version: number;
  prompt: string | null;
  status: string;
  image_path: string | null;
  model_slug: string | null;
  generation_ms: number | null;
  cost_cents: number | null;
  error_message: string | null;
  created_at: string;
};

type LeadLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  postal_code: string | null;
  timeframe_months: number | null;
  consent_call: boolean;
  consent_marketing: boolean;
};

type SessionWithRel = SessionRow & {
  current_render: RenderRow | null;
  all_renders: RenderRow[];
  lead: LeadLite | null;
};

function formatEuro(cents: number | null): string {
  if (cents == null) return "-";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function storageUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : STORAGE_PUBLIC_BASE + path;
}

export default function AdminPlannerSessions() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SessionWithRel | null>(null);

  const { data, isLoading, error } = useQuery<SessionWithRel[]>({
    queryKey: ["admin-planner-sessions"],
    queryFn: async () => {
      // 1. Sessions
      const { data: sessions, error: sErr } = await supabase
        .from("planner_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (sErr) throw sErr;

      const sessionIds = (sessions ?? []).map((s) => s.id);
      const renderIds = (sessions ?? [])
        .map((s) => s.current_render_id)
        .filter((x): x is string => Boolean(x));
      const leadIds = (sessions ?? [])
        .map((s) => s.lead_id)
        .filter((x): x is string => Boolean(x));

      // 2. Renders (aktueller + alle fuer die Session fuer Version-History im Dialog)
      const rendersQuery = supabase
        .from("planner_renders")
        .select(
          "id, session_id, version, prompt, status, image_path, model_slug, generation_ms, cost_cents, error_message, created_at"
        )
        .in("session_id", sessionIds.length ? sessionIds : ["__none__"])
        .order("version", { ascending: true });
      const { data: renders, error: rErr } = await rendersQuery;
      if (rErr) throw rErr;

      // 3. Leads
      const { data: leads, error: lErr } = leadIds.length
        ? await supabase
            .from("leads")
            .select(
              "id, first_name, last_name, email, phone, postal_code, timeframe_months, consent_call, consent_marketing"
            )
            .in("id", leadIds)
        : { data: [] as LeadLite[], error: null };
      if (lErr) throw lErr;

      const renderById = new Map<string, RenderRow>();
      const rendersBySession = new Map<string, RenderRow[]>();
      (renders ?? []).forEach((r) => {
        renderById.set(r.id, r as RenderRow);
        const arr = rendersBySession.get(r.session_id) ?? [];
        arr.push(r as RenderRow);
        rendersBySession.set(r.session_id, arr);
      });
      const leadById = new Map<string, LeadLite>();
      (leads ?? []).forEach((l) => leadById.set(l.id, l as LeadLite));

      // ref hint
      void renderIds;

      return (sessions ?? []).map<SessionWithRel>((s) => ({
        ...(s as SessionRow),
        current_render: s.current_render_id
          ? renderById.get(s.current_render_id) ?? null
          : null,
        all_renders: rendersBySession.get(s.id) ?? [],
        lead: s.lead_id ? leadById.get(s.lead_id) ?? null : null,
      }));
    },
    refetchInterval: 30_000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          s.session_token,
          s.lead?.first_name,
          s.lead?.last_name,
          s.lead?.email,
          s.lead?.postal_code,
          typeof s.spec?.kitchen_style === "string" ? (s.spec.kitchen_style as string) : "",
          typeof s.spec?.kitchen_form === "string" ? (s.spec.kitchen_form as string) : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, statusFilter, search]);

  const stats = useMemo(() => {
    if (!data) return { total: 0, completed: 0, active: 0, errors: 0, renderCount: 0, avgMs: 0 };
    const renders = data.flatMap((s) => s.all_renders);
    const successMs = renders
      .filter((r) => r.status === "success" && r.generation_ms)
      .map((r) => r.generation_ms ?? 0);
    const avgMs = successMs.length
      ? Math.round(successMs.reduce((a, b) => a + b, 0) / successMs.length)
      : 0;
    return {
      total: data.length,
      completed: data.filter((s) => s.status === "completed").length,
      active: data.filter((s) => s.status === "active").length,
      errors: renders.filter((r) => r.status === "failed").length,
      renderCount: renders.length,
      avgMs,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Traumküchen-KI (Funnel&nbsp;C)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle Planner-Sessions inkl. AI-Renderings, Prompt, Preis-Schätzung und
          verknüpftem Lead.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Sessions gesamt
          </div>
          <div className="mt-1 text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Aktive (noch kein Lead)
          </div>
          <div className="mt-1 text-2xl font-bold">{stats.active}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Lead erfasst
          </div>
          <div className="mt-1 text-2xl font-bold text-primary">{stats.completed}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Renders total
          </div>
          <div className="mt-1 text-2xl font-bold">{stats.renderCount}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Ø {(stats.avgMs / 1000).toFixed(1)} s · {stats.errors} fehlgeschlagen
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Conversion-Rate
          </div>
          <div className="mt-1 text-2xl font-bold">
            {stats.total ? Math.round((stats.completed / stats.total) * 100) : 0} %
          </div>
          <div className="text-xs text-muted-foreground mt-1">Lead / Session</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Suche: Token, Name, E-Mail, PLZ, Stil …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {Object.entries(SESSION_STATUS_LABEL).map(([k, { label }]) => (
                <SelectItem key={k} value={k}>
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
            Fehler: {error instanceof Error ? error.message : "Unbekannt"}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Noch keine Sessions.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Bild</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stil / Form</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead className="text-right">Preis-Spanne</TableHead>
                <TableHead className="text-right">Renders</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const status = SESSION_STATUS_LABEL[s.status] ?? {
                  label: s.status,
                  variant: "outline" as const,
                };
                const thumb = storageUrl(s.current_render?.image_path ?? null);
                const specStyle =
                  typeof s.spec?.kitchen_style === "string"
                    ? (s.spec.kitchen_style as string)
                    : "—";
                const specForm =
                  typeof s.spec?.kitchen_form === "string"
                    ? (s.spec.kitchen_form as string)
                    : "—";
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(s)}
                  >
                    <TableCell>
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={`Render v${s.current_render?.version}`}
                          className="h-10 w-14 rounded object-cover border"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-10 w-14 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(s.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{specStyle}</div>
                      <div className="text-muted-foreground">{specForm}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.lead ? (
                        <>
                          <div>
                            {s.lead.first_name ?? ""} {s.lead.last_name ?? ""}
                          </div>
                          <div className="text-muted-foreground">{s.lead.email}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {s.price_range_min_cents != null && s.price_range_max_cents != null
                        ? `${formatEuro(s.price_range_min_cents)} – ${formatEuro(s.price_range_max_cents)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">{s.all_renders.length}</TableCell>
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
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {selected && <SessionDetail session={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionDetail({ session }: { session: SessionWithRel }) {
  const status = SESSION_STATUS_LABEL[session.status] ?? {
    label: session.status,
    variant: "outline" as const,
  };
  const current = session.current_render;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          Session {session.session_token.slice(0, 12)}…
          <Badge variant={status.variant}>{status.label}</Badge>
        </DialogTitle>
        <DialogDescription>
          Erstellt {formatDateTime(session.created_at)} · {session.all_renders.length}{" "}
          Render(s) · IP {session.ip_address ?? "—"}
        </DialogDescription>
      </DialogHeader>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {current && storageUrl(current.image_path) ? (
            <img
              src={storageUrl(current.image_path) as string}
              alt={`Aktuelles Rendering v${current.version}`}
              className="w-full rounded-lg border object-cover aspect-[3/2]"
            />
          ) : (
            <div className="w-full aspect-[3/2] bg-muted rounded-lg grid place-items-center text-sm text-muted-foreground">
              Kein Bild
            </div>
          )}

          <div className="text-xs space-y-1">
            <div>
              <span className="text-muted-foreground">Preis-Spanne:</span>{" "}
              <span className="font-semibold">
                {session.price_range_min_cents != null && session.price_range_max_cents != null
                  ? `${formatEuro(session.price_range_min_cents)} – ${formatEuro(session.price_range_max_cents)}`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">UTM:</span>{" "}
              {[session.utm_source, session.utm_medium, session.utm_campaign]
                .filter(Boolean)
                .join(" / ") || "—"}
            </div>
            {current && (
              <div>
                <span className="text-muted-foreground">Modell:</span>{" "}
                {current.model_slug ?? "—"} ·{" "}
                {current.generation_ms ? `${(current.generation_ms / 1000).toFixed(1)}s` : "—"}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Spec (vom Kunden gewählt)
            </div>
            <pre className="max-h-48 overflow-y-auto rounded-md bg-muted p-2 text-xs">
              {JSON.stringify(session.spec, null, 2)}
            </pre>
          </div>

          {current?.prompt && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Aktueller Prompt (OpenAI-enhanced)
              </div>
              <pre className="max-h-40 overflow-y-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap break-words">
                {current.prompt}
              </pre>
            </div>
          )}

          {session.lead && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Verknüpfter Lead
              </div>
              <div className="rounded-md border p-3 text-xs space-y-1">
                <div className="font-semibold">
                  {session.lead.first_name} {session.lead.last_name}
                </div>
                <div>{session.lead.email}</div>
                {session.lead.phone && <div>{session.lead.phone}</div>}
                <div>
                  PLZ {session.lead.postal_code}
                  {session.lead.timeframe_months != null && (
                    <> · Zeitrahmen {session.lead.timeframe_months} Monate</>
                  )}
                </div>
                <div className="text-muted-foreground">
                  Consent: Anruf {session.lead.consent_call ? "✓" : "✗"} · Marketing{" "}
                  {session.lead.consent_marketing ? "✓" : "✗"}
                </div>
                <a
                  href={`/admin/leads?q=${encodeURIComponent(session.lead.email ?? "")}`}
                  className="inline-flex items-center text-primary hover:underline mt-1"
                  target="_blank"
                  rel="noreferrer"
                >
                  Lead öffnen <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {session.all_renders.length > 1 && (
        <div className="mt-6">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Alle Renderings ({session.all_renders.length})
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {session.all_renders
              .slice()
              .reverse()
              .map((r) => {
                const url = storageUrl(r.image_path);
                return (
                  <div key={r.id} className="relative">
                    {url ? (
                      <img
                        src={url}
                        alt={`v${r.version}`}
                        className={
                          r.id === session.current_render?.id
                            ? "w-full aspect-square object-cover rounded border-2 border-primary"
                            : "w-full aspect-square object-cover rounded border"
                        }
                      />
                    ) : (
                      <div className="w-full aspect-square bg-muted rounded" />
                    )}
                    <div className="text-[10px] text-center mt-1">
                      v{r.version}{" "}
                      {r.status !== "success" && (
                        <Badge
                          variant={r.status === "failed" ? "destructive" : "outline"}
                          className="ml-1 text-[9px] px-1 py-0"
                        >
                          {RENDER_STATUS_LABEL[r.status]?.label ?? r.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </>
  );
}
