import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import RelatedContent, { haendlerRelatedLinks } from "@/components/RelatedContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Zap, Shield, CheckCircle2, Handshake, BarChart3, Target, Clock, Gavel, ArrowRight, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import dealerProfessional from "@/assets/dealer-professional.webp";
import { useSettings } from "@/contexts/SettingsContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const Haendler = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || 'CaravanWert';

  // Live auction data for social proof
  const { data: liveAuctions } = useQuery({
    queryKey: ["haendler-live-auctions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          id, current_bid, starting_bid, end_time,
          kitchen:kitchens!left(
            manufacturer, model, year, body_type, mileage, city, sale_channel, instant_price,
            photos:kitchen_photos(url, card_url, medium_url, display_order)
          )
        `)
        .eq("status", "active")
        .gt("end_time", new Date().toISOString())
        .order("end_time", { ascending: true })
        .limit(4);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  const { data: auctionStats } = useQuery({
    queryKey: ["haendler-auction-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_platform_stats");
      if (error) throw error;
      const stats = data as any;
      return {
        activeAuctions: stats?.active_auctions || 0,
        soldAuctions: stats?.sold_auctions || 0,
        approvedDealers: stats?.approved_dealers || 0,
      };
    },
    staleTime: 60000,
  });

  const getTimeRemaining = (endTime: string) => {
    const diff = new Date(endTime).getTime() - Date.now();
    if (diff <= 0) return "Beendet";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}T ${hours}h`;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };
  const benefits = [
    {
      icon: TrendingUp,
      title: "Günstig einkaufen",
      description: "Ersteigern Sie geprüfte Wohnmobile und Wohnwagen zu attraktiven Preisen – direkt von Privatverkäufern."
    },
    {
      icon: Shield,
      title: "Sichere Abwicklung",
      description: "Rechtlich abgesicherte Kaufverträge, transparente Provisionen und professionelle Übergabe."
    },
    {
      icon: Users,
      title: "Exklusives Angebot",
      description: "Zugang zu Fahrzeugen, die nur über unsere Plattform verfügbar sind – bevor sie auf den freien Markt kommen."
    },
    {
      icon: Zap,
      title: "Wenig Aufwand",
      description: "Keine eigene Akquise nötig: Wir bringen die Verkäufer – Sie bieten bequem online."
    }
  ];

  const services = [
    {
      title: "Online-Auktionen",
      description: "Bieten Sie bequem online auf geprüfte Wohnmobile und Wohnwagen von Privatverkäufern.",
      features: [
        "Tägliche neue Fahrzeuge",
        "Transparente Gebots-Historie",
        "Sofortkauf-Option bei ausgewählten Fahrzeugen"
      ]
    },
    {
      title: "Fahrzeug-Informationen",
      description: "Alle wichtigen Daten auf einen Blick – für schnelle Kaufentscheidungen.",
      features: [
        "Detaillierte Fahrzeugbeschreibungen",
        "Hochwertige Fotos",
        "Zustandsberichte & Kilometerstand"
      ]
    },
    {
      title: "Kaufchance-System",
      description: "Wenn die Reserve nicht erreicht wird, erhalten Top-Bieter eine zweite Chance zum Kauf.",
      features: [
        "Exklusives Angebot für Höchstbieter",
        "Verhandlung direkt über die Plattform",
        "72h Frist für Gegenangebote"
      ]
    },
    {
      title: "Händler-Dashboard",
      description: "Behalten Sie den Überblick über Ihre Gebote, gewonnene Auktionen und Rechnungen.",
      features: [
        "Echtzeit-Benachrichtigungen bei Geboten",
        "Gebotsübersicht & Favoritenliste",
        "Rechnungen & Kaufverträge digital"
      ]
    }
  ];

  const stats = [
    { number: auctionStats ? `${auctionStats.activeAuctions}` : "30+", label: "Aktive Auktionen" },
    { number: "Täglich", label: "Neue Fahrzeuge" },
    { number: "Kostenlos", label: "Registrierung" },
    { number: auctionStats ? `${auctionStats.approvedDealers}+` : "40+", label: "Registrierte Händler" }
  ];

  const process = [
    {
      step: "1",
      title: "Kostenlos registrieren",
      description: "Schnelle Online-Registrierung mit Gewerbenachweis – Freischaltung in 1–2 Werktagen."
    },
    {
      step: "2",
      title: "Auktionen entdecken",
      description: "Durchstöbern Sie aktuelle Wohnmobile und Wohnwagen mit detaillierten Fahrzeugdaten."
    },
    {
      step: "3",
      title: "Online bieten",
      description: "Geben Sie Gebote ab – bequem vom Büro aus. Per Auto-Bid auch automatisch mitbieten."
    },
    {
      step: "4",
      title: "Fahrzeug übernehmen",
      description: "Bei Zuschlag: Kaufvertrag digital, sichere Übergabe und einfache Abwicklung."
    }
  ];

  // Service structured data for dealer program
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Wohnmobil-Auktionsplattform für Händler',
    description: 'Online-Auktionsplattform für Wohnmobil-Händler. Ersteigern Sie geprüfte Wohnmobile und Wohnwagen direkt von Privatverkäufern zu attraktiven Preisen.',
    provider: {
      '@type': 'Organization',
      name: siteName,
      url: 'https://caravanwert.de',
    },
    areaServed: {
      '@type': 'Place',
      name: 'Deutschland',
    },
    serviceType: 'B2B Vehicle Auction Platform',
  };

  return (
    <PageLayout
      breadcrumbs={true}
      title="Für Händler: Wohnmobile per Auktion einkaufen"
      description="Ersteigern Sie Wohnmobile und Wohnwagen von Privatverkäufern. Kostenlose Registrierung, transparente Auktionen, sichere Abwicklung. Jetzt als Händler registrieren!"
      keywords="wohnmobil händler einkauf, wohnmobil auktion händler, wohnwagen ankauf händler, b2b wohnmobil"
      canonicalPath="/haendler"
      structuredData={serviceSchema}
    >
      {/* Hero Section */}
      <PageHero size="lg">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Wohnmobile <span className="gradient-text">günstig einkaufen</span> – per Online-Auktion
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              Ersteigern Sie geprüfte Wohnmobile und Wohnwagen direkt von Privatverkäufern. 
              Kostenlose Registrierung, transparente Gebote, sichere Abwicklung.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/register/haendler">
                <Button size="lg" className="w-full sm:w-auto gradient-hero hover:gradient-hero-hover shadow-lg hover:shadow-glow">
                  Jetzt registrieren
                </Button>
              </Link>
              <Link to="/wohnmobil-haendler-werden">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Mehr erfahren
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="relative animate-fade-in animate-delay-200">
            <div className="absolute -inset-4 gradient-hero opacity-20 blur-3xl rounded-full" />
            <img 
              src={dealerProfessional} 
              alt="Professionelles Händler-Partnerprogramm" 
              className="relative rounded-2xl shadow-premium hover-lift"
            />
          </div>
        </div>
      </PageHero>

      {/* Stats Section */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                  {stat.number}
                </div>
                <div className="text-sm md:text-base opacity-90">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">Ihre Vorteile als Partner</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Profitieren Sie von unserem umfassenden Service und steigern Sie Ihren Geschäftserfolg.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="hover-lift border-2 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardHeader>
                  <div className="h-14 w-14 rounded-xl gradient-hero flex items-center justify-center mb-4 shadow-glow-sm">
                    <benefit.icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-xl">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{benefit.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Live Auctions Preview – Social Proof */}
      {liveAuctions && liveAuctions.length > 0 && (
        <section className="py-20 bg-gradient-to-b from-background to-muted/30">
          <div className="container">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 border border-red-200 mb-6">
                <Flame className="h-4 w-4 text-red-500 animate-pulse" />
                <span className="text-sm font-semibold text-red-700">LIVE – Jetzt verfügbar</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">
                Diese Fahrzeuge warten auf Ihr Gebot
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {auctionStats?.activeAuctions || liveAuctions.length} aktive Auktionen – registrieren Sie sich und bieten Sie mit.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {liveAuctions.map((auction: any) => {
                const m = auction.kitchen;
                if (!m) return null;
                const photos = m.photos?.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
                const photoObj = photos?.[0];
                const photoUrl = photoObj?.card_url || photoObj?.url;
                const isFestpreis = m.sale_channel === 'instant_price';
                const price = isFestpreis ? Number(m.instant_price || 0) : (auction.current_bid || auction.starting_bid || 0);
                const timeLeft = getTimeRemaining(auction.end_time);
                const isUrgent = new Date(auction.end_time).getTime() - Date.now() < 24 * 60 * 60 * 1000;

                return (
                  <Card key={auction.id} className="overflow-hidden hover-lift border-2 hover:border-primary/30 transition-all group">
                    <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                      {photoUrl ? (
                        <img src={photoUrl} alt={`${m.manufacturer} ${m.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Gavel className="h-12 w-12 opacity-30" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <Badge variant={isUrgent ? "destructive" : "secondary"} className="gap-1 text-xs font-semibold shadow-md">
                          <Clock className="h-3 w-3" />
                          {timeLeft}
                        </Badge>
                      </div>
                      {isFestpreis ? (
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-yellow-500 text-white text-xs font-semibold shadow-md">
                            Festpreis
                          </Badge>
                        </div>
                      ) : !auction.current_bid ? (
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-emerald-500 text-white text-xs font-semibold shadow-md">
                            Noch ohne Gebot!
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-sm line-clamp-1 mb-1">
                        {m.manufacturer} {m.model}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        {m.year && <span>{m.year}</span>}
                        {m.body_type && <><span>·</span><span>{m.body_type}</span></>}
                        {m.mileage && <><span>·</span><span>{Number(m.mileage).toLocaleString("de-DE")} km</span></>}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-muted-foreground">{isFestpreis ? 'Festpreis' : 'Aktuelles Gebot'}</div>
                          <div className={`text-lg font-bold ${isFestpreis ? 'text-yellow-600' : 'text-primary'}`}>
                            {Number(price).toLocaleString("de-DE")} €
                          </div>
                        </div>
                        <Gavel className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="text-center">
              <Link to="/register/haendler">
                <Button size="lg" className="gradient-hero hover:gradient-hero-hover shadow-lg hover:shadow-glow gap-2">
                  Jetzt registrieren & mitbieten
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground mt-3">
                Kostenlose Registrierung · Keine monatlichen Gebühren · Sofort bieten nach Freischaltung
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Services Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">Unsere Händler-Services</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Umfassende Dienstleistungen für Ihren Erfolg im Wohnmobil-Handel.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {services.map((service, index) => (
              <Card key={index} className="hover-lift-sm animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardHeader>
                  <CardTitle className="text-2xl">{service.title}</CardTitle>
                  <CardDescription className="text-base">{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {service.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">In 4 Schritten zum ersten Fahrzeug</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              So einfach kaufen Sie Wohnmobile über {siteName}.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {process.map((item, index) => (
              <div key={index} className="relative animate-fade-in" style={{ animationDelay: `${index * 0.15}s` }}>
                <div className="text-center">
                  <div className="inline-flex h-20 w-20 items-center justify-center rounded-full gradient-hero text-white text-3xl font-bold mb-6 shadow-lg">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Partner With Us */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">Warum über {siteName} einkaufen?</h2>
              <p className="text-lg opacity-90">
                Ihr direkter Draht zu Privatverkäufern – ohne Zwischenhändler.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {[
                {
                  icon: BarChart3,
                  title: "Stetig neue Fahrzeuge",
                  description: "Wöchentlich kommen neue Wohnmobile und Wohnwagen aus Privathand in die Auktion."
                },
                {
                  icon: Target,
                  title: "Weniger Wettbewerb",
                  description: "Überschaubares Bieterfeld – Ihre Chancen auf einen Zuschlag sind hoch."
                },
                {
                  icon: Handshake,
                  title: "Faire Konditionen",
                  description: "Transparente Provisionen nur bei Zuschlag. Keine monatlichen Gebühren."
                }
              ].map((item, index) => (
                <Card key={index} className="text-center border-primary/20 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <CardHeader>
                    <div className="h-14 w-14 rounded-xl gradient-hero flex items-center justify-center mb-3 shadow-glow-sm mx-auto">
                      <item.icon className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">{item.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl">Das bieten wir Ihnen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">Tägliche E-Mail mit neuen Fahrzeugen – Sie verpassen kein Angebot</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">Echtzeit-Benachrichtigungen wenn Sie überboten werden</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">Kaufvertrag und Rechnung automatisch bei Zuschlag</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">Provision nur bei erfolgreichem Kauf – keine laufenden Kosten</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* SEO Content */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-4xl mx-auto prose prose-lg">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6">Häufige Fragen von Händlern</h2>
            
            <h3 className="text-2xl font-bold mt-8 mb-4">Für wen ist die Plattform geeignet?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Unsere Auktionsplattform richtet sich an Wohnmobil-Händler, Autohäuser mit Camping-Abteilung,
              Wohnmobil-Vermietungen und Servicebetriebe, die ihren Bestand günstig aus Privathand aufstocken möchten.
              Egal ob Sie regelmäßig oder gelegentlich einkaufen – Sie zahlen nur bei Zuschlag.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">Wie funktioniert das Bieten?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Jedes Fahrzeug durchläuft eine zeitlich begrenzte Auktion. Sie können manuell oder per Auto-Bid 
              bieten. Bei einem Gebot in der letzten Minute wird die Auktion automatisch verlängert (Soft-Close), 
              damit kein Schnäppchen durch Last-Second-Gebote verloren geht. Bei Zuschlag erhalten Sie automatisch 
              Kaufvertrag und Rechnung.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">Was kostet die Teilnahme?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Die Registrierung und das Bieten sind kostenlos. Es fällt nur eine Provision an, wenn Sie eine 
              Auktion gewinnen – also nur bei tatsächlichem Kauf. Keine monatlichen Gebühren, keine Mindestabnahmen.
              Die Provisionsstaffel ist transparent in Ihrem Händler-Dashboard einsehbar.
            </p>
          </div>
        </div>
      </section>

      {/* Related Content for Internal Linking */}
      <RelatedContent
        title="Weitere Informationen für Händler"
        description="Alles was Sie für eine erfolgreiche Partnerschaft wissen müssen"
        links={haendlerRelatedLinks}
      />

      {/* CTA Section */}
      <section id="partner-werden" className="py-20 bg-gradient-to-br from-primary via-primary-light to-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-6">Jetzt kostenlos registrieren</h2>
            <p className="text-xl mb-8 opacity-95">
              Ersteigern Sie Wohnmobile direkt von Privatverkäufern – registrieren Sie sich in 2 Minuten.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register/haendler">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Jetzt registrieren
                </Button>
              </Link>
              {settings?.support_phone && (
                <a href={`tel:${settings.support_phone.replace(/\s/g, '')}`}>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 border-white/30 hover:bg-white/20 text-white">
                    Beratung anfordern
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default Haendler;
