import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type RenderPhase = "idle" | "starting" | "pending" | "ready" | "failed";

/**
 * Geschätzter Fortschritt einer Visualisierung: nähert sich 95 % (typisch
 * 20–40 s), springt bei „fertig“ auf 100 %. Ehrlicher als ein Countdown, weil
 * die tatsächliche Dauer je nach Modell und Warteschlange schwankt.
 */
export function useRenderPercent(phase: RenderPhase, startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  const running = phase === "pending" || phase === "starting";
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [running]);
  if (phase === "ready") return 100;
  if (!running || !startedAt) return 0;
  const seconds = Math.max(0, (now - startedAt) / 1000);
  return Math.min(95, Math.round(100 * (1 - Math.exp(-seconds / 16))));
}

/** Kleiner Status über den Lead-Fragen, damit klar ist: Die Küche entsteht gerade. */
export function RenderStatusChip({ phase, percent }: { phase: RenderPhase; percent: number }) {
  if (phase === "idle") return null;
  const ready = phase === "ready";
  const failed = phase === "failed";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "mb-3 flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-medium short:mb-2 short:py-1.5 xshort:py-1 xshort:text-[13px]",
        ready ? "border-success/30 bg-success/5 text-success" : failed ? "border-border bg-muted/60 text-muted-foreground" : "border-primary/20 bg-primary/5 text-foreground",
      )}
    >
      {ready ? (
        <CheckCircle2 className="h-4 w-4 flex-none" aria-hidden="true" />
      ) : failed ? (
        <Sparkles className="h-4 w-4 flex-none" aria-hidden="true" />
      ) : (
        <Loader2 className="h-4 w-4 flex-none animate-spin text-primary" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate">
        {ready
          ? "Ihre Küche ist fertig – nur noch ein kurzer Schritt"
          : failed
            ? "Visualisierung gerade nicht möglich – Preis & Angebote gibt es trotzdem"
            : "Ihre Küche wird gerade visualisiert …"}
      </span>
      {!ready && !failed && <span className="flex-none tabular-nums text-primary">{percent} %</span>}
    </div>
  );
}
