import { useState, useCallback } from "react";
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
import { Send, Euro, TrendingUp, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { withSessionRetry, ensureValidRLSSession, invokeWithAuth } from "@/lib/sessionGuard";
import { parseGermanNumber, formatBidDisplay } from "@/lib/parseGermanNumber";

interface ExistingOffer {
  id: string;
  offer_amount: number;
  counter_offer_amount: number | null;
  status: string;
  seller_response: string | null;
}

interface PostAuctionOfferDialogProps {
  auctionId: string;
  currentBid: number;
  vehicleTitle: string;
  onOfferSent?: () => void;
  children?: React.ReactNode;
  isFestpreis?: boolean;
  festpreis?: number;
}

export function PostAuctionOfferDialog({
  auctionId,
  currentBid,
  vehicleTitle,
  onOfferSent,
  children,
  isFestpreis = false,
  festpreis,
}: PostAuctionOfferDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [message, setMessage] = useState("");
  const [existingOffer, setExistingOffer] = useState<ExistingOffer | null>(null);
  const [isLoadingOffer, setIsLoadingOffer] = useState(false);

  const fetchExistingOffer = useCallback(async () => {
    if (!user) return;
    setIsLoadingOffer(true);
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;
      const { data } = await supabase
        .from('post_auction_offers')
        .select('id, offer_amount, counter_offer_amount, status, seller_response')
        .eq('auction_id', auctionId)
        .eq('buyer_id', user.id)
        .in('status', ['pending', 'countered'])
        .maybeSingle();
      setExistingOffer(data as ExistingOffer | null);
    } catch (err) {
      console.error('Error fetching existing offer:', err);
    } finally {
      setIsLoadingOffer(false);
    }
  }, [user, auctionId]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      fetchExistingOffer();
      setOfferAmount("");
      setMessage("");
    } else {
      setExistingOffer(null);
    }
  };

  const closeAndNotify = () => {
    setIsOpen(false);
    setOfferAmount("");
    setMessage("");
    onOfferSent?.();
  };

  // ─── New offer ───
  const handleSubmitNewOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Anmeldung erforderlich", description: "Bitte melden Sie sich an, um ein Angebot abzugeben", variant: "destructive" });
      return;
    }
    const amount = parseGermanNumber(offerAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Ungültiger Betrag", description: "Bitte geben Sie einen gültigen Betrag ein", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) {
        toast({ title: "Sitzung abgelaufen", description: "Bitte melden Sie sich erneut an.", variant: "destructive" });
        return;
      }

      const { data: auction, error: auctionError } = await supabase
        .from('auctions').select('status, kaufchance_expires_at').eq('id', auctionId).single();
      if (auctionError || !auction) {
        toast({ title: 'Inserat nicht gefunden', description: 'Das Inserat existiert nicht mehr.', variant: 'destructive' });
        return;
      }

      if (isFestpreis) {
        if (auction.status !== 'active') {
          toast({ title: 'Inserat nicht mehr aktiv', description: 'Dieses Inserat akzeptiert keine Preisvorschläge mehr.', variant: 'destructive' });
          return;
        }
        // Prevent seller from proposing on own listing
        const { data: mhData } = await supabase.from('auctions').select('motorhome:motorhomes(seller_id)').eq('id', auctionId).single();
        const sellerId = Array.isArray(mhData?.motorhome) ? mhData.motorhome[0]?.seller_id : (mhData?.motorhome as any)?.seller_id;
        if (sellerId && sellerId === user.id) {
          toast({ title: 'Eigenes Inserat', description: 'Sie können kein Angebot für Ihr eigenes Fahrzeug abgeben.', variant: 'destructive' });
          return;
        }
      } else {
        if (auction.status !== 'kaufchance') {
          toast({ title: 'Kaufchance nicht mehr verfügbar', description: 'Diese Auktion akzeptiert keine Kaufangebote mehr.', variant: 'destructive' });
          return;
        }
        if (auction.kaufchance_expires_at && new Date(auction.kaufchance_expires_at) < new Date()) {
          toast({ title: 'Kaufchance abgelaufen', description: 'Das Zeitfenster für Kaufangebote ist abgelaufen.', variant: 'destructive' });
          return;
        }

        const { data: invitation, error: invError } = await supabase
          .from('kaufchance_invitations').select('id').eq('auction_id', auctionId).eq('bidder_id', user.id).maybeSingle();
        if (invError || !invitation) {
          toast({ title: 'Nicht eingeladen', description: 'Sie wurden nicht als Top-Bieter zu dieser Kaufchance eingeladen.', variant: 'destructive' });
          return;
        }
      }

      const { data: checkExisting } = await supabase
        .from('post_auction_offers').select('id').eq('auction_id', auctionId).eq('buyer_id', user.id)
        .in('status', ['pending', 'countered']).maybeSingle();
      if (checkExisting) {
        await fetchExistingOffer();
        return;
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await withSessionRetry(async () => {
        const { error } = await supabase.from("post_auction_offers").insert({
          auction_id: auctionId, buyer_id: user.id, offer_amount: amount,
          message: message.trim() || null, expires_at: expiresAt.toISOString(),
        });
        if (error) throw error;
      }, 'PostAuctionOffer.insert');

      try {
        await invokeWithAuth('notify-offer-action', {
          body: { action: 'new_offer', auctionId, buyerId: user.id, offerAmount: amount, message: message.trim() || undefined },
        });
      } catch (notifyErr) {
        console.error('Failed to send offer notification:', notifyErr);
      }

      toast({ title: "Angebot gesendet", description: "Ihr Angebot wurde erfolgreich übermittelt. Der Verkäufer wird benachrichtigt." });
      closeAndNotify();
    } catch (error) {
      console.error("Error sending offer:", error);
      toast({ title: "Fehler", description: "Angebot konnte nicht gesendet werden. Bitte versuchen Sie es erneut.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Raise existing pending offer ───
  const handleRaiseOffer = async () => {
    if (!user || !existingOffer) return;
    const newAmount = parseGermanNumber(offerAmount);
    if (isNaN(newAmount) || newAmount <= existingOffer.offer_amount) {
      toast({ title: 'Ungültiger Betrag', description: `Neuer Betrag muss höher als ${existingOffer.offer_amount.toLocaleString('de-DE')} € sein.`, variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) { toast({ title: "Sitzung abgelaufen", description: "Bitte melden Sie sich erneut an.", variant: "destructive" }); return; }

      const { data: updated, error } = await supabase
        .from('post_auction_offers')
        .update({ offer_amount: newAmount, message: `Angebot erhöht auf ${newAmount.toLocaleString('de-DE')} €`, updated_at: new Date().toISOString() })
        .eq('id', existingOffer.id).eq('buyer_id', user.id).eq('status', 'pending').select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        toast({ title: 'Hinweis', description: 'Der Status hat sich geändert. Bitte versuchen Sie es erneut.' });
        await fetchExistingOffer();
        return;
      }

      try {
        await invokeWithAuth('notify-offer-action', {
          body: { action: 'new_offer', auctionId, buyerId: user.id, offerAmount: newAmount,
            message: `Angebot erhöht von ${existingOffer.offer_amount.toLocaleString('de-DE')} € auf ${newAmount.toLocaleString('de-DE')} €` },
        });
      } catch (notifyErr) { console.error('Failed to notify seller:', notifyErr); }

      toast({ title: 'Angebot erhöht', description: `Ihr Angebot wurde auf ${newAmount.toLocaleString('de-DE')} € erhöht.` });
      closeAndNotify();
    } catch (err) {
      console.error('Error raising offer:', err);
      toast({ title: 'Fehler', description: 'Angebot konnte nicht erhöht werden.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Accept counter-offer ───
  const handleAcceptCounterOffer = async () => {
    if (!existingOffer) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await invokeWithAuth('accept-kaufchance-offer', { body: { offerId: existingOffer.id } });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || 'Unbekannter Fehler');
      toast({
        title: 'Gegenangebot angenommen!',
        description: `Sie haben das Gegenangebot von ${existingOffer.counter_offer_amount!.toLocaleString('de-DE')} € angenommen. Der Kaufvertrag wird erstellt.`,
      });
      closeAndNotify();
    } catch (err: any) {
      console.error('Error accepting counter offer:', err);
      toast({ title: 'Fehler', description: err.message || 'Aktion konnte nicht durchgeführt werden.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Reject counter-offer ───
  const handleRejectCounterOffer = async () => {
    if (!user || !existingOffer) return;
    setIsSubmitting(true);
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) { toast({ title: "Sitzung abgelaufen", description: "Bitte melden Sie sich erneut an.", variant: "destructive" }); return; }

      const { data: updateResult, error } = await supabase
        .from('post_auction_offers').update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', existingOffer.id).eq('buyer_id', user.id).eq('status', 'countered').select('id');
      if (error) throw error;
      if (!updateResult || updateResult.length === 0) {
        toast({ title: 'Hinweis', description: 'Der Status hat sich bereits geändert.' });
        await fetchExistingOffer();
        return;
      }

      try {
        await invokeWithAuth('notify-offer-action', {
          body: { action: 'buyer_reject_counter', auctionId, buyerId: user.id,
            offerAmount: Number(existingOffer.offer_amount), counterAmount: Number(existingOffer.counter_offer_amount) },
        });
      } catch (notifyErr) { console.error('Failed to notify seller:', notifyErr); }

      toast({ title: 'Gegenangebot abgelehnt', description: 'Sie haben das Gegenangebot abgelehnt. Sie können ein neues Angebot abgeben.' });
      setExistingOffer(null);
    } catch (err) {
      console.error('Error rejecting counter offer:', err);
      toast({ title: 'Fehler', description: 'Aktion konnte nicht durchgeführt werden.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ───
  const renderCounteredView = () => (
    <>
      <DialogHeader>
        <DialogTitle>Gegenangebot erhalten</DialogTitle>
        <DialogDescription>
          Der Verkäufer hat ein Gegenangebot für &quot;{vehicleTitle}&quot; gemacht.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="p-3 bg-muted rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Ihr Angebot:</span>
            <span className="font-semibold">{existingOffer!.offer_amount.toLocaleString('de-DE')} €</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gegenangebot:</span>
            <span className="font-bold text-blue-600">{existingOffer!.counter_offer_amount?.toLocaleString('de-DE')} €</span>
          </div>
        </div>
        {existingOffer!.seller_response && (
          <p className="text-sm text-muted-foreground italic">&quot;{existingOffer!.seller_response}&quot;</p>
        )}
        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
          Hinweis: Wenn Sie das Gegenangebot ablehnen, können Sie danach ein neues, eigenes Angebot abgeben.
        </p>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button className="flex-1 bg-green-500 hover:bg-green-600" disabled={isSubmitting} onClick={handleAcceptCounterOffer}>
            <CheckCircle className="w-4 h-4 mr-2" />
            {isSubmitting ? "Wird verarbeitet..." : "Annehmen"}
          </Button>
          <Button variant="destructive" className="flex-1" disabled={isSubmitting} onClick={handleRejectCounterOffer}>
            <XCircle className="w-4 h-4 mr-2" />
            Ablehnen
          </Button>
        </DialogFooter>
      </div>
    </>
  );

  const renderRaiseView = () => (
    <>
      <DialogHeader>
        <DialogTitle>{isFestpreis ? 'Preisvorschlag erhöhen' : 'Angebot erhöhen'}</DialogTitle>
        <DialogDescription>
          Sie haben bereits {isFestpreis ? 'einen offenen Preisvorschlag' : 'ein offenes Angebot'} für &quot;{vehicleTitle}&quot;. Sie können den Betrag erhöhen.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="p-3 bg-muted rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{isFestpreis ? 'Festpreis:' : 'Letztes Gebot (Auktion):'}</span>
            <span className="font-semibold">{(isFestpreis && festpreis ? festpreis : currentBid).toLocaleString('de-DE')} €</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{isFestpreis ? 'Ihr aktueller Vorschlag:' : 'Ihr aktuelles Angebot:'}</span>
            <span className="font-bold text-primary">{existingOffer!.offer_amount.toLocaleString('de-DE')} €</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="raise-amount">Neuer Betrag *</Label>
          <div className="relative">
            <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="raise-amount" type="text" inputMode="decimal"
              placeholder={`> ${existingOffer!.offer_amount.toLocaleString('de-DE')}`}
              value={offerAmount} onChange={(e) => setOfferAmount(formatBidDisplay(e.target.value))} className="pl-9" />
          </div>
          <p className="text-xs text-muted-foreground">Neuer Betrag muss höher als Ihr aktuelles Angebot sein.</p>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Abbrechen</Button>
          <Button disabled={isSubmitting || !offerAmount} onClick={handleRaiseOffer}>
            <TrendingUp className="w-4 h-4 mr-2" />
            {isSubmitting ? "Wird erhöht..." : "Angebot erhöhen"}
          </Button>
        </DialogFooter>
      </div>
    </>
  );

  const renderNewOfferView = () => (
    <>
      <DialogHeader>
        <DialogTitle>{isFestpreis ? 'Preisvorschlag abgeben' : 'Kaufangebot abgeben'}</DialogTitle>
        <DialogDescription>
          {isFestpreis
            ? `Geben Sie einen Preisvorschlag für "${vehicleTitle}" ab. Der Verkäufer kann Ihren Vorschlag annehmen, ablehnen oder ein Gegenangebot machen.`
            : `Geben Sie ein Angebot für "${vehicleTitle}" ab. Der Verkäufer kann Ihr Angebot annehmen, ablehnen oder ein Gegenangebot machen.`}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmitNewOffer} className="space-y-4">
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">{isFestpreis ? 'Festpreis:' : 'Letztes Gebot in der Auktion:'}</p>
          <p className="text-xl font-bold">{(isFestpreis && festpreis ? festpreis : currentBid).toLocaleString('de-DE')} €</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="offer-amount">Ihr Angebot *</Label>
          <div className="relative">
            <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="offer-amount" type="text" inputMode="decimal"
              placeholder={`z.B. ${((isFestpreis && festpreis ? festpreis * 0.9 : currentBid > 0 ? currentBid - 500 : 1000)).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`}
              value={offerAmount} onChange={(e) => setOfferAmount(formatBidDisplay(e.target.value))} className="pl-9" />
          </div>
          <p className="text-xs text-muted-foreground">Hinweis: Ihr Angebot sollte realistisch sein, um eine Chance auf Annahme zu haben.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="offer-message">Nachricht an den Verkäufer (optional)</Label>
          <Textarea id="offer-message" placeholder="z.B. Begründung für Ihr Angebot, Fragen zum Fahrzeug..."
            value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[80px]" />
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Abbrechen</Button>
          <Button type="submit" disabled={isSubmitting}>
            <Send className="w-4 h-4 mr-2" />
            {isSubmitting ? "Wird gesendet..." : "Angebot senden"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
            <Send className="w-4 h-4 mr-2" />
            Angebot abgeben
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        {isLoadingOffer ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : existingOffer?.status === 'countered' ? (
          renderCounteredView()
        ) : existingOffer?.status === 'pending' ? (
          renderRaiseView()
        ) : (
          renderNewOfferView()
        )}
      </DialogContent>
    </Dialog>
  );
}
