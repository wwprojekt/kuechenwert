import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, SessionExpiredError } from "@/lib/sessionGuard";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Mail, MapPin, AlertTriangle } from "lucide-react";

interface Auction {
  id: string;
  status: string;
  starting_bid: number;
  current_bid: number | null;
  reserve_price: number | null;
  end_time: string | null;
  motorhome_id?: string;
  motorhome?: {
    id?: string;
    manufacturer?: string;
    model?: string;
    postal_code?: string | null;
    city?: string | null;
    seller?: {
      email?: string;
      first_name?: string;
      last_name?: string;
    };
  };
}

interface AuctionEditDialogProps {
  auction: Auction | null;
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

/**
 * Helper: Send registration invite to seller when auction is activated.
 * Non-blocking – errors are logged but don't prevent the status update.
 */
async function sendRegistrationInviteOnActivation(motorhomeId: string) {
  try {
    const { data: motorhome, error: mhError } = await supabase
      .from("motorhomes")
      .select("id, manufacturer, model, seller_id, seller:profiles!left(id, email, first_name, last_name)")
      .eq("id", motorhomeId)
      .maybeSingle();

    if (mhError || !motorhome) {
      logger.warn("Could not load motorhome for invite check:", mhError?.message);
      return;
    }

    const seller = motorhome.seller as any;
    if (!seller?.email) {
      logger.info("No seller email found, skipping invite");
      return;
    }

    const customerName = [seller.first_name, seller.last_name].filter(Boolean).join(" ");
    const { data, error } = await supabase.functions.invoke("send-registration-invite", {
      body: {
        email: seller.email,
        customerName: customerName || undefined,
        motorhomeId: motorhome.id,
      },
    });

    if (error || data?.error) {
      logger.error("Failed to send registration invite:", error?.message || data?.error);
      toast.info(
        `Auktion aktiviert. Registrierungslink an ${seller.email} konnte nicht automatisch gesendet werden.`,
        { duration: 6000 }
      );
      return;
    }

    toast.success(
      `Registrierungslink automatisch an ${seller.email} gesendet`,
      { duration: 5000 }
    );
  } catch (err: any) {
    logger.error("Error in sendRegistrationInviteOnActivation:", err);
  }
}

/**
 * Helper: Send relist notification to seller when auction is re-activated (ended/cancelled -> active).
 * Non-blocking – errors are logged but don't prevent the status update.
 */
async function sendRelistNotificationFromDialog(motorhomeId: string) {
  try {
    const { data: motorhome, error: mhError } = await supabase
      .from("motorhomes")
      .select("id, manufacturer, model, seller_id, seller:profiles!left(id, email, first_name, last_name, customer_number)")
      .eq("id", motorhomeId)
      .maybeSingle();

    if (mhError || !motorhome) {
      logger.warn("Could not load motorhome for relist notification:", mhError?.message);
      return;
    }

    const seller = motorhome.seller as any;
    if (!seller?.email) {
      logger.info("No seller email found, skipping relist notification");
      return;
    }

    const sellerName = [seller.first_name, seller.last_name].filter(Boolean).join(" ") || "";
    const vehicleName = [motorhome.manufacturer, motorhome.model].filter(Boolean).join(" ") || "Ihr Fahrzeug";
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + 7);
    const formattedEndTime = format(endTime, "dd.MM.yyyy HH:mm", { locale: de });

    const { data, error } = await invokeWithAuth("send-auction-notification", {
      body: {
        email: seller.email,
        name: sellerName,
        type: "seller_relisted",
        motorhomeModel: vehicleName,
        auctionUrl: "https://caravanwert.de/dashboard",
        endTime: formattedEndTime,
        customerNumber: seller.customer_number || undefined,
      },
    });

    if (error || data?.error) {
      logger.error("Failed to send relist notification:", error?.message || data?.error);
      toast.info(
        `Auktion erneut gestartet. Benachrichtigung an ${seller.email} konnte nicht gesendet werden.`,
        { duration: 6000 }
      );
      return;
    }

    toast.success(
      `Verk\u00e4ufer ${seller.email} wurde \u00fcber die erneute Auktion informiert`,
      { duration: 5000 }
    );
  } catch (err: any) {
    logger.error("Error in sendRelistNotificationFromDialog:", err);
  }
}

