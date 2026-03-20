import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Gavel, Car, Users, TrendingUp, Clock, UserPlus, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";

function RecentLeadsCard() {
  const { data: leads } = useQuery({
    queryKey: ["recentLeads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("quick_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  if (!leads || leads.length === 0) return null;

  return (
    <Card className="p-8 border-2 hover:border-primary/20 transition-smooth">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-cyan-500" />
          Neueste Leads
        </h2>
        <Badge variant="outline">{leads.length} Leads</Badge>
      </div>
      <div className="space-y-3">
        {leads.map((lead) => (
          <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">
                  {lead.manufacturer} {lead.model}
                </p>
                <Badge variant={lead.source === 'hero_form_partial' ? 'secondary' : 'default'} className="text-xs shrink-0">
                  {lead.source === 'hero_form_partial' ? 'Teilweise' : 'Vollständig'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                {lead.name && <span>{lead.name}</span>}
                {lead.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {lead.email}
                  </span>
                )}
                {lead.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {lead.phone}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground shrink-0 ml-4">
              {format(new Date(lead.created_at), "dd.MM.yy HH:mm", { locale: de })}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["adminStats"],
    queryFn: async () => {
      const [auctionsRes, motorhomesRes, usersRes, bidsRes, leadsRes] = await Promise.all([
        supabase.from("auctions").select("status", { count: "exact" }),
        supabase.from("motorhomes").select("*", { count: "exact" }),
        supabase.from("profiles").select("*", { count: "exact" }),
        supabase.from("bids").select("amount"),
        supabase.from("quick_leads").select("*", { count: "exact" }),
      ]);

      const activeAuctions = auctionsRes.data?.filter(a => a.status === "active").length || 0;
      const totalBids = bidsRes.data?.length || 0;
      const totalBidValue = bidsRes.data?.reduce((sum, bid) => sum + Number(bid.amount), 0) || 0;

      return {
        totalAuctions: auctionsRes.count || 0,
        activeAuctions,
        totalMotorhomes: motorhomesRes.count || 0,
        totalUsers: usersRes.count || 0,
        totalBids,
        totalBidValue,
        totalLeads: leadsRes.count || 0,
      };
    },
  });

  const { data: recentAuctions } = useQuery({
    queryKey: ["recentAuctions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("auctions")
        .select(`
          *,
          motorhome:motorhomes (
            manufacturer,
            model,
            year,
            motorhome_photos(photo_url, display_order)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      return data;
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Laufend</Badge>;
      case "sold":
        return <Badge className="bg-green-500 hover:bg-green-600">Verkauft</Badge>;
      case "ended":
        return <Badge className="bg-red-500 hover:bg-red-600">Nicht verkauft</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Abgebrochen</Badge>;
      case "draft":
        return <Badge variant="secondary">Entwurf</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const statCards = [
    {
      title: "Aktive Auktionen",
      value: stats?.activeAuctions || 0,
      icon: Gavel,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Wohnmobile",
      value: stats?.totalMotorhomes || 0,
      icon: Car,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Benutzer",
      value: stats?.totalUsers || 0,
      icon: Users,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Gebote",
      value: stats?.totalBids || 0,
      icon: TrendingUp,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Leads",
      value: stats?.totalLeads || 0,
      icon: UserPlus,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard Übersicht</h1>
        <p className="text-muted-foreground">
          Willkommen im Admin-Bereich. Hier sehen Sie die wichtigsten Kennzahlen auf einen Blick.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Card key={stat.title} className="relative overflow-hidden hover-lift border-2 hover:border-primary/30 transition-smooth group bg-card animate-scale-in" style={{ animationDelay: `${index * 100}ms` }}>
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className={`h-14 w-14 rounded-lg gradient-hero flex items-center justify-center shadow-lg group-hover:shadow-glow transition-smooth`}>
                  <stat.icon className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total Bid Value Card */}
      <Card className="p-6 gradient-hero text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 mb-1">Gesamtwert aller Gebote</p>
            <p className="text-4xl font-bold">
              €{stats?.totalBidValue.toLocaleString() || 0}
            </p>
          </div>
          <TrendingUp className="w-12 h-12 text-white/50" />
        </div>
      </Card>

      {/* Recent Leads */}
      <RecentLeadsCard />

      {/* Recent Auctions */}
      <Card className="p-8 border-2 hover:border-primary/20 transition-smooth hover-lift">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Neueste Auktionen
          </h2>
          <Link to="/admin/auctions">
            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
              Alle ansehen
            </Badge>
          </Link>
        </div>

        <div className="space-y-4">
          {recentAuctions?.map((auction) => {
            const firstPhoto = auction.motorhome?.motorhome_photos
              ?.sort((a: any, b: any) => a.display_order - b.display_order)[0]?.photo_url;

            return (
              <Link key={auction.id} to={`/auktion/${auction.id}`} className="block">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-smooth cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {firstPhoto ? (
                        <img 
                          src={firstPhoto}
                          alt={`${auction.motorhome?.manufacturer} ${auction.motorhome?.model}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10">
                          <Car className="w-5 h-5 text-primary" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {auction.motorhome?.manufacturer} {auction.motorhome?.model}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Baujahr {auction.motorhome?.year}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(auction.status)}
                    <p className="text-sm text-muted-foreground mt-1">
                      Aktuell: €{Number(auction.current_bid || auction.starting_bid).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
