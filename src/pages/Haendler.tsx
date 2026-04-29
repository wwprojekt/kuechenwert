import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import RelatedContent, { haendlerRelatedLinks } from "@/components/RelatedContent";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  Users,
  Zap,
  Shield,
  CheckCircle2,
  Handshake,
  Target,
  Inbox,
} from "lucide-react";
import { Link } from "react-router-dom";
import dealerProfessional from "@/assets/dealer-professional.webp";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand/config";

const Haendler = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || BRAND.name;

  const benefits = [
    {
      icon: TrendingUp,
      title: "Qualifizierte Küchen-Leads",
      description:
        "Erhalten Sie direkt Leads von Privatverkäufern, die ihre gebrauchte Küche verkaufen wollen — mit Fotos, Maßen und Details.",
    },
    {
      icon: Shield,
      title: "Sichere Abwicklung",
      description:
        "Rechtlich abgesicherte Kaufverträge, transparente Provisionen, DSGVO-konforme Datenschutzprozesse.",
    },
    {
      icon: Users,
      title: "Exklusives Angebot",
      description:
        "Zugang zu Küchen direkt von Privatverkäufern — bevor sie über Plattformen wie eBay Kleinanzeigen öffentlich werden.",
    },
    {
      icon: Zap,
      title: "Wenig Aufwand",
      description:
        "Keine eigene Akquise nötig: Wir bringen die Verkäufer, Sie entscheiden welche Lead-Angebote Sie abgeben.",
    },
  ];

  const services = [
    {
      title: "Lead-Inbox",
      description:
        "Alle neuen Küchen-Leads in einer übersichtlichen Inbox — filterbar nach Region, Hersteller und Budget.",
      features: [
        "Täglich neue Küchen von Privatverkäufern",
        "17 Datenpunkte pro Lead (Hersteller, Alter, Maße, Geräte)",
        "Fotos und Detailangaben direkt im Lead",
      ],
    },
    {
      title: "Angebots-System",
      description:
        "Geben Sie schnell und strukturiert Angebote an Privatverkäufer ab — digital und rechtssicher.",
      features: [
        "1-Click-Angebote mit Vorlagen",
        "Reverse-Auktion: Mehrere Händler bieten, Kunde wählt",
        "Vertrags-Vorlagen und digitale Unterschrift",
      ],
    },
    {
      title: "Reverse-Auktion (Funnel B)",
      description:
        "Der Verkäufer lädt bestehende Konkurrenz-Angebote hoch — Sie überbieten und gewinnen die Küche.",
      features: [
        "Transparente Konkurrenz-Preise",
        "72-Stunden-Bietphase",
        "Höchstes Gebot gewinnt",
      ],
    },
    {
      title: "Händler-Dashboard",
      description:
        "Behalten Sie den Überblick über Ihre Leads, offene Angebote und abgewickelte Verkäufe.",
      features: [
        "Echtzeit-Benachrichtigungen bei neuen Leads",
        "Lead-Verlauf und Angebotsübersicht",
        "Rechnungen & Verträge digital",
      ],
    },
  ];

  const stats = [
    { number: "Deutschlandweit", label: "Verfügbar" },
    { number: "Täglich", label: "Neue Leads" },
    { number: "Kostenlos", label: "Registrierung" },
    { number: "Nur bei Zuschlag", label: "Provision" },
  ];

  const process = [
    {
      step: "1",
      title: "Kostenlos registrieren",
      description:
        "Schnelle Online-Registrierung mit Gewerbenachweis und USt-ID — Freischaltung innerhalb von 1–2 Werktagen.",
    },
    {
      step: "2",
      title: "Leads entdecken",
      description:
        "Durchstöbern Sie neue Küchen-Leads in Ihrer Region — mit Fotos, Maßen und Ausstattungsdetails.",
    },
    {
      step: "3",
      title: "Angebot abgeben",
      description:
        "Senden Sie Ihr Angebot direkt über die Plattform. Bei der Reverse-Auktion überbieten Sie bestehende Angebote.",
    },
    {
      step: "4",
      title: "Küche übernehmen",
      description:
        "Bei Zuschlag: Vertrag digital, sichere Demontage und Abholung, transparente Abwicklung.",
    },
  ];

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${siteName}-Händler-Plattform`,
    description:
      "B2B-Plattform für Küchen-Händler: Qualifizierte Leads von Privatverkäufern gebrauchter Küchen, digitale Angebotsabwicklung, sichere Vertragsschließung.",
    provider: {
      "@type": "Organization",
      name: siteName,
      url: BRAND.baseUrl,
    },
    areaServed: {
      "@type": "Place",
      name: "Deutschland",
    },
    serviceType: "B2B Kitchen Lead Marketplace",
  };

  return (
    <PageLayout
      breadcrumbs={true}
      title="Für Küchen-Händler: Qualifizierte Leads direkt in Ihre Inbox"
      description="Als geprüfter Küchen-Händler erhalten Sie direkt Leads von Privatverkäufern gebrauchter Küchen. Kostenlose Registrierung, transparente Provisionen nur bei Zuschlag, sichere Abwicklung."
      keywords="Küchen-Händler, Küchen Ankauf Händler, gebrauchte Küchen Händler, Küchen Lead, B2B Küche"
      canonicalPath="/haendler"
      structuredData={serviceSchema}
    >
      {/* Hero Section */}
      <PageHero size="lg">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Küchen-Leads direkt{" "}
              <span className="gradient-text">in Ihre Inbox</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              Als geprüfter Küchen-Händler erhalten Sie qualifizierte Leads von
              Privatverkäufern. Kostenlose Registrierung, transparente
              Provisionen, sichere Abwicklung.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/register/haendler">
                <Button
                  size="lg"
                  className="w-full sm:w-auto gradient-hero hover:gradient-hero-hover shadow-lg hover:shadow-glow"
                >
                  Jetzt Händler werden
                </Button>
              </Link>
              <Link to="/kontakt">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Beratung anfordern
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative animate-fade-in animate-delay-200">
            <div className="absolute -inset-4 gradient-hero opacity-20 blur-3xl rounded-full" />
            <img
              src={dealerProfessional}
              alt="Professionelle Küchen-Händler-Partner bei KüchenWert"
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
              <div
                key={index}
                className="text-center animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="text-3xl md:text-4xl font-bold gradient-text mb-2">
                  {stat.number}
                </div>
                <div className="text-sm md:text-base opacity-90">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">
              Ihre Vorteile als Partner
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Profitieren Sie von unserem Lead-Marketplace und steigern Sie
              Ihren Geschäftserfolg mit minimalem Akquise-Aufwand.
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

      {/* Services Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">
              Unsere Händler-Services
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Umfassende Tools für Ihren Erfolg im Küchen-Handel.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {services.map((service, index) => (
              <Card
                key={index}
                className="hover-lift-sm animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <CardTitle className="text-2xl">{service.title}</CardTitle>
                  <CardDescription className="text-base">
                    {service.description}
                  </CardDescription>
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
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">
              In 4 Schritten zum ersten Küchen-Ankauf
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              So einfach kaufen Sie Küchen über {siteName}.
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

      {/* Why Partner With Us */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">
                Warum {siteName}-Partner werden?
              </h2>
              <p className="text-lg opacity-90">
                Ihr direkter Draht zu Privatverkäufern — ohne Zwischenhändler.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {[
                {
                  icon: Inbox,
                  title: "Stetig neue Leads",
                  description:
                    "Täglich kommen neue Küchen-Leads von Privatverkäufern in Ihre Inbox — gefiltert nach Ihrer Region.",
                },
                {
                  icon: Target,
                  title: "Qualifizierte Anfragen",
                  description:
                    "Jeder Lead enthält Fotos, Maße, Hersteller und Zustandsangaben — kein zeitraubendes Nachhaken.",
                },
                {
                  icon: Handshake,
                  title: "Faire Konditionen",
                  description:
                    "Transparente Provision nur bei erfolgreichem Zuschlag. Keine monatlichen Gebühren, keine Mindestabnahmen.",
                },
              ].map((item, index) => (
                <Card
                  key={index}
                  className="text-center border-primary/20 animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardHeader>
                    <div className="h-14 w-14 rounded-xl gradient-hero flex items-center justify-center mb-3 shadow-glow-sm mx-auto">
                      <item.icon className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {item.description}
                    </CardDescription>
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
                  <p className="text-base">
                    Push-Benachrichtigungen bei neuen Leads in Ihrer Region —
                    Sie verpassen kein Angebot
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">
                    Echtzeit-Benachrichtigungen wenn Sie in einer Reverse-Auktion
                    überboten werden
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">
                    Kaufvertrag und Rechnung automatisch bei Zuschlag
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">
                    Provision nur bei erfolgreichem Kauf — keine laufenden Kosten
                  </p>
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
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6">
              Häufige Fragen von Küchen-Händlern
            </h2>

            <h3 className="text-2xl font-bold mt-8 mb-4">
              Für wen ist die Plattform geeignet?
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Unsere Lead-Plattform richtet sich an Küchen-Studios,
              Küchen-Fachgeschäfte, Gebrauchtküchen-Händler, Umzugs- und
              Sanierungsdienstleister sowie freie Küchenmonteure, die ihren
              Auftragsbestand über Privatverkäufer-Leads erweitern möchten.
              Egal ob Sie regelmäßig oder gelegentlich ankaufen — Sie zahlen
              nur bei erfolgreichem Zuschlag.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">
              Wie funktioniert der Lead-Kauf?
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Jeder Küchen-Lead, der in Ihre Region passt, erscheint in Ihrer
              Inbox. Sie sehen alle relevanten Details (Hersteller, Baujahr,
              Grundriss, Geräte, Zustand, Fotos) und können direkt ein Angebot
              abgeben. Bei einer Reverse-Auktion (Funnel B) bieten mehrere
              Händler — der Verkäufer wählt das beste Angebot. Bei Zuschlag
              erhalten Sie automatisch Kaufvertrag und Rechnung.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">
              Was kostet die Teilnahme?
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Die Registrierung ist kostenlos. Es fällt nur eine Provision an,
              wenn Sie einen Lead erfolgreich in einen Kauf überführen — also
              nur bei tatsächlichem Zuschlag. Keine monatlichen Gebühren,
              keine Mindestabnahmen. Die Provisionsstaffel ist transparent in
              Ihrem Händler-Dashboard einsehbar.
            </p>
          </div>
        </div>
      </section>

      {/* Related Content for Internal Linking */}
      <RelatedContent
        title="Weitere Informationen für Küchen-Händler"
        description="Alles was Sie für eine erfolgreiche Partnerschaft wissen müssen"
        links={haendlerRelatedLinks}
      />

      {/* CTA Section */}
      <section
        id="partner-werden"
        className="py-20 bg-gradient-to-br from-primary via-primary-light to-primary text-primary-foreground"
      >
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-6">
              Jetzt kostenlos registrieren
            </h2>
            <p className="text-xl mb-8 opacity-95">
              Erhalten Sie ab sofort qualifizierte Küchen-Leads direkt in Ihre
              Inbox — Registrierung in 2 Minuten.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register/haendler">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Jetzt registrieren
                </Button>
              </Link>
              {settings?.support_phone && (
                <a href={`tel:${settings.support_phone.replace(/\s/g, "")}`}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto bg-white/10 border-white/30 hover:bg-white/20 text-white"
                  >
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
