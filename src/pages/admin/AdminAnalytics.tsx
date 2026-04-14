import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Car, Gavel, DollarSign, ArrowUpRight, ArrowDownRight, Eye, Globe, Clock, MousePointer } from "lucide-react";
import { format, subDays } from "date-fns";
import { de } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminAnalytics() {
  const now = new Date();

  // Fetch platform stats
  const { data: platformStats, isLoading: isLoadingPlatform } = useQuery({
    queryKey: ["adminPlatformStats"],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return null;

      // Fetch data in parallel
      const [usersRes, motorhomesRes, auctionsRes, bidsRes, appointmentsRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact" }),
        supabase.from("motorhomes").select("*, seller:profiles!left(*)"),
        supabase.from("auctions").select("*"),
        supabase.from("bids").select("*"),
        supabase.from("appointments").select("*"),
      ]);

      // Calculate stats
      const totalUsers = usersRes.count || 0;
      const totalMotorhomes = motorhomesRes.count || 0;
      const activeAuctions = auctionsRes.data?.filter(a => a.status === "active").length || 0;
      const totalBids = bidsRes.count || 0;
      
      // Revenue calculation – use auction current_bid (actual sale price), not reserve_price
      const soldAuctionsList = auctionsRes.data?.filter(a => a.status === "sold") || [];
      const totalRevenue = soldAuctionsList.reduce((sum, a) => {
        const mh = motorhomesRes.data?.find(m => m.id === a.motorhome_id);
        return sum + Number(a.current_bid || mh?.instant_price || 0);
      }, 0);
      
      // Average bid amount
      const avgBidAmount = bidsRes.data && bidsRes.data.length > 0
        ? bidsRes.data.reduce((sum, b) => sum + Number(b.amount), 0) / bidsRes.data.length
        : 0;

      // Auction success rate
      const completedAuctions = auctionsRes.data?.filter(a => a.status === "ended" || a.status === "sold") || [];
      const soldAuctions = auctionsRes.data?.filter(a => a.status === "sold") || [];
      const successRate = completedAuctions.length > 0 
        ? (soldAuctions.length / completedAuctions.length) * 100 
        : 0;

      // Calculate trends (compare last 30 days to previous 30 days)
      const thirtyDaysAgo = subDays(now, 30);
      const sixtyDaysAgo = subDays(now, 60);

      const recentUsers = usersRes.data?.filter(u => new Date(u.created_at) >= thirtyDaysAgo).length || 0;
      const previousUsers = usersRes.data?.filter(u => new Date(u.created_at) >= sixtyDaysAgo && new Date(u.created_at) < thirtyDaysAgo).length || 0;
      const usersTrend = previousUsers > 0 ? ((recentUsers - previousUsers) / previousUsers) * 100 : 0;

      const recentBids = bidsRes.data?.filter(b => new Date(b.created_at) >= thirtyDaysAgo).length || 0;
      const previousBids = bidsRes.data?.filter(b => new Date(b.created_at) >= sixtyDaysAgo && new Date(b.created_at) < thirtyDaysAgo).length || 0;
      const bidsTrend = previousBids > 0 ? ((recentBids - previousBids) / previousBids) * 100 : 0;

      // Daily stats for last 30 days
      const dailyStats = [];
      for (let i = 29; i >= 0; i--) {
        const date = subDays(now, i);
        const dateStr = format(date, "yyyy-MM-dd");
        
        const dayBids = bidsRes.data?.filter(b => 
          format(new Date(b.created_at), "yyyy-MM-dd") === dateStr
        ).length || 0;
        
        const dayMotorhomes = motorhomesRes.data?.filter(m => 
          format(new Date(m.created_at), "yyyy-MM-dd") === dateStr
        ).length || 0;

        dailyStats.push({
          date: format(date, "dd.MM", { locale: de }),
          bids: dayBids,
          motorhomes: dayMotorhomes,
        });
      }

      // Motorhome by body type
      const bodyTypeStats = motorhomesRes.data?.reduce((acc: any, m) => {
        const type = m.body_type || "Unbekannt";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      const bodyTypeData = Object.entries(bodyTypeStats || {}).map(([name, value]) => ({
        name,
        value,
      }));

      // Top sellers
      const sellerStats = motorhomesRes.data?.reduce((acc: any, m) => {
        if (m.seller) {
          const sellerId = m.seller_id;
          if (!acc[sellerId]) {
            acc[sellerId] = {
              name: `${m.seller.first_name || ''} ${m.seller.last_name || ''}`.trim() || m.seller.email,
              count: 0,
            };
          }
          acc[sellerId].count++;
        }
        return acc;
      }, {});

      const topSellers = Object.values(sellerStats || {})
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 5);

      return {
        totalUsers,
        totalMotorhomes,
        activeAuctions,
        totalBids,
        totalRevenue,
        avgBidAmount,
        successRate,
        dailyStats,
        bodyTypeData,
        topSellers,
        appointmentsCount: appointmentsRes.count || 0,
        usersTrend,
        bidsTrend,
      };
    },
  });

  // Fetch visitor analytics (page views, sessions)
  const { data: visitorStats, isLoading: isLoadingVisitors } = useQuery({
    queryKey: ["adminVisitorStats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_page_views")
        .select("*")
        .gte("created_at", subDays(now, 30).toISOString())
        .order("created_at", { ascending: false });

      if (error && error.code !== "42P01") {
        // Table doesn't exist yet - return mock structure
        console.warn("Analytics tables not yet created");
      }

      const pageViews = data || [];
      const totalPageViews = pageViews.length;
      
      // Calculate unique sessions
      const uniqueSessions = new Set(pageViews.map(pv => pv.session_id)).size;
      
      // Calculate avg session duration (placeholder until we have session end tracking)
      const avgSessionDuration = 0;
      
      // Top pages
      const pageStats = pageViews.reduce((acc: any, pv) => {
        const path = pv.page_path || "/";
        acc[path] = (acc[path] || 0) + 1;
        return acc;
      }, {});
      
      const topPages = Object.entries(pageStats)
        .map(([path, views]) => ({ path, views }))
        .sort((a: any, b: any) => b.views - a.views)
        .slice(0, 10);

      // Daily page views
      const dailyPageViews = [];
      for (let i = 29; i >= 0; i--) {
        const date = subDays(now, i);
        const dateStr = format(date, "yyyy-MM-dd");
        const dayViews = pageViews.filter(pv => 
          format(new Date(pv.created_at), "yyyy-MM-dd") === dateStr
        ).length;
        dailyPageViews.push({
          date: format(date, "dd.MM", { locale: de }),
          views: dayViews,
        });
      }

      // Device stats
      const deviceStats = pageViews.reduce((acc: any, pv) => {
        const device = pv.device_type || "desktop";
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {});

      const deviceData = Object.entries(deviceStats).map(([name, value]) => ({
        name: name === "desktop" ? "Desktop" : name === "mobile" ? "Mobil" : "Tablet",
        value,
      }));

      // Country stats  
      const countryStats = pageViews.reduce((acc: any, pv) => {
        const country = pv.country || "Unbekannt";
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {});

      const countryData = Object.entries(countryStats)
        .map(([name, value]) => ({ name, value }))
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 5);

      return {
        totalPageViews,
        uniqueSessions,
        avgSessionDuration,
        topPages,
        dailyPageViews,
        deviceData,
        countryData,
      };
    },
  });

  const COLORS = ["#195d3e", "#d2281c", "#fbbf24", "#3b82f6", "#8b5cf6", "#ec4899"];

  const isLoading = isLoadingPlatform || isLoadingVisitors;

  // Format trend percentage
  const formatTrend = (value: number | undefined) => {
    if (value === undefined || value === 0) return "0%";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const statCards = [
    {
      title: "Gesamtumsatz",
      value: `€${(platformStats?.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      change: "—",
      trend: "up" as const,
      gradient: "from-green-500 to-emerald-500",
    },
    {
      title: "Aktive Auktionen",
      value: platformStats?.activeAuctions || 0,
      icon: Gavel,
      change: formatTrend(platformStats?.bidsTrend),
      trend: (platformStats?.bidsTrend || 0) >= 0 ? "up" : "down",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      title: "Gebote gesamt",
      value: platformStats?.totalBids || 0,
      icon: TrendingUp,
      change: formatTrend(platformStats?.bidsTrend),
      trend: (platformStats?.bidsTrend || 0) >= 0 ? "up" : "down",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      title: "Erfolgsquote",
      value: `${(platformStats?.successRate || 0).toFixed(1)}%`,
      icon: Car,
      change: "—",
      trend: "up",
      gradient: "from-orange-500 to-red-500",
    },
  ];

  const visitorCards = [
    {
      title: "Seitenaufrufe",
      value: visitorStats?.totalPageViews || 0,
      icon: Eye,
      gradient: "from-indigo-500 to-purple-500",
    },
    {
      title: "Sitzungen",
      value: visitorStats?.uniqueSessions || 0,
      icon: Globe,
      gradient: "from-teal-500 to-green-500",
    },
    {
      title: "Ø Sitzungsdauer",
      value: visitorStats?.avgSessionDuration 
        ? `${Math.round(visitorStats.avgSessionDuration / 60)} min` 
        : "—",
      icon: Clock,
      gradient: "from-amber-500 to-orange-500",
    },
    {
      title: "Seiten/Sitzung",
      value: visitorStats?.uniqueSessions 
        ? (visitorStats.totalPageViews / visitorStats.uniqueSessions).toFixed(1)
        : "—",
      icon: MousePointer,
      gradient: "from-rose-500 to-pink-500",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Detaillierte Einblicke in Ihre Plattform-Performance</p>
      </div>

      <Tabs defaultValue="platform" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="platform">Plattform</TabsTrigger>
          <TabsTrigger value="visitors">Besucher</TabsTrigger>
        </TabsList>

        {/* Platform Analytics Tab */}
        <TabsContent value="platform" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat, index) => (
              <Card key={index} className="overflow-hidden hover-lift border-2">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                    {stat.change !== "—" && (
                      <div className={`flex items-center gap-1 text-sm ${
                        stat.trend === "up" ? "text-green-600" : "text-red-600"
                      }`}>
                        {stat.trend === "up" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        {stat.change}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activity Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Aktivität (Letzte 30 Tage)</CardTitle>
                <CardDescription>Gebote und neue Inserate pro Tag</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={platformStats?.dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="bids" stroke="#195d3e" strokeWidth={2} name="Gebote" />
                    <Line type="monotone" dataKey="motorhomes" stroke="#d2281c" strokeWidth={2} name="Inserate" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Body Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Fahrzeugtypen</CardTitle>
                <CardDescription>Verteilung nach Aufbauart</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={platformStats?.bodyTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {platformStats?.bodyTypeData?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Sellers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Verkäufer</CardTitle>
                <CardDescription>Verkäufer mit den meisten Inseraten</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={platformStats?.topSellers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#195d3e" name="Inserate" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Schnellübersicht</CardTitle>
                <CardDescription>Wichtige Kennzahlen auf einen Blick</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Registrierte Nutzer</p>
                      <p className="text-2xl font-bold">{platformStats?.totalUsers}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Car className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Wohnmobile gesamt</p>
                      <p className="text-2xl font-bold">{platformStats?.totalMotorhomes}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Ø Gebotshöhe</p>
                      <p className="text-2xl font-bold">€{(platformStats?.avgBidAmount || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Visitor Analytics Tab */}
        <TabsContent value="visitors" className="space-y-6">
          {/* Visitor KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {visitorCards.map((stat, index) => (
              <Card key={index} className="overflow-hidden hover-lift border-2">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Info Banner */}
          {(!visitorStats?.totalPageViews || visitorStats.totalPageViews === 0) && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Eye className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100">Besucheranalyse einrichten</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Die Besucheranalyse erfordert die Einrichtung der Analytics-Tabellen und dass Besucher der Cookie-Erfassung zugestimmt haben.
                      Daten werden DSGVO-konform nur bei Zustimmung erfasst.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Page Views Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Seitenaufrufe (Letzte 30 Tage)</CardTitle>
                <CardDescription>Tägliche Seitenaufrufe mit Zustimmung</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={visitorStats?.dailyPageViews || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={2} name="Aufrufe" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Device Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Geräteverteilung</CardTitle>
                <CardDescription>Desktop vs. Mobile vs. Tablet</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={visitorStats?.deviceData || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => entry.value > 0 ? `${entry.name}: ${entry.value}` : ""}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {(visitorStats?.deviceData || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Pages and Countries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Pages */}
            <Card>
              <CardHeader>
                <CardTitle>Beliebteste Seiten</CardTitle>
                <CardDescription>Meistbesuchte Seiten der letzten 30 Tage</CardDescription>
              </CardHeader>
              <CardContent>
                {(visitorStats?.topPages?.length || 0) > 0 ? (
                  <div className="space-y-3">
                    {visitorStats?.topPages?.map((page: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm font-medium truncate max-w-[200px]">{page.path}</span>
                        <span className="text-sm text-muted-foreground">{page.views} Aufrufe</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Noch keine Daten vorhanden</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Countries */}
            <Card>
              <CardHeader>
                <CardTitle>Besucher nach Land</CardTitle>
                <CardDescription>Geografische Verteilung der Besucher</CardDescription>
              </CardHeader>
              <CardContent>
                {(visitorStats?.countryData?.length || 0) > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={visitorStats?.countryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#6366f1" name="Besucher" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Noch keine Daten vorhanden</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
