import PageLayout from "@/components/PageLayout";
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
      description: "Wir leben für Wohnmobile und teilen die Begeisterung unserer Kunden für mobile Freiheit."
    },
    {
      icon: Shield,
      title: "Vertrauen",
      description: "Transparenz und Ehrlichkeit sind die Grundpfeiler unserer Geschäftsbeziehungen."
    },
    {
      icon: Target,
      title: "Exzellenz",
      description: "Wir streben nach höchster Qualität in allem, was wir tun - für Ihre Zufriedenheit."
    },
    {
      icon: Zap,
      title: "Innovation",
      description: "Moderne Technologie und effiziente Prozesse für schnellen und sicheren Service."
    }
  ];

  const milestones = [
    {
      year: "2015",
      title: "Gründung",
      description: "Start mit einer Vision: Wohnmobil-Ankauf einfach und fair gestalten."
    },
    {
      year: "2017",
      title: "Expansion",
      description: "Eröffnung von 3 weiteren Standorten in Deutschland."
    },
    {
      year: "2020",
      title: "Digitalisierung",
      description: "Launch unserer Online-Plattform für schnellen und transparenten Wohnmobil-Ankauf."
    },
    {
      year: "2023",
      title: "Marktführer",
      description: "Einer der führenden Wohnmobil-Ankäufer in Deutschland."
    }
  ];

  const team = [
    {
      name: "Expertise",
      description: "Über 50 Jahre kombinierte Erfahrung im Wohnmobil-Bereich"
    },
    {
      name: "Kundenservice",
      description: "Persönliche Betreuung durch geschulte Fachberater"
    },
    {
      name: "Netzwerk",
      description: "Starke Partnerschaften mit führenden Herstellern und Händlern"
    },
    {
      name: "Qualität",
      description: "TÜV-zertifizierte Prozesse für maximale Sicherheit"
    }
  ];

  const achievements = [
    { number: "Bundesweit", label: "Verfügbar" },
    { number: "24h", label: "Bewertungszeit" },
    { number: "TÜV", label: "Zertifiziert" },
    { number: "100%", label: "Kostenlos" }
  ];

  return (
    <PageLayout
      breadcrumbs={true}
      title="Über Uns"
      description={`Erfahren Sie mehr über ${siteName} - Ihr zuverlässiger Partner für Wohnmobil-Ankauf seit 2015. Bundesweit, schnell und fair.`}
      keywords="über uns, caravanwert, wohnmobil ankauf unternehmen, wohnmobil experten"
      canonicalPath="/ueber-uns"
    >
      {/* Hero Section */}
      <PageHero size="lg">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Ihre <span className="gradient-text">Wohnmobil-Experten</span> seit 2015
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
            Bei {siteName} verbinden wir Leidenschaft für Wohnmobile mit professionellem Service. 
            Vertrauen Sie auf über 8 Jahre Erfahrung und unseren bundesweiten Service.
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
                  {siteName} wurde 2015 aus einer einfachen Idee geboren: Den Wohnmobil-Ankauf transparenter, 
                  schneller und fairer zu gestalten. Was mit einem kleinen Standort begann, ist heute zu einem 
                  deutschlandweiten Netzwerk mit 6 Standorten gewachsen.
                </p>
                <p>
                  Unsere Gründer, selbst begeisterte Wohnmobil-Enthusiasten, erkannten die Schwierigkeiten beim 
                  privaten Verkauf und entwickelten einen Service, der beide Seiten zufriedenstellt: Faire Preise 
                  für Verkäufer und geprüfte Qualität für Käufer.
                </p>
                <p>
                  Heute sind wir stolz darauf, einer der führenden Wohnmobil-Ankäufer in Deutschland zu sein. 
                  Unser Erfolg basiert auf dem Vertrauen unserer Kunden und unserem Engagement für Qualität und Service.
                </p>
              </div>
            </div>
            
            <div className="relative animate-fade-in animate-delay-200">
              <div className="absolute -inset-4 gradient-hero opacity-20 blur-3xl rounded-full" />
              <img 
                src={dealerProfessional} 
                alt={`${siteName} Team - Professioneller Wohnmobil-Ankauf`} 
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
              Eine Reise des Wachstums und der kontinuierlichen Verbesserung.
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto space-y-8">
            {milestones.map((milestone, index) => (
              <div key={index} className="flex gap-8 items-start animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="flex-shrink-0">
                  <div className="h-20 w-20 rounded-xl gradient-hero flex items-center justify-center text-white font-bold text-lg shadow-lg">
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
                alt="Vertrauensvoller Wohnmobil-Ankauf" 
                className="relative rounded-2xl shadow-premium hover-lift"
              />
            </div>
            
            <div className="order-1 lg:order-2 animate-fade-in animate-delay-200">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Unser Team macht den Unterschied</h2>
              <p className="text-lg opacity-90 mb-8 leading-relaxed">
                Bei {siteName} arbeiten ausschließlich geschulte Fachleute mit echter Leidenschaft für Wohnmobile. 
                Unser Team vereint technisches Know-how mit ausgeprägtem Serviceverständnis.
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

      {/* Certifications */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Zertifizierungen & Auszeichnungen</h2>
              <p className="text-lg text-muted-foreground">
                Qualität, die durch unabhängige Institutionen bestätigt wird.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Award,
                  title: "TÜV-Zertifiziert",
                  description: "Geprüfte Qualitäts-standards"
                },
                {
                  icon: Users,
                  title: "Top-Bewertungen",
                  description: "98% Kundenzufriedenheit"
                },
                {
                  icon: TrendingUp,
                  title: "Branchenführer",
                  description: "Ausgezeichneter Service"
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
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Werden Sie Teil unserer Erfolgsgeschichte</h2>
            <p className="text-xl mb-8 opacity-95">
              Zahlreiche Kunden haben uns bereits vertraut. Lassen Sie uns auch Ihnen beim Verkauf 
              oder Kauf Ihres Wohnmobils helfen.
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
