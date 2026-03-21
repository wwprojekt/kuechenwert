import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Gavel, TrendingUp, Eye, Plus, ArrowUpRight, Sparkles, Clock, Calendar, Package } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Dashboard Overview – role-aware.
 *
 * For sellers: shows listings, active auctions, bids placed, appointments, portfolio value.
 * For dealers: shows bids placed, won auctions, inventory count, appointments, total spent.
 * Both roles see their recent activity.
 */
export default function DashboardOverview() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { primaryRole } = useUserRole();

  const isDealer = primaryRole === 'dealer';

  // ── Seller stats ──────────────────────────────────────────────
  const { data: sellerStats } = useQuery({
    queryKey: ["sellerStats", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [motorhomesRes, auctionsRes, bidsRes, appointmentsRes] = await Promise.all([
        supabase
          .from("motorhomes")
          .select("*", { count: "exact" })
          .eq("seller_id", user.id),
        supabase
          .from("auctions")
          .select("*, motorhome:motorhomes!inner(*)", { count: "exact" })
          .eq("motorhomes.seller_id", user.id),
        supabase
          .from("bids")
          .select("*", { count: "exact" })
          .eq("bidder_id", user.id),
        supabase
          .from("appointments")
          .select("*", { count: "exact" })
          .eq("seller_id", user.id)
          .in("status", ["scheduled", "confirmed"]),
      ]);

      const activeListings = auctionsRes.data?.filter((a) => a.status === "active").length || 0;
      const totalValue = motorhomesRes.data?.reduce(
        (sum, m) => sum + Number(m.instant_price || m.reserve_price || 0),
        0
      ) || 0;

      return {
        totalListings: motorhomesRes.count || 0,
        activeListings,
        totalBids: bidsRes.count || 0,
        upcomingAppointments: appointmentsRes.count || 0,
        totalValue,
      };
    },
    enabled: !!user && !isDealer,
  });

  // ── Dealer stats ──────────────────────────────────────────────
  const { data: dealerStats } = useQuery({
    queryKey: ["dealerStats", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [bidsRes, wonRes, inventoryRes] = await Promise.all([
        // Total bids placed by dealer
        supabase
          .from("bids")
          .select("*", { count: "exact" })
          .eq("bidder_id", user.id),
        // Won auctions (motorhomes sold to this dealer)
        supabase
          .from("motorhomes")
          .select("*", { count: "exact" })
          .eq("sold_to", user.id),
        // Inventory: motorhomes purchased by dealer
        supabase
          .from("motorhomes")
          .select("id, instant_price")
          .eq("sold_to", user.id),
      ]);

      const totalSpent = inventoryRes.data?.reduce(
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

  // ── Recent activity (role-aware) ──────────────────────────────
  const { data: recentActivity } = useQuery({
    queryKey: ["recentActivity", user?.id, primaryRole],
    queryFn: async () => {
      if (!user) return null;

      if (isDealer) {
        // For dealers: show auctions they have bid on
        const { data: recentBids } = await supabase
          .from("bids")
          .select("auction_id, amount, created_at")
          .eq("bidder_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (!recentBids || recentBids.length === 0) return [];

        // Get unique auction IDs
        const auctionIds = [...new Set(recentBids.map(b => b.auction_id))].slice(0, 5);

        const { data: auctions } = await supabase
          .from("auctions")
          .select(`
            *,
            motorhome:motorhomes!inner (
              id,
              manufacturer,
              model,
              year,
              photos:motorhome_photos (
                url,
                display_order
              )
            )
          `)
          .in("id", auctionIds)
          .order("created_at", { ascending: false });

        return auctions || [];
      } else {
        // For sellers: show their own auctions
        const { data } = await supabase
          .from("auctions")
          .select(`
            *,
            motorhome:motorhomes!inner (
              id,
              manufacturer,
              model,
              year,
              photos:motorhome_photos (
                url,
                display_order
              )
            )
          `)
          .eq("motorhomes.seller_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        return data;
      }
    },
    enabled: !!user,
  });

  // ── Stat cards (role-dependent) ───────────────────────────────
  const stats = isDealer ? dealerStats : sellerStats;

  const sellerStatCards = [
    {
      title: "Meine Inserate",
      value: sellerStats?.totalListings || 0,
      icon: Car,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-500/10 to-cyan-500/10",
      link: "/dashboard/listings",
      description: "Gesamt"
    },
    {
      title: "Aktive Auktionen",
      value: sellerStats?.activeListings || 0,
      icon: Gavel,
      gradient: "from-green-500 to-emerald-500",
      bgGradient: "from-green-500/10 to-emerald-500/10",
      link: "/dashboard/listings",
      description: "Laufend"
    },
    {
      title: "Meine Gebote",
      value: sellerStats?.totalBids || 0,
      icon: TrendingUp,
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-500/10 to-pink-500/10",
      link: "/dashboard/bids",
      description: "Platziert"
    },
    {
      title: "Anstehende Termine",
      value: sellerStats?.upcomingAppointments || 0,
      icon: Calendar,
      gradient: "from-orange-500 to-red-500",
      bgGradient: "from-orange-500/10 to-red-500/10",
      link: "/dashboard/appointments",
      description: "Geplant"
    },
  ];

  const dealerStatCards = [
    {
      title: "Meine Gebote",
      value: dealerStats?.totalBids || 0,
      icon: Gavel,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-500/10 to-cyan-500/10",
      link: "/dashboard/bids",
      description: "Platziert"
    },
    {
      title: "Gewonnene Auktionen",
      value: dealerStats?.wonAuctions || 0,
      icon: TrendingUp,
      gradient: "from-green-500 to-emerald-500",
      bgGradient: "from-green-500/10 to-emerald-500/10",
      link: "/dashboard/bids",
      description: "Erworben"
    },
    {
      title: "Inventar",
      value: dealerStats?.inventoryCount || 0,
      icon: Package,
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-500/10 to-pink-500/10",
      link: "/dashboard/inventory",
      description: "Fahrzeuge"
    },
    {
      title: "Gesamt investiert",
      value: `€${(dealerStats?.totalSpent || 0).toLocaleString('de-DE')}`,
      icon: Calendar,
      gradient: "from-orange-500 to-red-500",
      bgGradient: "from-orange-500/10 to-red-500/10",
      link: "/dashboard/invoices",
      description: "Ausgaben"
    },
  ];

  const statCards = isDealer ? dealerStatCards : sellerStatCards;

  // Portfolio value (seller) or total spent (dealer)
  const portfolioValue = isDealer
    ? dealerStats?.totalSpent || 0
    : sellerStats?.totalValue || 0;
  const portfolioLabel = isDealer ? "Gesamtausgaben" : "Portfolio Wert";
  const portfolioSubLabel = isDealer
    ? "Gesamtbetrag aller erworbenen Fahrzeuge"
    : "Gesamtwert aller Ihrer Inserate";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg blur-xl"></div>
        <div className="relative bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-8 border border-primary/20">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                  <Sparkles className="h-6 w-6 text-primary-foreground" />
                </div>
                Willkommen zurück!
              </h1>
              <p className="text-muted-foreground text-lg">
                {isDealer
                  ? "Verwalten Sie Ihre Gebote und Ihr Inventar"
                  : "Verwalten Sie Ihre Inserate und verfolgen Sie Ihre Aktivitäten"}
              </p>
            </div>
            {/* CTA: Seller → new listing, Dealer → browse auctions */}
            {!isDealer ? (
              <Link to="/verkaufen/wizard" className="md:self-start">
                <Button size="lg" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all group w-full md:w-auto">
                  <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
                  Neues Inserat erstellen
                  <ArrowUpRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Button>
              </Link>
            ) : (
              <Link to="/kaufen" className="md:self-start">
                <Button size="lg" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all group w-full md:w-auto">
                  <Gavel className="w-5 h-5 mr-2" />
                  Auktionen durchsuchen
                  <ArrowUpRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Link to={stat.link} key={stat.title} style={{ animationDelay: `${index * 100}ms` }}>
            <Card className="group relative overflow-hidden hover-lift border-2 hover:border-primary/30 transition-smooth cursor-pointer animate-scale-in bg-card h-full">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity -z-10`} />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between mb-4">
                  <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {stat.description}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Featured Card - Portfolio Value / Total Spent */}
      <Card className="relative overflow-hidden border-0 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30" />
        <CardContent className="p-8 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-white" />
                <p className="text-sm font-medium text-white/90 uppercase tracking-wider">{portfolioLabel}</p>
              </div>
              <p className="text-5xl md:text-6xl font-bold text-white tracking-tight">
                {typeof portfolioValue === 'number' ? `€${portfolioValue.toLocaleString('de-DE')}` : portfolioValue}
              </p>
              <p className="text-white/70 text-sm">{portfolioSubLabel}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 text-white/90">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Portfolio Performance</span>
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

      {/* Recent Activity Section */}
      <Card className="overflow-hidden border-2 hover:border-primary/20 transition-smooth">
        <div className="bg-gradient-to-r from-muted/50 to-background p-6 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {isDealer ? "Meine Gebotsaktivität" : "Meine Auktionen"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isDealer ? "Auktionen, auf die Sie geboten haben" : "Aktuelle und vergangene Inserate"}
                </p>
              </div>
            </div>
            <Link to={isDealer ? "/dashboard/bids" : "/dashboard/listings"}>
              <Button variant="outline" size="sm" className="group">
                Alle ansehen
                <ArrowUpRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>

        <CardContent className="p-6">
          {!recentActivity || recentActivity.length === 0 ? (
            <div className="text-center py-16">
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full animate-pulse" />
                <Car className="relative w-20 h-20 text-primary/40 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {isDealer ? "Noch keine Gebote" : "Noch keine Inserate"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {isDealer
                  ? "Durchsuchen Sie aktive Auktionen und geben Sie Ihr erstes Gebot ab"
                  : `Erstellen Sie Ihr erstes Inserat und erreichen Sie tausende potenzielle Käufer auf ${settings?.site_name || 'CaravanWert'}`}
              </p>
              <Link to={isDealer ? "/kaufen" : "/verkaufen/wizard"}>
                <Button size="lg" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg group">
                  {isDealer ? (
                    <>
                      <Gavel className="w-5 h-5 mr-2" />
                      Auktionen durchsuchen
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
                      Erstes Inserat erstellen
                    </>
                  )}
                  <ArrowUpRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((auction: any, index: number) => {
                const firstPhoto = auction.motorhome?.photos
                  ?.sort((a: any, b: any) => a.display_order - b.display_order)[0]?.url;
                
                return (
                  <div
                    key={auction.id}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-xl border border-border/50 hover:border-primary/20 bg-gradient-to-r from-background to-muted/20 hover:shadow-md transition-all gap-4"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
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
                        <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {auction.motorhome?.manufacturer} {auction.motorhome?.model}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                          <Clock className="w-3 h-3" />
                          Baujahr {auction.motorhome?.year}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Badge
                          variant={auction.status === "active" ? "default" : "secondary"}
                          className={auction.status === "active" ? "bg-gradient-to-r from-green-500 to-emerald-500" : ""}
                        >
                          {auction.status === "active" ? "Aktiv" : auction.status === "completed" ? "Abgeschlossen" : auction.status}
                        </Badge>
                        <p className="text-sm font-semibold text-foreground mt-2">
                          €{Number(auction.current_bid || auction.starting_bid).toLocaleString('de-DE')}
                        </p>
                      </div>
                      <Link to={isDealer ? `/auktion/${auction.id}` : `/dashboard/listings/${auction.motorhome?.id}`}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="hover:bg-primary/10 hover:text-primary transition-colors rounded-full"
                        >
                          <Eye className="w-5 h-5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
