import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withSessionRetry } from "@/lib/sessionGuard";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Euro, TrendingDown, Info } from "lucide-react";
import { MARKETING_CONFIG } from "@/lib/marketing-config";

/**
 * AdjustPriceRestartDialog
 *
 * Dialog für den "Mindestpreis anpassen und neu starten"-Pfad (Button 2 von 3
 * der Soft-Brake-Mail). Zeigt den letzten Mindest-/Sofortpreis als Default,
 * der Verkäufer kann ihn ändern — typischerweise senken (empfohlen, weil die
 * vorherige Marketing-Phase ohne Käufer endete). Dann wird der gleiche
 * seller_restart_listing RPC mit dem neuen Preis aufgerufen; der Wert wird
 * zum neuen `seller_initial_*` Anker (= Basis für zukünftige Auto-Reduktionen).
 *
 * Empfehlungslogik: Wenn das Fahrzeug bereits >=2 Marketing-Runden durchlaufen
 * hat, zeigen wir einen Hinweis, dass erfahrungsgemäß 10-15% Preisreduktion
 * den Verkauf beschleunigen. Erzwingen tun wir das nicht.
 */
export function AdjustPriceRestartDialog({
  open,
  onOpenChange,
  motorhomeId,
  motorhomeName,
  saleChannel,
  currentReservePrice,
  currentInstantPrice,
  previousAuctionRound,
  onRestarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  motorhomeId: string;
  motorhomeName: string;
  saleChannel: "auction" | "instant_price" | "station" | string | null;
  currentReservePrice: number | null;
  currentInstantPrice: number | null;
  previousAuctionRound: number | null;
  onRestarted?: (auctionId: string, endTime: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isInstantOnly = saleChannel === "instant_price";
  const currentPrice = isInstantOnly ? currentInstantPrice : currentReservePrice;

  const [newPriceInput, setNewPriceInput] = useState<string>(
    currentPrice?.toString() ?? "",
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNewPriceInput(currentPrice?.toString() ?? "");
    }
  }, [open, currentPrice]);

  const newPriceNum = newPriceInput ? Number(newPriceInput) : null;
  const priceDelta =
    currentPrice && newPriceNum ? newPriceNum - Number(currentPrice) : 0;
  const priceDeltaPct =
    currentPrice && Number(currentPrice) > 0 && newPriceNum
      ? (priceDelta / Number(currentPrice)) * 100
      : 0;
  const isReduction = priceDelta < 0;
  const isIncrease = priceDelta > 0;

  const shouldSuggestReduction =
    previousAuctionRound !== null &&
    previousAuctionRound >= 2 &&
    (!newPriceInput || Number(newPriceInput) === Number(currentPrice));

  const restartMutation = useMutation({
    mutationFn: async () => {
      if (!newPriceNum || newPriceNum <= 0) {
        throw new Error(
          isInstantOnly
            ? "Bitte geben Sie einen gültigen Sofortkauf-Preis ein."
            : "Bitte geben Sie einen gültigen Mindestpreis ein.",
        );
      }

      const { data, error } = await withSessionRetry(
        () =>
          supabase.rpc("seller_restart_listing", {
            p_motorhome_id: motorhomeId,
            p_new_reserve: isInstantOnly ? null : newPriceNum,
            p_new_instant: isInstantOnly ? newPriceNum : null,
          }),
        "adjust_price_restart_listing",
      );
      if (error) throw error;
      return data as {
        ok: boolean;
        auction_id: string;
        end_time: string;
        reserve_price: number;
        starting_bid: number;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["motorhomeDetail", motorhomeId] });
      queryClient.invalidateQueries({ queryKey: ["myListings"] });
      queryClient.invalidateQueries({ queryKey: ["motorhomeEdit", motorhomeId] });
      queryClient.invalidateQueries({ queryKey: ["motorhomeAuction", motorhomeId] });
      toast({
        title: "Inserat neu gestartet",
        description: `Neuer ${isInstantOnly ? "Sofortkauf" : "Mindest"}-Preis: €${newPriceNum!.toLocaleString("de-DE")}. Auktion endet in ${MARKETING_CONFIG.AUCTION_DURATION_DAYS} Tagen.`,
      });
      onRestarted?.(data.auction_id, data.end_time);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "Restart fehlgeschlagen",
        description:
          err?.message ||
          "Das Inserat konnte nicht neu gestartet werden.",
        variant: "destructive",
      });
    },
    onSettled: () => setSubmitting(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Euro className="w-5 h-5 text-primary" />
            Preis anpassen und neu starten
          </DialogTitle>
          <DialogDescription>
            {motorhomeName} — passen Sie den Preis an und starten Sie eine frische Marketing-Phase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Letzter Preis */}
          <div className="rounded-md border bg-muted/30 p-3 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">
              Bisheriger {isInstantOnly ? "Sofortkauf" : "Mindest"}-Preis:
            </span>
            <span className="font-semibold">
              €{Number(currentPrice ?? 0).toLocaleString("de-DE")}
            </span>
          </div>

          {/* Neuer Preis */}
          <div className="space-y-2">
            <Label htmlFor="new-price">
              Neuer {isInstantOnly ? "Sofortkauf" : "Mindest"}-Preis (€)
            </Label>
            <Input
              id="new-price"
              type="text"
              inputMode="numeric"
              value={newPriceInput}
              onChange={(e) =>
                setNewPriceInput(e.target.value.replace(/\D/g, ""))
              }
              placeholder={`z.B. ${Math.round(Number(currentPrice ?? 0) * 0.9)}`}
              autoFocus
            />
            {newPriceNum && priceDelta !== 0 && (
              <div
                className={`text-xs flex items-center gap-1 ${
                  isReduction ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {isReduction ? <TrendingDown className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                {isReduction
                  ? `Reduktion um €${Math.abs(priceDelta).toLocaleString("de-DE")} (${priceDeltaPct.toFixed(1)}%)`
                  : isIncrease
                    ? `Erhöhung um €${priceDelta.toLocaleString("de-DE")} (${priceDeltaPct.toFixed(1)}%)`
                    : null}
              </div>
            )}
          </div>

          {/* Tipp / Empfehlung */}
          {shouldSuggestReduction && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Tipp zur Preisgestaltung
                  </p>
                  <p className="text-amber-800 dark:text-amber-200 text-xs leading-relaxed">
                    Ihr Inserat war in Runde {previousAuctionRound} ohne Käufer —
                    Fahrzeuge in höheren Runden verkaufen typischerweise 10-15 %
                    unter dem bisherigen Mindestpreis. Zur Orientierung: 10 %
                    wären <strong>€{Math.round(Number(currentPrice ?? 0) * 0.9).toLocaleString("de-DE")}</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Was passiert */}
          <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Nach dem Neustart:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Neue {MARKETING_CONFIG.AUCTION_DURATION_DAYS}-Tage-Laufzeit, Runde 1</li>
              <li>Ihr neuer Preis wird zum Anker für automatische Reduktionen</li>
              <li>Alte Gebote und Kaufchance-Angebote werden zurückgesetzt</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Abbrechen
          </Button>
          <Button
            onClick={() => {
              setSubmitting(true);
              restartMutation.mutate();
            }}
            disabled={
              submitting || !newPriceNum || newPriceNum <= 0
            }
          >
            {submitting ? "Wird gestartet…" : "Mit neuem Preis starten"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
