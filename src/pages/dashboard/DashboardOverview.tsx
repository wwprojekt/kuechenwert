import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Car,
  Gavel,
  TrendingUp,
  Eye,
  Plus,
  ArrowUpRight,
  Sparkles,
  Clock,
  Calendar,
  Package,
  Hash,
  CheckCircle2,
  FileText,
  MessageSquare,
  Camera,
  Search,
  Truck,
  CircleDot,
  Lock,
  MessageSquarePlus,
  Pencil,
  ImagePlus,
  AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useEffect } from "react";

/**
 * Dashboard Overview – role-aware.
 *
 * For sellers: shows a status-timeline for their vehicle(s) – simple, focused, clear.
 * For dealers: shows bids placed, won auctions, inventory count, total spent.
 */
export default function DashboardOverview() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { primaryRole } = useUserRole();
  const queryClient = useQueryClient();

  const isDealer = primaryRole === "dealer";

  // ── Realtime: Auto-refresh when admin creates/updates motorhome ──
  // NOTE: We listen WITHOUT a filter on motorhomes because Supabase Realtime
  // filters on INSERT events can be unreliable (the filter is applied to the
  // NEW row, but RLS or timing issues may prevent delivery). Instead we listen
  // to ALL changes on the table and always invalidate – the React Query cache
  // will only refetch if the component is mounted.
  useEffect(() => {
    if (!user || isDealer) return;

    const channel = supabase
      .channel(`seller-dashboard-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "motorhomes",
        },
        () => {
          // Invalidate all seller-relevant queries so data refreshes automatically
          queryClient.invalidateQueries({ queryKey: ["sellerTimeline", user.id] });
          queryClient.invalidateQueries({ queryKey: ["myListings", user.id] });
          queryClient.invalidateQueries({ queryKey: ["pendingWizardSession", user.id] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "motorhome_photos",
        },
        () => {
          // Also refresh when photos are added/removed
          queryClient.invalidateQueries({ queryKey: ["sellerTimeline", user.id] });
          queryClient.invalidateQueries({ queryKey: ["myListings", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isDealer, queryClient]);

  // ── Profile (customer number) ─────────────────────────────────
  const { data: profile } = useQuery({
    queryKey: ["dashboardProfile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("customer_number, company_name, first_name, last_name")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // ── Seller: Check for pending wizard sessions ────────────────
  const { data: pendingWizardSession } = useQuery({
    queryKey: ["pendingWizardSession", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("wizard_sessions")
        .select("id, status, form_data, created_at, customer_name")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !isDealer,
    // Keep in sync with sellerTimeline polling
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  // ── Seller: Fetch motorhome + auction data for timeline ──────
  const { data: sellerData } = useQuery({
    queryKey: ["sellerTimeline", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get all motorhomes with their auctions and photos
      const { data: motorhomes, error } = await supabase
        .from("motorhomes")
        .select(
          `
          *,
          auction:auctions(*),
          photos:motorhome_photos(url, display_order)
        `
        )
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each motorhome with an active auction, get bid stats
      const enriched = await Promise.all(
        (motorhomes || []).map(async (mh) => {
          const auction = Array.isArray(mh.auction) ? mh.auction[0] : mh.auction;
          let bidStats = null;

          if (auction) {
            const { data: bids } = await supabase
              .from("bids")
              .select("amount, created_at, bidder_id")
              .eq("auction_id", auction.id)
              .order("created_at", { ascending: false });

            if (bids && bids.length > 0) {
              bidStats = {
                totalBids: bids.length,
                uniqueBidders: new Set(bids.map((b) => b.bidder_id)).size,
                highestBid: Math.max(...bids.map((b) => Number(b.amount))),
                latestBidTime: bids[0].created_at,
              };
            }
          }

          // Get addenda count
          let addendaCount = 0;
          if (auction) {
            const { count } = await supabase
              .from("auction_addenda")
              .select("*", { count: "exact", head: true })
              .eq("auction_id", auction.id);
            addendaCount = count || 0;
          }

          return { ...mh, bidStats, addendaCount };
        })
      );

      return enriched;
    },
    enabled: !!user && !isDealer,
    // Polling fallback: refetch every 30s in case Realtime subscription
    // doesn't fire (e.g. table not enabled for Realtime in Supabase config,
    // or RLS blocks the subscription). This ensures the seller sees new
    // motorhomes within 30 seconds even without Realtime.
    refetchInterval: 30 * 1000,
    // Don't poll when the tab is in the background to save resources
    refetchIntervalInBackground: false,
    // Override global staleTime so invalidation from Realtime takes effect immediately
    staleTime: 0,
  });

  // ── Dealer stats ──────────────────────────────────────────────
  const { data: dealerStats } = useQuery({
    queryKey: ["dealerStats", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [bidsRes, wonRes, inventoryRes] = await Promise.all([
        supabase
          .from("bids")
          .select("*", { count: "exact" })
          .eq("bidder_id", user.id),
        supabase
          .from("motorhomes")
          .select("*", { count: "exact" })
          .eq("sold_to", user.id),
        supabase
          .from("motorhomes")
          .select("id, instant_price")
          .eq("sold_to", user.id),
      ]);

      const totalSpent =
        inventoryRes.data?.reduce(
          (sum, m) => sum + Number(m.instant_price || 0),
          0
        ) || 0;

      return {
        totalBids: bidsRes.count || 0,
        wonAuctions: wonRes.count || 0,
        inventoryCount: inventoryRes.data?.length || 0,
        totalSpent,
      };
    },
    enabled: !!user && isDealer,
  });

  // ── Dealer recent activity ────────────────────────────────────
  const { data: dealerActivity } = useQuery({
    queryKey: ["dealerActivity", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: recentBids } = await supabase
        .from("bids")
        .select("auction_id, amount, created_at")
        .eq("bidder_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!recentBids || recentBids.length === 0) return [];

      const auctionIds = [
        ...new Set(recentBids.map((b) => b.auction_id)),
      ].slice(0, 5);

      const { data: auctions } = await supabase
        .from("auctions")
        .select(
          `
          *,
          motorhome:motorhomes!inner (
            id, manufacturer, model, year,
            photos:motorhome_photos (url, display_order)
          )
        `
        )
        .in("id", auctionIds)
        .order("created_at", { ascending: false });

      return auctions || [];
    },
    enabled: !!user && isDealer,
  });

  // ── Helper: Determine timeline step for a motorhome ──────────
  const getTimelineStep = (mh: any) => {
    const auction = Array.isArray(mh.auction) ? mh.auction[0] : mh.auction;

    if (!auction) {
      // No auction yet – motorhome status is 'available' (default), 'pending', or 'sold'
      if (mh.status === "available" || !mh.status) {
        return {
          step: 1,
          label: "Inserat eingereicht",
          sublabel: "Wird von unserem Team geprüft",
          color: "text-blue-600",
          bgColor: "bg-blue-100 dark:bg-blue-900/30",
          borderColor: "border-blue-200 dark:border-blue-800",
        };
      }
      if (mh.status === "pending") {
        return {
          step: 2,
          label: "In Prüfung",
          sublabel: "Unser Team bereitet Ihr Inserat vor",
          color: "text-amber-600",
          bgColor: "bg-amber-100 dark:bg-amber-900/30",
          borderColor: "border-amber-200 dark:border-amber-800",
        };
      }
      // status === 'sold' without auction (edge case)
      return {
        step: 6,
        label: "Verkauft",
        sublabel: "Ihr Wohnmobil wurde erfolgreich verkauft",
        color: "text-emerald-600",
        bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
        borderColor: "border-emerald-200 dark:border-emerald-800",
      };
    }

    if (auction.status === "scheduled") {
      return {
        step: 3,
        label: "Auktion geplant",
        sublabel: `Startet am ${format(new Date(auction.start_time), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}`,
        color: "text-indigo-600",
        bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
        borderColor: "border-indigo-200 dark:border-indigo-800",
      };
    }

    if (auction.status === "active") {
      return {
        step: 4,
        label: "Auktion läuft",
        sublabel: `Endet am ${format(new Date(auction.end_time), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}`,
        color: "text-green-600",
        bgColor: "bg-green-100 dark:bg-green-900/30",
        borderColor: "border-green-200 dark:border-green-800",
      };
    }

    if (auction.status === "kaufchance") {
      return {
        step: 5,
        label: "Kaufchance aktiv",
        sublabel: "Händler können Sofortangebote abgeben",
        color: "text-purple-600",
        bgColor: "bg-purple-100 dark:bg-purple-900/30",
        borderColor: "border-purple-200 dark:border-purple-800",
      };
    }

    if (auction.status === "completed") {
      if (mh.sold_to) {
        return {
          step: 6,
          label: "Verkauft!",
          sublabel: "Ihr Fahrzeug wurde erfolgreich verkauft",
          color: "text-emerald-600",
          bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
          borderColor: "border-emerald-200 dark:border-emerald-800",
        };
      }
      return {
        step: 6,
        label: "Auktion beendet",
        sublabel: "Reservepreis nicht erreicht",
        color: "text-gray-600",
        bgColor: "bg-gray-100 dark:bg-gray-900/30",
        borderColor: "border-gray-200 dark:border-gray-800",
      };
    }

    return {
      step: 1,
      label: auction.status || "Unbekannt",
      sublabel: "",
      color: "text-gray-600",
      bgColor: "bg-gray-100 dark:bg-gray-900/30",
      borderColor: "border-gray-200 dark:border-gray-800",
    };
  };

  // ── Timeline steps definition ────────────────────────────────
  const timelineSteps = [
    { num: 1, label: "Eingereicht", icon: FileText },
    { num: 2, label: "Prüfung", icon: Search },
    { num: 3, label: "Geplant", icon: Calendar },
    { num: 4, label: "Live", icon: Gavel },
    { num: 5, label: "Kaufchance", icon: Sparkles },
    { num: 6, label: "Abgeschlossen", icon: CheckCircle2 },
  ];

  // ═══════════════════════════════════════════════════════════════
  // SELLER DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  if (!isDealer) {
    const motorhomes = sellerData || [];
    const displayName =
      profile?.first_name || profile?.company_name || "Verkäufer";

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg blur-xl" />
          <div className="relative bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-6 sm:p-8 border border-primary/20">
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 flex items-center gap-3">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg flex-shrink-0">
                    <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                  </div>
                  Hallo, {displayName}!
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Hier sehen Sie den aktuellen Status Ihres Fahrzeugs.
                </p>
                {profile?.customer_number && (
                  <div className="mt-2 inline-flex items-center gap-2 bg-background/80 border border-border rounded-lg px-3 py-1.5">
                    <Hash className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs text-muted-foreground">
                      Kundennr:
                    </span>
                    <span className="text-xs font-bold text-primary">
                      {profile.customer_number}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* No motorhomes: Check for pending wizard session or show empty state */}
        {motorhomes.length === 0 && pendingWizardSession && (
          <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex-shrink-0">
                  <Clock className="w-8 h-8 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1 text-amber-800 dark:text-amber-200">
                    Ihr Inserat wird geprüft
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                    Vielen Dank für Ihre Einreichung! Unser Experten-Team prüft Ihre Angaben und bereitet Ihr Inserat
                    für die Auktion vor. Wir melden uns in Kürze bei Ihnen.
                  </p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Eingereicht am {format(new Date(pendingWizardSession.created_at), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}
                    </div>
                  </div>
                  {/* Progress indicator */}
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden">
                      <div className="h-full w-1/6 bg-amber-500 rounded-full animate-pulse" />
                    </div>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">Schritt 1 von 6</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {motorhomes.length === 0 && !pendingWizardSession && (
          <Card className="border-2 border-dashed border-primary/30">
            <CardContent className="p-8 sm:p-12 text-center">
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full animate-pulse" />
                <Car className="relative w-20 h-20 text-primary/40 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Noch kein Inserat vorhanden
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
                Erstellen Sie Ihr Inserat und erreichen Sie tausende potenzielle
                Käufer auf{" "}
                {settings?.site_name || "CaravanWert"}.
              </p>
              <Link to="/verkaufen/wizard">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg group w-full sm:w-auto"
                >
                  <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
                  Jetzt Inserat erstellen
                  <ArrowUpRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Motorhome cards with timeline */}
        {motorhomes.map((mh: any) => {
          const timeline = getTimelineStep(mh);
          const auction = Array.isArray(mh.auction) ? mh.auction[0] : mh.auction;
          const firstPhoto = mh.photos
            ?.sort(
              (a: any, b: any) => a.display_order - b.display_order
            )[0]?.url;
          const isLive =
            auction?.status === "active" ||
            auction?.status === "kaufchance";
          const detailUrl = `/dashboard/listings/${mh.id}`;

          return (
            <Card
              key={mh.id}
              className={`overflow-hidden border-2 ${timeline.borderColor} transition-all`}
            >
              <CardContent className="p-0">
                {/* Vehicle header */}
                <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-6 pb-4">
                  {/* Photo */}
                  <div className="relative w-full sm:w-32 h-48 sm:h-24 rounded-xl overflow-hidden flex-shrink-0">
                    {firstPhoto ? (
                      <img
                        src={firstPhoto}
                        alt={`${mh.manufacturer} ${mh.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <Car className="w-10 h-10 text-primary/40" />
                      </div>
                    )}
                    {isLive && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-green-500 text-white text-xs animate-pulse">
                          <CircleDot className="w-3 h-3 mr-1" />
                          LIVE
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Vehicle info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
                          {mh.manufacturer} {mh.model}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Baujahr {mh.year}
                          {mh.mileage &&
                            ` · ${Number(mh.mileage).toLocaleString("de-DE")} km`}
                        </p>
                        {/* Preisinfos für den Verkäufer */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                          {mh.reserve_price && (
                            <p className="text-sm text-muted-foreground">
                              Mindestpreis: <span className="font-semibold text-foreground">{Number(mh.reserve_price).toLocaleString("de-DE")} €</span>
                            </p>
                          )}
                          {mh.instant_price && (
                            <p className="text-sm text-muted-foreground">
                              Sofortpreis: <span className="font-semibold text-foreground">{Number(mh.instant_price).toLocaleString("de-DE")} €</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 flex-shrink-0">
                        <Link to={`/dashboard/listings/${mh.id}/edit?tab=photos`}>
                          <Button
                            size="sm"
                            className={`gap-2 w-full sm:w-auto ${
                              (!mh.photos || mh.photos.length === 0)
                                ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg ring-2 ring-amber-300 ring-offset-1"
                                : "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground"
                            }`}
                          >
                            <ImagePlus className="w-4 h-4" />
                            <span className="sm:hidden">Fotos</span>
                            <span className="hidden sm:inline">Fotos hochladen</span>
                          </Button>
                        </Link>
                        <Link to={`/dashboard/listings/${mh.id}/edit`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 w-full sm:w-auto"
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="sm:hidden">Bearbeiten</span>
                            <span className="hidden sm:inline">Bearbeiten</span>
                          </Button>
                        </Link>
                        <Link to={detailUrl}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 w-full sm:w-auto text-muted-foreground"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">Details</span>
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Current status badge */}
                    <div className="mt-3">
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${timeline.bgColor} ${timeline.color}`}
                      >
                        <CircleDot className="w-4 h-4" />
                        {timeline.label}
                      </div>
                      {timeline.sublabel && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {timeline.sublabel}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline progress bar */}
                <div className="px-4 sm:px-6 pb-4">
                  <div className="relative">
                    {/* Desktop timeline */}
                    <div className="hidden sm:flex items-center justify-between">
                      {timelineSteps.map((step, idx) => {
                        const isCompleted = timeline.step > step.num;
                        const isCurrent = timeline.step === step.num;
                        const StepIcon = step.icon;

                        return (
                          <div key={step.num} className="flex items-center flex-1 last:flex-none">
                            <div className="flex flex-col items-center">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                                  isCompleted
                                    ? "bg-primary text-primary-foreground shadow-md"
                                    : isCurrent
                                    ? `${timeline.bgColor} ${timeline.color} ring-2 ring-offset-2 ring-current shadow-lg`
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {isCompleted ? (
                                  <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                  <StepIcon className="w-4 h-4" />
                                )}
                              </div>
                              <span
                                className={`text-[10px] mt-1.5 font-medium text-center leading-tight ${
                                  isCurrent
                                    ? timeline.color
                                    : isCompleted
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                            {idx < timelineSteps.length - 1 && (
                              <div className="flex-1 mx-2 mt-[-18px]">
                                <div
                                  className={`h-1 rounded-full transition-all ${
                                    timeline.step > step.num + 1
                                      ? "bg-primary"
                                      : timeline.step > step.num
                                      ? "bg-gradient-to-r from-primary to-muted"
                                      : "bg-muted"
                                  }`}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Mobile timeline: compact progress bar */}
                    <div className="sm:hidden">
                      <div className="flex items-center gap-1 mb-2">
                        {timelineSteps.map((step) => {
                          const isCompleted = timeline.step > step.num;
                          const isCurrent = timeline.step === step.num;
                          return (
                            <div
                              key={step.num}
                              className={`h-2 flex-1 rounded-full transition-all ${
                                isCompleted
                                  ? "bg-primary"
                                  : isCurrent
                                  ? "bg-primary/50"
                                  : "bg-muted"
                              }`}
                            />
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Schritt {timeline.step} von {timelineSteps.length}:{" "}
                        <span className={`font-medium ${timeline.color}`}>
                          {timeline.label}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Photo missing warning */}
                {(!mh.photos || mh.photos.length === 0) && (
                  <div className="border-t border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 sm:px-6 py-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            Fotos fehlen!
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Ohne Fotos kann Ihr Wohnmobil nicht an Händler vermittelt werden. Laden Sie jetzt mindestens 4 Fotos hoch.
                          </p>
                        </div>
                      </div>
                      <Link to={`/dashboard/listings/${mh.id}/edit?tab=photos`} className="flex-shrink-0">
                        <Button
                          size="sm"
                          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                        >
                          <ImagePlus className="w-4 h-4" />
                          Jetzt Fotos hochladen
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {/* Live auction stats */}
                {isLive && mh.bidStats && (
                  <div className="border-t border-border/50 bg-muted/20 px-4 sm:px-6 py-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                      <div className="text-center sm:text-left">
                        <p className="text-xs text-muted-foreground">
                          Aktuelles Höchstgebot
                        </p>
                        <p className="text-lg sm:text-xl font-bold text-green-600">
                          €
                          {mh.bidStats.highestBid.toLocaleString("de-DE")}
                        </p>
                      </div>
                      <div className="text-center sm:text-left">
                        <p className="text-xs text-muted-foreground">
                          Gebote gesamt
                        </p>
                        <p className="text-lg sm:text-xl font-bold text-foreground">
                          {mh.bidStats.totalBids}
                        </p>
                      </div>
                      {mh.addendaCount > 0 && (
                        <div className="text-center sm:text-left col-span-2 sm:col-span-1">
                          <p className="text-xs text-muted-foreground">
                            Nachträge
                          </p>
                          <p className="text-lg sm:text-xl font-bold text-blue-600">
                            {mh.addendaCount}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action buttons for live auctions */}
                {isLive && (
                  <div className="border-t border-border/50 px-4 sm:px-6 py-3 flex flex-col sm:flex-row gap-2">
                    {auction?.id && (
                      <Link
                        to={`/auktion/${auction.id}`}
                        target="_blank"
                        className="flex-1"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          Auktion ansehen
                        </Button>
                      </Link>
                    )}
                    <Link to={detailUrl} className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 border-blue-500 text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/30"
                      >
                        <MessageSquarePlus className="w-4 h-4" />
                        Nachtrag schreiben
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Helpful info card */}
        {motorhomes.length > 0 && (
          <Card className="border border-border/50 bg-muted/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">
                    Haben Sie Fragen?
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Nutzen Sie die Nachrichten-Funktion, um uns direkt zu
                    kontaktieren. Wir helfen Ihnen gerne weiter.
                  </p>
                  <Link to="/dashboard/messages" className="inline-block mt-2">
                    <Button variant="outline" size="sm" className="gap-2">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Nachricht schreiben
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // DEALER DASHBOARD (unchanged logic, preserved as-is)
  // ═══════════════════════════════════════════════════════════════
  const dealerStatCards = [
    {
      title: "Meine Gebote",
      value: dealerStats?.totalBids || 0,
      icon: Gavel,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-500/10 to-cyan-500/10",
      link: "/dashboard/bids",
      description: "Platziert",
    },
    {
      title: "Gewonnene Auktionen",
      value: dealerStats?.wonAuctions || 0,
      icon: TrendingUp,
      gradient: "from-green-500 to-emerald-500",
      bgGradient: "from-green-500/10 to-emerald-500/10",
      link: "/dashboard/bids",
      description: "Erworben",
    },
    {
      title: "Inventar",
      value: dealerStats?.inventoryCount || 0,
      icon: Package,
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-500/10 to-pink-500/10",
      link: "/dashboard/inventory",
      description: "Fahrzeuge",
    },
    {
      title: "Gesamt investiert",
      value: `€${(dealerStats?.totalSpent || 0).toLocaleString("de-DE")}`,
      icon: Calendar,
      gradient: "from-orange-500 to-red-500",
      bgGradient: "from-orange-500/10 to-red-500/10",
      link: "/dashboard/invoices",
      description: "Ausgaben",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Dealer Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg blur-xl" />
        <div className="relative bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-6 sm:p-8 border border-primary/20">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg flex-shrink-0">
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                </div>
                Willkommen zurück!
              </h1>
              <p className="text-muted-foreground text-sm sm:text-lg">
                Verwalten Sie Ihre Gebote und Ihr Inventar
              </p>
              {profile?.customer_number && (
                <div className="mt-3 inline-flex items-center gap-2 bg-background/80 border border-border rounded-lg px-4 py-2">
                  <Hash className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground font-medium">
                    Kundennummer:
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {profile.customer_number}
                  </span>
                </div>
              )}
            </div>
            <Link to="/kaufen" className="md:self-start">
              <Button
                size="lg"
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all group w-full md:w-auto"
              >
                <Gavel className="w-5 h-5 mr-2" />
                Auktionen durchsuchen
                <ArrowUpRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Dealer Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {dealerStatCards.map((stat, index) => (
          <Link
            to={stat.link}
            key={stat.title}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <Card className="group relative overflow-hidden hover-lift border-2 hover:border-primary/30 transition-smooth cursor-pointer animate-scale-in bg-card h-full">
              <div
                className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity -z-10`}
              />
              <CardContent className="p-4 sm:p-6 relative">
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
                  >
                    <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {stat.description}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Dealer: Total Spent Card */}
      <Card className="relative overflow-hidden border-0 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30" />
        <CardContent className="p-6 sm:p-8 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-white" />
                <p className="text-sm font-medium text-white/90 uppercase tracking-wider">
                  Gesamtausgaben
                </p>
              </div>
              <p className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight">
                €{(dealerStats?.totalSpent || 0).toLocaleString("de-DE")}
              </p>
              <p className="text-white/70 text-sm">
                Gesamtbetrag aller erworbenen Fahrzeuge
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 text-white/90">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Portfolio Performance
                  </span>
                </div>
                <div className="h-1 w-32 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-white rounded-full" />
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dealer Recent Activity */}
      <Card className="overflow-hidden border-2 hover:border-primary/20 transition-smooth">
        <div className="bg-gradient-to-r from-muted/50 to-background p-4 sm:p-6 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  Meine Gebotsaktivität
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Auktionen, auf die Sie geboten haben
                </p>
              </div>
            </div>
            <Link to="/dashboard/bids">
              <Button variant="outline" size="sm" className="group w-full sm:w-auto">
                Alle ansehen
                <ArrowUpRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>

        <CardContent className="p-4 sm:p-6">
          {!dealerActivity || dealerActivity.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full animate-pulse" />
                <Car className="relative w-20 h-20 text-primary/40 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Noch keine Gebote
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm">
                Durchsuchen Sie aktive Auktionen und geben Sie Ihr erstes Gebot
                ab
              </p>
              <Link to="/kaufen">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg group w-full sm:w-auto"
                >
                  <Gavel className="w-5 h-5 mr-2" />
                  Auktionen durchsuchen
                  <ArrowUpRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {dealerActivity.map((auction: any, index: number) => {
                const firstPhoto = auction.motorhome?.photos
                  ?.sort(
                    (a: any, b: any) => a.display_order - b.display_order
                  )[0]?.url;

                return (
                  <Link
                    key={auction.id}
                    to={`/auktion/${auction.id}`}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-xl border border-border/50 hover:border-primary/20 bg-gradient-to-r from-background to-muted/20 hover:shadow-md transition-all gap-3 sm:gap-4 no-underline cursor-pointer"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex-shrink-0">
                        {firstPhoto ? (
                          <img
                            src={firstPhoto}
                            alt={`${auction.motorhome?.manufacturer} ${auction.motorhome?.model}`}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <Car className="w-8 h-8 text-primary" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm sm:text-base">
                          {auction.motorhome?.manufacturer}{" "}
                          {auction.motorhome?.model}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                          <Clock className="w-3 h-3" />
                          Baujahr {auction.motorhome?.year}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-left sm:text-right">
                        <Badge
                          variant={
                            auction.status === "active"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            auction.status === "active"
                              ? "bg-gradient-to-r from-green-500 to-emerald-500"
                              : ""
                          }
                        >
                          {auction.status === "active"
                            ? "Aktiv"
                            : auction.status === "completed"
                            ? "Abgeschlossen"
                            : auction.status}
                        </Badge>
                        <p className="text-sm font-semibold text-foreground mt-1 sm:mt-2">
                          €
                          {Number(
                            auction.current_bid || auction.starting_bid
                          ).toLocaleString("de-DE")}
                        </p>
                      </div>
                      <div className="p-2 rounded-full hover:bg-primary/10 transition-colors">
                        <ArrowUpRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
