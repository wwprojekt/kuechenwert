import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KaufchanceBadge } from "@/components/KaufchanceBadge";
import { PostAuctionOfferDialog } from "@/components/PostAuctionOfferDialog";
import { Zap, Car, ExternalLink, Clock, Euro, CheckCircle, XCircle, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface KaufchanceInvitation {
  id: string;
  auction_id: string;
  highest_bid: number;
  rank: number;
  invited_at: string;
}

interface KaufchanceAuction {
  id: string;
  current_bid: number | null;
  end_time: string;
  kaufchance_expires_at: string | null;
  kaufchance_min_price: number | null;
  motorhome: {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    listing_number: string | null;
    photos: Array<{ url: string; display_order: number }>;
  };
  // The current user's invitation data
  invitation?: KaufchanceInvitation;
}

interface MyOffer {
  id: string;
  offer_amount: number;
  counter_offer_amount: number | null;
  status: string;
  message: string | null;
  seller_response: string | null;
  created_at: string;
  expires_at: string | null;
  auction_id: string;
  auction: {
    id: string;
    current_bid: number | null;
    status: string;
    motorhome: {
      manufacturer: string;
      model: string;
      photos: Array<{ url: string; display_order: number }>;
    };
  };
}

export default function MyKaufchancen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [kaufchancen, setKaufchancen] = useState<KaufchanceAuction[]>([]);
  const [myOffers, setMyOffers] = useState<MyOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("browse");
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Step 1: Load the current user's kaufchance invitations
      const { data: invitations, error: invError } = await supabase
        .from("kaufchance_invitations")
        .select("*")
        .eq("bidder_id", user.id);

      if (invError) throw invError;

      // Step 2: Load the auctions for which this user is invited
      if (invitations && invitations.length > 0) {
        const auctionIds = invitations.map((inv: any) => inv.auction_id);

        const { data: auctionData, error: auctionError } = await supabase
          .from("auctions")
          .select(`
            id,
            current_bid,
            end_time,
            kaufchance_expires_at,
            kaufchance_min_price,
            motorhome:motorhomes (
              id,
              manufacturer,
              model,
              year,
              listing_number,
              photos:motorhome_photos (url, display_order)
            )
          `)
          .in("id", auctionIds)
          .eq("status", "kaufchance")
          .gt("kaufchance_expires_at", new Date().toISOString())
          .order("kaufchance_expires_at", { ascending: true });

        if (auctionError) throw auctionError;

        // Merge invitation data into auction data
        const invMap = new Map(invitations.map((inv: any) => [inv.auction_id, inv]));
        const merged = (auctionData || []).map((auction: any) => ({
          ...auction,
          invitation: invMap.get(auction.id),
        }));

        setKaufchancen(merged as KaufchanceAuction[]);
      } else {
        setKaufchancen([]);
      }

      // Step 3: Load my offers
      const { data: offersData, error: offersError } = await supabase
        .from("post_auction_offers")
        .select(`
          id,
          offer_amount,
          counter_offer_amount,
          status,
          message,
          seller_response,
          created_at,
          expires_at,
          auction_id,
          auction:auctions (
            id,
            current_bid,
            status,
            motorhome:motorhomes (
              manufacturer,
              model,
              photos:motorhome_photos (url, display_order)
            )
          )
        `)
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (offersError) throw offersError;
      setMyOffers((offersData as unknown as MyOffer[]) || []);
    } catch (error) {
      console.error("Error loading kaufchancen:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleAcceptCounterOffer = async (offer: MyOffer) => {
    setRespondingOfferId(offer.id);
    try {
      // Call the accept-kaufchance-offer Edge Function which handles the full sale flow
      const { data, error } = await supabase.functions.invoke('accept-kaufchance-offer', {
        body: { offerId: offer.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Gegenangebot angenommen!',
          description: `Sie haben das Gegenangebot von ${offer.counter_offer_amount!.toLocaleString('de-DE')} \u20ac angenommen. Der Kaufvertrag wird erstellt.`,
        });
      } else {
        throw new Error(data?.error || 'Unbekannter Fehler');
      }

      loadData();
    } catch (err: any) {
      console.error('Error accepting counter offer:', err);
      toast({
        title: 'Fehler',
        description: err.message || 'Aktion konnte nicht durchgeführt werden.',
        variant: 'destructive',
      });
    } finally {
      setRespondingOfferId(null);
    }
  };

  const handleRejectCounterOffer = async (offer: MyOffer) => {
    setRespondingOfferId(offer.id);
    try {
      const { error } = await supabase
        .from('post_auction_offers')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', offer.id)
        .eq('buyer_id', user!.id);
      if (error) throw error;
      toast({
        title: 'Gegenangebot abgelehnt',
        description: 'Sie haben das Gegenangebot abgelehnt.',
      });
      loadData();
    } catch (err) {
      console.error('Error rejecting counter offer:', err);
      toast({ title: 'Fehler', description: 'Aktion konnte nicht durchgeführt werden.', variant: 'destructive' });
    } finally {
      setRespondingOfferId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-green-500">Angenommen</Badge>;
      case "rejected":
        return <Badge variant="destructive">Abgelehnt</Badge>;
      case "countered":
        return <Badge className="bg-blue-500 text-white">Gegenangebot</Badge>;
      case "expired":
        return <Badge variant="secondary">Abgelaufen</Badge>;
      default:
        return <Badge variant="outline" className="text-orange-600 border-orange-600">Ausstehend</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500" />
          Kaufchancen
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Exklusive Kaufchancen – Sie wurden als Top-Bieter eingeladen, ein Angebot abzugeben
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse">
            Meine Kaufchancen ({kaufchancen.length})
          </TabsTrigger>
          <TabsTrigger value="my-offers">
            Meine Angebote ({myOffers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : kaufchancen.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Keine Kaufchancen verfügbar</h3>
                <p className="text-muted-foreground mb-4">
                  Aktuell sind keine Kaufchancen für Sie verfügbar. Sie werden per E-Mail benachrichtigt, wenn Sie als Top-Bieter eingeladen werden.
                </p>
                <Button asChild>
                  <Link to="/kaufen">Aktive Auktionen ansehen</Link>
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {kaufchancen.map((auction) => {
                const motorhome = auction.motorhome;
                const safePhotos = Array.isArray(motorhome.photos) ? motorhome.photos : motorhome.photos ? [motorhome.photos] : [];
                const firstPhoto = [...safePhotos].sort((a, b) => a.display_order - b.display_order)[0];

                return (
                  <Card key={auction.id} className="overflow-hidden">
                    <div className="flex flex-col md:flex-row">
                      {/* Image */}
                      <div className="relative w-full md:w-48 h-40 md:h-auto flex-shrink-0">
                        {firstPhoto ? (
                          <img
                            src={firstPhoto.url}
                            alt={`${motorhome.manufacturer} ${motorhome.model}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Car className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        {auction.kaufchance_expires_at && (
                          <div className="absolute top-2 left-2">
                            <KaufchanceBadge expiresAt={auction.kaufchance_expires_at} />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <CardContent className="flex-1 p-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg mb-1">
                              {motorhome.manufacturer} {motorhome.model}
                            </h3>
                            {motorhome.listing_number && (
                              <p className="text-xs font-mono text-muted-foreground mb-2">
                                #{motorhome.listing_number}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 mb-3">
                              <div className="flex items-center gap-1">
                                <Euro className="w-4 h-4 text-primary" />
                                <span className="font-semibold">
                                  Letztes Gebot: {auction.current_bid?.toLocaleString('de-DE') || 0} €
                                </span>
                              </div>
                              {auction.invitation && (
                                <div className="flex items-center gap-1">
                                  <Trophy className="w-4 h-4 text-amber-500" />
                                  <span className="text-sm text-amber-700 font-medium">
                                    Platz {auction.invitation.rank} – Ihr Gebot: {auction.invitation.highest_bid.toLocaleString('de-DE')} €
                                  </span>
                                </div>
                              )}
                            </div>

                            <p className="text-sm text-muted-foreground">
                              Sie wurden als Top-Bieter eingeladen. Geben Sie jetzt ein Kaufangebot ab.
                            </p>
                          </div>

                          <div className="flex flex-col gap-2">
                            <PostAuctionOfferDialog
                              auctionId={auction.id}
                              currentBid={auction.current_bid || 0}
                              vehicleTitle={`${motorhome.manufacturer} ${motorhome.model}`}
                              onOfferSent={loadData}
                            />
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/auktion/${auction.id}`}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Details
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-offers" className="space-y-4 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : myOffers.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Keine Angebote</h3>
                <p className="text-muted-foreground">
                  Sie haben noch keine Kaufangebote abgegeben.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {myOffers.map((offer) => {
                const auction = offer.auction;
                const motorhome = auction?.motorhome;
                const safePhotos2 = Array.isArray(motorhome?.photos) ? motorhome.photos : motorhome?.photos ? [motorhome.photos] : [];
                const firstPhoto = [...safePhotos2].sort((a, b) => a.display_order - b.display_order)[0];

                return (
                  <Card key={offer.id} className="overflow-hidden">
                    <div className="flex flex-col md:flex-row">
                      {/* Image */}
                      <div className="relative w-full md:w-40 h-32 md:h-auto flex-shrink-0">
                        {firstPhoto ? (
                          <img
                            src={firstPhoto.url}
                            alt={`${motorhome?.manufacturer} ${motorhome?.model}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Car className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <CardContent className="flex-1 p-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold">
                                {motorhome?.manufacturer} {motorhome?.model}
                              </h3>
                              {getStatusBadge(offer.status)}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {format(new Date(offer.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                            </p>
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Ihr Angebot</p>
                                <p className="font-semibold">{offer.offer_amount.toLocaleString('de-DE')} €</p>
                              </div>
                              {offer.counter_offer_amount && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Gegenangebot</p>
                                  <p className="font-semibold text-blue-600">
                                    {offer.counter_offer_amount.toLocaleString('de-DE')} €
                                  </p>
                                </div>
                              )}
                            </div>
                            {offer.seller_response && (
                              <p className="text-sm text-muted-foreground mt-2 italic">
                                "{offer.seller_response}"
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            {offer.status === 'countered' && offer.counter_offer_amount && (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  className="bg-green-500 hover:bg-green-600"
                                  disabled={respondingOfferId === offer.id}
                                  onClick={() => handleAcceptCounterOffer(offer)}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Annehmen ({offer.counter_offer_amount.toLocaleString('de-DE')} €)
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={respondingOfferId === offer.id}
                                  onClick={() => handleRejectCounterOffer(offer)}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Ablehnen
                                </Button>
                              </div>
                            )}
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/auktion/${auction?.id}`}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Zur Auktion
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
