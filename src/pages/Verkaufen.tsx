import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import RelatedContent, { verkaufenRelatedLinks } from "@/components/RelatedContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Euro, Clock, Shield, TrendingUp, Users, Award, HeartHandshake } from "lucide-react";
import { Link } from "react-router-dom";
import { generateServiceSchema } from "@/lib/seo";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand/config";

// Interim Hero-Bild (Unsplash-Kueche). Phase 3.10 tauscht dies gegen ein
// eigenes Brand-Asset in /public/images/.
const heroImage =
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=80";

const Verkaufen = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || BRAND.name;

  const benefits = [
    {
      icon: Euro,
      title: "Faire Preise",
      description:
        "Durch den Wettbewerb mehrerer geprüfter Küchen-Händler erzielen Sie einen fairen Marktpreis für Ihre gebrauchte Küche.",
    },
    {
      icon: Clock,
      title: "Schnelle Abwicklung",
      description:
        "Von der kostenlosen Bewertung bis zur verbindlichen Zusage — in 24–48 Stunden abgewickelt.",
    },
    {
      icon: Shield,
      title: "100 % sicher",
      description:
        "Sichere Abwicklung über uns: rechtssichere Verträge, Identitätsprüfung der Händler, DSGVO-konform.",
    },
    {
      icon: TrendingUp,
      title: "Faire Bewertung",
      description:
        "Transparente Preisermittlung basierend auf Marke, Alter, Ausstattung und Marktdaten für gebrauchte Küchen.",
    },
  ];

  const process = [
    {
      step: "1",
      title: "Online-Bewertung",
      description:
        "Beantworten Sie 17 einfache Fragen zu Ihrer Küche — Marke, Alter, Ausstattung, Geräte. Dauer: ca. 2 Minuten.",
    },
    {
      step: "2",
      title: "Fotos hochladen",
      description:
        "4–8 Fotos von Front, Arbeitsfläche, Kochinsel und Elektrogeräten reichen, um Ihre Küche realistisch zu bewerten.",
    },
    {
      step: "3",
      title: "Angebote erhalten",
      description:
        "Geprüfte Küchen-Händler senden Ihnen konkrete Angebote — transparent, vergleichbar, unverbindlich.",
    },
    {
      step: "4",
      title: "Verkaufen & bezahlt werden",
      description:
        "Sie wählen das beste Angebot. Demontage, Abholung und Bezahlung werden sicher über uns abgewickelt.",
    },
  ];

  const whyUs = [
    { icon: Users, text: "Zufriedene Verkäufer deutschlandweit" },
    { icon: Award, text: "Professionelle Küchen-Bewertung" },
    { icon: HeartHandshake, text: "Persönliche Beratung" },
    { icon: Shield, text: "Geprüfte Küchen-Händler" },
  ];

  const serviceSchema = generateServiceSchema(
    "Küchen Verkauf Service",
    "Verkaufen Sie Ihre gebrauchte Küche schnell, sicher und fair. Kostenlose Bewertung und Angebote von geprüften Küchen-Händlern.",
  );

  return (
    <PageLayout
      breadcrumbs={true}
      title="Küche verkaufen — schnell & fair in 48 h"
      description="Verkaufen Sie Ihre gebrauchte Küche schnell und sicher. Kostenlose Bewertung in 24 h und faire Preise durch den Wettbewerb geprüfter Küchen-Händler."
      keywords="Küche verkaufen, gebrauchte Küche verkaufen, Einbauküche verkaufen, Küchenankauf, Nobilia verkaufen, Häcker verkaufen, Nolte verkaufen"
      canonicalPath="/verkaufen"
      structuredData={serviceSchema}
    >
      {/* Hero Section */}
      <PageHero size="lg">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Verkaufen Sie Ihre{" "}
              <span className="gradient-text">Küche</span> schnell & fair
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              Schnell, sicher und unkompliziert — starten Sie die kostenlose
              Bewertung und erhalten Sie Angebote in nur 24 Stunden.
              Profitieren Sie vom fairen Wettbewerb geprüfter Küchen-Händler.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/funnel/a">
                <Button
                  size="lg"
                  className="w-full sm:w-auto gradient-hero hover:gradient-hero-hover shadow-lg hover:shadow-glow"
                >
                  Jetzt Bewertung starten
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
              alt="Küche verkaufen — kostenlose Bewertung durch KüchenWert"
              className="relative rounded-2xl shadow-premium hover-lift"
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </div>
      </PageHero>

      {/* Benefits Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">
              Ihre Vorteile beim Küchen-Verkauf
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Profitieren Sie von unserem professionellen Service und verkaufen
              Sie Ihre Küche mit Vertrauen.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <Card
                key={index}
                className="hover-lift border-2 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="h-14 w-14 rounded-xl gradient-hero flex items-center justify-center mb-4 shadow-glow-sm">
                    <benefit.icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-xl">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {benefit.description}
                  </CardDescription>
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
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">
              So einfach verkaufen Sie Ihre Küche
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              In nur 4 Schritten zum erfolgreichen Verkauf — transparent und
              ohne versteckte Kosten.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {process.map((item, index) => (
              <div
                key={index}
                className="relative animate-fade-in"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div className="text-center">
                  <div className="inline-flex h-20 w-20 items-center justify-center rounded-full gradient-hero text-white text-3xl font-bold mb-6 shadow-lg">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
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
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-12 text-center">
              Warum {siteName}?
            </h2>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {whyUs.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
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
                  <p className="text-base">
                    Faire und transparente Bewertung basierend auf aktuellen
                    Marktdaten für gebrauchte Küchen
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">
                    Keine versteckten Kosten — der angebotene Preis ist der
                    finale Preis
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">
                    Professionelle Abwicklung inkl. Demontage und Abholung durch
                    den Händler
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">
                    Persönlicher Ansprechpartner während des gesamten Prozesses
                  </p>
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
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6">
              Küche verkaufen — Ihre Fragen, unsere Antworten
            </h2>

            <h3 className="text-2xl font-bold mt-8 mb-4">
              Wie bestimmen wir den Wert Ihrer Küche?
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Der Wert einer gebrauchten Küche wird durch mehrere Faktoren
              bestimmt: Hersteller (Nobilia, Häcker, Nolte, SieMatic, Bulthaup
              usw.), Alter und Grifflos-/Front-Design, Ausstattung
              (Kochinsel, Dunstabzug, Induktion, integrierter Kühlschrank),
              Elektrogeräte-Hersteller (Bosch, Siemens, Miele, Neff),
              Arbeitsplatte (Laminat, Keramik, Quarzstein) sowie der
              allgemeine Gebrauchszustand. Unsere Experten berücksichtigen all
              diese Aspekte für einen fairen, marktgerechten Preis.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">
              Welche Unterlagen und Fotos benötige ich?
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Für eine präzise Bewertung sind 4–8 aussagekräftige Fotos
              hilfreich: Gesamtansicht der Küche, Arbeitsfläche aus der Nähe,
              Fronten und Griffe, Elektrogeräte mit Typenschild (wenn
              sichtbar). Kaufbeleg oder Originalplanung sind nicht zwingend
              notwendig, helfen dem Händler aber bei der Einschätzung. Alle
              weiteren Formalitäten übernehmen wir für Sie.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">
              Wie schnell erhalte ich mein Geld?
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Nach Annahme eines Angebots erfolgt die Auszahlung in der Regel
              am Tag der Abholung — per Banküberweisung, PayPal oder Barzahlung
              bei Übergabe. Die Demontage und der Abtransport werden vom
              Händler organisiert, meist innerhalb von 1–2 Wochen nach Zusage.
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
      <section
        id="bewertung"
        className="py-20 bg-gradient-to-br from-primary via-primary-light to-primary text-primary-foreground"
      >
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-6">
              Bereit für den Verkauf?
            </h2>
            <p className="text-xl mb-8 opacity-95">
              Starten Sie jetzt mit der kostenlosen Bewertung Ihrer Küche und
              erhalten Sie konkrete Angebote von geprüften Küchen-Händlern.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/funnel/a">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Kostenlose Bewertung starten
                </Button>
              </Link>
              {settings?.support_phone && (
                <a href={`tel:${settings.support_phone.replace(/\s/g, "")}`}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto bg-white/10 border-white/30 hover:bg-white/20 text-white"
                  >
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
