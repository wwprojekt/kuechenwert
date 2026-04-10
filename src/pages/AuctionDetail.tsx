import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js';
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { handleAndLogError, handleApiError, handleBusinessError } from "@/lib/errorLogService";
import { getFreshAccessToken, isTokenValid, ensureValidRLSSession } from "@/lib/sessionGuard";
import { useSessionExpired } from "@/components/SessionExpiredDialog";
import { trackVehicleViewed } from "@/lib/gadsConversionService";
import { trackMetaViewContent } from "@/lib/metaPixelService";
import { trackEvent } from "@/lib/analyticsService";
import { VehicleQuestionForm } from "@/components/VehicleQuestionForm";
import { KaufchanceBadge } from "@/components/KaufchanceBadge";
import { PostAuctionOfferDialog } from "@/components/PostAuctionOfferDialog";
import { useAudioNotification } from "@/hooks/useAudioNotification";
import { useFavorites } from "@/hooks/useFavorites";
import { anonymizePostalCode, getPlzCoordinates } from "@/lib/plzCoordinates";
import { calculateDistance, formatDistance } from "@/lib/geolocation";
import { CountryFlag } from "@/components/CountryFlag";
import type { Database } from "@/integrations/supabase/types";

// Define types for better type safety
type AuctionRow = Database["public"]["Tables"]["auctions"]["Row"];
type MotorhomeRow = Database["public"]["Tables"]["motorhomes"]["Row"];
type BidRow = Database["public"]["Tables"]["bids"]["Row"];
type PhotoRow = Database["public"]["Tables"]["motorhome_photos"]["Row"];

interface AuctionWithMotorhome extends AuctionRow {
  motorhome: MotorhomeRow & {
    photos: PhotoRow[];
  };
}

