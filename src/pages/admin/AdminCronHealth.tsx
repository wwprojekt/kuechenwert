/**
 * Admin Cron-Health-Dashboard
 *
 * Zeigt Status aller pg_cron-Jobs sowie der pg_net HTTP-Responses, die durch
 * Cron-Jobs Edge Functions auslösen. Datenquellen sind die SECURITY-DEFINER
 * RPCs admin_get_cron_jobs_health, admin_get_cron_run_history,
 * admin_get_http_response_health und admin_get_recent_http_failures.
 *
 * Ziele:
 *  - Auf einen Blick sehen, ob alle Jobs laufen (Schedule, letzter Run, Erfolg)
 *  - Schnell erkennen, wenn eine Edge Function dauerhaft 5xx zurückgibt
 *    (z.B. WORKER_RESOURCE_LIMIT 546)
 *  - Drill-down: Run-History einzelner Jobs + Fehler-Bodies inspizieren
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Server,
  TimerReset,
  Zap,
  XCircle,
  Loader2,
  Copy,
} from "lucide-react";

type JobHealth = {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
  runs_total: number;
  runs_succeeded: number;
  runs_failed: number;
  last_run_start: string | null;
  last_run_end: string | null;
  last_run_status: string | null;
  last_run_message: string | null;
  last_run_duration_ms: number | null;
  avg_duration_ms: number | null;
};

type HttpHealthRow = {
  status_class: string;
  total: number;
  last_seen: string | null;
  example_content: string | null;
};

type HttpFailureRow = {
  id: number;
  status_code: number | null;
  timed_out: boolean;
  error_msg: string | null;
  content: string | null;
  created: string;
};

type RunHistoryRow = {
  runid: number;
  status: string;
  return_message: string | null;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
};

type DriftRow = {
  jobid: number;
  jobname: string;
  schedule: string;
  expected_runs_per_hour: number | null;
  actual_runs_per_hour: number | null;
  drift_ratio: number | null;
  severity: "ok" | "too_fast" | "too_slow" | "unknown_schedule";
};

const TIME_WINDOWS: Array<{ value: string; label: string; hours: number }> = [
  { value: "1", label: "Letzte Stunde", hours: 1 },
  { value: "6", label: "Letzte 6 Stunden", hours: 6 },
  { value: "24", label: "Letzte 24 Stunden", hours: 24 },
  { value: "72", label: "Letzte 3 Tage", hours: 72 },
  { value: "168", label: "Letzte 7 Tage", hours: 168 },
];

const STATUS_CLASS_META: Record<
  string,
  { label: string; tone: "ok" | "warn" | "err" | "info"; description: string }
> = {
  "2xx_success": { label: "2xx Success", tone: "ok", description: "Erfolgreiche HTTP-Antworten" },
  "3xx_redirect": { label: "3xx Redirect", tone: "info", description: "Redirects (selten von Edge Functions)" },
  "4xx_client": { label: "4xx Client", tone: "warn", description: "Auth-/Validierungsfehler – Function-Logik prüfen" },
  "5xx_server": { label: "5xx Server", tone: "err", description: "Server-Fehler in der Edge Function" },
  "5xx_resource": { label: "546 Resource Limit", tone: "err", description: "WORKER_RESOURCE_LIMIT – Function überlastet" },
  timeout: { label: "Timeout", tone: "err", description: "Request hat das Zeitlimit überschritten" },
  transport_error: { label: "Transport-Fehler", tone: "err", description: "DNS/TLS/Netzwerk – Function nicht erreichbar" },
  other: { label: "Sonstige", tone: "info", description: "Nicht klassifizierte Antworten" },
};

function formatDateTime(iso: string | null) {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelative(iso: string | null) {
  if (!iso) return "–";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `vor ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  return `vor ${d} Tag${d === 1 ? "" : "en"}`;
}

function formatDuration(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "–";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m} m ${Math.round(s - m * 60)} s`;
}

function describeSchedule(cron: string): string {
  // Conservative human-readable hints for common patterns
  const trimmed = cron.trim().replace(/\s+/g, " ");
  const map: Record<string, string> = {
    "* * * * *": "Jede Minute",
    "*/1 * * * *": "Jede Minute",
    "*/2 * * * *": "Alle 2 Minuten",
    "*/5 * * * *": "Alle 5 Minuten",
    "*/15 * * * *": "Alle 15 Minuten",
    "0 * * * *": "Stündlich",
    "15 * * * *": "Stündlich (Min. 15)",
    "0 0 * * *": "Täglich um 00:00",
  };
  if (map[trimmed]) return map[trimmed];
  // "0 H * * *" → täglich um H:00
  const daily = trimmed.match(/^0 (\d{1,2}) \* \* \*$/);
  if (daily) return `Täglich um ${daily[1].padStart(2, "0")}:00`;
  // "M H * * D" → wöchentlich
  const weekly = trimmed.match(/^(\d{1,2}) (\d{1,2}) \* \* (\d)$/);
  if (weekly) return `Wöchentlich (Tag ${weekly[3]}, ${weekly[2]}:${weekly[1].padStart(2, "0")})`;
  // "M H D * *" → monatlich
  const monthly = trimmed.match(/^(\d{1,2}) (\d{1,2}) (\d{1,2}) \* \*$/);
  if (monthly) return `Monatlich (am ${monthly[3]}. um ${monthly[2]}:${monthly[1].padStart(2, "0")})`;
  return trimmed;
}

