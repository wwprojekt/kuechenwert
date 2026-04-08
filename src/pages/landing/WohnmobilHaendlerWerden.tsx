import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Shield, TrendingUp, Gavel, Euro, Users, Clock, Zap, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import FAQSection from "@/components/FAQSection";
import { useSettings } from "@/contexts/SettingsContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const WohnmobilHaendlerWerden = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || "CaravanWert";

  const { data: stats } = useQuery({
    queryKey: ["dealer-landing-stats"],
    queryFn: async () => {
      const [activeRes, dealerRes] = await Promise.all([
        supabase.from("auctions").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("dealer_applications").select("id", { count: "exact", head: true }).eq("status", "approved"),
      ]);
      return { active: activeRes.count || 0, dealers: dealerRes.count || 0 };
    },
    staleTime: 60000,
  });

  const faqs = [
    {
      question: "Wie funktioniert die Händler-Registrierung?",
      answer: "Die Registrierung dauert nur 2 Minuten. Sie füllen das Online-Formular aus und laden Ihren Gewerbenachweis hoch. Die Freischaltung erfolgt in der Regel innerhalb von 1–2 Werktagen."
    },
    {
      question: "Was kostet die Teilnahme?",
      answer: "Die Registrierung und das Bieten sind komplett kostenlos. Es fällt nur eine Provision an, wenn Sie eine Auktion gewinnen – also nur bei tatsächlichem Kauf. Keine monatlichen Gebühren, keine Mindestabnahme."
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
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Wohnmobil Händler werden – Auktionsplattform für B2B-Einkauf",
    description: "Registrieren Sie sich als Wohnmobil-Händler und ersteigern Sie Fahrzeuge direkt von Privatverkäufern. Kostenlos, transparent, ohne monatliche Gebühren.",
    provider: { "@type": "Organization", name: siteName, url: "https://caravanwert.de" },
  };

  return (
    <PageLayout
      title="Wohnmobil Händler werden – Per Auktion günstig einkaufen"
      description="Registrieren Sie sich als Händler auf CaravanWert und ersteigern Sie geprüfte Wohnmobile & Wohnwagen direkt von Privatverkäufern. Kostenlos, keine Mindestabnahme."
      keywords="wohnmobil händler werden, wohnmobil auktion händler, wohnwagen einkauf händler, b2b wohnmobil plattform, wohnmobil händler registrieren"
      canonicalPath="/wohnmobil-haendler-werden"
      structuredData={structuredData}
    >
      <PageHero size="lg">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
              <Gavel className="h-4 w-4" />
              B2B-Auktionsplattform für Händler
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
                "Provision nur bei Zuschlag – kein Risiko",
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
              <Link to="/register/haendler">
                <Button size="lg" className="w-full sm:w-auto gradient-hero hover:gradient-hero-hover shadow-lg hover:shadow-glow gap-2">
                  Kostenlos registrieren
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/kaufen">
                <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                  Aktuelle Auktionen ansehen
                </Button>
              </Link>
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
                  <div className="text-3xl font-bold gradient-text mb-1">0 €</div>
                  <div className="text-sm text-muted-foreground">Registrierung</div>
                </CardContent>
              </Card>
              <Card className="text-center border-2 border-primary/20">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold gradient-text mb-1">{stats?.dealers || "40+"}+</div>
                  <div className="text-sm text-muted-foreground">Händler vertrauen uns</div>
                </CardContent>
              </Card>
              <Card className="text-center border-2 border-primary/20">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold gradient-text mb-1">Täglich</div>
                  <div className="text-sm text-muted-foreground">Neue Fahrzeuge</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </PageHero>

      {/* How it works */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">So funktioniert der Einkauf per Auktion</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { icon: Users, step: "1", title: "Registrieren", desc: "Online-Formular + Gewerbenachweis. Freischaltung in 1–2 Werktagen." },
              { icon: BarChart3, step: "2", title: "Fahrzeuge entdecken", desc: "Täglich neue Wohnmobile & Wohnwagen mit Fotos und Zustandsberichten." },
              { icon: Gavel, step: "3", title: "Online bieten", desc: "Manuell oder per Auto-Bid. Soft-Close schützt vor Last-Second-Geboten." },
              { icon: Euro, step: "4", title: "Fahrzeug übernehmen", desc: "Kaufvertrag & Rechnung automatisch. Sichere Übergabe." },
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

      {/* Benefits */}
      <section className="py-20">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Warum Händler {siteName} nutzen</h2>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            Kein eigener Ankauf, kein Risiko – Fahrzeuge direkt von Privatverkäufern ersteigern.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: TrendingUp, title: "Günstige Einkaufspreise", desc: "Keine Händlermargen. Fahrzeuge oft 15–30% unter Marktwert ersteigern." },
              { icon: Zap, title: "Minimaler Aufwand", desc: "Kein Standort, keine Besichtigungen – bieten Sie bequem vom Büro aus." },
              { icon: Shield, title: "Nur bei Erfolg zahlen", desc: "Kostenlose Registrierung. Provision nur bei gewonnener Auktion." },
              { icon: Clock, title: "Täglicher Digest", desc: "Jeden Morgen erhalten Sie eine E-Mail mit neuen und endenden Auktionen." },
              { icon: Gavel, title: "Kaufchance-System", desc: "Reserve nicht erreicht? Top-Bieter bekommen eine zweite Chance." },
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

      {/* FAQ */}
      <FAQSection items={faqs} title="Häufige Fragen von Händlern" />

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary via-primary-light to-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-4xl font-bold mb-6">Jetzt kostenlos registrieren</h2>
            <p className="text-xl mb-8 opacity-95">
              In 2 Minuten registriert. Keine monatlichen Kosten. Sofort nach Freischaltung bieten.
            </p>
            <Link to="/register/haendler">
              <Button size="lg" variant="secondary" className="gap-2">
                Händler-Registrierung starten
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default WohnmobilHaendlerWerden;
