import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Send, Euro, MessageSquare } from "lucide-react";
import { withSessionRetry } from "@/lib/sessionGuard";

interface PostAuctionOfferDialogProps {
  auctionId: string;
  currentBid: number;
  vehicleTitle: string;
  onOfferSent?: () => void;
  children?: React.ReactNode;
}

export function PostAuctionOfferDialog({
  auctionId,
  currentBid,
  vehicleTitle,
  onOfferSent,
  children,
}: PostAuctionOfferDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Anmeldung erforderlich",
        description: "Bitte melden Sie sich an, um ein Angebot abzugeben",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(offerAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Ungültiger Betrag",
        description: "Bitte geben Sie einen gültigen Betrag ein",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate auction is still in kaufchance status and not expired
      const { data: auction, error: auctionError } = await supabase
        .from('auctions')
        .select('status, kaufchance_expires_at')
        .eq('id', auctionId)
        .single();

      if (auctionError || !auction) {
        toast({
          title: 'Auktion nicht gefunden',
          description: 'Die Auktion existiert nicht mehr.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (auction.status !== 'kaufchance') {
        toast({
          title: 'Kaufchance nicht mehr verfügbar',
          description: 'Diese Auktion akzeptiert keine Kaufangebote mehr.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (auction.kaufchance_expires_at && new Date(auction.kaufchance_expires_at) < new Date()) {
        toast({
          title: 'Kaufchance abgelaufen',
          description: 'Das Zeitfenster für Kaufangebote ist abgelaufen.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Set offer to expire in 24 hours
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await withSessionRetry(async () => {
        const { error } = await supabase.from("post_auction_offers").insert({
          auction_id: auctionId,
          buyer_id: user.id,
          offer_amount: amount,
          message: message.trim() || null,
          expires_at: expiresAt.toISOString(),
        });
        if (error) throw error;
      }, 'PostAuctionOffer.insert');

      toast({
        title: "Angebot gesendet",
        description: "Ihr Angebot wurde erfolgreich übermittelt. Der Verkäufer wird benachrichtigt.",
      });

      setIsOpen(false);
      setOfferAmount("");
      setMessage("");
      onOfferSent?.();
    } catch (error) {
      console.error("Error sending offer:", error);
      toast({
        title: "Fehler",
        description: "Angebot konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
            <Send className="w-4 h-4 mr-2" />
            Angebot abgeben
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kaufangebot abgeben</DialogTitle>
          <DialogDescription>
            Geben Sie ein Angebot für "{vehicleTitle}" ab. Der Verkäufer kann Ihr Angebot annehmen, ablehnen oder ein Gegenangebot machen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Letztes Gebot in der Auktion:</p>
            <p className="text-xl font-bold">{currentBid.toLocaleString('de-DE')} €</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-amount">Ihr Angebot *</Label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="offer-amount"
                type="number"
                placeholder="Betrag eingeben"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                className="pl-9"
                min={1}
                step={100}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Hinweis: Ihr Angebot sollte realistisch sein, um eine Chance auf Annahme zu haben.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-message">Nachricht an den Verkäufer (optional)</Label>
            <Textarea
              id="offer-message"
              placeholder="z.B. Begründung für Ihr Angebot, Fragen zum Fahrzeug..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? "Wird gesendet..." : "Angebot senden"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
