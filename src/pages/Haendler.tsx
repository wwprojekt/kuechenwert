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
      title: "Kaufbereite Küchen-Leads",
      description:
        "Erhalten Sie Anfragen von Kund:innen, die konkret eine neue Küche planen — mit Budget, Stil-Wünschen, Wohnsituation und Zeitrahmen.",
    },
    {
      icon: Shield,
      title: "Sichere Abwicklung",
      description:
        "Rechtlich abgesicherte Verträge, transparente Provisionen und DSGVO-konforme Prozesse — Provision nur bei erfolgreichem Kauf.",
    },
    {
      icon: Users,
      title: "Vorqualifiziert",
      description:
        "Jeder Lead wird von unserem Küchen-Team telefonisch auf Ernsthaftigkeit und Budget geprüft — bevor er Sie überhaupt erreicht.",
    },
    {
      icon: Zap,
      title: "Wenig Aufwand",
      description:
        "Keine eigene Akquise nötig. Sie wählen selbst, welche Leads Sie annehmen und welche Sie passen lassen.",
    },
  ];

  const services = [
    {
      title: "Lead-Inbox",
      description:
        "Alle neuen Küchen-Anfragen in einer übersichtlichen Inbox — filterbar nach Region, Budget und Stil.",
      features: [
        "Täglich neue, vorqualifizierte Lead-Anfragen",
        "17 Datenpunkte pro Lead (Stil, Form, Budget, Zeitrahmen)",
        "Beispielbilder und Wohnsituation direkt im Lead",
      ],
    },
    {
      title: "Angebots-System",
      description:
        "Senden Sie strukturierte Angebote an Kund:innen — digital, rechtssicher und mit eigenen Vorlagen.",
      features: [
        "1-Click-Angebote mit eigenen Vorlagen",
        "Reverse-Auktion: Gegen andere Studios bieten",
        "Vertrags-Vorlagen &amp; digitale Unterschrift",
      ],
    },
    {
      title: "Reverse-Auktion (Funnel B)",
      description:
        "Kund:innen laden ein bestehendes Studio-Angebot hoch — Sie unterbieten den Preis und gewinnen den Auftrag.",
      features: [
        "Preistransparenz ohne Konkurrenz-Namen",
        "72-Stunden-Bietphase",
        "Kund:in entscheidet bei Angebotsende",
      ],
    },
    {
      title: "Händler-Dashboard",
      description:
        "Behalten Sie den Überblick über Ihre Leads, offenen Angebote und abgeschlossenen Aufträge.",
      features: [
        "Echtzeit-Benachrichtigungen bei neuen Leads",
        "Lead-Verlauf &amp; Angebotsübersicht",
        "Rechnungen &amp; Verträge digital",
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
        "Erhalten Sie neue Anfragen aus Ihrer Region — mit Budget, Stil, Wohnsituation und Zeitrahmen.",
    },
    {
      step: "3",
      title: "Angebot senden",
      description:
        "Senden Sie Ihr Beratungs- oder Kauf-Angebot direkt über die Plattform. Bei Funnel B unterbieten Sie bestehende Angebote.",
    },
    {
      step: "4",
      title: "Auftrag gewinnen",
      description:
        "Bei Zuschlag: Digitaler Vertrag, Beratungstermin, finales Aufmass, Lieferung und Montage — transparent abgewickelt.",
    },
  ];

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${siteName}-Händler-Plattform`,
    description:
      "B2B-Plattform für Küchenstudios & Fachhändler: Qualifizierte Küchen-Leads, Reverse-Auktion auf Studio-Preise, digitale Angebotsabwicklung und sichere Vertragsschließung.",
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
      title="Für Küchenstudios & Fachhändler — qualifizierte Leads direkt in Ihre Inbox"
      description="Als geprüftes Partner-Studio erhalten Sie kaufbereite Küchen-Leads aus Ihrer Region. Kostenlose Registrierung, Provision nur bei Erfolg, Reverse-Auktion optional."
      keywords="Küchenstudio Partner, Küchen Leads, Küchenhändler Lead, Reverse-Auktion Küche, B2B Küchen-Plattform"
      canonicalPath="/haendler"
      structuredData={serviceSchema}
    >
      {/* Hero Section */}
      <PageHero size="lg">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Kaufbereite Küchen-Leads{" "}
              <span className="gradient-text">direkt in Ihre Inbox</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              Als geprüftes Partner-Studio erhalten Sie vorqualifizierte Anfragen
              von Kund:innen, die gerade eine neue Küche planen — inkl. Budget,
              Stil und Zeitrahmen. Provision nur bei Erfolg.
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
              Profitieren Sie von unserem Lead-Marktplatz und Reverse-Auktion —
              und steigern Sie Ihren Umsatz bei minimalem Akquise-Aufwand.
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
              Unsere Partner-Services
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Alles, was Ihr Küchenstudio für effiziente Lead-Bearbeitung braucht.
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
              In 4 Schritten zum ersten Auftrag
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              So einfach gewinnen Sie neue Kund:innen über {siteName}.
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
                Ihr direkter Draht zu kaufbereiten Kund:innen — ohne Werbebudget-Verbrennung.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {[
                {
                  icon: Inbox,
                  title: "Stetig neue Leads",
                  description:
                    "Täglich kommen neue Küchen-Anfragen von kaufbereiten Kund:innen in Ihre Inbox — gefiltert nach Ihrer Region.",
                },
                {
                  icon: Target,
                  title: "Vorqualifizierte Anfragen",
                  description:
                    "Jeder Lead enthält Budget, Stil, Wohnsituation und Zeitrahmen — bereits vom KüchenWert-Team auf Ernsthaftigkeit geprüft.",
                },
                {
                  icon: Handshake,
                  title: "Faire Konditionen",
                  description:
                    "Transparente Provision nur bei erfolgreichem Kauf. Keine monatlichen Gebühren, keine Mindestabnahmen.",
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
                    Vertrag und Rechnung automatisch bei Zuschlag
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-base">
                    Provision nur bei erfolgreichem Küchenkauf — keine laufenden Kosten
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
              Häufige Fragen von Küchenstudios &amp; Fachhändlern
            </h2>

            <h3 className="text-2xl font-bold mt-8 mb-4">
              Für wen ist die Plattform geeignet?
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Unsere Lead-Plattform richtet sich an Küchenstudios,
              Küchen-Fachgeschäfte, Möbelhäuser mit Küchenabteilung sowie
              freie Küchenmonteure und Schreinereien, die ihre Auftragsbücher
              über qualifizierte Endkunden-Leads füllen möchten.
              Egal ob Sie regelmäßig oder gelegentlich Leads annehmen —
              Sie zahlen nur bei erfolgreichem Kauf.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">
              Wie funktioniert der Lead-Prozess?
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Jeder Küchen-Lead, der in Ihre Region passt, erscheint in Ihrer
              Inbox. Sie sehen alle relevanten Details (Stil, Form, Budget,
              Wohnsituation, Zeitrahmen, Beispielbilder) und können direkt ein
              Angebot oder einen Beratungstermin anbieten. Bei einer
              Reverse-Auktion (Funnel B) bieten mehrere Studios — die Kund:in
              wählt das beste Angebot. Bei Zuschlag erhalten Sie automatisch
              Vertrag und Rechnung.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">
              Was kostet die Teilnahme?
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Die Registrierung ist kostenlos. Es fällt nur eine Provision an,
              wenn Sie einen Lead erfolgreich in einen Küchen-Kauf überführen
              — also nur bei tatsächlich zustande gekommenem Auftrag. Keine
              monatlichen Gebühren, keine Mindestabnahmen. Die Provisionsstaffel
              ist transparent in Ihrem Partner-Dashboard einsehbar.
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
