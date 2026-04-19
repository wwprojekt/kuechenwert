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
import { Send, Euro, TrendingUp, CheckCircle, XCircle, Loader2, MessageCircleReply, ArrowLeft } from "lucide-react";
import { withSessionRetry, ensureValidRLSSession, invokeWithAuth, isNetworkError, SessionExpiredError } from "@/lib/sessionGuard";
import { logger } from "@/lib/logger";
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
  // When user clicks "Eigenes Gegenangebot" inside renderCounteredView,
  // we switch into a sub-view that lets them type their own amount
  // instead of just Accept/Reject.
  const [showBuyerCounterForm, setShowBuyerCounterForm] = useState(false);

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
      // Transiente Netzwerkfehler nicht als CONSOLE_ERROR ins error_logs spülen
      if (isNetworkError(err)) {
        logger.warn('PostAuctionOfferDialog: transient network error fetching existing offer', err);
      } else {
        console.error('Error fetching existing offer:', err);
      }
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
      setShowBuyerCounterForm(false);
    } else {
      setExistingOffer(null);
      setShowBuyerCounterForm(false);
    }
  };

  const closeAndNotify = () => {
    setIsOpen(false);
    setOfferAmount("");
    setMessage("");
    setShowBuyerCounterForm(false);
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

      const offerExpiresAt = !isFestpreis && auction.kaufchance_expires_at
        ? auction.kaufchance_expires_at
        : null;

      await withSessionRetry(async () => {
        const { error } = await supabase.from("post_auction_offers").insert({
          auction_id: auctionId, buyer_id: user.id, offer_amount: amount,
          message: message.trim() || null, expires_at: offerExpiresAt,
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
      if (error instanceof SessionExpiredError) {
        // Dialog wird via sessionGuard.notifySessionExpired() bereits angezeigt – kein Toast.
        return;
      }
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
      if (err instanceof SessionExpiredError) return;
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
      if (err instanceof SessionExpiredError) return;
      console.error('Error accepting counter offer:', err);
      toast({ title: 'Fehler', description: err.message || 'Aktion konnte nicht durchgeführt werden.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Submit own counter-counter offer (buyer responds to seller's counter
  //     with a different amount instead of just Accept/Reject) ───
  const handleSubmitBuyerCounter = async () => {
    if (!user || !existingOffer) return;
    const newAmount = parseGermanNumber(offerAmount);
    if (isNaN(newAmount) || newAmount <= 0) {
      toast({ title: 'Ungültiger Betrag', description: 'Bitte geben Sie einen gültigen Betrag ein.', variant: 'destructive' });
      return;
    }
    const sellerCounter = Number(existingOffer.counter_offer_amount ?? 0);
    if (sellerCounter > 0 && newAmount >= sellerCounter) {
      toast({
        title: 'Hinweis: Betrag ≥ Gegenangebot',
        description: `Wenn Ihr Gegenvorschlag ${newAmount.toLocaleString('de-DE')} € beträgt und damit ≥ ${sellerCounter.toLocaleString('de-DE')} €, sollten Sie das Gegenangebot besser direkt annehmen.`,
        variant: 'destructive',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) {
        toast({ title: "Sitzung abgelaufen", description: "Bitte melden Sie sich erneut an.", variant: "destructive" });
        return;
      }

      const { data: auctionForExpiry } = await supabase
        .from('auctions').select('kaufchance_expires_at').eq('id', auctionId).single();
      const counterExpiresAt = auctionForExpiry?.kaufchance_expires_at ?? null;

      const { data: updated, error } = await supabase
        .from('post_auction_offers')
        .update({
          status: 'pending',
          offer_amount: newAmount,
          counter_offer_amount: null,
          seller_response: null,
          message: message.trim() || `Gegenvorschlag des Käufers: ${newAmount.toLocaleString('de-DE')} €`,
          expires_at: counterExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingOffer.id)
        .eq('buyer_id', user.id)
        .eq('status', 'countered')
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        toast({ title: 'Hinweis', description: 'Der Status hat sich bereits geändert. Bitte erneut versuchen.' });
        await fetchExistingOffer();
        return;
      }

      try {
        await invokeWithAuth('notify-offer-action', {
          body: {
            action: 'new_offer',
            auctionId,
            buyerId: user.id,
            offerAmount: newAmount,
            message: `Käufer hat Ihr Gegenangebot über ${sellerCounter.toLocaleString('de-DE')} € mit einem eigenen Vorschlag von ${newAmount.toLocaleString('de-DE')} € beantwortet.`,
          },
        });
      } catch (notifyErr) {
        console.error('Failed to notify seller about buyer counter:', notifyErr);
      }

      toast({
        title: 'Gegenvorschlag gesendet',
        description: `Ihr Vorschlag über ${newAmount.toLocaleString('de-DE')} € wurde an den Verkäufer übermittelt.`,
      });
      closeAndNotify();
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      console.error('Error submitting buyer counter:', err);
      toast({ title: 'Fehler', description: 'Gegenvorschlag konnte nicht gesendet werden.', variant: 'destructive' });
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
      if (err instanceof SessionExpiredError) return;
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
          Sie können das Gegenangebot annehmen, ablehnen — oder einen <strong>eigenen Gegenvorschlag</strong> an den Verkäufer senden.
        </p>
        <DialogFooter className="flex flex-col gap-2">
          <Button className="w-full bg-green-500 hover:bg-green-600" disabled={isSubmitting} onClick={handleAcceptCounterOffer}>
            <CheckCircle className="w-4 h-4 mr-2" />
            {isSubmitting ? "Wird verarbeitet..." : `Annehmen (${existingOffer!.counter_offer_amount?.toLocaleString('de-DE')} €)`}
          </Button>
          <Button
            variant="outline"
            className="w-full border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            disabled={isSubmitting}
            onClick={() => { setOfferAmount(""); setMessage(""); setShowBuyerCounterForm(true); }}
          >
            <MessageCircleReply className="w-4 h-4 mr-2" />
            Eigenes Gegenangebot
          </Button>
          <Button variant="destructive" className="w-full" disabled={isSubmitting} onClick={handleRejectCounterOffer}>
            <XCircle className="w-4 h-4 mr-2" />
            Ablehnen
          </Button>
        </DialogFooter>
      </div>
    </>
  );

  const renderBuyerCounterView = () => {
    const sellerCounter = Number(existingOffer!.counter_offer_amount ?? 0);
    const suggestion = sellerCounter > 0 ? Math.max(1, Math.round(sellerCounter * 0.92)) : 0;
    return (
      <>
        <DialogHeader>
          <DialogTitle>Eigenes Gegenangebot senden</DialogTitle>
          <DialogDescription>
            Senden Sie dem Verkäufer für &quot;{vehicleTitle}&quot; einen eigenen Vorschlag.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gegenangebot des Verkäufers:</span>
              <span className="font-bold text-blue-600">{sellerCounter.toLocaleString('de-DE')} €</span>
            </div>
            {existingOffer!.offer_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ihr ursprüngliches Angebot:</span>
                <span className="font-semibold">{existingOffer!.offer_amount.toLocaleString('de-DE')} €</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyer-counter-amount">Ihr Gegenvorschlag *</Label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="buyer-counter-amount"
                type="text"
                inputMode="decimal"
                placeholder={suggestion ? `z.B. ${suggestion.toLocaleString('de-DE')}` : 'Betrag in €'}
                value={offerAmount}
                onChange={(e) => setOfferAmount(formatBidDisplay(e.target.value))}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Geben Sie einen Betrag ein, der unter dem Gegenangebot des Verkäufers liegt.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyer-counter-message">Nachricht an den Verkäufer (optional)</Label>
            <Textarea
              id="buyer-counter-message"
              placeholder="z.B. Begründung für Ihren Vorschlag, Hinweise zu Mängeln…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[70px]"
            />
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setShowBuyerCounterForm(false)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
            <Button disabled={isSubmitting || !offerAmount} onClick={handleSubmitBuyerCounter}>
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? "Wird gesendet..." : "Gegenvorschlag senden"}
            </Button>
          </DialogFooter>
        </div>
      </>
    );
  };

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
          showBuyerCounterForm ? renderBuyerCounterView() : renderCounteredView()
        ) : existingOffer?.status === 'pending' ? (
          renderRaiseView()
        ) : (
          renderNewOfferView()
        )}
      </DialogContent>
    </Dialog>
  );
}
