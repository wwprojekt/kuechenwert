import PageLayout from "@/components/PageLayout";
import {
  generateOrganizationSchema,
  generateBreadcrumbSchema,
  getBreadcrumbsFromPath,
} from "@/lib/seo";
import PageHero from "@/components/PageHero";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Award,
  Users,
  TrendingUp,
  Shield,
  Heart,
  Target,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import dealerProfessional from "@/assets/dealer-professional.webp";
import handshakeDeal from "@/assets/handshake-deal.webp";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand/config";

const UeberUns = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || BRAND.name;

  const values = [
    {
      icon: Heart,
      title: "Leidenschaft",
      description:
        "Wir lieben gut geplante Küchen — und möchten, dass jede Kundin und jeder Kunde die Traumküche zum fairen Preis bekommt.",
    },
    {
      icon: Shield,
      title: "Vertrauen",
      description:
        "Transparenz und Ehrlichkeit sind die Grundpfeiler unserer Zusammenarbeit — mit Kund:innen und Partner-Studios.",
    },
    {
      icon: Target,
      title: "Exzellenz",
      description:
        "Wir streben nach höchster Qualität in Vermittlung, Reverse-Auktion und Beratung — damit Sie entspannt entscheiden.",
    },
    {
      icon: Zap,
      title: "Innovation",
      description:
        "Moderne Technologie (KI-Traumküchen-Planer, echte Marktdaten) trifft auf persönlichen, menschlichen Service.",
    },
  ];

  const milestones = [
    {
      year: "2024",
      title: "Die Idee",
      description:
        "Als Betreiber erfolgreicher Vermittlungsplattformen (wohnwert24.de, caravanwert.de) erkennen wir: Küchenkauf ist heute für viele intransparent und teuer — das muss nicht so sein.",
    },
    {
      year: "2026",
      title: "Konzeption",
      description:
        "Entwicklung einer lead-zentrierten Plattform speziell für neue Küchen: Angebotsvermittlung, Reverse-Auktion auf Studio-Preise und KI-Planer für Traumküchen.",
    },
    {
      year: "Apr 2026",
      title: "Launch",
      description: `${siteName} geht an den Start — mit dem Ziel, den Kauf einer neuen Küche transparenter, schneller und fairer zu gestalten.`,
    },
    {
      year: "Ab 2026",
      title: "Wachstum",
      description:
        "Kontinuierlicher Ausbau unseres Küchenstudio-Netzwerks deutschlandweit und stetige Verbesserung unserer Funnels.",
    },
  ];

  const team = [
    {
      name: "Branchenübergreifende Expertise",
      description:
        "Erfahrung aus Immobilien- und Fahrzeug-Vermittlung, angewandt auf den Küchenmarkt",
    },
    {
      name: "Persönlicher Kundenservice",
      description: "Individuelle Betreuung durch engagierte Küchen-Berater:innen",
    },
    {
      name: "Netzwerk geprüfter Küchenstudios",
      description:
        "Wachsendes Partnernetzwerk aus verifizierten Studios, Fachhändlern und Möbelhäusern in ganz Deutschland",
    },
    {
      name: "Digitale Kompetenz",
      description:
        "Moderne Plattform mit KüchenRechner, Reverse-Auktion und KI-Traumküchen-Planer",
    },
  ];

  const achievements = [
    { number: "Bundesweit", label: "Verfügbar" },
    { number: "48 h", label: "Ø bis Angebote" },
    { number: "Geprüft", label: "Studio-Netzwerk" },
    { number: "100 %", label: "Kostenlos für Kund:innen" },
  ];

  return (
    <PageLayout
      breadcrumbs={true}
      title="Über uns – Ihr Partner für die neue Traumküche"
      description={`Erfahren Sie mehr über ${siteName} – die Plattform für Ihre neue Küche. Angebote von geprüften Studios, Reverse-Auktion und KI-Planer. Eine Marke der ${BRAND.legalName}, bundesweit, schnell und fair.`}
      keywords="über uns, KüchenWert, neue Küche planen, Küchen-Vermittlung, Küchenstudio Vergleich, Traumküche"
      canonicalPath="/ueber-uns"
      structuredData={[
        generateOrganizationSchema(settings),
        generateBreadcrumbSchema(getBreadcrumbsFromPath("/ueber-uns")),
      ]}
    >
      {/* Hero Section */}
      <PageHero size="lg">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Ihre Plattform für die{" "}
            <span className="gradient-text">neue Traumküche</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
            {siteName} verbindet Menschen, die eine neue Küche planen, mit geprüften
            Küchenstudios — transparent, kostenlos und mit echtem Wettbewerb um
            den fairsten Preis. Entstanden aus der Erfahrung mehrerer erfolgreicher
            Vermittlungsplattformen der {BRAND.legalName}.
          </p>
        </div>
      </PageHero>

      {/* Stats Section */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {achievements.map((achievement, index) => (
              <div
                key={index}
                className="text-center animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                  {achievement.number}
                </div>
                <div className="text-sm md:text-base opacity-90">
                  {achievement.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Unsere Geschichte
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  {siteName} wurde 2026 gestartet — aus einer klaren
                  Überzeugung heraus: Der Kauf einer neuen Küche sollte genauso
                  einfach, transparent und fair ablaufen wie der Vergleich eines
                  Immobilien- oder Fahrzeug-Angebots. Niemand sollte zehn
                  Küchenstudios abklappern müssen, um einen fairen Preis zu
                  bekommen.
                </p>
                <p>
                  Als Team der {BRAND.legalName} — Betreiberin von{" "}
                  <a
                    href="https://wohnwert24.de"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    wohnwert24.de
                  </a>{" "}
                  und{" "}
                  <a
                    href="https://caravanwert.de"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    caravanwert.de
                  </a>{" "}
                  — haben wir umfangreiche Erfahrung in der digitalen
                  Vermittlung und Lead-Generierung gesammelt. Diese Expertise
                  übertragen wir nun auf den Küchen-Markt: Wir bringen
                  Küchen-Käufer und geprüfte Küchenstudios zusammen — schnell,
                  sicher und kostenlos für Privatkunden.
                </p>
                <p>
                  Unsere Plattform wächst stetig. Wir arbeiten kontinuierlich
                  daran, unser Händlernetzwerk auszubauen und unseren Service
                  für Sie zu verbessern. Dabei setzen wir auf modernste
                  Technologie (inklusive KI-gestützter Küchen-Planung) und
                  persönlichen Kontakt.
                </p>
              </div>
            </div>

            <div className="relative animate-fade-in animate-delay-200">
              <div className="absolute -inset-4 gradient-hero opacity-20 blur-3xl rounded-full" />
              <img
                src={dealerProfessional}
                alt={`${siteName} — professionelle Küchen-Vermittlung`}
                className="relative rounded-2xl shadow-premium hover-lift"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Unsere Werte</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Diese Prinzipien leiten uns in allem, was wir tun, und machen uns
              zu Ihrem vertrauenswürdigen Partner.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <Card
                key={index}
                className="hover-lift border-2 text-center animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="h-14 w-14 rounded-xl gradient-hero flex items-center justify-center mb-4 shadow-glow-sm mx-auto">
                    <value.icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-xl">{value.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {value.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Unsere Meilensteine
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Von der Idee zur Plattform — unser Weg im Überblick.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            {milestones.map((milestone, index) => (
              <div
                key={index}
                className="flex gap-8 items-start animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex-shrink-0">
                  <div className="h-20 w-20 rounded-xl gradient-hero flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {milestone.year}
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <h3 className="text-2xl font-bold mb-2">{milestone.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {milestone.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Excellence */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1 animate-fade-in">
              <div className="absolute -inset-4 gradient-hero opacity-20 blur-3xl rounded-full" />
              <img
                src={handshakeDeal}
                alt="Vertrauensvolle Küchen-Vermittlung — Händler und Verkäufer"
                className="relative rounded-2xl shadow-premium hover-lift"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="order-1 lg:order-2 animate-fade-in animate-delay-200">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Was uns auszeichnet
              </h2>
              <p className="text-lg opacity-90 mb-8 leading-relaxed">
                Bei {siteName} verbinden wir digitale Kompetenz mit
                persönlichem Service. Unsere Erfahrung aus dem Immobilien- und
                Wohnmobil-Markt hilft uns, auch im Küchen-Segment die besten
                Lösungen für Sie zu finden.
              </p>

              <div className="space-y-4">
                {team.map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-lg mb-1">
                        {item.name}
                      </h3>
                      <p className="opacity-90">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Offer */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Unser Versprechen
              </h2>
              <p className="text-lg text-muted-foreground">
                Darauf können Sie sich bei {siteName} verlassen.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Shield,
                  title: "Geprüfte Küchenstudios",
                  description:
                    "Alle Partner durchlaufen unseren Verifizierungsprozess (Gewerbenachweis, USt-ID, Kundenzufriedenheit).",
                },
                {
                  icon: Users,
                  title: "Persönlicher Service",
                  description:
                    "Individuelle Betreuung bei jeder Küchenplanung — vom ersten Klick bis zum Montagetag.",
                },
                {
                  icon: TrendingUp,
                  title: "Faire Preise",
                  description:
                    "Durch echten Wettbewerb und unsere Reverse-Auktion sparen Sie bis zu 30 % gegenüber dem Studio-Listenpreis.",
                },
              ].map((cert, index) => (
                <Card
                  key={index}
                  className="text-center hover-lift-sm animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardHeader>
                    <div className="h-16 w-16 rounded-xl gradient-hero flex items-center justify-center mb-4 shadow-glow-sm mx-auto">
                      <cert.icon className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-xl">{cert.title}</CardTitle>
                    <CardDescription className="text-base">
                      {cert.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary via-primary-light to-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Lernen Sie uns kennen
            </h2>
            <p className="text-xl mb-8 opacity-95">
              Überzeugen Sie sich selbst von unserem Service. Wir freuen uns
              darauf, Ihnen den Weg zur neuen Traumküche so einfach und günstig
              wie möglich zu machen — kostenlos und unverbindlich.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/funnel/a">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Kostenlose Angebote einholen
                </Button>
              </Link>
              <Link to="/kontakt">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto bg-white/10 border-white/30 hover:bg-white/20 text-white"
                >
                  Kontakt aufnehmen
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default UeberUns;
