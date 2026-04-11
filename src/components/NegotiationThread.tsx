import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSessionExpired } from "@/components/SessionExpiredDialog";
import { invokeWithAuth, SessionExpiredError, ensureValidRLSSession } from "@/lib/sessionGuard";
import { useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Euro,
  MessageSquare,
  Send,
} from "lucide-react";

interface Offer {
  id: string;
  offer_amount: number;
  counter_offer_amount: number | null;
  status: string;
  message: string | null;
  seller_response: string | null;
  created_at: string;
  expires_at: string | null;
}

interface NegotiationThreadProps {
  offers: Offer[];
  isSeller: boolean;
  onOfferUpdated?: () => void;
}

export function NegotiationThread({ offers, isSeller, onOfferUpdated }: NegotiationThreadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { showSessionExpired } = useSessionExpired();
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionType, setActionType] = useState<"accept" | "counter" | "reject" | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return (
          <Badge className="bg-green-500 text-white gap-1">
            <CheckCircle className="w-3 h-3" />
            Angenommen
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" />
            Abgelehnt
          </Badge>
        );
      case "countered":
        return (
          <Badge className="bg-blue-500 text-white gap-1">
            <ArrowLeft className="w-3 h-3" />
            Gegenangebot
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3 h-3" />
            Abgelaufen
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-orange-600 border-orange-600 gap-1">
            <Clock className="w-3 h-3" />
            Ausstehend
          </Badge>
        );
    }
  };

  const handleAction = async () => {
    if (!selectedOffer || !actionType) return;

    setIsSubmitting(true);

    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;

      if (selectedOffer.expires_at && new Date(selectedOffer.expires_at) < new Date()) {
        toast({ title: 'Angebot abgelaufen', description: 'Dieses Angebot ist bereits abgelaufen.', variant: 'destructive' });
        setSelectedOffer(null);
        setActionType(null);
        setIsSubmitting(false);
        return;
      }

      if (actionType === "accept") {
        // Use the Edge Function for acceptance to trigger full purchase flow
        const { data: acceptResult, error: acceptError } = await invokeWithAuth('accept-kaufchance-offer', {
          body: { offerId: selectedOffer.id },
        });
        if (acceptError) throw acceptError;
        if (!(acceptResult as any)?.success) throw new Error((acceptResult as any)?.error || 'Unbekannter Fehler');
      } else {
        const updateData: any = {
          seller_response: responseMessage.trim() || null,
          updated_at: new Date().toISOString(),
        };

        if (actionType === "reject") {
          updateData.status = "rejected";
        } else if (actionType === "counter") {
          const amount = parseFloat(counterAmount);
          if (isNaN(amount) || amount <= 0) {
            toast({
              title: "Ungültiger Betrag",
              description: "Bitte geben Sie einen gültigen Betrag ein",
              variant: "destructive",
            });
            setIsSubmitting(false);
            return;
          }
          updateData.status = "countered";
          updateData.counter_offer_amount = amount;
        }

        const { error } = await supabase
          .from("post_auction_offers")
          .update(updateData)
          .eq("id", selectedOffer.id);

        if (error) throw error;

        // Send notification via Edge Function (runs with service_role, bypasses RLS)
        try {
          const { data: offerData } = await supabase
            .from('post_auction_offers')
            .select('buyer_id, offer_amount, auction_id')
            .eq('id', selectedOffer.id)
            .single();

          if (offerData) {
            await supabase.functions.invoke('notify-offer-action', {
              body: {
                action: actionType === 'reject' ? 'offer_rejected' : 'counter_offer',
                auctionId: offerData.auction_id,
                buyerId: offerData.buyer_id,
                offerAmount: Number(offerData.offer_amount),
                counterAmount: actionType === 'counter' ? parseFloat(counterAmount) : undefined,
                sellerResponse: responseMessage.trim() || undefined,
              },
            });
          }
        } catch (notifyErr) {
          console.error('Failed to send buyer notification:', notifyErr);
        }
      }

      toast({
        title: actionType === "accept" 
          ? "Angebot angenommen" 
          : actionType === "reject" 
            ? "Angebot abgelehnt"
            : "Gegenangebot gesendet",
        description: "Der K\u00e4ufer wird benachrichtigt.",
      });

      setSelectedOffer(null);
      setActionType(null);
      setCounterAmount("");
      setResponseMessage("");
      onOfferUpdated?.();
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        showSessionExpired('/dashboard/kaufchancen');
        return;
      }
      console.error("Error updating offer:", error);
      toast({
        title: "Fehler",
        description: "Aktion konnte nicht durchgeführt werden",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (offers.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Noch keine Angebote eingegangen</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {offers.map((offer) => (
        <Card key={offer.id} className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusBadge(offer.status)}
                <span className="text-sm text-muted-foreground">
                  {format(new Date(offer.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <ArrowRight className="w-4 h-4 text-primary" />
                  <span className="font-semibold">
                    {offer.offer_amount.toLocaleString('de-DE')} €
                  </span>
                  <span className="text-sm text-muted-foreground">(Angebot)</span>
                </div>
                
                {offer.counter_offer_amount && (
                  <div className="flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold text-blue-600">
                      {offer.counter_offer_amount.toLocaleString('de-DE')} €
                    </span>
                    <span className="text-sm text-muted-foreground">(Gegenangebot)</span>
                  </div>
                )}
              </div>
              
              {offer.message && (
                <p className="text-sm text-muted-foreground italic">"{offer.message}"</p>
              )}
              
              {offer.seller_response && (
                <p className="text-sm bg-primary/5 p-2 rounded italic">
                  Antwort: "{offer.seller_response}"
                </p>
              )}
            </div>

            {isSeller && offer.status === "pending" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-green-500 hover:bg-green-600"
                  onClick={() => {
                    setSelectedOffer(offer);
                    setActionType("accept");
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Annehmen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-500 text-blue-600 hover:bg-blue-50"
                  onClick={() => {
                    setSelectedOffer(offer);
                    setActionType("counter");
                  }}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Gegenangebot
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setSelectedOffer(offer);
                    setActionType("reject");
                  }}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Ablehnen
                </Button>
              </div>
            )}
          </div>
        </Card>
      ))}

      {/* Action Dialog */}
      <Dialog open={!!selectedOffer && !!actionType} onOpenChange={() => {
        setSelectedOffer(null);
        setActionType(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "accept" && "Angebot annehmen"}
              {actionType === "reject" && "Angebot ablehnen"}
              {actionType === "counter" && "Gegenangebot machen"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "accept" && "Sie stimmen dem Verkauf zum angebotenen Preis zu."}
              {actionType === "reject" && "Das Angebot wird abgelehnt."}
              {actionType === "counter" && "Schlagen Sie einen alternativen Preis vor."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedOffer && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Angebot:</p>
                <p className="text-lg font-bold">{selectedOffer.offer_amount.toLocaleString('de-DE')} €</p>
              </div>
            )}

            {actionType === "counter" && (
              <div className="space-y-2">
                <Label htmlFor="counter-amount">Ihr Gegenangebot *</Label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="counter-amount"
                    type="number"
                    placeholder="Betrag eingeben"
                    value={counterAmount}
                    onChange={(e) => setCounterAmount(e.target.value)}
                    className="pl-9"
                    min={1}
                    step={100}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="response-message">Nachricht (optional)</Label>
              <Textarea
                id="response-message"
                placeholder="Optionale Nachricht an den Käufer..."
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSelectedOffer(null);
              setActionType(null);
            }}>
              Abbrechen
            </Button>
            <Button
              onClick={handleAction}
              disabled={isSubmitting}
              className={
                actionType === "accept" ? "bg-green-500 hover:bg-green-600" :
                actionType === "reject" ? "" : 
                "bg-blue-500 hover:bg-blue-600"
              }
              variant={actionType === "reject" ? "destructive" : "default"}
            >
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? "Wird gesendet..." : "Bestätigen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
