import type { AccuracySummary } from "../../../supabase/functions/_shared/price-accuracy.ts";
import type { CalibrationRun } from "./api";

const pct = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v * 100)} %`);

function Kpi({ label, summary }: { label: string; summary: AccuracySummary | undefined }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{summary?.n ? `± ${pct(summary.mdape)}` : "–"}</p>
      <p className="text-xs text-muted-foreground">
        {summary?.n ? `${pct(summary.coverage)} der Angebote in der Spanne · ${summary.n} Ausschreibungen` : "noch keine Daten"}
      </p>
    </div>
  );
}

function biasText(bias: number | null | undefined): string | null {
  if (bias == null || Math.abs(bias) < 0.02) return null;
  return `Die Schätzungen liegen im Mittel ${pct(Math.abs(bias))} ${bias > 0 ? "unter" : "über"} dem Angebotsmedian der Studios.`;
}

/** Wie gut trifft die Schätzung die Studio-Angebote? Maßgeblich ist die Schätzung, die Kund:innen gesehen haben. */
export function PriceAccuracy({ run }: { run: CalibrationRun | undefined }) {
  const { shown, raw, calibrated } = run?.accuracy ?? {};
  if (!raw?.n) {
    return (
      <p className="text-sm text-muted-foreground">
        Die Treffsicherheit erscheint mit den ersten Studio-Angeboten: wie weit die Schätzungen daneben lagen und wie oft die Angebote in
        der angezeigten Spanne lagen.
      </p>
    );
  }
  const bias = biasText(shown?.n ? shown.bias : raw.bias);
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Angezeigte Schätzung" summary={shown} />
        <Kpi label="Engine ohne Abgleich" summary={raw} />
        <Kpi label="Engine mit Abgleich" summary={calibrated} />
      </div>
      {bias && <p className="text-sm">{bias}</p>}
      <p className="text-xs text-muted-foreground">
        ± = mittlere Abweichung (Median) zwischen Schätzung und Angebotsmedian. Die Engine-Werte sind an denselben Ausschreibungen gelernt
        und fallen deshalb etwas zu gut aus; ehrlich ist die Schätzung, die Kund:innen bei der Anfrage gesehen haben.
      </p>
    </div>
  );
}
