import PageLayout from "@/components/PageLayout";
import { generateOrganizationSchema, generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Users, TrendingUp, Shield, Heart, Target, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import dealerProfessional from "@/assets/dealer-professional.jpg";
import handshakeDeal from "@/assets/handshake-deal.jpg";
import { useSettings } from "@/contexts/SettingsContext";

const UeberUns = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || 'CaravanWert';
  const values = [
    {
      icon: Heart,
      title: "Leidenschaft",
      description: "Wir verbinden unsere Erfahrung aus der Immobilienbranche mit der Begeisterung für mobile Freiheit."
    },
    {
      icon: Shield,
      title: "Vertrauen",
      description: "Transparenz und Ehrlichkeit sind die Grundpfeiler unserer Geschäftsbeziehungen."
    },
    {
      icon: Target,
      title: "Exzellenz",
      description: "Wir streben nach höchster Qualität in allem, was wir tun – für Ihre Zufriedenheit."
    },
    {
      icon: Zap,
      title: "Innovation",
      description: "Moderne Technologie und effiziente Prozesse für schnellen und sicheren Service."
    }
  ];

  const milestones = [
    {
      year: "2024",
      title: "Die Idee",
      description: "Als Betreiber von wohnwert24.de erkennen wir das Potenzial, unsere Expertise in der Lead-Generierung auf den Wohnmobil-Markt zu übertragen."
    },
    {
      year: "Okt 2025",
      title: "Gründung",
      description: "CaravanWert geht an den Start – mit dem Ziel, den Wohnmobil-Verkauf transparenter, schneller und fairer zu gestalten."
    },
    {
      year: "2025",
      title: "Plattform-Launch",
      description: "Unsere Online-Plattform mit Auktionssystem, Sofortpreis-Ankauf und Händlernetzwerk geht live."
    },
    {
      year: "2026",
      title: "Wachstum",
      description: "Kontinuierlicher Ausbau unseres Händlernetzwerks und stetige Verbesserung unserer Plattform."
    }
  ];

  const team = [
    {
      name: "Branchenübergreifende Expertise",
      description: "Erfahrung aus der Immobilienbranche, angewandt auf den Wohnmobil-Markt"
    },
    {
      name: "Kundenservice",
      description: "Persönliche Betreuung durch engagierte Ansprechpartner"
    },
    {
      name: "Netzwerk",
      description: "Wachsendes Partnernetzwerk aus geprüften Händlern in ganz Deutschland"
    },
    {
      name: "Digitale Kompetenz",
      description: "Moderne Plattform mit datenbasierter Fahrzeugbewertung"
    }
  ];

  const achievements = [
    { number: "Bundesweit", label: "Verfügbar" },
    { number: "24h", label: "Bewertungszeit" },
    { number: "Geprüft", label: "Händlernetzwerk" },
    { number: "100%", label: "Kostenlos" }
  ];

  return (
    <PageLayout
      breadcrumbs={true}
      title="Über uns – Ihr Partner für den Wohnmobil-Verkauf"
      description={`Erfahren Sie mehr über ${siteName} – Ihre Plattform für den Wohnmobil-Verkauf. Gegründet 2025, bundesweit, schnell und fair.`}
      keywords="über uns, caravanwert, wohnmobil verkauf plattform, wohnmobil verkaufen"
      canonicalPath="/ueber-uns"
      structuredData={[generateOrganizationSchema(settings), generateBreadcrumbSchema(getBreadcrumbsFromPath("/ueber-uns"))]}
    >
      {/* Hero Section */}
      <PageHero size="lg">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Ihre Plattform für den <span className="gradient-text">Wohnmobil-Verkauf</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
            {siteName} verbindet Wohnmobil-Besitzer mit geprüften Händlern – 
            schnell, transparent und kostenlos. Entstanden aus der Erfahrung der Immobilienbranche.
          </p>
        </div>
      </PageHero>

      {/* Stats Section */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {achievements.map((achievement, index) => (
              <div key={index} className="text-center animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                  {achievement.number}
                </div>
                <div className="text-sm md:text-base opacity-90">{achievement.label}</div>
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
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Unsere Geschichte</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  {siteName} wurde im Oktober 2025 gegründet – aus einer klaren Überzeugung heraus: Der Verkauf 
                  eines Wohnmobils sollte genauso einfach, transparent und fair sein wie der Verkauf einer Immobilie.
                </p>
                <p>
                  Als Betreiber von <a href="https://wohnwert24.de" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">wohnwert24.de</a> haben 
                  wir bereits umfangreiche Erfahrung in der digitalen Vermittlung und Lead-Generierung gesammelt. 
                  Diese Expertise übertragen wir nun auf den Wohnmobil-Markt: Wir bringen Verkäufer und geprüfte 
                  Händler zusammen – schnell, sicher und kostenlos für Privatverkäufer.
                </p>
                <p>
                  Unsere Plattform wächst stetig. Wir arbeiten kontinuierlich daran, unser Händlernetzwerk 
                  auszubauen und unseren Service für Sie zu verbessern. Dabei setzen wir auf modernste 
                  Technologie und persönlichen Kontakt.
                </p>
              </div>
            </div>
            
            <div className="relative animate-fade-in animate-delay-200">
              <div className="absolute -inset-4 gradient-hero opacity-20 blur-3xl rounded-full" />
              <img 
                src={dealerProfessional} 
                alt={`${siteName} – Professioneller Wohnmobil-Verkauf`} 
                className="relative rounded-2xl shadow-premium hover-lift"
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
              Diese Prinzipien leiten uns in allem, was wir tun, und machen uns zu Ihrem vertrauenswürdigen Partner.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <Card key={index} className="hover-lift border-2 text-center animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardHeader>
                  <div className="h-14 w-14 rounded-xl gradient-hero flex items-center justify-center mb-4 shadow-glow-sm mx-auto">
                    <value.icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-xl">{value.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{value.description}</CardDescription>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Unsere Meilensteine</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Von der Idee zur Plattform – unser Weg im Überblick.
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto space-y-8">
            {milestones.map((milestone, index) => (
              <div key={index} className="flex gap-8 items-start animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="flex-shrink-0">
                  <div className="h-20 w-20 rounded-xl gradient-hero flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {milestone.year}
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <h3 className="text-2xl font-bold mb-2">{milestone.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{milestone.description}</p>
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
                alt="Vertrauensvoller Wohnmobil-Verkauf" 
                className="relative rounded-2xl shadow-premium hover-lift"
              />
            </div>
            
            <div className="order-1 lg:order-2 animate-fade-in animate-delay-200">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Was uns auszeichnet</h2>
              <p className="text-lg opacity-90 mb-8 leading-relaxed">
                Bei {siteName} verbinden wir digitale Kompetenz mit persönlichem Service. 
                Unsere Erfahrung aus der Immobilienbranche hilft uns, auch im Wohnmobil-Markt 
                die besten Lösungen für Sie zu finden.
              </p>
              
              <div className="space-y-4">
                {team.map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                      <p className="opacity-90">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Offer - replaces fake Certifications */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Unser Versprechen</h2>
              <p className="text-lg text-muted-foreground">
                Darauf können Sie sich bei {siteName} verlassen.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Shield,
                  title: "Geprüfte Händler",
                  description: "Alle Partner durchlaufen unseren Verifizierungsprozess"
                },
                {
                  icon: Users,
                  title: "Persönlicher Service",
                  description: "Individuelle Betreuung bei jedem Verkauf"
                },
                {
                  icon: TrendingUp,
                  title: "Faire Preise",
                  description: "Marktgerechte Bewertung Ihres Fahrzeugs"
                }
              ].map((cert, index) => (
                <Card key={index} className="text-center hover-lift-sm animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <CardHeader>
                    <div className="h-16 w-16 rounded-xl gradient-hero flex items-center justify-center mb-4 shadow-glow-sm mx-auto">
                      <cert.icon className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-xl">{cert.title}</CardTitle>
                    <CardDescription className="text-base">{cert.description}</CardDescription>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Lernen Sie uns kennen</h2>
            <p className="text-xl mb-8 opacity-95">
              Überzeugen Sie sich selbst von unserem Service. Wir freuen uns darauf, 
              Ihnen beim Verkauf Ihres Wohnmobils zu helfen – kostenlos und unverbindlich.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/verkaufen">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Jetzt verkaufen
                </Button>
              </Link>
              <Link to="/kontakt">
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 border-white/30 hover:bg-white/20 text-white">
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
