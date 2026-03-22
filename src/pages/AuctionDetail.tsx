import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { handleAndLogError, handleApiError, handleBusinessError } from "@/lib/errorLogService";
import { VehicleQuestionForm } from "@/components/VehicleQuestionForm";
import { KaufchanceBadge } from "@/components/KaufchanceBadge";
import { PostAuctionOfferDialog } from "@/components/PostAuctionOfferDialog";
import { useAudioNotification } from "@/hooks/useAudioNotification";
import type { Database } from "@/integrations/supabase/types";

// Define types for better type safety
type AuctionRow = Database["public"]["Tables"]["auctions"]["Row"];
type MotorhomeRow = Database["public"]["Tables"]["motorhomes"]["Row"];
type BidRow = Database["public"]["Tables"]["bids"]["Row"];
type PhotoRow = Database["public"]["Tables"]["motorhome_photos"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

interface AuctionWithMotorhome extends AuctionRow {
  motorhome: MotorhomeRow & {
    photos: PhotoRow[];
    seller: Pick<ProfileRow, "first_name" | "last_name" | "company_name"> | null;
  };
}

interface BidWithBidder extends BidRow {
  bidder: Pick<ProfileRow, "first_name" | "last_name" | "company_name"> | null;
}
import {
  Clock,
  TrendingUp,
  Users,
  Gauge,
  Calendar,
  Bed,
  Droplets,
  Sun,
  Umbrella,
  ArrowLeft,
  Gavel,
  Zap,
  Eye,
  Heart,
  Shield,
  Award,
  Fuel,
  Cog,
  Home,
  Car,
  Ruler,
  CheckCircle,
  CheckCircle2,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize,
  User,
  AlertTriangle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CommissionDisplay } from "@/components/CommissionDisplay";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AuctionDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { primaryRole } = useUserRole();
  const isAdmin = primaryRole === 'admin';
  const siteName = settings?.site_name || 'CaravanWert';
  const { toast } = useToast();
  const navigate = useNavigate();

  const [auction, setAuction] = useState<AuctionWithMotorhome | null>(null);
  const [bids, setBids] = useState<BidWithBidder[]>([]);
  const [bidAmount, setBidAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isEndingSoon, setIsEndingSoon] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [enableAutobid, setEnableAutobid] = useState(false);
  const [maxAutobidAmount, setMaxAutobidAmount] = useState("");
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const hotbidSoundPlayed = useRef(false);
  const { playNotification } = useAudioNotification();

  // Validate UUID format
  const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  // Fetch auction details
  useEffect(() => {
    const fetchAuction = async () => {
      if (!id || !isValidUUID(id)) {
        toast({
          title: "Ungültige Auktion",
          description: "Die angegebene Auktions-ID ist ungültig.",
          variant: "destructive",
        });
        navigate('/kaufen');
        return;
      }

      const { data, error } = await supabase
        .from("auctions")
        .select(`
          *,
          motorhome:motorhomes!left(
            *,
            photos:motorhome_photos(*),
            seller:profiles!left(
              first_name,
              last_name,
              company_name
            )
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        // Log detailed error for debugging
        console.error("Auction fetch error:", error.message, error.code, error.details);
        logger.error("AuctionDetail fetch failed:", { 
          auctionId: id, 
          error: error.message,
          code: error.code,
          details: error.details
        });
        const germanMessage = handleApiError(error, 'AuctionDetail', { auctionId: id });
        toast({
          title: "Fehler beim Laden",
          description: germanMessage,
          variant: "destructive",
        });
        return;
      }
      
      if (!data) {
        toast({
          title: "Nicht gefunden",
          description: "Die angeforderte Auktion existiert nicht.",
          variant: "destructive",
        });
        return;
      }

      setAuction(data);
    };

    fetchAuction();
  }, [id, toast, navigate]);

  // Fetch bids
  useEffect(() => {
    const fetchBids = async () => {
      const { data, error } = await supabase
        .from("bids")
        .select(`
          *,
          bidder:profiles(first_name, last_name, company_name)
        `)
        .eq("auction_id", id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setBids(data);
      }
    };

    fetchBids();
  }, [id]);

  // Real-time bid updates with stale update prevention
  useEffect(() => {
    let isSubscribed = true; // Track mount state to prevent stale updates
    
    const channel = supabase
      .channel(`auction-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
          filter: `auction_id=eq.${id}`,
        },
        async (payload) => {
          // Guard: Check if component is still mounted before async operation
          if (!isSubscribed) return;
          
          // Fetch bidder profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, company_name")
            .eq("id", payload.new.bidder_id)
            .single();

          // Guard: Check again after async operation completes
          if (!isSubscribed) return;

          const newBid = {
            ...payload.new,
            bidder: profile,
          };

          setBids((prev) => [newBid, ...prev]);

          // Update auction current bid
          setAuction((prev) => prev ? ({
            ...prev,
            current_bid: payload.new.amount,
          }) : null);

          // Show toast for new bid
          if (payload.new.bidder_id !== user?.id) {
            toast({
              title: "Neues Gebot!",
              description: `€${payload.new.amount.toLocaleString()} von ${
                profile?.company_name || `${profile?.first_name} ${profile?.last_name}`
              }`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false; // Mark as unmounted
      supabase.removeChannel(channel);
    };
  }, [id, user, toast]);

  // Countdown timer
  useEffect(() => {
    if (!auction) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const endTime = new Date(auction.end_time).getTime();
      const distance = endTime - now;

      if (distance < 0) {
        setTimeRemaining("Beendet");
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      const enteringHotbid = distance < 5 * 60 * 1000;
      if (enteringHotbid && !hotbidSoundPlayed.current) {
        hotbidSoundPlayed.current = true;
        playNotification('general');
      }
      setIsEndingSoon(enteringHotbid); // < 5 minutes = urgent

      if (days > 0) {
        setTimeRemaining(`${days}T ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [auction, playNotification]);

  const handleInstantBuy = async () => {
    if (!user) {
      toast({
        title: "Anmeldung erforderlich",
        description: "Bitte melden Sie sich an, um zu kaufen",
        variant: "destructive",
      });
      navigate(`/login?redirect=/auktion/${id}`);
      return;
    }

    if (!motorhome.instant_price) {
      toast({
        title: "Fehler",
        description: "Sofortkauf nicht verfügbar",
        variant: "destructive",
      });
      return;
    }

     setIsSubmitting(true);
    try {
      // Refresh session token before instant buy to prevent JWT expiry errors
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        toast({
          title: "Sitzung abgelaufen",
          description: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
          variant: "destructive",
        });
        navigate(`/login?redirect=/auktion/${id}`);
        setIsSubmitting(false);
        return;
      }

      // Call server-side Edge Function for secure instant buy
      const { data, error } = await supabase.functions.invoke('instant-buy', {
        body: { auctionId: id },
      });

      if (error) {
        // Edge Function returned an error
        const errorBody = typeof error === 'object' && 'message' in error
          ? error.message
          : 'Kauf konnte nicht abgeschlossen werden';
        throw new Error(errorBody);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Kauf erfolgreich!",
        description: `Sie haben dieses Wohnmobil für €${motorhome.instant_price.toLocaleString()} gekauft. Wir werden uns in Kürze bei Ihnen melden.`,
      });

      // Navigate to listings to show sold status
      setTimeout(() => {
        navigate('/kaufen', { replace: true });
      }, 2000);
    } catch (error: unknown) {
      const germanMessage = handleBusinessError(error, 'AuctionDetail.InstantBuy');
      toast({
        title: "Kauf fehlgeschlagen",
        description: germanMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlaceBid = async () => {
    const amount = parseFloat(bidAmount);
    const currentBid = auction.current_bid || auction.starting_bid;
    const minimumBid = currentBid + 50; // Minimum increment €50

    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Ungültiges Gebot",
        description: "Bitte geben Sie einen gültigen positiven Betrag ein",
        variant: "destructive",
      });
      return;
    }

    if (amount < minimumBid) {
      toast({
        title: "Gebot zu niedrig",
        description: `Mindestgebot: €${minimumBid.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Anmeldung erforderlich",
        description: "Bitte melden Sie sich an, um ein Gebot abzugeben",
        variant: "destructive",
      });
      navigate(`/login?redirect=/auktion/${id}`);
      return;
    }

    // Warn if bid is unusually high (more than 2x current bid)
    if (amount > currentBid * 2) {
      const confirmed = window.confirm(
        `Ihr Gebot von €${amount.toLocaleString()} ist mehr als doppelt so hoch wie das aktuelle Gebot von €${currentBid.toLocaleString()}. Möchten Sie fortfahren?`
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);

    try {
      // Refresh session token before placing bid to prevent JWT expiry errors
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        toast({
          title: "Sitzung abgelaufen",
          description: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
          variant: "destructive",
        });
        navigate(`/login?redirect=/auktion/${id}`);
        setIsSubmitting(false);
        return;
      }

      // Validate autobid settings
      if (enableAutobid) {
        const maxAmount = parseFloat(maxAutobidAmount);
        if (isNaN(maxAmount) || maxAmount <= amount) {
          toast({
            title: "Ungültiges Maximalgebot",
            description: "Maximalgebot muss höher als Ihr aktuelles Gebot sein",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Place bid via edge function
      const { data, error } = await supabase.functions.invoke('place-bid', {
        body: {
          auctionId: id,
          amount: amount,
          isAutobid: enableAutobid,
          maxAutobidAmount: enableAutobid ? parseFloat(maxAutobidAmount) : undefined,
        },
      });

      if (error) {
        // Try to extract the actual error message from the edge function response
        let errorMsg = error.message || 'Gebot konnte nicht abgegeben werden';
        if ('context' in error && (error as any).context?.body) {
          try {
            const body = await (error as any).context.body.json?.() || JSON.parse(await (error as any).context.body.text?.());
            if (body?.error) errorMsg = body.error;
          } catch { /* use default error message */ }
        }
        // Handle expired session specifically
        if (errorMsg === 'Unauthorized' || errorMsg.includes('Unauthorized') || errorMsg.includes('JWT')) {
          toast({
            title: "Sitzung abgelaufen",
            description: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an und versuchen Sie es nochmal.",
            variant: "destructive",
          });
          navigate(`/login?redirect=/auktion/${id}`);
          setIsSubmitting(false);
          return;
        }
        throw new Error(errorMsg);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Update local auction state if extended
      if (data.auctionExtended) {
        setAuction((prev) => prev ? ({ ...prev, end_time: data.newEndTime }) : null);
        toast({
          title: "Auktion verlängert!",
          description: "Die Auktion wurde um 5 Minuten verlängert",
        });
      }

      toast({
        title: "Gebot erfolgreich!",
        description: enableAutobid 
          ? `Ihr Gebot von €${amount.toLocaleString()} wurde abgegeben mit Autobid bis €${parseFloat(maxAutobidAmount).toLocaleString()}`
          : `Ihr Gebot von €${amount.toLocaleString()} wurde abgegeben`,
      });

      setBidAmount("");
      setMaxAutobidAmount("");
      setEnableAutobid(false);
    } catch (error: unknown) {
      const germanMessage = handleBusinessError(error, 'AuctionDetail.PlaceBid');
      toast({
        title: "Gebot fehlgeschlagen",
        description: germanMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!auction || !auction.motorhome) {
    return (
      <PageLayout title="Lädt..." description="Auktion wird geladen">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    );
  }

  const motorhome = auction.motorhome;
  const photos = motorhome.photos?.sort((a, b) => a.display_order - b.display_order) || [];
  const currentBid = auction.current_bid || auction.starting_bid;
  const reserveMet = auction.reserve_price ? currentBid >= auction.reserve_price : true;
  // Only show reserve price info to the seller or admin
  const canSeeReservePrice = user?.id === (motorhome as any).seller_id || isAdmin;

  // Generate Product structured data
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${motorhome.manufacturer} ${motorhome.model}`,
    description: motorhome.description || `${motorhome.manufacturer} ${motorhome.model} - Baujahr ${motorhome.year}`,
    brand: {
      '@type': 'Brand',
      name: motorhome.manufacturer,
    },
    model: motorhome.model,
    productionDate: motorhome.year?.toString(),
    image: photos[0]?.url || 'https://caravanwert.de/favicon.png',
    offers: {
      '@type': 'Offer',
      price: currentBid,
      priceCurrency: 'EUR',
      availability: auction.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      itemCondition: 'https://schema.org/UsedCondition',
      seller: {
        '@type': 'Organization',
        name: siteName,
      },
      priceValidUntil: auction.end_time,
    },
  };

  return (
    <PageLayout
      title={`${motorhome.manufacturer} ${motorhome.model}`}
      description={`Auktion für ${motorhome.manufacturer} ${motorhome.model} - Aktuelles Gebot: €${currentBid.toLocaleString()}`}
      keywords={`auktion, ${motorhome.manufacturer}, ${motorhome.model}, wohnmobil`}
      canonicalPath={`/auktion/${id}`}
      ogImage={photos[0]?.url}
      structuredData={productSchema}
    >
      <div className="min-h-screen relative overflow-hidden">
        {/* Consistent gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/80 via-sky-50/40 to-white" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-cyan-100/30 to-transparent" />
        
        <div className="container mx-auto px-4 max-w-7xl py-6 relative z-10">
          {/* Simple Header */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate("/kaufen")}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück zu Auktionen
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!user) {
                    toast({
                      title: "Anmeldung erforderlich",
                      description: "Bitte melden Sie sich an, um Auktionen zu beobachten.",
                      variant: "destructive",
                    });
                    navigate(`/login?redirect=/auktion/${id}`);
                    return;
                  }
                  setIsWatched(!isWatched);
                }}
                className={`gap-2 ${isWatched ? 'text-red-600 border-red-200' : ''}`}
              >
                <Heart className={`w-4 h-4 ${isWatched ? 'fill-current' : ''}`} />
                {isWatched ? 'Beobachtet' : 'Beobachten'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column - Photos and details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Enhanced Photo Gallery */}
              <Card className="overflow-hidden shadow-lg">
                <div className="relative group">
                  <div className="relative h-[500px] bg-muted overflow-hidden">
                    {photos.length > 0 ? (
                      <>
                        <img
                          src={photos[currentPhotoIndex]?.url}
                          alt={`${motorhome.manufacturer} ${motorhome.model}`}
                          className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                        />
                        
                        {/* Photo Navigation */}
                        {photos.length > 1 && (
                          <>
                            <button
                              onClick={() => setCurrentPhotoIndex(currentPhotoIndex > 0 ? currentPhotoIndex - 1 : photos.length - 1)}
                              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setCurrentPhotoIndex(currentPhotoIndex < photos.length - 1 ? currentPhotoIndex + 1 : 0)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        
                        {/* Photo Counter */}
                        <div className="absolute bottom-4 left-4 bg-black/75 text-white px-3 py-1 rounded-full text-sm">
                          {currentPhotoIndex + 1} / {photos.length}
                        </div>
                        
                        {/* Fullscreen Button */}
                        <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
                          <DialogTrigger asChild>
                            <button className="absolute top-4 right-4 bg-black/50 hover:bg-black/75 text-white p-2 rounded-full opacity-75 hover:opacity-100 transition-opacity">
                              <Maximize className="w-5 h-5" />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-7xl w-full h-[90vh] p-0 bg-black/95">
                            <div className="relative w-full h-full flex items-center justify-center">
                              <img
                                src={photos[currentPhotoIndex]?.url}
                                alt={`${motorhome.manufacturer} ${motorhome.model}`}
                                className="max-w-full max-h-full object-contain"
                              />
                              <button
                                onClick={() => setIsLightboxOpen(false)}
                                className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white p-2 rounded-full"
                              >
                                <X className="w-6 h-6" />
                              </button>
                              {photos.length > 1 && (
                                <>
                                  <button
                                    onClick={() => setCurrentPhotoIndex(currentPhotoIndex > 0 ? currentPhotoIndex - 1 : photos.length - 1)}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-3 rounded-full"
                                  >
                                    <ChevronLeft className="w-6 h-6" />
                                  </button>
                                  <button
                                    onClick={() => setCurrentPhotoIndex(currentPhotoIndex < photos.length - 1 ? currentPhotoIndex + 1 : 0)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white p-3 rounded-full"
                                  >
                                    <ChevronRight className="w-6 h-6" />
                                  </button>
                                </>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Car className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p>Keine Fotos verfügbar</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Enhanced Thumbnails */}
                  {photos.length > 1 && (
                    <div className="p-4 bg-card/50">
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {photos.map((photo, index) => (
                          <button
                            key={photo.id}
                            onClick={() => setCurrentPhotoIndex(index)}
                            className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 hover:scale-105 ${
                              index === currentPhotoIndex
                                ? "border-primary shadow-md"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <img
                              src={photo.url}
                              alt={`Thumbnail ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Comprehensive Vehicle Information */}
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Übersicht</TabsTrigger>
                  <TabsTrigger value="technical">Technik</TabsTrigger>
                  <TabsTrigger value="features">Ausstattung</TabsTrigger>
                  <TabsTrigger value="condition">Zustand</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  <Card className="p-6">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <Info className="w-6 h-6 text-primary" />
                      Fahrzeug-Übersicht
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Aufbauart</span>
                          <span className="font-semibold">{motorhome.body_type}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Zustand</span>
                          <Badge variant={motorhome.condition === 'Neuwertig' ? 'default' : 'secondary'}>
                            {motorhome.condition}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Erstzulassung</span>
                          <span className="font-semibold">
                            {motorhome.first_registration ? new Date(motorhome.first_registration).toLocaleDateString('de-DE') : 'Nicht angegeben'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Vorbesitzer</span>
                          <span className="font-semibold">{motorhome.previous_owners || 'Nicht angegeben'}</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Gesamtgewicht</span>
                          <span className="font-semibold">{motorhome.weight_kg ? `${motorhome.weight_kg.toLocaleString()} kg` : 'Nicht angegeben'}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Nutzlast</span>
                          <span className="font-semibold">{motorhome.payload_kg ? `${motorhome.payload_kg.toLocaleString()} kg` : 'Nicht angegeben'}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Achsen</span>
                          <span className="font-semibold">{motorhome.number_of_axles || 'Nicht angegeben'}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Sitzplätze mit Gurt</span>
                          <span className="font-semibold">{motorhome.seats || 'Nicht angegeben'}</span>
                        </div>
                      </div>
                    </div>
                    
                    {motorhome.description && (
                      <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                        <h3 className="font-semibold mb-2">Beschreibung</h3>
                        <p className="text-muted-foreground whitespace-pre-wrap">{motorhome.description}</p>
                      </div>
                    )}

                    {/* Known Defects Section - Prominent Display */}
                    {(motorhome as any).damage_summary ? (
                      <div className="mt-6 p-4 border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                        <h3 className="font-semibold mb-2 flex items-center gap-2 text-orange-700 dark:text-orange-300">
                          <AlertTriangle className="w-5 h-5" />
                          Bekannte Mängel
                        </h3>
                        <p className="text-orange-800 dark:text-orange-200 whitespace-pre-wrap">{(motorhome as any).damage_summary}</p>
                      </div>
                    ) : (motorhome as any).has_damage && (
                      <div className="mt-6 p-4 border-2 border-green-500 bg-green-50 dark:bg-green-950/20 rounded-lg">
                        <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-700 dark:text-green-300">
                          <CheckCircle2 className="w-5 h-5" />
                          Keine bekannten Mängel
                        </h3>
                        <p className="text-green-700 dark:text-green-300 text-sm">
                          Der Verkäufer hat angegeben, dass keine wesentlichen Mängel am Fahrzeug bekannt sind.
                        </p>
                      </div>
                    )}
                  </Card>

                  {/* Vehicle Question Form */}
                  <VehicleQuestionForm 
                    motorhomeId={motorhome.id} 
                    vehicleTitle={`${motorhome.manufacturer} ${motorhome.model}`}
                  />
                </TabsContent>

                <TabsContent value="technical" className="space-y-6">
                  <Card className="p-6">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <Cog className="w-6 h-6 text-primary" />
                      Technische Daten
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Baujahr</p>
                          <p className="font-semibold">{motorhome.year}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Gauge className="w-5 h-5 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Kilometerstand</p>
                          <p className="font-semibold">{motorhome.mileage.toLocaleString()} km</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Fuel className="w-5 h-5 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Kraftstoff</p>
                          <p className="font-semibold">{motorhome.fuel_type || 'Nicht angegeben'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Zap className="w-5 h-5 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Leistung</p>
                          <p className="font-semibold">
                            {motorhome.engine_power_hp ? `${motorhome.engine_power_hp} PS` : 'Nicht angegeben'}
                            {motorhome.power_kw && ` (${motorhome.power_kw} kW)`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Cog className="w-5 h-5 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Getriebe</p>
                          <p className="font-semibold">{motorhome.transmission || 'Nicht angegeben'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Shield className="w-5 h-5 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Schadstoffklasse</p>
                          <p className="font-semibold">{motorhome.emission_class || 'Nicht angegeben'}</p>
                        </div>
                      </div>
                      {(motorhome as any).engine_displacement_ccm && (
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Cog className="w-5 h-5 text-primary flex-shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Hubraum</p>
                            <p className="font-semibold">{(motorhome as any).engine_displacement_ccm.toLocaleString()} ccm</p>
                          </div>
                        </div>
                      )}
                      {(motorhome as any).main_tires && (
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Car className="w-5 h-5 text-primary flex-shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Hauptreifen</p>
                            <p className="font-semibold">{(motorhome as any).main_tires}</p>
                          </div>
                        </div>
                      )}
                      {(motorhome as any).second_tires && (
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Car className="w-5 h-5 text-primary flex-shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Zweiter Reifensatz</p>
                            <p className="font-semibold">{(motorhome as any).second_tires}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <div className="flex items-center gap-2 mb-3">
                          <Ruler className="w-5 h-5 text-primary" />
                          <h3 className="font-semibold">Abmessungen</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Länge:</span>
                            <span>{motorhome.length_m ? `${(motorhome.length_m / 100).toFixed(2)} m` : '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Breite:</span>
                            <span>{motorhome.width_m ? `${(motorhome.width_m / 100).toFixed(2)} m` : '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Höhe:</span>
                            <span>{motorhome.height_m ? `${(motorhome.height_m / 100).toFixed(2)} m` : '—'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Droplets className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold">Wassertanks</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Frischwasser:</span>
                            <span>{motorhome.water_tank_liters ? `${motorhome.water_tank_liters} L` : '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Grauwasser:</span>
                            <span>{motorhome.grey_water_capacity_liters ? `${motorhome.grey_water_capacity_liters} L` : '—'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Sun className="w-5 h-5 text-green-600" />
                          <h3 className="font-semibold">Energie</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Solar:</span>
                            <span>{motorhome.has_solar ? `${motorhome.solar_power_watts || '—'} W` : 'Nein'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Batterie:</span>
                            <span>{motorhome.battery_capacity_ah ? `${motorhome.battery_capacity_ah} Ah` : '—'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="features" className="space-y-6">
                  <Card className="p-6">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <Award className="w-6 h-6 text-primary" />
                      Ausstattung & Features
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Home className="w-5 h-5 text-primary" />
                          Innenausstattung
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { key: 'has_kitchen', label: 'Küche', icon: Home },
                            { key: 'has_toilet', label: 'Toilette', icon: Droplets },
                            { key: 'has_shower', label: 'Dusche', icon: Droplets },
                          ].map(({ key, label, icon: Icon }) => (
                            <div key={key} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">{label}</span>
                              </div>
                              <Badge variant={motorhome[key] ? 'default' : 'secondary'}>
                                {motorhome[key] ? 'Ja' : 'Nein'}
                              </Badge>
                            </div>
                          ))}
                          <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                            <div className="flex items-center gap-2">
                              <Bed className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">Schlafplätze</span>
                            </div>
                            <Badge variant="default">{motorhome.sleeping_places}</Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                            <div className="flex items-center gap-2">
                              <Home className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">Klimaanlage</span>
                            </div>
                            <Badge variant="secondary">{motorhome.air_conditioning_type}</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Car className="w-5 h-5 text-primary" />
                          Außenausstattung
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { key: 'has_solar', label: 'Solaranlage', icon: Sun },
                            { key: 'has_awning', label: 'Markise', icon: Umbrella },
                            { key: 'has_bike_rack', label: 'Fahrradträger', icon: Car },
                            { key: 'has_garage', label: 'Garage', icon: Home },
                            { key: 'has_backup_camera', label: 'Rückfahrkamera', icon: Eye },
                            { key: 'has_parking_sensors', label: 'Parksensoren', icon: Shield },
                          ].map(({ key, label, icon: Icon }) => (
                            <div key={key} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">{label}</span>
                              </div>
                              <Badge variant={motorhome[key] ? 'default' : 'secondary'}>
                                {motorhome[key] ? 'Ja' : 'Nein'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="condition" className="space-y-6">
                  <Card className="p-6">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <CheckCircle className="w-6 h-6 text-primary" />
                      Fahrzeugzustand
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-semibold">Unfallfreiheit</span>
                          </div>
                          <Badge variant={motorhome.accident_free ? 'default' : 'destructive'}>
                            {motorhome.accident_free ? 'Unfallfrei' : 'Unfall vorhanden'}
                          </Badge>
                        </div>
                        
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold">Raucherfahrzeug</span>
                          </div>
                          <Badge variant={motorhome.non_smoker ? 'default' : 'secondary'}>
                            {motorhome.non_smoker ? 'Nichtraucher' : 'Raucherfahrzeug'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Award className="w-5 h-5 text-purple-600" />
                            <span className="font-semibold">Serviceheft</span>
                          </div>
                          <Badge variant={motorhome.service_history_available ? 'default' : 'secondary'}>
                            {motorhome.service_history_available ? 'Verfügbar' : 'Nicht verfügbar'}
                          </Badge>
                        </div>
                        
                        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-5 h-5 text-orange-600" />
                            <span className="font-semibold">TÜV/HU</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {motorhome.tuev_valid_until 
                              ? `Gültig bis: ${new Date(motorhome.tuev_valid_until).toLocaleDateString('de-DE')}`
                              : 'Nicht angegeben'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Enhanced Bid History */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Users className="w-6 h-6 text-primary" />
                    Gebotsverlauf
                  </h2>
                  <Badge variant="outline" className="px-3 py-1">
                    {bids.length} Gebote
                  </Badge>
                </div>

                {bids.length > 0 && (
                  <div className="mb-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Aktuell führend</p>
                        <p className="font-semibold text-primary">
                          {bids[0]?.bidder?.company_name || 
                           `${bids[0]?.bidder?.first_name} ${bids[0]?.bidder?.last_name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">
                          €{(bids[0]?.amount ?? 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          vor {bids[0]?.created_at ? Math.floor((Date.now() - new Date(bids[0].created_at).getTime()) / (1000 * 60)) : 0} Min.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {bids.length > 0 ? (
                    bids.map((bid, index) => (
                      <div
                        key={bid.id}
                        className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                          index === 0 
                            ? 'bg-primary/10 border border-primary/20' 
                            : 'bg-muted/50 hover:bg-muted/70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            #{index + 1}
                          </div>
                          <div>
                            <p className="font-semibold flex items-center gap-2">
                              {bid.bidder?.company_name ||
                                `${bid.bidder?.first_name} ${bid.bidder?.last_name}`}
                              {bid.is_autobid && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Zap className="w-3 h-3" /> Auto
                                </Badge>
                              )}
                              {index === 0 && (
                                <Badge className="text-xs bg-green-500">
                                  Führend
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(bid.created_at).toLocaleString("de-DE")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            index === 0 ? 'text-primary' : 'text-foreground'
                          }`}>
                            €{bid.amount.toLocaleString()}
                          </p>
                          {index > 0 && (
                            <p className="text-xs text-green-600">
                              +€{(bid.amount - bids[index]?.amount || 0).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Gavel className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground font-medium">Noch keine Gebote vorhanden</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Seien Sie der Erste und geben Sie ein Gebot ab!
                      </p>
                    </div>
                  )}
                </div>

                {bids.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Durchschnitt</p>
                        <p className="font-semibold">
                          €{Math.round(bids.reduce((sum, bid) => sum + bid.amount, 0) / bids.length).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Höchstes Gebot</p>
                        <p className="font-semibold text-primary">
                          €{Math.max(...bids.map(b => b.amount)).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Bieter</p>
                        <p className="font-semibold">
                          {new Set(bids.map(b => b.bidder_id)).size}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Simplified Right column - Bidding Sidebar */}
            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-24 space-y-6">
                <div>
                  <h1 className="text-2xl font-bold mb-2">
                    {motorhome.manufacturer} {motorhome.model}
                  </h1>
                  <p className="text-muted-foreground mb-2">
                    {motorhome.body_type} • {motorhome.year}
                  </p>
                  {motorhome.seller && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span>Verkäufer: {motorhome.seller.company_name || `${motorhome.seller.first_name} ${motorhome.seller.last_name}`}</span>
                    </div>
                  )}
                </div>

                {/* Trust Indicators & Vehicle Badges */}
                <div className="space-y-3">
                  {/* Platform Trust Badges */}
                  <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Geprüft</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Verifiziert</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Sicher</span>
                    </div>
                  </div>
                  
                  {/* Vehicle Condition Badges */}
                  <div className="flex flex-wrap gap-2">
                    {motorhome.accident_free && (
                      <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                        <CheckCircle className="w-3 h-3" />
                        Unfallfrei
                      </Badge>
                    )}
                    {motorhome.non_smoker && (
                      <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                        <Shield className="w-3 h-3" />
                        Nichtraucher
                      </Badge>
                    )}
                    {motorhome.service_history_available && (
                      <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                        <Award className="w-3 h-3" />
                        Serviceheft
                      </Badge>
                    )}
                    {motorhome.tuv_new && (
                      <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                        <CheckCircle className="w-3 h-3" />
                        TÜV neu
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Timer */}
                {isEndingSoon && timeRemaining !== "Beendet" ? (
                  <div className="text-center p-4 -mx-2 rounded-xl bg-gradient-to-br from-destructive/10 via-destructive/5 to-orange-500/10 border-2 border-destructive/30 animate-pulse">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="text-lg">🔥</span>
                      <p className="text-sm font-bold text-destructive uppercase tracking-wider">
                        Hotbid-Phase
                      </p>
                      <span className="text-lg">🔥</span>
                    </div>
                    <p className="text-4xl font-extrabold text-destructive tabular-nums">
                      {timeRemaining}
                    </p>
                    <p className="text-xs text-destructive/80 mt-1 font-medium">
                      Gebote verlängern die Auktion!
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-primary" />
                      <p className="text-sm font-medium">
                        {timeRemaining === "Beendet" ? "Auktionsstatus" : "Verbleibende Zeit"}
                      </p>
                    </div>
                    <p
                      className={`text-3xl font-bold ${
                        timeRemaining === "Beendet"
                          ? "text-muted-foreground"
                          : ""
                      }`}
                    >
                      {timeRemaining}
                    </p>
                    {timeRemaining === "Beendet" && auction.status === "active" && (
                      <p className="text-xs text-muted-foreground mt-1">Status wird aktualisiert...</p>
                    )}
                  </div>
                )}

                <Separator />

                {/* Current bid */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Aktuelles Gebot</p>
                  <p className="text-4xl font-bold text-primary">
                    €{currentBid.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <TrendingUp className="w-4 h-4" />
                    <span>Startgebot: €{auction.starting_bid.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span>{bids.length} Gebote</span>
                    <span>{bids.length > 0 ? new Set(bids.map(b => b.bidder_id)).size : 0} Bieter</span>
                  </div>
                </div>

                {/* Commission Display - always visible for dealers */}
                {(primaryRole === 'dealer' || isAdmin) && currentBid > 0 && (
                  <CommissionDisplay 
                    bidAmount={currentBid} 
                    variant="detailed"
                  />
                )}

                {/* Reserve price indicator - only visible to seller and admin */}
                {canSeeReservePrice && auction.reserve_price && (
                  <div>
                    {reserveMet ? (
                      <Badge className="w-full justify-center bg-green-500 text-white">
                        Mindestpreis erreicht
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="w-full justify-center">
                        Mindestpreis noch nicht erreicht
                      </Badge>
                    )}
                  </div>
                )}

                <Separator />

                {/* Instant Buy Section */}
                {motorhome.instant_price && 
                 motorhome.sale_channel === 'instant_price' &&
                 motorhome.status !== 'sold' && (
                  <>
                    <div className="space-y-3 p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Sofortkauf</p>
                          <p className="text-2xl font-bold text-primary">
                            €{motorhome.instant_price.toLocaleString()}
                          </p>
                        </div>
                        <Zap className="w-8 h-8 text-primary" />
                      </div>
                      <Button
                        onClick={handleInstantBuy}
                        disabled={isSubmitting || auction.status !== 'active'}
                        className="w-full h-12 text-lg bg-primary hover:bg-primary/90"
                      >
                        <Zap className="w-5 h-5 mr-2" />
                        {isSubmitting ? "Wird gekauft..." : "Jetzt kaufen"}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Sofort kaufen und Auktion beenden
                      </p>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Sold Badge */}
                {motorhome.status === 'sold' ? (
                  <div className="text-center py-4">
                    <Badge className="text-lg bg-green-500 text-white">
                      Verkauft
                    </Badge>
                    {motorhome.sale_type === 'instant' && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Per Sofortkauf verkauft
                      </p>
                    )}
                  </div>
                ) : auction.status === "active" && timeRemaining !== "Beendet" ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Ihr Gebot (Mindestens €{(currentBid + 50).toLocaleString()})
                      </label>
                      <Input
                        type="number"
                        placeholder="Betrag eingeben"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        min={currentBid + 50}
                        step={50}
                        className="text-lg h-12"
                      />
                    </div>

                    {/* Commission Display */}
                    {bidAmount && parseFloat(bidAmount) > 0 && (
                      <CommissionDisplay 
                        bidAmount={parseFloat(bidAmount)} 
                        variant="detailed"
                        className="animate-fade-in"
                      />
                    )}

                    {/* Autobid Option */}
                    <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="autobid"
                          checked={enableAutobid}
                          onCheckedChange={(checked) => setEnableAutobid(checked as boolean)}
                        />
                        <div className="flex-1">
                          <Label htmlFor="autobid" className="cursor-pointer font-medium flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary" />
                            Automatisches Mitbieten aktivieren
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            System bietet automatisch für Sie mit, wenn Sie überboten werden
                          </p>
                        </div>
                      </div>

                      {enableAutobid && (
                        <div className="animate-fade-in">
                          <label className="text-sm font-medium mb-2 block">
                            Maximalgebot (Muss höher als aktuelles Gebot sein)
                          </label>
                          <Input
                            type="number"
                            placeholder="Ihr maximales Gebot"
                            value={maxAutobidAmount}
                            onChange={(e) => setMaxAutobidAmount(e.target.value)}
                            min={parseFloat(bidAmount || "0") + 50}
                            step={50}
                            className="h-10"
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            Das System bietet automatisch bis zu diesem Betrag für Sie mit
                          </p>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handlePlaceBid}
                      disabled={isSubmitting || !bidAmount || (enableAutobid && !maxAutobidAmount)}
                      className="w-full h-12 text-lg gradient-hero hover:gradient-hero-hover"
                    >
                      <Gavel className="w-5 h-5 mr-2" />
                      {isSubmitting ? "Wird geboten..." : "Gebot abgeben"}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Gebote sind verbindlich. Mindesterhöhung: €100
                    </p>
                  </div>
                ) : auction.status === "kaufchance" && (auction as any).kaufchance_expires_at ? (
                  <div className="space-y-4">
                    <div className="p-4 border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-5 h-5 text-amber-600" />
                        <h3 className="font-semibold text-amber-700 dark:text-amber-300">
                          Kaufchance!
                        </h3>
                      </div>
                      <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                        Diese Auktion endete ohne Verkauf. Sie können jetzt ein Direktangebot abgeben!
                      </p>
                      <KaufchanceBadge expiresAt={(auction as any).kaufchance_expires_at} className="mb-3" />
                      <PostAuctionOfferDialog
                        auctionId={auction.id}
                        currentBid={currentBid}
                        vehicleTitle={`${motorhome.manufacturer} ${motorhome.model}`}
                      >
                        <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                          <Zap className="w-4 h-4 mr-2" />
                          Jetzt Angebot abgeben
                        </Button>
                      </PostAuctionOfferDialog>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Badge variant="secondary" className="text-lg">
                      Auktion beendet
                    </Badge>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default AuctionDetail;