export function AuctionEditDialog({
  auction,
  open,
  isOpen,
  onOpenChange,
  onClose,
}: AuctionEditDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    status: "",
    starting_bid: "",
    reserve_price: "",
    end_time: "",
    postal_code: "",
    city: "",
  });

  // Support both open/onOpenChange and isOpen/onClose prop patterns
  const dialogOpen = open ?? isOpen ?? false;
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) onOpenChange(newOpen);
    if (!newOpen && onClose) onClose();
  };

  // Reset form when auction changes
  useEffect(() => {
    if (auction) {
      setFormData({
        status: auction.status || "",
        starting_bid: auction.starting_bid?.toString() || "",
        reserve_price: auction.reserve_price?.toString() || "",
        end_time: auction.end_time
          ? format(new Date(auction.end_time), "yyyy-MM-dd'T'HH:mm")
          : "",
        postal_code: auction.motorhome?.postal_code || "",
        city: auction.motorhome?.city || "",
      });
    }
  }, [auction]);

  const updateMutation = useMutation({
    mutationFn: async (data: {
      status: string;
      starting_bid: number;
      reserve_price: number | null;
      end_time: string | null;
      previousStatus: string;
      postal_code: string;
      city: string;
    }) => {
      // Save location to motorhome if provided
      const motorhomeId = auction?.motorhome_id || auction?.motorhome?.id;
      if (motorhomeId && (data.postal_code || data.city)) {
        const locationUpdate: any = {};
        if (data.postal_code) locationUpdate.postal_code = data.postal_code;
        if (data.city) locationUpdate.city = data.city;

        const { error: mhError } = await supabase
          .from("motorhomes")
          .update(locationUpdate)
          .eq("id", motorhomeId);

        if (mhError) {
          logger.error("Failed to update motorhome location:", mhError);
        }
      }

      const updateData: any = {
        status: data.status,
        starting_bid: data.starting_bid,
        reserve_price: data.reserve_price,
        end_time: data.end_time,
      };

      // If activating the auction, also set start_time and end_time (7 days)
      if (data.previousStatus !== "active" && data.status === "active") {
        updateData.start_time = new Date().toISOString();
        if (!data.end_time) {
          const endTime = new Date();
          endTime.setDate(endTime.getDate() + 7);
          updateData.end_time = endTime.toISOString();
        }
      }

      const { error } = await supabase
        .from("auctions")
        .update(updateData)
        .eq("id", auction!.id);

      if (error) throw error;

      return {
        previousStatus: data.previousStatus,
        newStatus: data.status,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
      queryClient.invalidateQueries({ queryKey: ["adminMotorhomes"] });
      toast.success("Auktion erfolgreich aktualisiert");
      handleOpenChange(false);

      // If status changed to "active", send appropriate notification
      if (result.previousStatus !== "active" && result.newStatus === "active") {
        const motorhomeId = auction?.motorhome_id || auction?.motorhome?.id;
        if (motorhomeId) {
          if (result.previousStatus === "ended" || result.previousStatus === "cancelled") {
            // Relist: Send info email instead of registration invite
            sendRelistNotificationFromDialog(motorhomeId);
          } else {
            // First activation (draft -> active): Send registration invite
            sendRegistrationInviteOnActivation(motorhomeId);
          }
        }
      }
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const startingBid = parseFloat(formData.starting_bid);
    if (isNaN(startingBid) || startingBid < 0) {
      toast.error("Bitte geben Sie ein gültiges Startgebot ein");
      return;
    }

    const reservePrice = formData.reserve_price
      ? parseFloat(formData.reserve_price)
      : null;
    if (reservePrice !== null && isNaN(reservePrice)) {
      toast.error("Bitte geben Sie einen gültigen Mindestpreis ein");
      return;
    }

    // CRITICAL: Validate reserve price when activating - prevents selling below minimum
    const isActivating = auction?.status !== "active" && formData.status === "active";
    if (isActivating && (!reservePrice || reservePrice <= 0)) {
      toast.error("Bitte geben Sie einen Mindestpreis (Reservepreis) ein, bevor Sie die Auktion aktivieren. Ohne Mindestpreis wird das Fahrzeug zum niedrigsten Gebot verkauft!");
      return;
    }
    // Validate postal code when activating
    if (isActivating && !formData.postal_code.trim()) {
      toast.error("Bitte geben Sie die PLZ des Fahrzeugstandorts ein, bevor Sie die Auktion aktivieren");
      return;
    }

    // Validate PLZ format (EU-weit: 3-10 alphanumerische Zeichen, Leerzeichen/Bindestriche erlaubt)
    if (formData.postal_code.trim() && !/^[A-Za-z0-9][A-Za-z0-9\s\-]{1,9}$/.test(formData.postal_code.trim())) {
      toast.error("Bitte geben Sie eine gültige Postleitzahl ein (3-10 Zeichen)");
      return;
    }

    const endTime = formData.end_time
      ? new Date(formData.end_time).toISOString()
      : null;

    updateMutation.mutate({
      status: formData.status,
      starting_bid: startingBid,
      reserve_price: reservePrice,
      end_time: endTime,
      previousStatus: auction?.status || "",
      postal_code: formData.postal_code.trim(),
      city: formData.city.trim(),
    });
  };

  if (!auction) return null;

  // Check if status is being changed to active (for the info message)
  const isActivating = auction.status !== "active" && formData.status === "active";
  const sellerEmail = auction.motorhome?.seller?.email;
  const missingLocation = isActivating && !formData.postal_code.trim();

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Auktion bearbeiten</DialogTitle>
          <DialogDescription>
            {auction.motorhome?.manufacturer} {auction.motorhome?.model}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, status: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Status wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Entwurf</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="ended">Beendet (Nicht verkauft)</SelectItem>
                <SelectItem value="sold">Verkauft</SelectItem>
                <SelectItem value="cancelled">Abgebrochen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location fields - required before activation */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="w-4 h-4 text-primary" />
              Fahrzeugstandort
              {isActivating && <span className="text-destructive text-xs">(Pflichtfeld)</span>}
            </div>
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="postal_code" className="text-xs">PLZ *</Label>
                <Input
                  id="postal_code"
                  value={formData.postal_code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, postal_code: e.target.value }))
                  }
                  placeholder="z.B. 80331"
                  maxLength={10}
                  className={missingLocation ? "border-destructive" : ""}
                />
              </div>
              <div className="col-span-3 space-y-1">
                <Label htmlFor="city" className="text-xs">Stadt</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, city: e.target.value }))
                  }
                  placeholder="z.B. München"
                />
              </div>
            </div>
            {missingLocation && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="w-3 h-3" />
                PLZ muss vor Aktivierung eingetragen werden
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Händler sehen nur die ersten 2 Ziffern der PLZ (z.B. &quot;80xxx&quot;) und die ungefähre Entfernung.
            </p>
          </div>

          {/* Info: Registration invite will be sent automatically */}
          {isActivating && sellerEmail && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <Mail className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-800 dark:text-blue-200">
                Ein Registrierungslink wird automatisch an <strong>{sellerEmail}</strong> gesendet, sobald die Auktion aktiviert wird.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="starting_bid">Startgebot (€)</Label>
            <Input
              id="starting_bid"
              type="number"
              min="0"
              step="1"
              value={formData.starting_bid}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, starting_bid: e.target.value }))
              }
              placeholder="50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reserve_price">Mindestpreis (€)</Label>
            <Input
              id="reserve_price"
              type="number"
              min="0"
              step="1"
              value={formData.reserve_price}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, reserve_price: e.target.value }))
              }
              placeholder="Optional"
            />
            <p className="text-xs text-muted-foreground">
              Aktuelles Gebot: €{(auction.current_bid || auction.starting_bid).toLocaleString()}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="end_time">Enddatum</Label>
            <Input
              id="end_time"
              type="datetime-local"
              value={formData.end_time}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, end_time: e.target.value }))
              }
            />
            {isActivating && !formData.end_time && (
              <p className="text-xs text-muted-foreground">
                Wird automatisch auf 7 Tage ab jetzt gesetzt
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
