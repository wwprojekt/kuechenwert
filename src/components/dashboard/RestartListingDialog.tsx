import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withSessionRetry } from "@/lib/sessionGuard";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RotateCw, CalendarClock } from "lucide-react";
import { MARKETING_CONFIG } from "@/lib/marketing-config";
import { format } from "date-fns";
import { de } from "date-fns/locale";

/**
 * RestartListingDialog
 *
 * Dialog für den "Erneut starten"-Pfad der Soft-Brake-Mail
 * (Button 1 von 3). Rufst den RPC `seller_restart_listing` OHNE Preis-
 * Parameter — der bestehende Reserve/Instant-Preis wird übernommen. Es wird
 * eine frische Marketing-Phase angelegt (Runde 1, 3 Tage Laufzeit, 16/30
 * Tage Cap). Alle alten Bids/Kaufchance-Invitations/Post-Auction-Offers
 * werden gelöscht; die Auktions-Row selbst bleibt bestehen (gleiche ID,
 * reset auf status='active').
 *
 * Verwendung: triggert durch URL-Query `?action=restart` aus der
 * seller_soft_brake Mail ODER durch einen direkten Button im Dashboard
 * wenn die Auktion ended/cancelled ist.
 */
export function RestartListingDialog({
  open,
  onOpenChange,
  motorhomeId,
  motorhomeName,
  saleChannel,
  currentReservePrice,
  currentInstantPrice,
  onRestarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  motorhomeId: string;
  motorhomeName: string;
  saleChannel: "auction" | "instant_price" | "station" | string | null;
  currentReservePrice: number | null;
  currentInstantPrice: number | null;
  onRestarted?: (auctionId: string, endTime: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const isInstantOnly = saleChannel === "instant_price";
  const effectivePrice = isInstantOnly
    ? currentInstantPrice
    : currentReservePrice;

  const restartMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await withSessionRetry(
        () =>
          supabase.rpc("seller_restart_listing", {
            p_motorhome_id: motorhomeId,
            p_new_reserve: null,
            p_new_instant: null,
          }),
        "restart_listing",
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
      toast({
        title: "Inserat neu gestartet",
        description: `Die Auktion läuft nun ${MARKETING_CONFIG.AUCTION_DURATION_DAYS} Tage, endet am ${format(new Date(data.end_time), "dd.MM.yyyy HH:mm", { locale: de })}.`,
      });
      onRestarted?.(data.auction_id, data.end_time);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "Restart fehlgeschlagen",
        description:
          err?.message ||
          "Das Inserat konnte nicht neu gestartet werden. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.",
        variant: "destructive",
      });
    },
    onSettled: () => setSubmitting(false),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RotateCw className="w-5 h-5 text-primary" />
            Inserat neu starten
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="text-sm">
                <strong>{motorhomeName}</strong> wird mit einer frischen Marketing-Phase neu eingestellt.
              </p>
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <CalendarClock className="w-4 h-4" />
                  Was passiert jetzt?
                </div>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li>Neue {MARKETING_CONFIG.AUCTION_DURATION_DAYS}-Tage-Auktion, Zähler zurück auf Runde 1</li>
                  <li>
                    {isInstantOnly ? "Sofortkauf-Preis" : "Mindestpreis"}:{" "}
                    <span className="font-semibold text-foreground">
                      €{Number(effectivePrice ?? 0).toLocaleString("de-DE")}
                    </span>{" "}
                    (bleibt unverändert)
                  </li>
                  <li>Frische Marketing-Phase: bis zu {isInstantOnly ? MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_DAYS : 16} Tage</li>
                  <li>Automatische Wiedereinstellung aktiviert</li>
                  <li>Alte Gebote und Kaufchance-Angebote werden zurückgesetzt</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                Möchten Sie stattdessen den Preis anpassen? Schließen Sie diesen Dialog und nutzen Sie „Preis anpassen und neu starten".
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              setSubmitting(true);
              restartMutation.mutate();
            }}
            disabled={submitting || !effectivePrice || effectivePrice <= 0}
          >
            {submitting ? "Wird gestartet…" : "Jetzt neu starten"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
