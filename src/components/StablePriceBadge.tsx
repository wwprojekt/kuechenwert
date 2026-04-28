import { ShieldCheck } from "lucide-react";
import { differenceInDays } from "date-fns";
import { MARKETING_CONFIG } from "@/lib/marketing-config";

interface StablePriceBadgeProps {
  /**
   * Zeitpunkt der letzten dynamischen Preissenkung (auctions.last_price_reduction_at).
   * Wenn null/undefined, gilt das Inserat seit Marketing-Phasen-Start als stabil.
   */
  lastPriceReductionAt?: string | null;
  /** Marketing-Phase-Start (auctions.marketing_phase_started_at). */
  marketingPhaseStartedAt?: string | null;
  /** Fallback wenn marketing_phase_started_at null ist (Bestand-Inserate). */
  fallbackAnchor?: string | null;
  /** Optional: visuelle Variante. Default: "inline" (kompakt, neben Preis). */
  variant?: "inline" | "compact";
  className?: string;
}

/**
 * P4.2/P4.3: "Stabil seit X Tagen" Badge.
 *
 * Erscheint im Käufer-View (AuctionDetail, KitchenCard), sobald der Mindest-/
 * Festpreis seit mindestens MARKETING_CONFIG.STABLE_PRICE_BADGE_AFTER_DAYS
 * (7 Tage) NICHT mehr automatisch gesenkt wurde. Soll Vertrauen signalisieren
 * ("seriöses Angebot, kein Verramsch-Inserat") OHNE den Käufer zum Warten zu
 * verleiten.
 *
 * Wir verraten dem Käufer hier ABSICHTLICH NICHT, ob das Inserat überhaupt
 * dynamic_pricing aktiv hat oder ob der Floor schon erreicht ist — sonst kann
 * man Bid-Strategien daraus ableiten.
 */
export function StablePriceBadge({
  lastPriceReductionAt,
  marketingPhaseStartedAt,
  fallbackAnchor,
  variant = "inline",
  className,
}: StablePriceBadgeProps) {
  // Anker = letzte Reduktion ODER Marketing-Phasen-Start ODER Fallback (created_at)
  const anchorIso = lastPriceReductionAt ?? marketingPhaseStartedAt ?? fallbackAnchor ?? null;
  if (!anchorIso) return null;

  const anchor = new Date(anchorIso);
  if (Number.isNaN(anchor.getTime())) return null;

  const days = differenceInDays(new Date(), anchor);
  if (days < MARKETING_CONFIG.STABLE_PRICE_BADGE_AFTER_DAYS) return null;

  const label = `Preis stabil seit ${days} Tagen`;
  const baseStyle =
    variant === "compact"
      ? "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
      : "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800";

  return (
    <span className={`${baseStyle} ${className ?? ""}`} title="Dieses Angebot ist seit längerer Zeit zum gleichen Preis verfügbar">
      <ShieldCheck className={variant === "compact" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {label}
    </span>
  );
}
