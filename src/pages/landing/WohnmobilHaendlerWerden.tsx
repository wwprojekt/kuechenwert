import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Shield, TrendingUp, Gavel, Euro, Users, Clock, Zap, BarChart3, Phone, Timer, Star, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import FAQSection from "@/components/FAQSection";
import { useSettings } from "@/contexts/SettingsContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { trackLandingPageLead, trackPhoneClick } from "@/lib/gadsConversionService";
import { trackEvent } from "@/lib/analyticsService";
import { generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";

const WohnmobilHaendlerWerden = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || "CaravanWert";

  const { data: stats } = useQuery({
    queryKey: ["dealer-landing-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_platform_stats");
      if (error) throw error;
      const s = data as any;
      return {
        active: s?.active_auctions || 0,
        dealers: s?.approved_dealers || 0,
        endingSoon: s?.ending_soon || 0,
        brands: s?.unique_brands || 30,
      };
    },
    staleTime: 60000,
  });

  const { data: liveAuctions } = useQuery({
    queryKey: ["dealer-landing-auctions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("auctions")
        .select("id, current_bid, starting_bid, end_time, bid_count, motorhome_id")
        .eq("status", "active")
        .order("end_time", { ascending: true })
        .limit(3);
      if (!data?.length) return [];

      const mhIds = data.map(a => a.motorhome_id).filter(Boolean);
      const [{ data: mhs }, { data: photos }] = await Promise.all([
        supabase.from("motorhomes").select("id, manufacturer, model, year, body_type, mileage").in("id", mhIds),
        supabase.from("motorhome_photos").select("motorhome_id, url, display_order").in("motorhome_id", mhIds).order("display_order", { ascending: true }),
      ]);

      return data.map(auction => {
        const mh = mhs?.find(m => m.id === auction.motorhome_id);
        const photo = photos?.find(p => p.motorhome_id === auction.motorhome_id);
        const photoUrl = photo?.url || null;
        const timeLeft = new Date(auction.end_time).getTime() - Date.now();
        const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
        const daysLeft = Math.floor(hoursLeft / 24);
        return {
          id: auction.id,
          title: `${mh?.manufacturer || ""} ${mh?.model || ""}`.trim() || "Wohnmobil",
          year: mh?.year, bodyType: mh?.body_type, mileage: mh?.mileage,
          currentBid: auction.current_bid || auction.starting_bid,
          bidCount: auction.bid_count || 0,
          timeLeft: daysLeft > 0 ? `${daysLeft}T ${hoursLeft % 24}h` : `${hoursLeft}h`,
          photoUrl,
        };
      });
    },
    staleTime: 60000,
  });

  const handleCtaClick = (source: string) => {
    trackLandingPageLead("wohnmobil-haendler-werden", source);
    trackEvent("dealer_cta_click", { category: "dealer_acquisition", properties: { source } });
  };

  const handlePhoneClick = () => {
    trackPhoneClick("+4951151532476", "/wohnmobil-haendler-werden");
  };

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

  const faqs = [
    {
      question: "Wie funktioniert die Händler-Registrierung?",
      answer: "Die Registrierung dauert nur 2 Minuten. Sie füllen das Online-Formular aus und laden Ihren Gewerbenachweis hoch. Die Freischaltung erfolgt in der Regel innerhalb von 1–2 Werktagen."
    },
    {
      question: "Was kostet die Teilnahme?",
      answer: "Die Registrierung und das Bieten sind komplett kostenlos. Sie zahlen nur eine Provision von 1,2–2 % bei gewonnener Auktion (z. B. 300 € bei einem Fahrzeug für 15.000 €). Keine monatlichen Gebühren, keine Mindestabnahme."
    },
    {
      question: "Wie werden die Fahrzeuge geprüft?",
      answer: "Alle Fahrzeuge werden mit detaillierten Fahrzeugdaten und Zustandsberichten eingestellt. Wir prüfen die Angaben der Verkäufer und stellen hochauflösende Fotos bereit. Bei Zuschlag erhalten Sie automatisch Kaufvertrag und Rechnung."
    },
    {
      question: "Kann ich automatisch bieten?",
      answer: "Ja! Mit der Auto-Bid-Funktion können Sie einen Höchstbetrag festlegen. Das System bietet dann automatisch für Sie mit, bis Ihr Limit erreicht ist. So verpassen Sie kein Fahrzeug."
    },
    {
      question: "Was passiert, wenn die Reserve nicht erreicht wird?",
      answer: "Wenn die Reserve nicht erreicht wird, aktiviert sich unser Kaufchance-System: Die Top-Bieter erhalten ein exklusives Angebot, das Fahrzeug zum Höchstgebot zu kaufen. Sie haben 72 Stunden Zeit für Gegenangebote."
    },
    {
      question: "Welche Fahrzeugtypen werden angeboten?",
      answer: "Wir bieten Wohnmobile (Teilintegriert, Vollintegriert, Alkoven, Kastenwagen, Campingbus) und Wohnwagen aller Marken. Die meisten Fahrzeuge stammen von Privatverkäufern aus Deutschland."
    },
    {
      question: "Wie hoch ist die Provision genau?",
      answer: "Die Provision ist gestaffelt: 2 % bis 10.000 €, 1,8 % bis 15.000 €, 1,5 % bis 20.000 €, 1,3 % bis 30.000 €, 1,2 % ab 30.000 €. Es gilt eine Mindestprovision. Bei hohem Volumen gibt es zusätzliche Mengenrabatte."
    },
  ];

  const breadcrumbSchema = generateBreadcrumbSchema(getBreadcrumbsFromPath("/wohnmobil-haendler-werden"));

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Wohnmobil Händler werden – Auktionsplattform für Händler-Einkauf",
      description: "Registrieren Sie sich als Wohnmobil-Händler und ersteigern Sie Fahrzeuge direkt von Privatverkäufern. Provision ab 1,2 %, keine monatlichen Gebühren.",
      provider: { "@type": "Organization", name: siteName, url: "https://caravanwert.de" },
    },
    breadcrumbSchema,
  ];

  return (
    <PageLayout
      title="Wohnmobil Händler werden – Per Auktion günstig einkaufen"
      description="Registrieren Sie sich als Händler auf CaravanWert und ersteigern Sie geprüfte Wohnmobile & Wohnwagen direkt von Privatverkäufern. Provision ab 1,2 %, keine Mindestabnahme."
      keywords="wohnmobil händler werden, wohnmobil auktion händler, wohnwagen einkauf händler, wohnmobil händler plattform, wohnmobil händler registrieren"
      canonicalPath="/wohnmobil-haendler-werden"
      structuredData={structuredData}
      hideFooter
    >
      <PageHero size="lg">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
              <Gavel className="h-4 w-4" />
              Auktionsplattform für Händler – direkt von Privat
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Wohnmobile <span className="gradient-text">günstig einkaufen</span> – direkt von Privat
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              {stats?.active || "30+"} Fahrzeuge jetzt verfügbar. Bieten Sie als registrierter Händler auf Wohnmobile und Wohnwagen von Privatverkäufern – ohne Zwischenhändler.
            </p>
            <div className="space-y-3 mb-8">
              {[
                "Kostenlose Registrierung – keine monatlichen Gebühren",
                "Provision ab 1,2 % – nur bei Zuschlag",
                "Tägliche E-Mail mit neuen Fahrzeugen",
                "Auto-Bid: Automatisch mitbieten bis zum Limit",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-sm md:text-base">{item}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/register/haendler" onClick={() => handleCtaClick("hero_primary")}>
                <Button size="lg" className="w-full sm:w-auto gradient-hero hover:gradient-hero-hover shadow-lg hover:shadow-glow gap-2">
                  Kostenlos registrieren
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="tel:+4951151532476" onClick={handlePhoneClick}>
                <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                  <Phone className="h-4 w-4" />
                  Beratung: 0511 51532476
                </Button>
              </a>
            </div>
          </div>

          <div className="relative animate-fade-in animate-delay-200">
            <div className="grid grid-cols-2 gap-4">
              <Card className="text-center border-2 border-primary/20">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold gradient-text mb-1">{stats?.active || "30+"}</div>
                  <div className="text-sm text-muted-foreground">Aktive Auktionen</div>
                </CardContent>
              </Card>
              <Card className="text-center border-2 border-primary/20">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold gradient-text mb-1">ab 1,2 %</div>
                  <div className="text-sm text-muted-foreground">Provision</div>
                </CardContent>
              </Card>
              <Card className="text-center border-2 border-primary/20">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold gradient-text mb-1">{stats?.brands || "30"}+</div>
                  <div className="text-sm text-muted-foreground">Marken verfügbar</div>
                </CardContent>
              </Card>
              <Card className="text-center border-2 border-primary/20">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold gradient-text mb-1">Täglich</div>
                  <div className="text-sm text-muted-foreground">Neue Fahrzeuge</div>
                </CardContent>
              </Card>
            </div>
            {(stats?.endingSoon ?? 0) > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-orange-50 border border-orange-200 text-center">
                <p className="text-sm font-medium text-orange-800">
                  <Timer className="h-4 w-4 inline mr-1" />
                  {stats!.endingSoon} {stats!.endingSoon === 1 ? "Auktion endet" : "Auktionen enden"} in den nächsten 24h
                </p>
              </div>
            )}
          </div>
        </div>
      </PageHero>

      {/* LIVE AUCTIONS PREVIEW */}
      {liveAuctions && liveAuctions.length > 0 && (
        <section className="py-16 bg-slate-50">
          <div className="container">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-medium mb-3">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                LIVE – Jetzt verfügbar
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">Diese Fahrzeuge warten auf Ihr Gebot</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {liveAuctions.map((auction) => (
                <Card key={auction.id} className="overflow-hidden hover-lift">
                  <div className="h-48 bg-muted flex items-center justify-center relative">
                    {auction.photoUrl ? (
                      <img src={auction.photoUrl} alt={auction.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <Camera className="h-12 w-12 text-muted-foreground/30" />
                    )}
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      <Timer className="h-3 w-3 inline mr-1" />
                      {auction.timeLeft}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-base mb-1 truncate">{auction.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      {auction.year && <span>Bj. {auction.year}</span>}
                      {auction.bodyType && <><span>•</span><span>{auction.bodyType}</span></>}
                      {auction.mileage && <><span>•</span><span>{(auction.mileage / 1000).toFixed(0)}t km</span></>}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold text-primary">{formatPrice(auction.currentBid)}</div>
                        <div className="text-xs text-muted-foreground">{auction.bidCount} {auction.bidCount === 1 ? "Gebot" : "Gebote"}</div>
                      </div>
                      <Link to="/register/haendler" onClick={() => handleCtaClick("auction_card")}>
                        <Button size="sm" variant="outline" className="text-xs">Mitbieten →</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link to="/kaufen">
                <Button variant="outline" className="gap-2">
                  Alle {stats?.active || "30+"} Auktionen ansehen <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">So funktioniert der Einkauf per Auktion</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Registrieren", desc: "Online-Formular + Gewerbenachweis. Freischaltung in 1–2 Werktagen." },
              { step: "2", title: "Fahrzeuge entdecken", desc: "Täglich neue Wohnmobile & Wohnwagen mit Fotos und Zustandsberichten." },
              { step: "3", title: "Online bieten", desc: "Manuell oder per Auto-Bid. Soft-Close schützt vor Last-Second-Geboten." },
              { step: "4", title: "Fahrzeug übernehmen", desc: "Kaufvertrag & Rechnung automatisch. Sichere Übergabe mit PIN." },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full gradient-hero text-white text-xl font-bold mb-4 shadow-lg">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMISSION TRANSPARENCY */}
      <section className="py-16">
        <div className="container max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">Transparente Kosten – nur bei Erfolg</h2>
          <p className="text-muted-foreground text-center mb-10">Keine monatlichen Gebühren. Sie zahlen nur eine geringe Provision, wenn Sie eine Auktion gewinnen.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { range: "bis 10.000 €", rate: "2,0 %" },
              { range: "bis 20.000 €", rate: "1,5 %" },
              { range: "bis 30.000 €", rate: "1,3 %" },
              { range: "ab 30.000 €", rate: "1,2 %" },
            ].map((tier, i) => (
              <div key={i} className="text-center p-4 rounded-xl bg-primary/5 border border-primary/10">
                <div className="text-2xl font-bold text-primary">{tier.rate}</div>
                <div className="text-xs text-muted-foreground mt-1">{tier.range}</div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-green-50 px-4 py-2 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Beispiel: Zuschlag bei 25.000 € → nur 325 € Provision (1,3 %)</span>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-20 bg-slate-50">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Warum Händler {siteName} nutzen</h2>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            Kein eigener Ankauf, kein Risiko – Fahrzeuge direkt von Privatverkäufern ersteigern.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: TrendingUp, title: "Günstige Einkaufspreise", desc: "Keine Händlermargen. Fahrzeuge oft 15–30 % unter Marktwert ersteigern." },
              { icon: Zap, title: "Minimaler Aufwand", desc: "Kein Standort, keine Besichtigungen – bieten Sie bequem vom Büro aus." },
              { icon: Shield, title: "Nur bei Erfolg zahlen", desc: "Kostenlose Registrierung. Provision ab 1,2 % – nur bei gewonnener Auktion." },
              { icon: Clock, title: "Täglicher Digest", desc: "Jeden Morgen erhalten Sie eine E-Mail mit neuen und endenden Auktionen." },
              { icon: Gavel, title: "Kaufchance-System", desc: "Reserve nicht erreicht? Top-Bieter bekommen eine zweite Chance zum Zuschlag." },
              { icon: BarChart3, title: "Händler-Dashboard", desc: "Übersicht über Gebote, gewonnene Fahrzeuge, Rechnungen und mehr." },
            ].map((item, i) => (
              <Card key={i} className="hover-lift">
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-16">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">Das sagen unsere Händler</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { quote: "Endlich eine Plattform, auf der ich unkompliziert Wohnmobile direkt von Privat kaufen kann. Die Provisionen sind fair und der Ablauf professionell.", name: "Thomas K.", role: "Händler aus Niedersachsen" },
              { quote: "Die tägliche E-Mail mit neuen Fahrzeugen spart mir enorm viel Zeit. Auto-Bid ist genial – ich verpasse kein Angebot mehr.", name: "Sandra M.", role: "Wohnmobil-Händlerin aus Bayern" },
              { quote: "Transparente Kosten, kein Risiko. Ich zahle nur bei Zuschlag und die Kaufverträge werden automatisch erstellt. Top Service.", name: "Markus R.", role: "Caravan-Händler aus NRW" },
            ].map((t, i) => (
              <Card key={i} className="border-0 shadow-md">
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-3">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 italic">&ldquo;{t.quote}&rdquo;</p>
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQSection items={faqs} title="Häufige Fragen von Händlern" />

      {/* FINAL CTA – dealer-focused (replaces seller-focused default footer) */}
      <section className="py-20 bg-gradient-to-br from-primary via-primary-light to-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">Jetzt kostenlos registrieren und mitbieten</h2>
            <p className="text-lg mb-8 opacity-95">
              In 2 Minuten registriert. Provision ab 1,2 %. Sofort nach Freischaltung auf {stats?.active || "30+"} Fahrzeuge bieten.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register/haendler" onClick={() => handleCtaClick("footer_primary")}>
                <Button size="lg" variant="secondary" className="gap-2 shadow-lg">
                  Händler-Registrierung starten
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="tel:+4951151532476" onClick={handlePhoneClick}>
                <Button size="lg" variant="outline" className="gap-2 border-white/30 text-white hover:bg-white/10">
                  <Phone className="h-4 w-4" />
                  0511 51532476
                </Button>
              </a>
            </div>
            <p className="text-sm mt-6 opacity-70">
              Kostenlos &amp; unverbindlich · Keine Kreditkarte nötig · Freischaltung in 1–2 Werktagen
            </p>
          </div>
        </div>
      </section>

      {/* Mini footer for legal (since hideFooter removes seller-focused default) */}
      <footer className="py-6 bg-slate-900 text-slate-400 text-center text-xs">
        <div className="container flex flex-wrap justify-center gap-4">
          <span>© {new Date().getFullYear()} {siteName} GmbH</span>
          <Link to="/impressum" className="hover:text-white">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-white">Datenschutz</Link>
          <Link to="/agb" className="hover:text-white">AGB</Link>
          <Link to="/kontakt" className="hover:text-white">Kontakt</Link>
        </div>
      </footer>
    </PageLayout>
  );
};

export default WohnmobilHaendlerWerden;
