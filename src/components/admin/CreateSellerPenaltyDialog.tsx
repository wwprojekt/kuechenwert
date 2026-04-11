/**
 * Create Seller Penalty Invoice Dialog
 * Admin can issue a Vertragsstrafe (€399 inkl. MwSt) to a seller
 * for AGB violations: anderweitiger Verkauf, vorzeitige Rücknahme, falsche Angaben
 */

import { useState, useEffect, useMemo } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronsUpDown, Scale } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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

const AUCTION_STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  ended: "Beendet",
  sold: "Verkauft",
  cancelled: "Abgebrochen",
  draft: "Entwurf",
  kaufchance: "Kaufchance",
};

interface CreateSellerPenaltyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedSellerId?: string;
  preSelectedAuctionId?: string;
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
  const [sellerSearchOpen, setSellerSearchOpen] = useState(false);
  const [sellerSearchQuery, setSellerSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      setSellerId(preSelectedSellerId || "");
      setAuctionId(preSelectedAuctionId || "");
      setReason("");
      setNotes("");
      setSellerSearchQuery("");
    }
  }, [open, preSelectedSellerId, preSelectedAuctionId]);

  // Server-side seller search with ilike (debounced by React Query staleTime)
  const { data: sellers, isLoading: sellersLoading } = useQuery({
    queryKey: ["admin-sellers-for-penalty", sellerSearchQuery],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, first_name, last_name, email, company_name")
        .order("last_name")
        .limit(50);

      if (sellerSearchQuery.length >= 2) {
        const q = `%${sellerSearchQuery}%`;
        query = query.or(
          `first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q},company_name.ilike.${q}`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open && !preSelectedSellerId,
    staleTime: 300,
  });

  // Fetch the pre-selected seller's profile so we can show their name
  const { data: preSelectedSeller } = useQuery({
    queryKey: ["admin-seller-profile", preSelectedSellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, company_name")
        .eq("id", preSelectedSellerId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!preSelectedSellerId,
  });

  // Fetch auctions for selected seller using !inner join so PostgREST
  // filters parent rows (auctions) by the embedded motorhome's seller_id
  const { data: sellerAuctions } = useQuery({
    queryKey: ["admin-seller-auctions", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auctions")
        .select(
          "id, status, motorhome:motorhomes!inner(id, manufacturer, model, year, seller_id)"
        )
        .eq("motorhome.seller_id", sellerId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!sellerId && !preSelectedAuctionId,
  });

  function getSellerDisplayName(profile: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    company_name: string | null;
  }) {
    return (
      profile.company_name ||
      `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
      profile.email ||
      "Unbekannt"
    );
  }

  const selectedSellerFromList = useMemo(
    () => sellers?.find((s) => s.id === sellerId),
    [sellers, sellerId]
  );

  const sellerDisplayName = preSelectedSellerId
    ? preSelectedSeller
      ? getSellerDisplayName(preSelectedSeller)
      : "Wird geladen..."
    : selectedSellerFromList
      ? getSellerDisplayName(selectedSellerFromList)
      : null;

  const createPenaltyMutation = useMutation({
    mutationFn: async () => {
      if (!sellerId || !reason) {
        throw new Error("Verkäufer und Grund sind erforderlich");
      }

      const effectiveAuctionId =
        auctionId && auctionId !== "none" ? auctionId : null;

      let effectiveMotorhomeId = preSelectedMotorhomeId || null;
      if (!effectiveMotorhomeId && effectiveAuctionId) {
        const selected = sellerAuctions?.find(
          (a: any) => a.id === effectiveAuctionId
        );
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
          notes_param: notes || null,
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

          {/* Seller selection – searchable combobox or pre-selected display */}
          {!preSelectedSellerId ? (
            <div className="space-y-2">
              <Label>Verkäufer *</Label>
              <Popover
                open={sellerSearchOpen}
                onOpenChange={setSellerSearchOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={sellerSearchOpen}
                    className="w-full justify-between font-normal"
                  >
                    {sellerDisplayName || "Verkäufer suchen..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Name, E-Mail oder Firma..."
                      value={sellerSearchQuery}
                      onValueChange={setSellerSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {sellersLoading
                          ? "Suche..."
                          : sellerSearchQuery.length < 2
                            ? "Mind. 2 Zeichen eingeben..."
                            : "Kein Verkäufer gefunden."}
                      </CommandEmpty>
                      <CommandGroup>
                        {sellers?.map((seller) => {
                          const name = getSellerDisplayName(seller);
                          return (
                            <CommandItem
                              key={seller.id}
                              value={seller.id}
                              onSelect={(val) => {
                                setSellerId(val === sellerId ? "" : val);
                                setSellerSearchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  sellerId === seller.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{name}</span>
                                {seller.email && seller.email !== name && (
                                  <span className="text-xs text-muted-foreground">
                                    {seller.email}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Label className="text-muted-foreground">Verkäufer:</Label>
              <span className="font-medium">{sellerDisplayName}</span>
            </div>
          )}

          {/* Auction selection (optional) */}
          {!preSelectedAuctionId && sellerId && (
            <div className="space-y-2">
              <Label>
                Zugehörige Auktion{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Select value={auctionId} onValueChange={setAuctionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Auktion zuordnen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Keine Zuordnung —</SelectItem>
                  {sellerAuctions?.map((auction: any) => {
                    const statusLabel =
                      AUCTION_STATUS_LABELS[auction.status] || auction.status;
                    return (
                      <SelectItem key={auction.id} value={auction.id}>
                        {auction.motorhome?.manufacturer}{" "}
                        {auction.motorhome?.model}{" "}
                        {auction.motorhome?.year
                          ? `(${auction.motorhome.year})`
                          : ""}{" "}
                        – {statusLabel}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Penalty reason */}
          <div className="space-y-2">
            <Label>Grund der Vertragsstrafe *</Label>
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
            <Label htmlFor="penalty-notes">
              Interne Notizen{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="penalty-notes"
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
