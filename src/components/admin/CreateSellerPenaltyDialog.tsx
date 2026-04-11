/**
 * Create Seller Penalty Invoice Dialog
 * Admin can issue a Vertragsstrafe (€399 inkl. MwSt) to a seller
 * for AGB violations: anderweitiger Verkauf, vorzeitige Rücknahme, falsche Angaben
 */

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Scale } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const penaltyReasons = [
  {
    value: "anderweitiger_verkauf",
    label: "Anderweitiger Verkauf während Auktion",
    description:
      "Fahrzeug wurde während laufender Auktion oder Nachverhandlung anderweitig verkauft",
  },
  {
    value: "vorzeitige_ruecknahme",
    label: "Vorzeitige Rücknahme des Fahrzeugs",
    description:
      "Fahrzeug wurde ohne berechtigten Grund von der Auktion zurückgezogen",
  },
  {
    value: "falsche_angaben",
    label: "Falsche/irreführende Angaben",
    description:
      "Wesentlich unzutreffende Angaben zu Zustand, Historie, Ausstattung oder Mängeln",
  },
] as const;

interface CreateSellerPenaltyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected seller ID (e.g. from auction detail) */
  preSelectedSellerId?: string;
  /** Pre-selected auction ID */
  preSelectedAuctionId?: string;
  /** Pre-selected motorhome ID */
  preSelectedMotorhomeId?: string;
}

export function CreateSellerPenaltyDialog({
  open,
  onOpenChange,
  preSelectedSellerId,
  preSelectedAuctionId,
  preSelectedMotorhomeId,
}: CreateSellerPenaltyDialogProps) {
  const queryClient = useQueryClient();

  const [sellerId, setSellerId] = useState(preSelectedSellerId || "");
  const [auctionId, setAuctionId] = useState(preSelectedAuctionId || "");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSellerId(preSelectedSellerId || "");
      setAuctionId(preSelectedAuctionId || "");
      setReason("");
      setNotes("");
    }
  }, [open, preSelectedSellerId, preSelectedAuctionId]);

  // Fetch sellers (profiles with motorhomes)
  const { data: sellers } = useQuery({
    queryKey: ["admin-sellers-for-penalty"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, company_name")
        .order("last_name");
      if (error) throw error;
      return data;
    },
    enabled: open && !preSelectedSellerId,
  });

  // Fetch auctions for selected seller
  const { data: sellerAuctions } = useQuery({
    queryKey: ["admin-seller-auctions", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auctions")
        .select(
          "id, status, motorhome:motorhomes(id, manufacturer, model, year)"
        )
        .eq("motorhome.seller_id", sellerId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      // Filter out auctions where motorhome join returned null
      return data?.filter((a: any) => a.motorhome) || [];
    },
    enabled: open && !!sellerId && !preSelectedAuctionId,
  });

  // Get selected seller display name
  const selectedSeller = sellers?.find((s) => s.id === sellerId);
  const sellerDisplayName = preSelectedSellerId
    ? undefined // Will be shown from parent context
    : selectedSeller
      ? selectedSeller.company_name ||
        `${selectedSeller.first_name || ""} ${selectedSeller.last_name || ""}`.trim() ||
        selectedSeller.email
      : null;

  const createPenaltyMutation = useMutation({
    mutationFn: async () => {
      if (!sellerId || !reason) {
        throw new Error("Verkäufer und Grund sind erforderlich");
      }

      const effectiveAuctionId = auctionId && auctionId !== "none" ? auctionId : undefined;

      // Resolve motorhome_id from auction if not pre-selected
      let effectiveMotorhomeId = preSelectedMotorhomeId || undefined;
      if (!effectiveMotorhomeId && effectiveAuctionId) {
        const selected = sellerAuctions?.find((a: any) => a.id === effectiveAuctionId);
        if (selected?.motorhome?.id) {
          effectiveMotorhomeId = selected.motorhome.id;
        }
      }

      const { data, error } = await supabase.rpc(
        "create_seller_penalty_invoice",
        {
          seller_id_param: sellerId,
          auction_id_param: effectiveAuctionId,
          motorhome_id_param: effectiveMotorhomeId,
          penalty_reason_param: reason,
          notes_param: notes || undefined,
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["financial-stats"] });

      toast.success("Vertragsstrafe erstellt", {
        description:
          "Strafrechnung über 399,00 € wurde erfolgreich angelegt.",
      });

      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Fehler beim Erstellen der Vertragsstrafe", {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPenaltyMutation.mutate();
  };

  const selectedReason = penaltyReasons.find((r) => r.value === reason);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-destructive" />
            Vertragsstrafe erstellen
          </DialogTitle>
          <DialogDescription>
            Erstellt eine Strafrechnung über 399,00 € inkl. MwSt. gemäß § 8
            Abs. 4 AGB
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Amount info */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Netto</p>
              <p className="text-lg font-bold">335,29 €</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">19% MwSt.</p>
              <p className="text-lg font-bold">63,71 €</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Brutto</p>
              <p className="text-lg font-bold text-destructive">399,00 €</p>
            </div>
          </div>

          {/* Seller selection */}
          {!preSelectedSellerId ? (
            <div className="space-y-2">
              <Label htmlFor="seller">Verkäufer *</Label>
              <Select value={sellerId} onValueChange={setSellerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Verkäufer auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {sellers?.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.company_name ||
                        `${seller.first_name || ""} ${seller.last_name || ""}`.trim() ||
                        seller.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            sellerDisplayName && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Label className="text-muted-foreground">Verkäufer:</Label>
                <span className="font-medium">{sellerDisplayName}</span>
              </div>
            )
          )}

          {/* Auction selection (optional) */}
          {!preSelectedAuctionId && sellerId && (
            <div className="space-y-2">
              <Label htmlFor="auction">
                Zugehörige Auktion{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Select
                value={auctionId}
                onValueChange={setAuctionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auktion zuordnen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Keine Zuordnung —</SelectItem>
                  {sellerAuctions?.map((auction: any) => (
                    <SelectItem key={auction.id} value={auction.id}>
                      {auction.motorhome?.manufacturer}{" "}
                      {auction.motorhome?.model}{" "}
                      {auction.motorhome?.year
                        ? `(${auction.motorhome.year})`
                        : ""}{" "}
                      –{" "}
                      <Badge variant="outline" className="ml-1">
                        {auction.status}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Penalty reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Grund der Vertragsstrafe *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Grund auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {penaltyReasons.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedReason && (
              <p className="text-xs text-muted-foreground">
                {selectedReason.description}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Interne Notizen{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Informationen zum Sachverhalt..."
              rows={3}
            />
          </div>

          {/* Warning */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Es wird eine rechtsverbindliche Rechnung über{" "}
              <strong>399,00 €</strong> erstellt und dem Verkäufer zugeordnet.
              Die Rechnung wird als Entwurf angelegt und kann über die
              Finanzübersicht versendet werden.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={
                createPenaltyMutation.isPending || !sellerId || !reason
              }
            >
              {createPenaltyMutation.isPending
                ? "Wird erstellt..."
                : "Vertragsstrafe erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateSellerPenaltyDialog;