type BidWithBidder = BidRow;
import {
  Clock,
  TrendingUp,
  Users,
  User,
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
  AlertTriangle,
  MapPin,
  Navigation,
  ArrowUp,
  ArrowDown,
  Crown,
  Bell,
  FileText,
  Lock,
  Building2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CommissionDisplay } from "@/components/CommissionDisplay";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const AuctionDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { primaryRole, isDealer } = useUserRole();
  const isAdmin = primaryRole === 'admin';
  const canSeePrices = isDealer || isAdmin;
  const siteName = settings?.site_name || 'CaravanWert';
  const { toast } = useToast();
  const navigate = useNavigate();
  const { showSessionExpired } = useSessionExpired();

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
  const { isFavorite, toggleFavorite, isLoading: isFavLoading } = useFavorites();
  const hotbidSoundPlayed = useRef(false);
  const { playNotification, notifyOutbid } = useAudioNotification();
  const [addenda, setAddenda] = useState<{id: string; content: string; created_at: string}[]>([]);

  // Check if current user is invited to kaufchance (React Query for dedup + caching)
  const { data: isInvitedToKaufchanceData } = useQuery({
    queryKey: ['kaufchanceInvitation', id, user?.id],
    queryFn: async () => {
      // Session-Check VOR RLS-Query (getSession gibt auch abgelaufene Tokens zurück!)
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) {
        showSessionExpired(`/auktion/${id}`);
        return false;
      }
      const { data, error } = await supabase
        .from('kaufchance_invitations')
        .select('id')
        .eq('auction_id', id!)
        .eq('bidder_id', user!.id)
        .maybeSingle();
      return !error && !!data;
    },
    enabled: !!user && !!id,
    staleTime: 60 * 1000,
    retry: 1,
  });
  const isInvitedToKaufchance = isInvitedToKaufchanceData ?? false;

  // Live Bidding Status
  const [bidStatusAnimation, setBidStatusAnimation] = useState<'none' | 'pulse-green' | 'pulse-red'>('none');
  const prevHighestBidderRef = useRef<boolean | null>(null);
  const [neighborAuctions, setNeighborAuctions] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null });

  // Fetch neighboring auctions for prev/next navigation
  useEffect(() => {
    const fetchNeighbors = async () => {
      if (!id) return;
      try {
        // Fetch all active auctions ordered by end_time (same order as /kaufen)
        const { data, error } = await supabase
          .from('auctions')
          .select('id')
          .eq('status', 'active')
          .order('end_time', { ascending: true });
        if (error || !data) return;
        const idx = data.findIndex((a) => a.id === id);
        if (idx === -1) return;
        setNeighborAuctions({
          prev: idx > 0 ? data[idx - 1].id : null,
          next: idx < data.length - 1 ? data[idx + 1].id : null,
        });
      } catch {
        // Silently fail – navigation is a convenience feature
      }
    };
    fetchNeighbors();
  }, [id]);

  // Validate UUID format
  const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  // Fetch dealer's postal code for distance calculation (React Query for cross-page caching)
  const { data: dealerPostalCode = null } = useQuery({
    queryKey: ['profilePostalCode', user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_zip, address_zip")
        .eq("id", user!.id)
        .maybeSingle();
      return profile?.company_zip || profile?.address_zip || null;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // PLZ changes very rarely
  });

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
            photos:motorhome_photos(*)
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
      lastAuctionStatusRef.current = data.status;

      // Google Ads: Fahrzeug angesehen (Remarketing)
      if (data.motorhome) {
        const mh = data.motorhome;
        trackVehicleViewed(mh.id, `${mh.manufacturer} ${mh.model} (${mh.year})`);
        trackMetaViewContent({
          content_name: `${mh.manufacturer} ${mh.model} (${mh.year})`,
          content_category: mh.body_type || 'Wohnmobil',
          content_ids: [mh.id],
          content_type: 'vehicle',
          value: data.current_bid || data.starting_bid || 0,
          currency: 'EUR',
        });
        trackEvent('auction_viewed', { category: 'auction', label: `${mh.manufacturer} ${mh.model}`, value: data.current_bid || data.starting_bid || 0, properties: { auctionId: data.id, manufacturer: mh.manufacturer, model: mh.model, bodyType: mh.body_type, bidsCount: data.bids_count } });
      }
    };

    fetchAuction();
  }, [id, toast, navigate]);

  // Fetch bids
  useEffect(() => {
    const fetchBids = async () => {
      const { data, error } = await supabase
        .from("bids")
        .select("*")
        .eq("auction_id", id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setBids(Array.isArray(data) ? data : []);
      }
    };

    fetchBids();
  }, [id]);

  // Fetch addenda (Nachträge)
  useEffect(() => {
    const fetchAddenda = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("auction_addenda")
        .select("id, content, created_at")
        .eq("auction_id", id)
        .order("created_at", { ascending: true });
      if (!error && data) {
        setAddenda(data);
      }
    };
    fetchAddenda();
  }, [id]);

  // Set of bid IDs already known locally (for dedup against Realtime)
  const knownBidIdsRef = useRef<Set<string>>(new Set());
  // Track last-known auction status for Realtime toast dedup
  const lastAuctionStatusRef = useRef<string | null>(auction?.status ?? null);

  // Real-time bid updates with dedup against optimistic updates
  useEffect(() => {
    let isSubscribed = true;
    
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
        (payload) => {
          if (!isSubscribed) return;
          const newBid = payload.new as BidWithBidder;

          // Dedup: Skip if this bid was already added via optimistic update
          if (knownBidIdsRef.current.has(newBid.id)) {
            knownBidIdsRef.current.delete(newBid.id);
            return;
          }

          setBids((prev) => [newBid, ...(Array.isArray(prev) ? prev : [])]);

          setAuction((prev) => prev ? ({
            ...prev,
            current_bid: newBid.amount,
          }) : null);

          // ─── Live Bidding Status & Sound ───────────────────────
          if (user) {
            const isNewBidFromMe = newBid.bidder_id === user.id;
            
            if (isNewBidFromMe) {
              setBidStatusAnimation('pulse-green');
              setTimeout(() => setBidStatusAnimation('none'), 2000);
            } else {
              const wasHighestBidder = prevHighestBidderRef.current;
              if (wasHighestBidder) {
                setBidStatusAnimation('pulse-red');
                setTimeout(() => setBidStatusAnimation('none'), 3000);
                notifyOutbid(newBid.amount);
              }
              
              toast({
                title: wasHighestBidder ? "Sie wurden überboten!" : "Neues Gebot!",
                description: wasHighestBidder
                  ? `Neues Höchstgebot: ${Number(newBid.amount).toLocaleString("de-DE")} €. Bieten Sie erneut!`
                  : `Neues Gebot: ${Number(newBid.amount).toLocaleString("de-DE")} €`,
                variant: wasHighestBidder ? "destructive" : "default",
              });
            }
          } else {
            toast({
              title: "Neues Gebot!",
              description: `Aktuelles Höchstgebot: ${Number(newBid.amount).toLocaleString("de-DE")} €`,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auctions",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          if (!isSubscribed) return;
          const updated = payload.new as AuctionRow;
          const prevStatus = lastAuctionStatusRef.current;

          setAuction((prev) => {
            if (!prev) return prev;
            const changes: Partial<AuctionWithMotorhome> = {};

            if (updated.end_time && updated.end_time !== prev.end_time) {
              changes.end_time = updated.end_time;
            }
            if (updated.status && updated.status !== prev.status) {
              changes.status = updated.status;
            }
            if (updated.current_bid != null && updated.current_bid !== prev.current_bid) {
              changes.current_bid = updated.current_bid;
            }

            if (Object.keys(changes).length === 0) return prev;
            return { ...prev, ...changes };
          });

          // Status-change toasts (compared via ref, outside state updater)
          if (updated.status && updated.status !== prevStatus) {
            lastAuctionStatusRef.current = updated.status;
            if (updated.status === 'sold') {
              toast({ title: "Auktion beendet", description: "Diese Auktion wurde verkauft." });
            } else if (updated.status === 'ended') {
              toast({ title: "Auktion beendet", description: "Diese Auktion ist abgelaufen." });
            } else if (updated.status === 'kaufchance') {
              toast({ title: "Kaufchance!", description: "Diese Auktion bietet jetzt eine Kaufchance." });
            }
          }
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, [id, user, toast, notifyOutbid]);

  // Realtime: Subscribe to kaufchance offer changes (seller responds to this user's offers)
  useEffect(() => {
    if (!user || !id || auction?.status !== 'kaufchance') return;

    const kaufchanceChannel = supabase
      .channel(`kaufchance-detail-${id}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "post_auction_offers",
          filter: `buyer_id=eq.${user.id}`,
        },
        (payload) => {
          const newRecord = payload.new as any;
          if (newRecord.auction_id !== id) return;

          if (newRecord.status === "countered") {
            const amount = newRecord.counter_offer_amount;
            toast({
              title: "Neues Gegenangebot!",
              description: amount
                ? `Der Verkäufer hat ein Gegenangebot über ${Number(amount).toLocaleString("de-DE")} € gemacht.`
                : "Der Verkäufer hat ein Gegenangebot gemacht.",
            });
          } else if (newRecord.status === "accepted") {
            toast({
              title: "🎉 Angebot angenommen!",
              description: "Der Verkäufer hat Ihr Angebot akzeptiert! Der Kaufvertrag wird erstellt.",
            });
          } else if (newRecord.status === "rejected") {
            toast({
              title: "Angebot abgelehnt",
              description: "Ihr Angebot wurde abgelehnt. Sie können ein neues Angebot abgeben.",
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(kaufchanceChannel);
    };
  }, [id, user, auction?.status, toast]);

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

      const enteringHotbid = distance < 1 * 60 * 1000;
      if (enteringHotbid && !hotbidSoundPlayed.current) {
        hotbidSoundPlayed.current = true;
        playNotification('general');
      }
      setIsEndingSoon(enteringHotbid); // < 1 minute = urgent (soft-close window)

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
      // Get a guaranteed fresh JWT token (validates token structure + expiry)
      let accessToken = await getFreshAccessToken();
      if (!accessToken) {
        showSessionExpired(`/auktion/${id}`);
        setIsSubmitting(false);
        return;
      }

      // Call server-side Edge Function for secure instant buy – with 401 retry
      let { data, error } = await supabase.functions.invoke('instant-buy', {
        body: { auctionId: id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // Automatic retry on 401
      if (error instanceof FunctionsHttpError && error.context?.status === 401) {
        logger.warn('instant-buy: 401 on first attempt, retrying with fresh token...');
        accessToken = await getFreshAccessToken();
        if (accessToken) {
          const retry = await supabase.functions.invoke('instant-buy', {
            body: { auctionId: id },
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          data = retry.data;
          error = retry.error;
        }
      }

      if (error) {
        let errorMsg = error.message || 'Kauf konnte nicht abgeschlossen werden';
        if (error instanceof FunctionsHttpError) {
          if (error.context?.status === 401) {
            showSessionExpired(`/auktion/${id}`);
            setIsSubmitting(false);
            return;
          }
          try {
            const body = await error.context.json();
            if (body?.error) errorMsg = body.error;
          } catch {
            try {
              const text = await error.context.text();
              if (text) errorMsg = text;
            } catch { /* use default */ }
          }
        } else if (error instanceof FunctionsRelayError) {
          errorMsg = 'Verbindungsfehler zum Server. Bitte versuchen Sie es erneut.';
        } else if (error instanceof FunctionsFetchError) {
          errorMsg = 'Der Server ist momentan nicht erreichbar. Bitte versuchen Sie es später erneut.';
        }
        throw new Error(errorMsg);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Google Ads: Sofortkauf-Conversion
      try {
        const safeGtag = window.gtag || ((...args: unknown[]) => window.dataLayer?.push(args));
        safeGtag('event', 'conversion', {
          send_to: 'AW-18033517246/JO7oCPuNkY4cEL7FhpdD',
          value: motorhome.instant_price,
          currency: 'EUR',
        });
        safeGtag('event', 'purchase', {
          event_category: 'Auction',
          event_label: `instant_buy_${motorhome.manufacturer}_${motorhome.model}`,
          value: motorhome.instant_price,
          currency: 'EUR',
          transaction_id: id,
          items: [{ id: motorhome.id, name: `${motorhome.manufacturer} ${motorhome.model}`, category: 'Wohnmobil', price: motorhome.instant_price }],
        });
      } catch { /* tracking should never break the purchase flow */ }

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
      // Validate autobid settings first (no network needed)
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

      // Get a guaranteed fresh JWT token (validates token structure + expiry)
      let accessToken = await getFreshAccessToken();
      if (!accessToken) {
        showSessionExpired(`/auktion/${id}`);
        setIsSubmitting(false);
        return;
      }

      // Place bid via edge function – with automatic retry on 401
      const bidBody = {
        auctionId: id,
        amount: amount,
        isAutobid: enableAutobid,
        maxAutobidAmount: enableAutobid ? parseFloat(maxAutobidAmount) : undefined,
      };

      let { data, error } = await supabase.functions.invoke('place-bid', {
        body: bidBody,
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // Automatic retry on 401: refresh token once more and try again
      if (error instanceof FunctionsHttpError && error.context?.status === 401) {
        logger.warn('place-bid: 401 on first attempt, retrying with fresh token...');
        accessToken = await getFreshAccessToken();
        if (accessToken) {
          const retry = await supabase.functions.invoke('place-bid', {
            body: bidBody,
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          data = retry.data;
          error = retry.error;
        }
      }

      if (error) {
        let errorMsg = error.message || 'Gebot konnte nicht abgegeben werden';
        let serverMinimumBid: number | undefined;
        let serverCurrentBid: number | undefined;
        if (error instanceof FunctionsHttpError) {
          if (error.context?.status === 401) {
            showSessionExpired(`/auktion/${id}`);
            setIsSubmitting(false);
            return;
          }
          try {
            const body = await error.context.json();
            if (body?.error) errorMsg = body.error;
            if (body?.minimum_bid) serverMinimumBid = body.minimum_bid;
            if (body?.current_bid) serverCurrentBid = body.current_bid;
          } catch {
            try {
              const text = await error.context.text();
              if (text) errorMsg = text;
            } catch { /* use default */ }
          }
        } else if (error instanceof FunctionsRelayError) {
          errorMsg = 'Verbindungsfehler zum Server. Bitte versuchen Sie es erneut.';
        } else if (error instanceof FunctionsFetchError) {
          errorMsg = 'Der Server ist momentan nicht erreichbar. Bitte versuchen Sie es später erneut.';
        }

        // Auto-update local auction state with server's current bid if stale
        if (serverCurrentBid && auction) {
          const localBid = auction.current_bid || auction.starting_bid;
          if (serverCurrentBid > localBid) {
            setAuction(prev => prev ? { ...prev, current_bid: serverCurrentBid } : prev);
          }
        }
        // Pre-fill input with server minimum so user can bid with one tap
        if (serverMinimumBid) {
          setBidAmount(String(serverMinimumBid));
        }

        throw new Error(errorMsg);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // ─── Optimistic local update ─────────────────────────────
      // Immediately update UI so the bidder sees their bid without waiting for Realtime
      const bidId = data.bid?.id;
      if (bidId) {
        // Register bid_id for dedup so Realtime doesn't add it again
        knownBidIdsRef.current.add(bidId);
        // Auto-cleanup after 10s (Realtime should arrive well within that)
        setTimeout(() => knownBidIdsRef.current.delete(bidId), 10_000);

        // Add bid to the list optimistically
        const optimisticBid: BidWithBidder = {
          id: bidId,
          auction_id: id!,
          bidder_id: user!.id,
          amount: amount,
          is_autobid: enableAutobid,
          max_autobid_amount: enableAutobid ? parseFloat(maxAutobidAmount) : null,
          created_at: new Date().toISOString(),
        };
        setBids((prev) => [optimisticBid, ...(Array.isArray(prev) ? prev : [])]);
      }

      // Update auction current_bid immediately
      setAuction((prev) => prev ? ({
        ...prev,
        current_bid: data.currentBid ?? amount,
        ...(data.auctionExtended ? { end_time: data.newEndTime } : {}),
      }) : null);

      // Visual feedback: green pulse for own bid
      setBidStatusAnimation('pulse-green');
      setTimeout(() => setBidStatusAnimation('none'), 2000);

      if (data.auctionExtended) {
        toast({
          title: "Auktion verlängert!",
          description: "Die Auktion wurde um 1 Minute verlängert (Soft-Close)",
        });
      }

      // Google Ads: Gebot-Tracking
      try {
        const safeGtag = window.gtag || ((...args: unknown[]) => window.dataLayer?.push(args));
        safeGtag('event', 'add_to_cart', {
          event_category: 'Auction',
          event_label: `bid_placed_${auction.motorhome?.manufacturer}_${auction.motorhome?.model}`,
          value: amount,
          currency: 'EUR',
          items: [{ id: auction.motorhome?.id, name: `${auction.motorhome?.manufacturer} ${auction.motorhome?.model}`, category: 'Wohnmobil', price: amount }],
        });
      } catch { /* tracking should never break the bid flow */ }

      trackEvent('bid_placed', { category: 'business', label: `${auction.motorhome?.manufacturer} ${auction.motorhome?.model}`, value: amount, properties: { auctionId: auction.id, autobid: enableAutobid } });

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
      <PageLayout breadcrumbs={true} title="Lädt..." description="Auktion wird geladen">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    );
  }

  const motorhome = auction.motorhome;
  const rawPhotos = motorhome.photos;
  const photos = (Array.isArray(rawPhotos) ? rawPhotos : rawPhotos ? [rawPhotos] : []).sort((a, b) => a.display_order - b.display_order);
  const currentBid = auction.current_bid || auction.starting_bid;
  const reserveMet = auction.reserve_price ? currentBid >= auction.reserve_price : true;
  // Only show reserve price info to the seller or admin
  const canSeeReservePrice = user?.id === (motorhome as any).seller_id || isAdmin;

  // ─── Live Bidding Status (computed) ─────────────────────────
  const userBids = user ? bids.filter(b => b.bidder_id === user.id) : [];
  const userHighestBid = userBids.length > 0 ? Math.max(...userBids.map(b => b.amount)) : 0;
  const hasBid = userBids.length > 0;
  const isHighestBidder = hasBid && bids.length > 0 && bids[0]?.bidder_id === user?.id;
  const wasOutbid = hasBid && !isHighestBidder;
  // Keep ref in sync for realtime callback
  prevHighestBidderRef.current = isHighestBidder;

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
      breadcrumbs={true}
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
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => navigate("/kaufen")}
                className="hover:bg-primary/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück zu Auktionen
              </Button>
              {(neighborAuctions.prev || neighborAuctions.next) && (
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!neighborAuctions.prev}
                    onClick={() => neighborAuctions.prev && navigate(`/auktion/${neighborAuctions.prev}`)}
                    className="gap-1"
                    title="Vorherige Auktion"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Vorherige</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!neighborAuctions.next}
                    onClick={() => neighborAuctions.next && navigate(`/auktion/${neighborAuctions.next}`)}
                    className="gap-1"
                    title="Nächste Auktion"
                  >
                    <span className="hidden sm:inline">Nächste</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isFavLoading}
                onClick={async () => {
                  if (!user) {
                    toast({
                      title: "Anmeldung erforderlich",
                      description: "Bitte melden Sie sich an, um Auktionen zu beobachten.",
                      variant: "destructive",
                    });
                    navigate(`/login?redirect=/auktion/${id}`);
                    return;
                  }
                  await toggleFavorite(motorhome.id);
                }}
                className={`gap-2 ${isFavorite(motorhome.id) ? 'text-red-600 border-red-200' : ''}`}
              >
                <Heart className={`w-4 h-4 ${isFavorite(motorhome.id) ? 'fill-current' : ''}`} />
                {isFavorite(motorhome.id) ? 'Beobachtet' : 'Beobachten'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column - Photos and details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Enhanced Photo Gallery */}
              <Card className="overflow-hidden shadow-lg">
                <div className="relative group">
                  <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] bg-muted overflow-hidden">
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
                          <span className="text-muted-foreground">Baujahr</span>
                          <span className="font-semibold">{motorhome.year}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Kilometerstand</span>
                          <span className="font-semibold">{motorhome.mileage.toLocaleString()} km</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Kraftstoff</span>
                          <span className="font-semibold">{motorhome.fuel_type || 'Nicht angegeben'}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Getriebe</span>
                          <span className="font-semibold">{motorhome.transmission || 'Nicht angegeben'}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Leistung</span>
                          <span className="font-semibold">
                            {motorhome.engine_power_hp
                              ? `${motorhome.engine_power_hp} PS${(motorhome as any).power_kw ? ` (${(motorhome as any).power_kw} kW)` : ''}`
                              : 'Nicht angegeben'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Gesamtgewicht</span>
                          <span className="font-semibold">{motorhome.weight_kg ? `${motorhome.weight_kg.toLocaleString()} kg` : 'Nicht angegeben'}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-muted-foreground">Nutzlast</span>
                          <span className="font-semibold">{motorhome.payload_kg ? `${motorhome.payload_kg.toLocaleString()} kg` : 'Nicht angegeben'}</span>
                        </div>
                      </div>
                    </div>
                    {/* Weitere Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-muted-foreground text-sm">Vorbesitzer</span>
                        <span className="font-semibold text-sm">{motorhome.previous_owners != null ? motorhome.previous_owners : 'k.A.'}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-muted-foreground text-sm">Sitzplätze</span>
                        <span className="font-semibold text-sm">{motorhome.seats || 'k.A.'}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-muted-foreground text-sm">Schlafplätze</span>
                        <span className="font-semibold text-sm">{motorhome.sleeping_places || 'k.A.'}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-muted-foreground text-sm">Achsen</span>
                        <span className="font-semibold text-sm">{motorhome.number_of_axles || 'k.A.'}</span>
                      </div>
                    </div>

                    {/* Fahrzeugbeschreibung */}
                    {motorhome.description && (
                      <div className="mt-6">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-primary" />
                          Beschreibung
                        </h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {motorhome.description}
                        </p>
                      </div>
                    )}

                    {/* Nachträge des Verkäufers */}
                    {addenda.length > 0 && (
                      <div className="mt-6 space-y-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <FileText className="w-5 h-5 text-blue-600" />
                          Nachträge des Verkäufers
                        </h3>
                        {addenda.map((item) => (
                          <div
                            key={item.id}
                            className="p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20"
                          >
                            <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Nachträglich hinzugefügt am{" "}
                              {format(new Date(item.created_at), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}
                            </p>
                          </div>
                        ))}
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
                              ? `Gültig bis: ${new Date(motorhome.tuev_valid_until).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })}`
                              : 'Nicht angegeben'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>

            </div>

            {/* Simplified Right column - Bidding Sidebar */}
            <div className="lg:col-span-1 space-y-6 order-first lg:order-last">
              <Card className="p-6 lg:sticky lg:top-24 space-y-6">
                <div>
                  <h1 className="text-2xl font-bold mb-2">
                    {motorhome.manufacturer} {motorhome.model}
                  </h1>
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <span>{motorhome.body_type} • {motorhome.year}</span>
                    {motorhome.account_type === 'dealer' ? (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                        Händler
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-600 border-gray-200">
                        Privat
                      </Badge>
                    )}
                  </div>
                  {/* Anonymized Location & Distance */}
                  {motorhome.postal_code && (() => {
                    const anonymizedPlz = anonymizePostalCode(motorhome.postal_code);
                    const vehicleCoords = getPlzCoordinates(motorhome.postal_code);
                    const dealerCoords = dealerPostalCode ? getPlzCoordinates(dealerPostalCode) : null;
                    const distanceKm = vehicleCoords && dealerCoords
                      ? calculateDistance(
                          { latitude: vehicleCoords.lat, longitude: vehicleCoords.lng },
                          { latitude: dealerCoords.lat, longitude: dealerCoords.lng }
                        )
                      : null;
                    return (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="inline-flex items-center gap-1">Standort: {motorhome.country && <CountryFlag countryCode={motorhome.country} showCode={true} size="sm" />}{motorhome.country ? '-' : ''}{anonymizedPlz}</span>
                        {distanceKm !== null && (
                          <span className="flex items-center gap-1 ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            <Navigation className="w-3 h-3" />
                            ca. {formatDistance(distanceKm)}
                          </span>
                        )}
                      </div>
                    );
                  })()}
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
                      Gebot in letzter Minute verlängert um 1 Min!
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

                {/* Current bid with Live Status */}
                <div className={`relative rounded-xl p-4 -mx-2 transition-all duration-500 ${
                  bidStatusAnimation === 'pulse-green'
                    ? 'bg-emerald-50 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-100'
                    : bidStatusAnimation === 'pulse-red'
                    ? 'bg-red-50 ring-2 ring-red-400/50 shadow-lg shadow-red-100'
                    : isHighestBidder
                    ? 'bg-emerald-50/50 ring-1 ring-emerald-200'
                    : wasOutbid
                    ? 'bg-red-50/50 ring-1 ring-red-200'
                    : ''
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-muted-foreground">Aktuelles Gebot</p>
                    {hasBid && (
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
                        isHighestBidder
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-red-100 text-red-700 border border-red-200'
                      }`}>
                        {isHighestBidder ? (
                          <><Crown className="w-3.5 h-3.5" /> Höchstbietender</>
                        ) : (
                          <><ArrowDown className="w-3.5 h-3.5" /> Überboten</>
                        )}
                      </div>
                    )}
                  </div>
                  {canSeePrices ? (
                    <p className={`text-4xl font-bold transition-colors duration-500 ${
                      isHighestBidder ? 'text-emerald-600' : wasOutbid ? 'text-red-600' : 'text-primary'
                    }`}>
                      €{currentBid.toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-lg font-medium text-muted-foreground flex items-center gap-2 mt-1">
                      <Lock className="w-4 h-4 text-amber-500" />
                      Nur für Händler sichtbar
                    </p>
                  )}
                  
                  {/* User's own bid info */}
                  {hasBid && (
                    <div className={`mt-2 flex items-center gap-2 text-sm font-medium ${
                      isHighestBidder ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {isHighestBidder ? (
                        <><CheckCircle className="w-4 h-4" /> Ihr Gebot: €{userHighestBid.toLocaleString()}</>
                      ) : (
                        <><AlertTriangle className="w-4 h-4" /> Ihr Gebot: €{userHighestBid.toLocaleString()} — €{(currentBid - userHighestBid).toLocaleString()} zurück</>
                      )}
                    </div>
                  )}

                  {canSeePrices && (
                    <>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <TrendingUp className="w-4 h-4" />
                        <span>Startgebot: €{auction.starting_bid.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{bids.length} Gebote</span>
                        <span>{bids.length > 0 ? new Set(bids.map(b => b.bidder_id)).size : 0} Bieter</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Provision - visible for dealers and admins */}
                {(primaryRole === 'dealer' || isAdmin) && currentBid > 0 && settings?.commission_rate_percent > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Kostenübersicht</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Aktuelles Gebot</span>
                          <span className="font-medium">€{currentBid.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Provision</span>
                          <span className="font-medium">€{(currentBid * (settings.commission_rate_percent / 100)).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Gesamtkosten</span>
                        <span className="text-lg font-bold text-primary">€{(currentBid + currentBid * (settings.commission_rate_percent / 100)).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </>
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

                {/* Instant Buy Section - only for dealers */}
                {motorhome.instant_price && 
                 Number(motorhome.instant_price) > 0 &&
                 motorhome.status !== 'sold' && canSeePrices && (
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
                  (primaryRole === 'dealer' || isAdmin) ? (
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

                    {/* Rapid Bid Buttons - 1-Klick-Schnellgebote */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Schnellgebot</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[100, 500, 1000].map((increment) => {
                          const rapidBidValue = currentBid + increment;
                          return (
                            <Button
                              key={increment}
                              variant="outline"
                              size="sm"
                              className="h-10 text-sm font-semibold hover:bg-primary/10 hover:border-primary/50 transition-all"
                              onClick={() => {
                                setBidAmount(rapidBidValue.toString());
                              }}
                              disabled={isSubmitting || auction.status !== 'active'}
                            >
                              <ArrowUp className="w-3 h-3 mr-1" />
                              +€{increment.toLocaleString()}
                            </Button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-muted-foreground text-center">
                        Klicken Sie auf einen Betrag, um Ihr Gebot schnell zu setzen
                      </p>
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
                      Gebote sind verbindlich. Mindesterhöhung: €50
                    </p>
                  </div>
                  ) : (
                  <div className="space-y-4">
                    <div className="p-4 border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg text-center">
                      <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
                      <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">
                        Bieten nur für Händler
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">
                        Nur freigeschaltete Händler können Gebote abgeben. Registrieren Sie sich jetzt als Händler, um an Auktionen teilzunehmen.
                      </p>
                      {!user ? (
                        <div className="space-y-2">
                          <Link to={`/login?redirect=/auktion/${id}`}>
                            <Button className="w-full" variant="default">
                              Anmelden
                            </Button>
                          </Link>
                          <Link to="/register/haendler">
                            <Button className="w-full" variant="outline">
                              <Building2 className="w-4 h-4 mr-2" />
                              Als Händler registrieren
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <Link to="/register/haendler">
                          <Button className="w-full" variant="default">
                            <Building2 className="w-4 h-4 mr-2" />
                            Jetzt als Händler registrieren
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                  )
                ) : auction.status === "kaufchance" && (auction as any).kaufchance_expires_at ? (
                  <div className="space-y-4">
                    <div className="p-4 border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-5 h-5 text-amber-600" />
                        <h3 className="font-semibold text-amber-700 dark:text-amber-300">
                          Kaufchance!
                        </h3>
                      </div>
                      <KaufchanceBadge expiresAt={(auction as any).kaufchance_expires_at} className="mb-3" />
                      {isInvitedToKaufchance ? (
                        <>
                          <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                            Sie wurden als Top-Bieter eingeladen! Geben Sie jetzt ein Direktangebot ab.
                          </p>
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
                        </>
                      ) : (
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Diese Auktion befindet sich in der Kaufchance-Phase. Nur eingeladene Top-Bieter können ein Angebot abgeben.
                        </p>
                      )}
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

              {/* Gebotsverlauf - direkt unter der Bidding Sidebar */}
              <Card className="p-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Gebotsverlauf
                  </h2>
                  {canSeePrices && (
                    <Badge variant="outline" className="px-3 py-1">
                      {bids.length} Gebote
                    </Badge>
                  )}
                </div>

                {!canSeePrices ? (
                  <div className="text-center py-8">
                    <Lock className="w-10 h-10 mx-auto text-amber-500/50 mb-3" />
                    <p className="text-muted-foreground font-medium text-sm">Gebotsverlauf nur für Händler sichtbar</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Melden Sie sich als Händler an, um den Gebotsverlauf zu sehen.
                    </p>
                    {!user ? (
                      <div className="flex gap-2 justify-center mt-4">
                        <Link to={`/login?redirect=/auktion/${id}`}>
                          <Button size="sm" variant="default">Anmelden</Button>
                        </Link>
                        <Link to="/register/haendler">
                          <Button size="sm" variant="outline">
                            <Building2 className="w-4 h-4 mr-1" />
                            Registrieren
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <Link to="/register/haendler" className="mt-4 inline-block">
                        <Button size="sm" variant="outline">
                          <Building2 className="w-4 h-4 mr-1" />
                          Als Händler registrieren
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <>

                {bids.length > 0 && (
                  <div className={`mb-4 p-3 rounded-lg border transition-all duration-300 ${
                    isHighestBidder
                      ? 'bg-emerald-50 border-emerald-200'
                      : wasOutbid
                      ? 'bg-red-50 border-red-200'
                      : 'bg-primary/5 border-primary/20'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Aktuell führend</p>
                        <p className={`font-semibold text-sm ${
                          isHighestBidder ? 'text-emerald-600' : wasOutbid ? 'text-red-600' : 'text-primary'
                        }`}>
                          {isHighestBidder ? 'Sie!' : `Bieter #1`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${
                          isHighestBidder ? 'text-emerald-600' : wasOutbid ? 'text-red-600' : 'text-primary'
                        }`}>
                          €{(bids[0]?.amount ?? 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          vor {bids[0]?.created_at ? Math.floor((Date.now() - new Date(bids[0].created_at).getTime()) / (1000 * 60)) : 0} Min.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {bids.length > 0 ? (
                    bids.map((bid, index) => {
                      const isMine = user && bid.bidder_id === user.id;
                      return (
                        <div
                          key={bid.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg transition-all duration-300 ${
                            isMine && index === 0
                              ? 'bg-emerald-50 border border-emerald-200 ring-1 ring-emerald-100'
                              : isMine
                              ? 'bg-amber-50/70 border border-amber-200/50'
                              : index === 0 
                              ? 'bg-primary/10 border border-primary/20' 
                              : 'bg-muted/50 hover:bg-muted/70'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              isMine && index === 0 ? 'bg-emerald-500 text-white'
                              : isMine ? 'bg-amber-400 text-white'
                              : index === 0 ? 'bg-primary text-white'
                              : 'bg-muted text-muted-foreground'
                            }`}>
                              {isMine ? <User className="w-3.5 h-3.5" /> : `#${index + 1}`}
                            </div>
                            <div>
                              <p className="font-semibold text-sm flex items-center gap-1.5">
                                {isMine ? 'Ihr Gebot' : 'Gebot'}
                                {bid.is_autobid && (
                                  <Badge variant="outline" className="text-[10px] gap-0.5 px-1 py-0">
                                    <Zap className="w-2.5 h-2.5" /> Auto
                                  </Badge>
                                )}
                                {index === 0 && (
                                  <Badge className={`text-[10px] px-1.5 py-0 ${
                                    isMine ? 'bg-emerald-500' : 'bg-green-500'
                                  }`}>
                                    {isMine ? <><Crown className="w-2.5 h-2.5 mr-0.5" /> Führend</> : 'Führend'}
                                  </Badge>
                                )}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(bid.created_at).toLocaleString("de-DE")}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-base font-bold ${
                              isMine && index === 0 ? 'text-emerald-600'
                              : isMine ? 'text-amber-600'
                              : index === 0 ? 'text-primary'
                              : 'text-foreground'
                            }`}>
                              €{bid.amount.toLocaleString()}
                            </p>
                            {index > 0 && bids[index + 1] && (
                              <p className="text-[11px] text-green-600">
                                +€{(bid.amount - bids[index + 1].amount).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <Gavel className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground font-medium text-sm">Noch keine Gebote</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Seien Sie der Erste!
                      </p>
                    </div>
                  )}
                </div>

                {bids.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Durchschnitt</p>
                        <p className="font-semibold text-sm">
                          €{Math.round(bids.reduce((sum, bid) => sum + bid.amount, 0) / bids.length).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Höchstes</p>
                        <p className="font-semibold text-sm text-primary">
                          €{Math.max(...bids.map(b => b.amount)).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Bieter</p>
                        <p className="font-semibold text-sm">
                          {new Set(bids.map(b => b.bidder_id)).size}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                  </>
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
