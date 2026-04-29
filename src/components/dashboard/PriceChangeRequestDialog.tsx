import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { invokeWithAuth } from "@/lib/sessionGuard";
import { BRAND } from "@/lib/brand";
import { Mail, Loader2 } from "lucide-react";

/**
 * Dialog für Verkäufer, um beim CaravanWert-Team eine Preisänderung
 * für ein laufendes Inserat (Auktion active/kaufchance) anzufragen.
 *
 * Nutzt die Edge Function `request-price-change`, die ownership prüft,
 * den Antrag in `price_change_requests` speichert (Tabelle hat partial
 * unique index – max 1 pending pro Inserat) und eine Admin-E-Mail
 * mit Direkt-Link sendet.
 */

export interface PriceChangeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kitchenId: string;
  saleChannel: "auction" | "instant_price" | "station" | string | null | undefined;
  /**
   * Aktueller, gueltiger Mindestpreis. Bei Live-Auktionen ist das der
   * potenziell durch Dynamic Pricing reduzierte Wert aus auctions.reserve_price.
   */
  currentReserve: number | null | undefined;
  currentInstant: number | null | undefined;
  /**
   * Optional: Der vom Verkaeufer urspruenglich eingetragene Wunsch-Mindestpreis
   * (auctions.seller_initial_reserve). Wenn vorhanden UND vom currentReserve
   * verschieden, zeigen wir beide Werte transparent an.
   */
  initialReserve?: number | null;
}

const fmtEuro = (v: number | null | undefined) =>
  v == null ? "–" : `${new Intl.NumberFormat("de-DE").format(v)} €`;

