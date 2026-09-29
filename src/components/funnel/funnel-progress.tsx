/**
 * Fortschritt in Prozent mit Vorsprung (wie im CaravanWert-Wizard): Der erste
 * Schritt zeigt 10 %, der letzte 95 %, denn fertig ist die Anfrage erst mit
 * dem Absenden. Bei vielen Schritten wirkt das weniger abschreckend als
 * „Schritt 2 / 18“; die Schrittzahl bleibt für Screenreader erhalten.
 */
function funnelProgressPercent(current: number, total: number): number {
  if (total <= 1) return 95;
  const clamped = Math.min(Math.max(current, 0), total - 1);
  return Math.round(10 + (85 * clamped) / (total - 1));
}

export function FunnelProgress({ label, current, total }: { label: string; current: number; total: number }) {
  const percent = funnelProgressPercent(current, total);
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-brand-700">
          {percent} %<span className="sr-only"> geschafft, Schritt {current + 1} von {total}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuetext={`Schritt ${current + 1} von ${total}`}
        aria-label="Fortschritt"
        className="h-[3px] w-full overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
