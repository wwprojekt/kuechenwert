import { cn } from "@/lib/utils";

/**
 * Fortschritt in Prozent mit Vorsprung (wie im CaravanWert-Wizard): Der erste
 * Schritt zeigt 10 %, der letzte 95 %, denn fertig ist die Anfrage erst mit
 * dem Absenden. Bei vielen Schritten wirkt das weniger abschreckend als
 * „Schritt 2 / 18“; die Schrittzahl bleibt für Screenreader erhalten.
 */
export function funnelProgressPercent(current: number, total: number): number {
  if (total <= 1) return 95;
  const clamped = Math.min(Math.max(current, 0), total - 1);
  return Math.round(10 + (85 * clamped) / (total - 1));
}

/** Nur Balken und Prozentzahl: keine Schrittnamen, keine Schrittzählung im Bild. */
export function FunnelProgress({
  current,
  total,
  percent = funnelProgressPercent(current, total),
  className,
}: {
  current: number;
  total: number;
  percent?: number;
  className?: string;
}) {
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${value} % geschafft, Schritt ${current + 1} von ${total}`}
        aria-label="Fortschritt"
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${value}%` }}
        />
      </div>
      <span aria-hidden="true" className="min-w-[2.75rem] text-right text-xs font-bold tabular-nums text-brand-700">
        {value} %
      </span>
    </div>
  );
}
