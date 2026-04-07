import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import RelatedContent, { verkaufenRelatedLinks } from "@/components/RelatedContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Euro, Clock, Shield, TrendingUp, Users, Award, HeartHandshake } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-motorhome.jpg";
import { generateServiceSchema } from "@/lib/seo";
import { useSettings } from "@/contexts/SettingsContext";

const Verkaufen = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || 'CaravanWert';

  const benefits = [
    {
      icon: Euro,
      title: "Faire Preise",
      description: "Durch den Wettbewerb mehrerer Händler erzielen Sie einen fairen Marktpreis für Ihr Wohnmobil."
    },
    {
      icon: Clock,
      title: "Schnelle Abwicklung",
      description: "Verkaufen Sie Ihr Wohnmobil in nur 24–48 Stunden – von der Bewertung bis zur Auszahlung."
    },
    {
      icon: Shield,
      title: "100% Sicher",
      description: "Sicherer Verkauf mit rechtlicher Absicherung und sofortiger Barzahlung."
    },
    {
      icon: TrendingUp,
      title: "Faire Bewertung",
      description: "Transparente Preisermittlung basierend auf Marktdaten und Fahrzeugzustand."
    }
  ];

  const process = [
    {
      step: "1",
      title: "Online-Bewertung",
      description: "Füllen Sie unser einfaches Formular aus und erhalten Sie eine kostenlose Bewertung."
    },
    {
      step: "2",
      title: "Besichtigung vereinbaren",
      description: "Wir besichtigen Ihr Fahrzeug vor Ort oder Sie bringen es zu einer Ankaufstation."
    },
    {
      step: "3",
      title: "Angebot erhalten",
      description: "Sie erhalten ein verbindliches Kaufangebot - ohne versteckte Kosten."
    },
    {
      step: "4",
      title: "Verkauf abschließen",
      description: "Bei Zusage erfolgt die Auszahlung sofort - bar oder per Überweisung."
    }
  ];

  const whyUs = [
    { icon: Users, text: "Zufriedene Verkäufer bundesweit" },
    { icon: Award, text: "Professioneller Ankauf" },
    { icon: HeartHandshake, text: "Persönliche Beratung" },
    { icon: Shield, text: "Geprüfte Sicherheit" }
  ];

  // Service structured data
  const serviceSchema = generateServiceSchema(
    'Wohnmobil Verkauf Service',
    'Verkaufen Sie Ihr Wohnmobil schnell, sicher und fair. Sofortpreis-Ankauf, Online-Auktion oder Übergabe an einer Ankaufstation.'
  );

  return (
    <PageLayout
      breadcrumbs={true}
      title="Wohnmobil verkaufen – Schnell & Fair in 48 Stunden"
      description="Verkaufen Sie Ihr Wohnmobil schnell und sicher. Kostenlose Bewertung in 24h und faire Preise durch Händlerwettbewerb."
      keywords="wohnmobil verkaufen, wohnwagen verkaufen, camper verkaufen, ankauf wohnmobil, wohnmobil ankauf"
      canonicalPath="/verkaufen"
      structuredData={serviceSchema}
    >
      {/* Hero Section */}
      <PageHero size="lg">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Verkaufen Sie Ihr <span className="gradient-text">Wohnmobil</span> schnell & fair
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              Schnell, sicher und unkompliziert - starten Sie Ihre kostenlose Auktion und erhalten Sie Gebote in nur 24 Stunden. Profitieren Sie von fairem Händlerwettbewerb.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/verkaufen/wizard">
                <Button
                  size="lg"
                  className="w-full sm:w-auto gradient-hero hover:gradient-hero-hover shadow-lg hover:shadow-glow"
                >
                  Jetzt Auktion starten
                </Button>
              </Link>
              <Link to="/kontakt">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Beratung vereinbaren
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="relative animate-fade-in animate-delay-200">
            <div className="absolute -inset-4 gradient-hero opacity-20 blur-3xl rounded-full" />
            <img 
              src={heroImage} 
              alt="Wohnmobil verkaufen - Professioneller Ankauf" 
              className="relative rounded-2xl shadow-premium hover-lift"
            />
          </div>
        </div>
      </PageHero>

      {/* Benefits Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">Ihre Vorteile beim Verkauf</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Profitieren Sie von unserem professionellen Service und verkaufen Sie Ihr Wohnmobil mit Vertrauen.
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

      {/* Process Section */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">So einfach verkaufen Sie Ihr Wohnmobil</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              In nur 4 Schritten zum erfolgreichen Verkauf - transparent und ohne versteckte Kosten.
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

      {/* Why Choose Us */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-12 text-center">Warum {siteName}?</h2>
            
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {whyUs.map((item, index) => (
                <div key={index} className="flex items-center gap-4 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-lg font-medium">{item.text}</p>
                </div>
              ))}
            </div>

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl">Unser Versprechen an Sie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">Faire und transparente Bewertung basierend auf aktuellen Marktdaten</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">Keine versteckten Kosten - der angebotene Preis ist der finale Preis</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">Professionelle Abwicklung mit rechtlicher Absicherung</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">Persönlicher Ansprechpartner während des gesamten Prozesses</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* SEO Content Section */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-4xl mx-auto prose prose-lg">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6">Wohnmobil verkaufen - Ihre Fragen, unsere Antworten</h2>
            
            <h3 className="text-2xl font-bold mt-8 mb-4">Wie bestimmen wir den Wert Ihres Wohnmobils?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Der Wert Ihres Wohnmobils wird durch verschiedene Faktoren bestimmt: Marke und Modell, Baujahr und Kilometerstand, 
              Ausstattung und Zusatzoptionen, Zustand und Wartungshistorie sowie aktuelle Marktnachfrage. Unsere Experten 
              berücksichtigen alle diese Aspekte, um Ihnen einen fairen und marktgerechten Preis anzubieten.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">Welche Dokumente benötige ich für den Verkauf?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Für einen reibungslosen Verkauf benötigen Sie: Fahrzeugbrief (Zulassungsbescheinigung Teil II), 
              Fahrzeugschein (Zulassungsbescheinigung Teil I), gültige HU-Bescheinigung, Serviceheft und Wartungsnachweise, 
              sowie bei vorhandenem Scheckheft dieses ebenfalls. Alle weiteren Formalitäten übernehmen wir für Sie.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">Wie schnell erhalte ich mein Geld?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Bei Vertragsabschluss erfolgt die Auszahlung sofort - entweder bar an unseren Ankaufstationen oder 
              per Banküberweisung innerhalb von 24 Stunden. Sie müssen nicht warten und haben Ihr Geld unmittelbar verfügbar.
            </p>
          </div>
        </div>
      </section>

      {/* Related Content for Internal Linking */}
      <RelatedContent
        title="Weitere hilfreiche Informationen"
        description="Erfahren Sie mehr über unseren Service und Ihre Möglichkeiten"
        links={verkaufenRelatedLinks}
      />

      {/* CTA Section */}
      <section id="bewertung" className="py-20 bg-gradient-to-br from-primary via-primary-light to-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-6">Bereit für den Verkauf?</h2>
            <p className="text-xl mb-8 opacity-95">
              Starten Sie jetzt mit der kostenlosen Bewertung Ihres Wohnmobils und erhalten Sie verbindliche Gebote von geprüften Händlern.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/verkaufen/wizard">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  Kostenlose Bewertung starten
                </Button>
              </Link>
              {settings?.support_phone && (
                <a href={`tel:${settings.support_phone.replace(/\s/g, '')}`}>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 border-white/30 hover:bg-white/20 text-white">
                    Jetzt anrufen
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

export default Verkaufen;
