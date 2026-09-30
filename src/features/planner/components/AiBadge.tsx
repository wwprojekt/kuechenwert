import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Kennzeichnet ein KI-erzeugtes Bild direkt auf dem Bild, auch wenn es geteilt oder abfotografiert wird. */
export function AiBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white",
        className,
      )}
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" /> KI-Visualisierung
    </span>
  );
}
