import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration, type FunnelFieldStats, type FunnelStats, type FunnelStepStats } from "./useFunnelStats";

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)} %` : "–");

function DropBar({ step }: { step: FunnelStepStats }) {
  const share = step.reached > 0 ? step.dropped / step.reached : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-destructive" style={{ width: `${Math.min(100, share * 100)}%` }} />
      </div>
      <span className="tabular-nums">{percent(step.dropped, step.reached)}</span>
    </div>
  );
}

export function StepTable({ steps }: { steps: FunnelStepStats[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Schritte</CardTitle>
        <CardDescription>
          Erreicht = Durchläufe mit diesem Schritt. Abbruch = hier zuletzt gewesen, nicht abgeschickt (Durchläufe der letzten 30 Minuten
          laufen noch). Zeit = Median bis „Weiter“.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Schritt</TableHead>
              <TableHead className="text-right">Erreicht</TableHead>
              <TableHead className="text-right">Abbrüche</TableHead>
              <TableHead>Abbruchquote</TableHead>
              <TableHead className="text-right">Zeit</TableHead>
              <TableHead className="text-right">Pflicht fehlte</TableHead>
              <TableHead>Häufigste Fehlerfelder</TableHead>
              <TableHead className="text-right">Zurück</TableHead>
              <TableHead className="text-right">Inaktiv</TableHead>
              <TableHead className="text-right">Exit-Dialog</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.map((step) => (
              <TableRow key={step.step_index}>
                <TableCell className="font-medium">
                  {step.step_index + 1}. {step.label ?? step.step}
                </TableCell>
                <TableCell className="text-right tabular-nums">{step.reached}</TableCell>
                <TableCell className="text-right tabular-nums">{step.dropped}</TableCell>
                <TableCell>
                  <DropBar step={step} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatDuration(step.median_ms)}</TableCell>
                <TableCell className="text-right tabular-nums">{step.validation_sessions}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {step.error_fields.slice(0, 3).map((f) => `${f.field} (${f.count})`).join(", ") || "–"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{step.back_clicks}</TableCell>
                <TableCell className="text-right tabular-nums">{step.idle_sessions}</TableCell>
                <TableCell className="text-right tabular-nums">{step.exit_intents}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function FieldTable({ fields }: { fields: FunnelFieldStats[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Felder</CardTitle>
        <CardDescription>Nur Feldschlüssel, keine Eingaben. Leer verlassen und Korrekturen zeigen, wo Nutzer zögern.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {fields.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Noch keine Feldereignisse.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feld</TableHead>
                <TableHead>Schritt</TableHead>
                <TableHead className="text-right">Durchläufe</TableHead>
                <TableHead className="text-right">Leer verlassen</TableHead>
                <TableHead className="text-right">Korrigiert</TableHead>
                <TableHead className="text-right">Auswahl geändert</TableHead>
                <TableHead className="text-right">Pflichtfehler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field.field}>
                  <TableCell className="font-mono text-xs">{field.field}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{field.step}</TableCell>
                  <TableCell className="text-right tabular-nums">{field.sessions}</TableCell>
                  <TableCell className="text-right tabular-nums">{field.left_empty}</TableCell>
                  <TableCell className="text-right tabular-nums">{field.corrected}</TableCell>
                  <TableCell className="text-right tabular-nums">{field.changes}</TableCell>
                  <TableCell className="text-right tabular-nums">{field.validation_errors}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ShareList({ title, description, rows }: { title: string; description: string; rows: Array<{ name: string; sessions: number; converted: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Daten.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-4">
                <span className="truncate">{row.name}</span>
                <span className="flex-none tabular-nums text-muted-foreground">
                  {row.sessions} Durchläufe · {percent(row.converted, row.sessions)} abgeschickt
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const DEVICE_LABELS: Record<string, string> = { mobile: "Mobil", tablet: "Tablet", desktop: "Desktop" };

export function SegmentCards({ stats }: { stats: FunnelStats }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ShareList
        title="Geräte"
        description="Abschlussquote je Gerät"
        rows={stats.devices.map((d) => ({ name: DEVICE_LABELS[d.device] ?? d.device, sessions: d.sessions, converted: d.converted }))}
      />
      <ShareList
        title="Herkunft"
        description="utm_source, sonst Anzeigen-Klick oder verweisende Website"
        rows={stats.sources.map((s) => ({ name: s.source, sessions: s.sessions, converted: s.converted }))}
      />
    </div>
  );
}

export function ProblemList({ problems }: { problems: FunnelStats["problems"] }) {
  if (problems.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Technische Probleme</CardTitle>
        <CardDescription>JavaScript-Fehler und fehlgeschlagenes Absenden im Funnel</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Art</TableHead>
              <TableHead>Meldung</TableHead>
              <TableHead className="text-right">Anzahl</TableHead>
              <TableHead className="text-right">Durchläufe</TableHead>
              <TableHead className="text-right">Zuletzt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {problems.map((p) => (
              <TableRow key={`${p.event}:${p.message}`}>
                <TableCell>{p.event === "js_error" ? "JS-Fehler" : "Absenden"}</TableCell>
                <TableCell className="max-w-md truncate font-mono text-xs" title={p.message}>
                  {p.message}
                </TableCell>
                <TableCell className="text-right tabular-nums">{p.count}</TableCell>
                <TableCell className="text-right tabular-nums">{p.sessions}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {new Date(p.last_seen).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
