import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import RelatedContent, { haendlerRelatedLinks } from "@/components/RelatedContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Zap, Shield, CheckCircle2, Handshake, BarChart3, Target } from "lucide-react";
import { Link } from "react-router-dom";
import dealerProfessional from "@/assets/dealer-professional.jpg";
import { useSettings } from "@/contexts/SettingsContext";

const Haendler = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || 'CaravanWert';
  const benefits = [
    {
      icon: TrendingUp,
      title: "Schneller Umschlag",
      description: "Verkaufen Sie Ihre Bestandsfahrzeuge schneller durch unser deutschlandweites Netzwerk."
    },
    {
      icon: Shield,
      title: "Sichere Abwicklung",
      description: "Rechtlich abgesicherte Prozesse und garantierte Zahlungsabwicklung."
    },
    {
      icon: Users,
      title: "Exklusiver Zugang",
      description: "Zugriff auf unsere Datenbank mit Tausenden kaufinteressierten Kunden."
    },
    {
      icon: Zap,
      title: "Digitale Tools",
      description: "Moderne Plattform für effizientes Bestandsmanagement und Verkauf."
    }
  ];

  const services = [
    {
      title: "Ankaufsplattform",
      description: "Nutzen Sie unsere Plattform, um überschüssige Bestände schnell und unkompliziert zu verkaufen.",
      features: [
        "Direkter Zugang zu Käufernetzwerk",
        "Automatische Preisermittlung",
        "Schnelle Abwicklung in 48h"
      ]
    },
    {
      title: "Marketing-Support",
      description: "Profitieren Sie von unserer Reichweite und professionellen Marketingkampagnen.",
      features: [
        "Professionelle Fahrzeugfotos",
        "Online-Marketing-Kampagnen",
        "Social Media Promotion"
      ]
    },
    {
      title: "Bestandsmanagement",
      description: "Optimieren Sie Ihre Lagerkosten durch intelligentes Bestandsmanagement.",
      features: [
        "Bestandsanalyse",
        "Verkaufsempfehlungen",
        "Marktpreis-Monitoring"
      ]
    },
    {
      title: "Netzwerk-Zugang",
      description: "Werden Sie Teil unseres Händlernetzwerks und profitieren Sie von Synergien.",
      features: [
        "Händler-zu-Händler Plattform",
        "Exklusive Events",
        "Brancheninsights"
      ]
    }
  ];

  const stats = [
    { number: "Bundesweit", label: "Händlernetzwerk" },
    { number: "24h", label: "Durchschn. Reaktionszeit" },
    { number: "TÜV", label: "Zertifiziert" },
    { number: "100%", label: "Kostenlos starten" }
  ];

  const process = [
    {
      step: "1",
      title: "Registrierung",
      description: "Schnelle Online-Registrierung mit Nachweis Ihrer Gewerbeberechtigung."
    },
    {
      step: "2",
      title: "Plattform-Zugang",
      description: "Erhalten Sie sofortigen Zugang zu unserer Händlerplattform und allen Tools."
    },
    {
      step: "3",
      title: "Fahrzeuge einstellen",
      description: "Laden Sie Ihre Fahrzeuge hoch - wir kümmern uns um die Vermarktung."
    },
    {
      step: "4",
      title: "Verkauf abwickeln",
      description: "Wir vermitteln Käufer und wickeln die gesamte Transaktion ab."
    }
  ];

  // Service structured data for dealer program
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Händler-Partnerprogramm',
    description: 'Werden Sie Teil unseres deutschlandweiten Händlernetzwerks. Schneller Bestandsverkauf, professioneller Marketing-Support und Zugang zu kaufbereiten Kunden.',
    provider: {
      '@type': 'Organization',
      name: siteName,
      url: 'https://caravanwert.de',
    },
    areaServed: {
      '@type': 'Country',
      name: 'Germany',
    },
    serviceType: 'B2B Vehicle Trading Platform',
  };

  return (
    <PageLayout
      breadcrumbs={true}
      title="Für Händler"
      description="Partnerprogramm für Wohnmobil-Händler. Schneller Bestandsverkauf, Marketing-Support und Zugang zu kaufbereiten Kunden. Jetzt Partner werden!"
      keywords="händler programm, wohnmobil händler, b2b wohnmobil, händler partnerschaft"
      canonicalPath="/haendler"
      structuredData={serviceSchema}
    >
      {/* Hero Section */}
      <PageHero size="lg">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Ihr <span className="gradient-text">Partner</span> für erfolgreichen Wohnmobil-Handel
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              Werden Sie Teil unseres deutschlandweiten Händlernetzwerks. Profitieren Sie von schnellem Bestandsverkauf, 
              professionellem Marketing-Support und Zugang zu Tausenden kaufbereiten Kunden.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/register/haendler">
                <Button size="lg" className="w-full sm:w-auto gradient-hero hover:gradient-hero-hover shadow-lg hover:shadow-glow">
                  Jetzt registrieren
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ihre Vorteile als Partner</h2>
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

      {/* Services Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Unsere Händler-Services</h2>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">So werden Sie Partner</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              In nur 4 einfachen Schritten zum erfolgreichen {siteName} Partner.
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
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Warum {siteName}?</h2>
              <p className="text-lg opacity-90">
                Wir sind mehr als nur eine Plattform - wir sind Ihr strategischer Partner für Wachstum.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {[
                {
                  icon: BarChart3,
                  title: "Marktführende Position",
                  description: "Profitieren Sie von unserer starken Marktpräsenz und Reputation."
                },
                {
                  icon: Target,
                  title: "Zielgruppenreichweite",
                  description: "Zugang zu über 50.000 qualifizierten Interessenten monatlich."
                },
                {
                  icon: Handshake,
                  title: "Faire Partnerschaft",
                  description: "Transparente Konditionen und keine versteckten Kosten."
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
                <CardTitle className="text-2xl">Unser Versprechen an Sie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">Persönlicher Ansprechpartner für alle Ihre Anliegen</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">Kontinuierliche Weiterentwicklung unserer Plattform und Services</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">Regelmäßige Schulungen und Brancheninsights</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">Faire und transparente Provisionsmodelle</p>
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
            <h2 className="text-3xl font-bold mb-6">Händlerpartnerschaft - Gemeinsam zum Erfolg</h2>
            
            <h3 className="text-2xl font-bold mt-8 mb-4">Für wen ist das Partnerprogramm geeignet?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Unser Partnerprogramm richtet sich an etablierte Wohnmobil-Händler, Autohäuser mit Wohnmobil-Abteilung, 
              Wohnmobil-Vermietungen und Servicebetriebe. Egal ob Sie ein großes Autohaus oder ein spezialisierter 
              Wohnmobil-Händler sind - wir bieten maßgeschneiderte Lösungen für Ihre Bedürfnisse.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">Welche Voraussetzungen gibt es?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Sie benötigen einen gültigen Gewerbeschein für Kraftfahrzeughandel, nachweisbare Erfahrung im Wohnmobil-Bereich 
              und die Bereitschaft zur vertrauensvollen Zusammenarbeit. Die Mitgliedschaft im Partnerprogramm ist kostenlos - 
              Sie zahlen nur eine erfolgsbasierte Provision bei Verkaufsabschluss.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">Wie funktioniert die Provisionsabrechnung?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Unsere Provisionsmodelle sind transparent und fair gestaltet. Sie zahlen nur bei erfolgreicher Vermittlung - 
              keine versteckten Kosten oder Abos. Die genauen Konditionen besprechen wir individuell mit Ihnen, 
              abhängig von Ihrer Unternehmensgröße und den geplanten Volumina.
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
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Werden Sie noch heute Partner!</h2>
            <p className="text-xl mb-8 opacity-95">
              Werden Sie Teil unseres wachsenden Händlernetzwerks und profitieren Sie von unserem starken Service.
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
