import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

interface Auction {
  id: string;
  status: string;
  starting_bid: number;
  current_bid: number | null;
  reserve_price: number | null;
  end_time: string | null;
  motorhome?: {
    manufacturer?: string;
    model?: string;
  };
}

interface AuctionEditDialogProps {
  auction: Auction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuctionEditDialog({
  auction,
  open,
  onOpenChange,
}: AuctionEditDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    status: "",
    starting_bid: "",
    reserve_price: "",
    end_time: "",
  });

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
      });
    }
  }, [auction]);

  const updateMutation = useMutation({
    mutationFn: async (data: {
      status: string;
      starting_bid: number;
      reserve_price: number | null;
      end_time: string | null;
    }) => {
      const { error } = await supabase
        .from("auctions")
        .update({
          status: data.status,
          starting_bid: data.starting_bid,
          reserve_price: data.reserve_price,
          end_time: data.end_time,
        })
        .eq("id", auction!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
      toast.success("Auktion erfolgreich aktualisiert");
      onOpenChange(false);
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

    const endTime = formData.end_time
      ? new Date(formData.end_time).toISOString()
      : null;

    updateMutation.mutate({
      status: formData.status,
      starting_bid: startingBid,
      reserve_price: reservePrice,
      end_time: endTime,
    });
  };

  if (!auction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
