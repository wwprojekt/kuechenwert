import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AuctionRoundBadgeProps {
  /**
   * `auctions.auction_round` aus der DB. Wird beim Auto-Relist nach erfolgloser
   * Kaufchance hochgezählt (siehe `close-auction` Edge Function) sowie bei
   * manuellem Admin-Relist (siehe `AdminAuctions.tsx` `relistAuctionMutation`).
   * Default in der DB ist 1.
   */
  round: number | null | undefined;
  className?: string;
}

/**
 * Händler-/Admin-Hinweis: Wievielten Anlauf nimmt diese Auktion?
 *
 * Farb-Eskalation (je höher die Runde, desto mehr Verkaufsdruck):
 *   Runde 1   → grün  „Neu"
 *   Runde 2   → gelb  „2. Runde"
 *   Runde 3   → dunkelorange „3. Runde"
 *   Runde ≥4  → rot   „4. Runde" (oder höhere Zahl)
 *
 * Sichtbarkeits-Gating (Händler/Admin only) erfolgt am Aufrufort, nicht hier —
 * die Komponente ist neutral wiederverwendbar.
 */
export function AuctionRoundBadge({ round, className }: AuctionRoundBadgeProps) {
  const safeRound =
    typeof round === "number" && Number.isFinite(round) && round > 0
      ? Math.floor(round)
      : 1;

  let label: string;
  let tone: string;

  // Tones bewusst eine Stufe dunkler als „intuitiv" gewählt, damit weißer
  // Text auf der Füllung WCAG-AA-Kontrast (≥4.5:1) bei text-[10px] erreicht.
  // Yellow ist die Ausnahme: bleibt yellow-400 mit dunkler Schrift, weil
  // ein dunkleres Gelb visuell zu Senf/Olive driften würde.
  if (safeRound <= 1) {
    label = "Neu";
    tone = "bg-emerald-600 text-white border-emerald-700";
  } else if (safeRound === 2) {
    label = "2. Runde";
    tone = "bg-yellow-400 text-yellow-950 border-yellow-500";
  } else if (safeRound === 3) {
    label = "3. Runde";
    tone = "bg-orange-700 text-white border-orange-800";
  } else {
    label = `${safeRound}. Runde`;
    tone = "bg-red-700 text-white border-red-800";
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-semibold px-1.5 py-0 leading-none",
        tone,
        className,
      )}
    >
      {label}
    </Badge>
  );
}
