import { useState } from "react";
import { CheckCircle2, Clock, MousePointerClick, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FunnelId } from "@/lib/funnelRoutes";
import { KpiCard } from "./AnalyticsCards";
import { FieldTable, ProblemList, SegmentCards, StepTable } from "./FunnelTables";
import { formatDuration, useFunnelStats } from "./useFunnelStats";

const FUNNELS: Array<{ id: FunnelId; label: string }> = [
  { id: "a", label: "A · Küchenangebote (/formular)" },
  { id: "b", label: "B · Angebot unterbieten" },
  { id: "c", label: "C · Traumküche planen" },
];

const RANGES = [7, 30, 90] as const;

const rate = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)} %` : "–");

/** Abbruchanalyse je Funnel aus der Funnel-Telemetrie (Muster der CaravanWert-UX-Auswertung). */
export function FunnelTab() {
  const [funnel, setFunnel] = useState<FunnelId>("a");
  const [days, setDays] = useState<number>(30);
  const { data: stats, isLoading, error } = useFunnelStats(funnel, days);
  const totals = stats?.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={funnel} onValueChange={(v) => setFunnel(v as FunnelId)}>
          <SelectTrigger className="w-72" aria-label="Funnel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FUNNELS.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-40" aria-label="Zeitraum">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((d) => (
              <SelectItem key={d} value={String(d)}>
                Letzte {d} Tage
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">Nur Besucher mit Statistik-Einwilligung.</p>
      </div>

      {error && (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">Auswertung konnte nicht geladen werden: {error.message}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Durchläufe" value={isLoading ? "…" : totals?.sessions ?? 0} icon={Users} gradient="from-indigo-500 to-purple-500" />
        <KpiCard
          title="Erste Antwort gegeben"
          value={isLoading || !totals ? "…" : `${totals.answered} (${rate(totals.answered, totals.sessions)})`}
          icon={MousePointerClick}
          gradient="from-teal-500 to-green-500"
        />
        <KpiCard
          title="Abgeschickt"
          value={isLoading || !totals ? "…" : `${totals.converted} (${rate(totals.converted, totals.sessions)})`}
          icon={CheckCircle2}
          gradient="from-amber-500 to-orange-500"
        />
        <KpiCard
          title="Dauer bis Absenden (Median)"
          value={isLoading || !totals ? "…" : formatDuration(totals.median_duration_ms)}
          icon={Clock}
          gradient="from-rose-500 to-pink-500"
        />
      </div>

      {stats && stats.steps.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Noch keine Funnel-Ereignisse in diesem Zeitraum. Erfasst wird ab dem ersten Besuch mit Statistik-Einwilligung.
          </CardContent>
        </Card>
      )}

      {stats && stats.steps.length > 0 && (
        <>
          <StepTable steps={stats.steps} />
          <FieldTable fields={stats.fields} />
          <SegmentCards stats={stats} />
          <ProblemList problems={stats.problems} />
        </>
      )}
    </div>
  );
}
