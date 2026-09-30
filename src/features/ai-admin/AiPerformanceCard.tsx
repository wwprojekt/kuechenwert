import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/features/marketplace/api-client";
import { falModel } from "../../../supabase/functions/_shared/fal-models.ts";
import { feedbackReasonLabel } from "../../../supabase/functions/_shared/render-feedback.ts";
import { fetchAiStats, type AiGroupStats, type AiModelStats } from "./api";
import { abVerdict, wilsonInterval } from "./stats";

const usd = (cents: number) => (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "USD" });
const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)} %` : "–");
const seconds = (ms: number | null) => (ms ? `${(ms / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s` : "–");
const range = (up: number, rated: number) => {
  const ci = wilsonInterval(up, rated);
  return ci ? `${Math.round(ci[0] * 100)}–${Math.round(ci[1] * 100)} %` : null;
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ModelRow({ m }: { m: AiModelStats }) {
  const rated = m.thumbs_up + m.thumbs_down;
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{falModel(m.model)?.label ?? m.model}</div>
        <Badge variant="outline" className="mt-1 text-[10px]">
          {m.mode === "edit" ? "mit Foto / Variante" : "ohne Foto"}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{m.started}</TableCell>
      <TableCell className="text-right tabular-nums">{pct(m.first_try_success, m.started)}</TableCell>
      <TableCell className="text-right tabular-nums">{m.fell_back}</TableCell>
      <TableCell className="text-right tabular-nums">
        {m.images}
        {m.as_fallback > 0 && <span className="text-xs text-muted-foreground"> ({m.as_fallback} als Ausweich)</span>}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {seconds(m.p50_ms)}
        {m.p90_ms ? <span className="block text-xs text-muted-foreground">9 von 10 ≤ {seconds(m.p90_ms)}</span> : null}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {m.thumbs_up} / {m.thumbs_down}
        <span className="block text-xs text-muted-foreground">{rated ? `${pct(m.thumbs_up, rated)} positiv` : "keine Bewertung"}</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{usd(m.cost_cents)}</TableCell>
    </TableRow>
  );
}

function GroupRow({ g }: { g: AiGroupStats }) {
  const rated = g.thumbs_up + g.thumbs_down;
  const ci = range(g.thumbs_up, rated);
  return (
    <TableRow>
      <TableCell className="font-medium">{g.group === "challenger" ? "Vergleichsmodell" : "Hauptmodell"}</TableCell>
      <TableCell className="text-right tabular-nums">{g.sessions}</TableCell>
      <TableCell className="text-right tabular-nums">
        {rated ? pct(g.thumbs_up, rated) : "–"}
        {ci && <span className="block text-xs text-muted-foreground">{ci} · {rated} Bew.</span>}
      </TableCell>
      <TableCell className="text-right tabular-nums">{pct(g.fell_back, g.first_renders)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {g.sessions ? (g.variants / g.sessions).toLocaleString("de-DE", { maximumFractionDigits: 1 }) : "–"}
      </TableCell>
      <TableCell className="text-right tabular-nums">{g.sessions ? usd(g.cost_cents / g.sessions) : "–"}</TableCell>
    </TableRow>
  );
}

const VERDICT: Record<ReturnType<typeof abVerdict>, string> = {
  control: "Das Hauptmodell wird gesichert besser bewertet.",
  challenger: "Das Vergleichsmodell wird gesichert besser bewertet – Wechsel prüfen (Ausweichquote und Kosten beachten).",
  open: "Noch kein gesicherter Unterschied: Die Spannen der positiven Bewertungen überlappen sich.",
};

export function AiPerformanceCard() {
  const [days, setDays] = useState(30);
  const stats = useQuery({ queryKey: ["admin-ai-stats", days], queryFn: () => fetchAiStats(days), refetchInterval: 60_000 });
  const s = stats.data;
  const control = s?.groups.find((g) => g.group === "control");
  const challenger = s?.groups.find((g) => g.group === "challenger");
  const verdict = abVerdict(
    control ? { up: control.thumbs_up, rated: control.thumbs_up + control.thumbs_down } : null,
    challenger ? { up: challenger.thumbs_up, rated: challenger.thumbs_up + challenger.thumbs_down } : null,
  );
  const reasons = Object.entries(s?.reasons ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Leistung der KI</CardTitle>
          <CardDescription>
            Welches Modell liefert zuverlässig Bilder, die gefallen? Planungen ohne Anfrage werden nach 30 Tagen gelöscht, daher höchstens
            30 Tage. Kosten sind Schätzungen nach fal-Preisliste.
          </CardDescription>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-32" aria-label="Zeitraum">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 Tage</SelectItem>
            <SelectItem value="14">14 Tage</SelectItem>
            <SelectItem value="30">30 Tage</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-6">
        {!s ? (
          stats.isError ? (
            <p className="text-sm text-destructive">{errorMessage(stats.error)}</p>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span>KI-Bilder in den letzten 24 Stunden</span>
                <span className="tabular-nums">
                  {s.today.renders} / {s.today.cap || "pausiert"}
                </span>
              </div>
              <Progress value={s.today.cap ? Math.min(100, (s.today.renders / s.today.cap) * 100) : 100} />
              {s.today.cap > 0 && (
                <p className="text-xs text-muted-foreground">
                  Davon ungeprüfte Besucher (vor der Anfrage oder ohne Bot-Prüfung): {s.today.open} von höchstens {s.today.open_cap}; der
                  Rest bleibt Kund:innen mit bestandener Prüfung vorbehalten.
                </p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label="Planungen" value={String(s.funnel.sessions)} />
              <Kpi label="Mit Visualisierung" value={pct(s.funnel.with_render, s.funnel.sessions)} hint={`${s.funnel.with_photo_render} mit eigenem Foto`} />
              <Kpi label="Anfragen" value={String(s.funnel.leads)} hint={`${pct(s.funnel.leads, s.funnel.sessions)} der Planungen`} />
              <Kpi label="KI-Kosten" value={usd(s.funnel.cost_cents)} />
              <Kpi label="Kosten je Anfrage" value={s.funnel.leads ? usd(s.funnel.cost_cents / s.funnel.leads) : "–"} />
            </div>

            {s.models.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Visualisierungen im Zeitraum.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modell</TableHead>
                      <TableHead className="text-right">Gestartet</TableHead>
                      <TableHead className="text-right">Erfolg 1. Versuch</TableHead>
                      <TableHead className="text-right">Ausgewichen</TableHead>
                      <TableHead className="text-right">Bilder</TableHead>
                      <TableHead className="text-right">Dauer (Median)</TableHead>
                      <TableHead className="text-right">👍 / 👎</TableHead>
                      <TableHead className="text-right">Kosten</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.models.map((m) => (
                      <ModelRow key={`${m.model}-${m.mode}`} m={m} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {reasons.length > 0 && (
              <p className="text-sm">
                <span className="font-semibold">Gründe bei 👎: </span>
                <span className="text-muted-foreground">{reasons.map(([id, n]) => `${feedbackReasonLabel(id)} (${n})`).join(" · ")}</span>
              </p>
            )}

            {s.groups.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">A/B-Vergleich (Planungen mit Foto)</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Gruppe</TableHead>
                        <TableHead className="text-right">Planungen</TableHead>
                        <TableHead className="text-right">Positiv bewertet (Erstbild)</TableHead>
                        <TableHead className="text-right">Ausgewichen</TableHead>
                        <TableHead className="text-right">Varianten je Planung</TableHead>
                        <TableHead className="text-right">KI-Kosten je Planung</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.groups.map((g) => (
                        <GroupRow key={g.group} g={g} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm font-medium">{VERDICT[verdict]}</p>
                <p className="text-xs text-muted-foreground">
                  Kund:innen sehen Bild und Preis erst nach der Anfrage, das Modell beeinflusst die Anfragequote also nicht. Es zählen die
                  Bewertungen der Erstbilder (Spanne = 95-%-Bereich), Ausweichquote, Dauer und Kosten.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
