import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Book,
  ChefHat,
  AlertTriangle,
  ArrowRight,
  Users,
  Wrench,
  Truck,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BRAND } from "@/lib/brand";

/**
 * Ratgeber/Guides hub for KüchenWert.
 *
 * Phase 3.7 will add marken-spezifische Ratgeber (Nobilia, Häcker, SieMatic,
 * Ballerup, etc.) plus Situationsratgeber (Umzug, Scheidung, Renovierung).
 * Bis dahin zeigen wir die Kategorien als Platzhalter + Link in den Funnel.
 *
 * Die alten Caravan-Ratgeber-Detailseiten (src/pages/ratgeber/RatgeberTemplate)
 * sind weiterhin unter /ratgeber/:slug erreichbar. Sobald neue Kuechen-Guides
 * produziert sind, wird das Array unten mit echten Links befuellt.
 */

type GuideCategory = {
  title: string;
  description: string;
  icon: typeof ChefHat;
  slug: string;
};

const guideCategories: GuideCategory[] = [
  {
    title: "Küche richtig bewerten",
    description:
      "Wie Marke, Alter, Zustand und Ausstattung den Wiederverkaufswert Ihrer Küche beeinflussen.",
    icon: Calculator,
    slug: "kueche-richtig-bewerten",
  },
  {
    title: "Küchen-Demontage & Transport",
    description:
      "Worauf Sie bei Abbau, Verpackung und Transport Ihrer gebrauchten Küche achten sollten.",
    icon: Truck,
    slug: "kueche-demontage-transport",
  },
  {
    title: "Küche verkaufen oder entsorgen?",
    description:
      "Wann sich der Verkauf lohnt und wann es sinnvoller ist, die Küche zu spenden oder zu entsorgen.",
    icon: ChefHat,
    slug: "kueche-verkaufen-entsorgen",
  },
  {
    title: "Geräte: mitverkaufen oder nicht?",
    description:
      "Backofen, Kühlschrank & Co. – welche Elektrogeräte den Preis steigern und welche Sie besser behalten.",
    icon: Wrench,
    slug: "kuechengeraete-mitverkaufen",
  },
];

const situationGuides: { label: string; description: string; slug: string }[] = [
  {
    label: "Umzug",
    description: "Alte Küche beim Umzug nicht mehr gebraucht? So verkaufen Sie sie fair und schnell.",
    slug: "kueche-umzug-verkaufen",
  },
  {
    label: "Renovierung",
    description: "Neue Küche geplant? Wir zeigen, wie Sie mit der alten Küche noch Geld machen.",
    slug: "kueche-renovierung-verkaufen",
  },
  {
    label: "Erbfall",
    description: "Küche geerbt? So ermitteln Sie den Wert und finden den richtigen Käufer.",
    slug: "kueche-erbfall-verkaufen",
  },
  {
    label: "Scheidung",
    description: "Gemeinsame Küche verkaufen – fair, transparent und ohne Streit.",
    slug: "kueche-scheidung-verkaufen",
  },
  {
    label: "Immobilienverkauf",
    description: "Haus oder Wohnung verkauft? So trennen Sie die Küche vom Objekt.",
    slug: "kueche-immobilienverkauf",
  },
  {
    label: "Mit Schaden",
    description: "Kratzer, Wasserschaden, defekte Geräte? Auch beschädigte Küchen haben einen Wert.",
    slug: "kueche-mit-schaden-verkaufen",
  },
];

const Ratgeber = () => {
  return (
    <PageLayout
      breadcrumbs={true}
      title={`Küchen-Ratgeber | ${BRAND.name}`}
      description={`Ratgeber rund um den Verkauf gebrauchter Küchen: Bewertung, Demontage, Transport, Geräte und typische Verkaufssituationen – kompakt erklärt von ${BRAND.name}.`}
      keywords="küchen ratgeber, küche verkaufen ratgeber, küche bewertung, küche demontage, küche transport, küche entsorgen"
      canonicalPath="/ratgeber"
    >
      <PageHero size="lg">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-hero mb-6 shadow-glow-sm">
            <Book className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Ihr <span className="gradient-text">Küchen-Ratgeber</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-4 leading-relaxed">
            Alles rund um Bewertung, Demontage, Transport und Verkauf Ihrer gebrauchten
            Küche – in kompakten Experten-Guides zusammengefasst.
          </p>
        </div>
      </PageHero>

      {/* Haupt-Kategorien */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-hero mb-4 shadow-glow-sm">
              <ChefHat className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Die wichtigsten Themen</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Die häufigsten Fragen beim Verkauf einer gebrauchten Küche – verständlich erklärt.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {guideCategories.map((category, index) => {
              const Icon = category.icon;
              return (
                <Card
                  key={category.slug}
                  className="hover-lift border-2 animate-fade-in h-full"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-xl">{category.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      {category.description}
                    </p>
                    <Link
                      to="/funnel/a"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
                    >
                      Kostenlose Bewertung starten
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Situations-Guides */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-hero mb-4 shadow-glow-sm">
              <AlertTriangle className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ratgeber nach Situation</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Jede Lebenslage ist anders. Hier finden Sie Tipps für Ihre konkrete Situation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {situationGuides.map((guide, index) => (
              <Card
                key={guide.slug}
                className="hover-lift border-2 h-full animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CardHeader className="pb-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                    {guide.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mt-2">{guide.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Expert Help CTA */}
      <section className="py-20 bg-gradient-to-br from-primary via-primary-light to-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <Users className="h-16 w-16 mx-auto mb-6 opacity-90" />
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Brauchen Sie persönliche Beratung?
            </h2>
            <p className="text-xl mb-8 opacity-95">
              Unsere Experten helfen Ihnen gerne bei allen Fragen rund um Bewertung und Verkauf
              Ihrer Küche.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/funnel/a">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Kostenlose Küchen-Bewertung
                </Button>
              </Link>
              <Link to="/faq">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto bg-white/10 border-white/30 hover:bg-white/20 text-white"
                >
                  Häufige Fragen
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default Ratgeber;