function statusToneClass(tone: "ok" | "warn" | "err" | "info") {
  switch (tone) {
    case "ok":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "warn":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "err":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "info":
    default:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
  }
}

function jobHealthTone(j: JobHealth): "ok" | "warn" | "err" | "info" {
  if (!j.active) return "info";
  if (j.runs_total === 0) return "warn";
  if (j.runs_failed > 0) return "err";
  if (j.last_run_status === "failed") return "err";
  return "ok";
}

const AdminCronHealth = () => {
  const { toast } = useToast();
  const [windowKey, setWindowKey] = useState<string>("24");
  const hours = useMemo(
    () => TIME_WINDOWS.find((w) => w.value === windowKey)?.hours ?? 24,
    [windowKey],
  );

  const [isLoading, setIsLoading] = useState(true);
  const [jobs, setJobs] = useState<JobHealth[]>([]);
  const [httpHealth, setHttpHealth] = useState<HttpHealthRow[]>([]);
  const [failures, setFailures] = useState<HttpFailureRow[]>([]);
  const [drifts, setDrifts] = useState<DriftRow[]>([]);

  const [selectedJob, setSelectedJob] = useState<JobHealth | null>(null);
  const [history, setHistory] = useState<RunHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [selectedFailure, setSelectedFailure] = useState<HttpFailureRow | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [jobsRes, healthRes, failRes, driftRes] = await Promise.all([
        supabase.rpc("admin_get_cron_jobs_health", { p_hours: hours }),
        supabase.rpc("admin_get_http_response_health", { p_hours: hours }),
        supabase.rpc("admin_get_recent_http_failures", { p_hours: hours, p_limit: 100 }),
        supabase.rpc("admin_get_cron_schedule_drift"),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (healthRes.error) throw healthRes.error;
      if (failRes.error) throw failRes.error;
      // Drift is best-effort: ignore errors so the dashboard still loads on a
      // fresh DB that has not yet had the drift RPC migrated in.
      if (driftRes.error) {
        console.warn("CronHealth drift fetch failed", driftRes.error);
      }

      setJobs((jobsRes.data || []) as JobHealth[]);
      setHttpHealth((healthRes.data || []) as HttpHealthRow[]);
      setFailures((failRes.data || []) as HttpFailureRow[]);
      setDrifts(((driftRes.data || []) as DriftRow[]) ?? []);
    } catch (err) {
      console.error("CronHealth fetch error", err);
      toast({
        title: "Laden fehlgeschlagen",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [hours, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openHistory = useCallback(
    async (job: JobHealth) => {
      setSelectedJob(job);
      setHistory([]);
      setHistoryLoading(true);
      try {
        const { data, error } = await supabase.rpc("admin_get_cron_run_history", {
          p_jobid: job.jobid,
          p_limit: 100,
        });
        if (error) throw error;
        setHistory((data || []) as RunHistoryRow[]);
      } catch (err) {
        toast({
          title: "Run-History fehlgeschlagen",
          description: err instanceof Error ? err.message : "Unbekannter Fehler",
          variant: "destructive",
        });
      } finally {
        setHistoryLoading(false);
      }
    },
    [toast],
  );

  const totalRuns = useMemo(() => jobs.reduce((s, j) => s + (j.runs_total || 0), 0), [jobs]);
  const totalFailedRuns = useMemo(
    () => jobs.reduce((s, j) => s + (j.runs_failed || 0), 0),
    [jobs],
  );
  const httpStats = useMemo(() => {
    const out = { ok: 0, fail: 0, other: 0 };
    for (const row of httpHealth) {
      const meta = STATUS_CLASS_META[row.status_class];
      if (meta?.tone === "ok") out.ok += row.total;
      else if (meta?.tone === "err" || meta?.tone === "warn") out.fail += row.total;
      else out.other += row.total;
    }
    return out;
  }, [httpHealth]);
  const httpTotal = httpStats.ok + httpStats.fail + httpStats.other;
  const httpFailRate = httpTotal > 0 ? (httpStats.fail / httpTotal) * 100 : 0;

  const driftedJobs = useMemo(
    () => drifts.filter((d) => d.severity === "too_fast" || d.severity === "too_slow"),
    [drifts],
  );

  const inactiveJobs = useMemo(() => jobs.filter((j) => !j.active).length, [jobs]);
  const failingJobs = useMemo(
    () => jobs.filter((j) => j.active && (j.runs_failed > 0 || j.last_run_status === "failed")).length,
    [jobs],
  );
  const idleActiveJobs = useMemo(
    () => jobs.filter((j) => j.active && j.runs_total === 0).length,
    [jobs],
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    toast({ title: "Kopiert", description: "In die Zwischenablage übernommen." });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TimerReset className="w-6 h-6 text-primary" />
            Cron-Health
          </h1>
          <p className="text-muted-foreground mt-1">
            Status aller pg_cron-Jobs und der HTTP-Antworten von cron-getriggerten
            Edge Functions im gewählten Zeitfenster.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={windowKey} onValueChange={setWindowKey}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Zeitfenster" />
            </SelectTrigger>
            <SelectContent>
              {TIME_WINDOWS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Aktive Jobs</p>
            <p className="text-2xl font-bold">{jobs.filter((j) => j.active).length}</p>
            <p className="text-xs text-muted-foreground mt-1">{jobs.length} insgesamt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cron-Runs</p>
            <p className="text-2xl font-bold">{totalRuns.toLocaleString("de-DE")}</p>
            <p className="text-xs text-muted-foreground mt-1">in {hours} h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Fehlerhafte Runs</p>
            <p
              className={`text-2xl font-bold ${
                totalFailedRuns > 0 ? "text-red-600" : "text-foreground"
              }`}
            >
              {totalFailedRuns.toLocaleString("de-DE")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">SQL-Ebene (cron.job_run_details)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">HTTP-Antworten</p>
            <p className="text-2xl font-bold">{httpTotal.toLocaleString("de-DE")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {httpStats.ok.toLocaleString("de-DE")} OK · {httpStats.fail.toLocaleString("de-DE")} Fehler
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">HTTP-Fehlerquote</p>
            <p
              className={`text-2xl font-bold ${
                httpFailRate >= 25
                  ? "text-red-600"
                  : httpFailRate >= 5
                  ? "text-orange-600"
                  : "text-green-600"
              }`}
            >
              {httpFailRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">der pg_net-Responses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Auffällig</p>
            <p
              className={`text-2xl font-bold ${
                failingJobs + idleActiveJobs + driftedJobs.length > 0
                  ? "text-orange-600"
                  : "text-green-600"
              }`}
            >
              {failingJobs + idleActiveJobs + driftedJobs.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {failingJobs} mit Fehlern · {idleActiveJobs} ohne Runs · {inactiveJobs} inaktiv
              {driftedJobs.length > 0 && ` · ${driftedJobs.length} Schedule-Drift`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule-Drift Warning – only shown when actual frequency deviates >50% from schedule */}
      {driftedJobs.length > 0 && (
        <Card className="border-red-300 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
                  Schedule-Drift erkannt
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Die tatsächliche Run-Frequenz weicht in den letzten 2 Stunden um mehr
                  als 50 % vom konfigurierten Schedule ab. Häufigste Ursache: eine
                  Schedule-Änderung wurde nur in git committed, aber nie in der DB
                  persistiert. Prüfen mit{" "}
                  <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                    select * from cron.job;
                  </code>
                  .
                </p>
                <div className="mt-3 border border-border rounded-lg overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
                      <tr>
                        <th className="text-left px-3 py-2">Severity</th>
                        <th className="text-left px-3 py-2">Job</th>
                        <th className="text-left px-3 py-2">Schedule</th>
                        <th className="text-right px-3 py-2">Erwartet/h</th>
                        <th className="text-right px-3 py-2">Tatsächlich/h</th>
                        <th className="text-right px-3 py-2">Faktor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {driftedJobs.map((d) => (
                        <tr key={d.jobid}>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                d.severity === "too_fast"
                                  ? statusToneClass("err")
                                  : statusToneClass("warn")
                              }`}
                            >
                              {d.severity === "too_fast" ? "ZU OFT" : "ZU SELTEN"}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium">{d.jobname}</td>
                          <td className="px-3 py-2 font-mono text-xs">{d.schedule}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {d.expected_runs_per_hour ?? "–"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {d.actual_runs_per_hour ?? "–"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {d.drift_ratio !== null ? `${d.drift_ratio}×` : "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* HTTP-Health Breakdown */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Server className="w-5 h-5 text-muted-foreground" />
              HTTP-Antworten (pg_net)
            </h2>
            <span className="text-xs text-muted-foreground">{hours} h</span>
          </div>
          {httpHealth.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Keine HTTP-Aufrufe im gewählten Zeitfenster.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {httpHealth.map((row) => {
                const meta = STATUS_CLASS_META[row.status_class] ?? {
                  label: row.status_class,
                  tone: "info" as const,
                  description: "",
                };
                return (
                  <div
                    key={row.status_class}
                    className="border border-border rounded-lg p-3 bg-card"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusToneClass(meta.tone)}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xl font-bold">
                        {row.total.toLocaleString("de-DE")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{meta.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Zuletzt: {formatRelative(row.last_seen)}
                    </p>
                    {row.example_content && (
                      <p
                        className="text-[11px] font-mono bg-muted rounded px-2 py-1 mt-2 truncate"
                        title={row.example_content}
                      >
                        {row.example_content}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jobs table */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-muted-foreground" />
              Cron-Jobs
            </h2>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          {jobs.length === 0 && !isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Keine Cron-Jobs gefunden.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Job</th>
                    <th className="text-left px-4 py-2">Schedule</th>
                    <th className="text-right px-4 py-2">Runs ({hours} h)</th>
                    <th className="text-right px-4 py-2">Fehler</th>
                    <th className="text-left px-4 py-2">Letzter Run</th>
                    <th className="text-right px-4 py-2">Dauer (Ø)</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.map((job) => {
                    const tone = jobHealthTone(job);
                    return (
                      <tr key={job.jobid} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          {tone === "ok" && (
                            <CheckCircle2 className="w-5 h-5 text-green-600" aria-label="OK" />
                          )}
                          {tone === "err" && (
                            <XCircle className="w-5 h-5 text-red-600" aria-label="Fehler" />
                          )}
                          {tone === "warn" && (
                            <AlertTriangle className="w-5 h-5 text-orange-500" aria-label="Warnung" />
                          )}
                          {tone === "info" && (
                            <Clock className="w-5 h-5 text-blue-500" aria-label="Inaktiv" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{job.jobname}</div>
                          <div className="text-xs text-muted-foreground">
                            #{job.jobid} {job.active ? "" : "· inaktiv"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs">{job.schedule}</div>
                          <div className="text-xs text-muted-foreground">
                            {describeSchedule(job.schedule)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium">
                            {job.runs_total.toLocaleString("de-DE")}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {job.runs_succeeded} OK
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {job.runs_failed > 0 ? (
                            <span className="text-red-600 font-semibold">
                              {job.runs_failed}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs">
                            {formatRelative(job.last_run_start)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {job.last_run_status === "succeeded" ? (
                              <span className="text-green-600">erfolgreich</span>
                            ) : job.last_run_status ? (
                              <span className="text-red-600">{job.last_run_status}</span>
                            ) : (
                              <span>–</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-xs">{formatDuration(job.last_run_duration_ms)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Ø {formatDuration(job.avg_duration_ms)}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openHistory(job)}
                          >
                            Details
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent failures */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-500" />
              Letzte HTTP-Fehler ({failures.length})
            </h2>
            <span className="text-xs text-muted-foreground">{hours} h</span>
          </div>
          {failures.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Keine HTTP-Fehler im Zeitfenster. Sauber!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
              {failures.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFailure(f)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/30 flex items-start gap-3"
                >
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                      f.timed_out
                        ? statusToneClass("err")
                        : f.error_msg
                        ? statusToneClass("err")
                        : (f.status_code ?? 0) === 546
                        ? statusToneClass("err")
                        : (f.status_code ?? 0) >= 500
                        ? statusToneClass("err")
                        : statusToneClass("warn")
                    }`}
                  >
                    {f.timed_out
                      ? "TIMEOUT"
                      : f.error_msg
                      ? "ERROR"
                      : f.status_code ?? "?"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate text-foreground">
                      {(f.content || f.error_msg || "(leer)").slice(0, 200)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelative(f.created)} · {formatDateTime(f.created)} · #{f.id}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run-History Dialog */}
      <Dialog
        open={selectedJob !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJob(null);
            setHistory([]);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  {selectedJob.jobname}
                </DialogTitle>
                <DialogDescription>
                  Run-History (max. 100) · Schedule {selectedJob.schedule} ·{" "}
                  {describeSchedule(selectedJob.schedule)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">
                    Cron-Command
                  </h3>
                  <div className="flex items-start gap-2">
                    <pre className="text-[11px] font-mono bg-muted rounded p-2 flex-1 overflow-x-auto whitespace-pre-wrap">
                      {selectedJob.command}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 flex-shrink-0"
                      onClick={() => copyToClipboard(selectedJob.command)}
                      aria-label="Kopieren"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Run-History
                  </h3>
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : history.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      Keine Run-Einträge gefunden.
                    </p>
                  ) : (
                    <div className="border border-border rounded-lg overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 text-muted-foreground uppercase">
                          <tr>
                            <th className="text-left px-3 py-2">Status</th>
                            <th className="text-left px-3 py-2">Start</th>
                            <th className="text-right px-3 py-2">Dauer</th>
                            <th className="text-left px-3 py-2">Message</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {history.map((h) => (
                            <tr key={h.runid}>
                              <td className="px-3 py-2">
                                {h.status === "succeeded" ? (
                                  <span className="text-green-600 font-medium">OK</span>
                                ) : (
                                  <span className="text-red-600 font-medium">{h.status}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono">
                                {formatDateTime(h.start_time)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {formatDuration(h.duration_ms)}
                              </td>
                              <td className="px-3 py-2 font-mono truncate max-w-[280px]">
                                {h.return_message || "–"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Failure-Detail Dialog */}
      <Dialog
        open={selectedFailure !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedFailure(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedFailure && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  HTTP-Antwort #{selectedFailure.id}
                </DialogTitle>
                <DialogDescription>
                  {formatDateTime(selectedFailure.created)} · {formatRelative(selectedFailure.created)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Status-Code</p>
                    <p className="font-mono">{selectedFailure.status_code ?? "–"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Timeout</p>
                    <p className="font-mono">{selectedFailure.timed_out ? "ja" : "nein"}</p>
                  </div>
                </div>
                {selectedFailure.error_msg && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Transport-Fehler</p>
                    <pre className="text-xs font-mono bg-muted rounded p-2 whitespace-pre-wrap">
                      {selectedFailure.error_msg}
                    </pre>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Response-Body</p>
                    {selectedFailure.content && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboard(selectedFailure.content || "")}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Kopieren
                      </Button>
                    )}
                  </div>
                  <pre className="text-xs font-mono bg-muted rounded p-2 whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                    {selectedFailure.content || "(leer)"}
                  </pre>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCronHealth;
