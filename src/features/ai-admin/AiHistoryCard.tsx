import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/features/marketplace/api-client";
import { falModel } from "../../../supabase/functions/_shared/fal-models.ts";
import { fetchDailyStats, fetchSettingsHistory } from "./api";
import { aggregateHistory, describeChanges, type HistoryBucket } from "./history";

const RANGES: Record<string, { days: number; bucket: HistoryBucket; label: string }> = {
  weeks: { days: 7 * 12, bucket: "week", label: "12 Wochen" },
  months: { days: 365, bucket: "month", label: "12 Monate" },
};

const usd = (cents: number) => (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "USD" });
const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)} %` : "–");
const seconds = (ms: number | null) => (ms ? `${(ms / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s` : "–");

function sinceDay(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Kennzahlen über die 30-Tage-Löschung hinaus und was sich an den Einstellungen geändert hat. */
export function AiHistoryCard() {
  const [range, setRange] = useState<keyof typeof RANGES>("weeks");
  const { days, bucket } = RANGES[range]!;
  const daily = useQuery({ queryKey: ["admin-ai-daily", range], queryFn: () => fetchDailyStats(sinceDay(days)) });
  const history = useQuery({ queryKey: ["admin-ai-settings-history"], queryFn: () => fetchSettingsHistory() });
  const rows = aggregateHistory(daily.data ?? [], bucket);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Verlauf</CardTitle>
          <CardDescription>
            Anonyme Tageswerte (nur Zählungen, Dauer, Kosten und Modelle), die über die 30-Tage-Löschung der Planungen hinaus bleiben.
            So lassen sich Modell- oder Prompt-Wechsel über Monate vergleichen.
          </CardDescription>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as keyof typeof RANGES)}>
          <SelectTrigger className="w-32" aria-label="Zeitraum des Verlaufs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RANGES).map(([key, r]) => (
              <SelectItem key={key} value={key}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-6">
        {daily.isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : daily.isError ? (
          <p className="text-sm text-destructive">{errorMessage(daily.error)}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Tageswerte – sie entstehen jede Nacht für den Vortag.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitraum</TableHead>
                  <TableHead className="text-right">Planungen</TableHead>
                  <TableHead className="text-right">Anfragen</TableHead>
                  <TableHead className="text-right">Bilder</TableHead>
                  <TableHead className="text-right">Erfolg 1. Versuch</TableHead>
                  <TableHead className="text-right">Ausgewichen</TableHead>
                  <TableHead className="text-right">Positiv</TableHead>
                  <TableHead className="text-right">Dauer</TableHead>
                  <TableHead className="text-right">Kosten</TableHead>
                  <TableHead>Hauptmodell</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.sessions}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.images}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(r.firstTrySuccess, r.started)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(r.fellBack, r.started)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(r.thumbsUp, r.thumbsUp + r.thumbsDown)}</TableCell>
                    <TableCell className="text-right tabular-nums">{seconds(r.medianMs)}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(r.costCents)}</TableCell>
                    <TableCell className="text-sm">{r.mainModel ? (falModel(r.mainModel)?.label ?? r.mainModel) : "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold">Änderungen an den Einstellungen</p>
          {history.isError ? (
            <p className="text-sm text-destructive">{errorMessage(history.error)}</p>
          ) : !history.data?.length ? (
            <p className="text-sm text-muted-foreground">Seit Beginn der Aufzeichnung (30.09.2026) unverändert.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.data.map((c) => (
                <li key={c.changed_at} className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">{new Date(c.changed_at).toLocaleString("de-DE")}</p>
                  {describeChanges(c).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