export function PriceChangeRequestDialog({
  open,
  onOpenChange,
  kitchenId,
  saleChannel,
  currentReserve,
  currentInstant,
  initialReserve,
}: PriceChangeRequestDialogProps) {
  const isInstantPrice = saleChannel === "instant_price";
  const showInstantField = isInstantPrice;
  const showReserveField = !isInstantPrice;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [requestedReserve, setRequestedReserve] = useState<string>("");
  const [requestedInstant, setRequestedInstant] = useState<string>("");
  const [reason, setReason] = useState("");

  const reset = () => {
    setRequestedReserve("");
    setRequestedInstant("");
    setReason("");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const reserveNum = requestedReserve ? Number(requestedReserve) : null;
      const instantNum = requestedInstant ? Number(requestedInstant) : null;

      if (showReserveField && (!reserveNum || reserveNum <= 0)) {
        throw new Error("Bitte geben Sie einen neuen Mindestpreis größer 0 ein.");
      }
      if (showInstantField && (!instantNum || instantNum <= 0)) {
        throw new Error("Bitte geben Sie einen neuen Sofortpreis größer 0 ein.");
      }
      if (reason.trim().length < 5) {
        throw new Error("Bitte begründen Sie Ihre Anfrage in mind. 5 Zeichen.");
      }

      const reserveUnchanged =
        showReserveField && reserveNum != null && currentReserve != null && Number(reserveNum) === Number(currentReserve);
      const instantUnchanged =
        showInstantField && instantNum != null && currentInstant != null && Number(instantNum) === Number(currentInstant);
      if (reserveUnchanged || instantUnchanged) {
        throw new Error("Der gewünschte Preis entspricht dem aktuellen Preis – bitte einen abweichenden Wert eingeben.");
      }

      // Preise duerfen nur gesenkt, nicht erhoeht werden. Der Server setzt
      // die Regel nochmals durch (request-price-change Edge Function), aber
      // so bekommt der Verkaeufer sofort eine klare Fehlermeldung.
      if (
        showReserveField &&
        reserveNum != null &&
        currentReserve != null &&
        Number(reserveNum) > Number(currentReserve)
      ) {
        throw new Error(
          `Der Mindestpreis kann nur gesenkt, nicht erhöht werden (aktuell ${fmtEuro(currentReserve)}). Für eine Erhöhung kontaktieren Sie bitte ${BRAND.supportEmail}.`,
        );
      }
      if (
        showInstantField &&
        instantNum != null &&
        currentInstant != null &&
        Number(instantNum) > Number(currentInstant)
      ) {
        throw new Error(
          `Der Sofortpreis kann nur gesenkt, nicht erhöht werden (aktuell ${fmtEuro(currentInstant)}). Für eine Erhöhung kontaktieren Sie bitte ${BRAND.supportEmail}.`,
        );
      }

      const { data, error } = await invokeWithAuth("request-price-change", {
        body: {
          kitchenId,
          requestedReserve: showReserveField ? reserveNum : null,
          requestedInstant: showInstantField ? instantNum : null,
          reason: reason.trim(),
        },
      });
      if (error) {
        const errAny = error as { context?: { body?: string }; message?: string };
        let msg = errAny?.message || "Anfrage fehlgeschlagen";
        try {
          if (errAny?.context?.body) {
            const parsed = JSON.parse(errAny.context.body) as { error?: string };
            if (parsed?.error) msg = parsed.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      return data as { ok: boolean; requestId: string; status: string };
    },
    onSuccess: () => {
      toast({
        title: "Anfrage übermittelt",
        description: "Das CaravanWert-Team hat Ihre Anfrage erhalten und meldet sich in Kürze per E-Mail.",
      });
      queryClient.invalidateQueries({ queryKey: ["pendingPriceRequest", kitchenId] });
      reset();
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const err = error as { message?: string; code?: string };
      toast({
        title: "Anfrage konnte nicht gesendet werden",
        description: err?.message || `Bitte versuchen Sie es später erneut oder schreiben Sie an ${BRAND.supportEmail}.`,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Preisanpassung anfragen
          </DialogTitle>
          <DialogDescription>
            Während die Auktion läuft, übernimmt das CaravanWert-Team die Preisanpassung. Bitte geben Sie Ihren Wunsch und einen kurzen Grund an – Sie erhalten eine Antwort per E-Mail.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          Hinweis: Der Preis kann nur <strong>gesenkt</strong> werden (AGB §6.4 c –
          Reduktionsboden-Logik). Eine Erhöhung des Mindest- oder Sofortpreises
          ist nicht möglich.
        </div>

        <div className="space-y-4">
          {showReserveField && (
            <div className="space-y-1.5">
              <Label htmlFor="pcr-reserve">
                Neuer Mindestpreis <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                <Input
                  id="pcr-reserve"
                  type="text"
                  inputMode="numeric"
                  value={requestedReserve}
                  onChange={(e) => setRequestedReserve(e.target.value.replace(/\D/g, ""))}
                  placeholder="z.B. 32000"
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Aktuell: <span className="font-medium text-foreground">{fmtEuro(currentReserve)}</span>
                {initialReserve != null && currentReserve != null && Number(initialReserve) !== Number(currentReserve) && (
                  <>
                    {" "}
                    <span className="text-muted-foreground/70">
                      (Ihr Wunsch beim Einstellen: {fmtEuro(initialReserve)} – durch automatische
                      Anpassung nach Kaufchance reduziert)
                    </span>
                  </>
                )}
              </p>
            </div>
          )}

          {showInstantField && (
            <div className="space-y-1.5">
              <Label htmlFor="pcr-instant">
                Neuer Sofortpreis <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                <Input
                  id="pcr-instant"
                  type="text"
                  inputMode="numeric"
                  value={requestedInstant}
                  onChange={(e) => setRequestedInstant(e.target.value.replace(/\D/g, ""))}
                  placeholder="z.B. 42000"
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Aktuell: <span className="font-medium text-foreground">{fmtEuro(currentInstant)}</span>
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pcr-reason">
              Begründung <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="pcr-reason"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z.B. Preisniveau am Markt hat sich verändert, ich möchte mehr/weniger Spielraum geben…"
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/1000 Zeichen – mind. 5 Zeichen.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Abbrechen
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Anfrage senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
