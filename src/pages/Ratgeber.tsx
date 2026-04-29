import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Book,
  ChefHat,
  AlertTriangle,
  ArrowRight,
  Users,
  Ruler,
  Calculator,
  Gavel,
  Sparkles,
  Refrigerator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BRAND } from "@/lib/brand";

/**
 * Ratgeber/Guides hub for KuechenWert (Kaeufer-Perspektive).
 *
 * Kerngedanke: Der Ratgeber hilft Kund:innen, eine NEUE Kueche zu planen
 * und zu kaufen — nicht zu verkaufen.
 *
 * Alle CTAs fuehren in Funnel A (Angebote einholen), den KuechenRechner
 * (Budget einschaetzen) oder Funnel B (Studio-Preise unterbieten).
 *
 * Phase 3.7 (Marken-Ratgeber Nobilia/Haecker/SieMatic etc.) folgt wenn
 * Markenliste + Content steht. Detailseiten unter /ratgeber/:slug sind
 * weiterhin erreichbar, werden aber Stueck fuer Stueck auf Kuechen-Planung
 * umgeschrieben.
 */

type GuideCategory = {
  title: string;
  description: string;
  icon: typeof ChefHat;
  slug: string;
};

const guideCategories: GuideCategory[] = [
  {
    title: "Küche richtig planen",
    description:
      "Grundriss, Abmessungen, Arbeitszonen und Laufwege — so wird Ihre neue Küche wirklich alltagstauglich.",
    icon: Ruler,
    slug: "kueche-richtig-planen",
  },
  {
    title: "Budget realistisch einschätzen",
    description:
      "Was kostet eine neue Küche wirklich? Wir zeigen typische Preisspannen nach Größe, Stil und Geräte-Level.",
    icon: Calculator,
    slug: "kueche-budget-einschaetzen",
  },
  {
    title: "Studio-Angebote richtig vergleichen",
    description:
      "Worauf Sie bei Angeboten von Küchenstudios achten müssen — von Preis bis Versteckkosten.",
    icon: Gavel,
    slug: "kueche-angebote-vergleichen",
  },
  {
    title: "Geräte auswählen",
    description:
      "Bosch, Siemens, Miele, Gaggenau: Welche Marke passt zu Ihrem Kochstil — und wo sich Premium wirklich lohnt.",
    icon: Refrigerator,
    slug: "kuechengeraete-waehlen",
  },
];

const situationGuides: { label: string; description: string; slug: string }[] = [
  {
    label: "Erstkauf",
    description:
      "Erste eigene Küche? Wir zeigen Schritt für Schritt, wie Sie von der Idee zum Umzug-fertigen Ergebnis kommen.",
    slug: "kueche-erstkauf",
  },
  {
    label: "Renovierung",
    description:
      "Alte Küche raus, neue rein — so planen Sie den Wechsel ohne wochenlange Baustelle.",
    slug: "kueche-renovierung",
  },
  {
    label: "Hausbau",
    description:
      "Neubau? Wann planen Sie die Küche, wann bestellen, wann einbauen? Der richtige Ablauf spart bares Geld.",
    slug: "kueche-hausbau",
  },
  {
    label: "Nach Umzug",
    description:
      "Umgezogen und die alte Küche passt nicht? So finden Sie schnell eine passende neue zum fairen Preis.",
    slug: "kueche-nach-umzug",
  },
  {
    label: "Kleines Budget",
    description:
      "Traumküche mit kleinem Geldbeutel: Welche Kompromisse lohnen sich — und bei welchen Sie lieber abwarten.",
    slug: "kueche-kleines-budget",
  },
  {
    label: "Luxus & Design",
    description:
      "Bulthaup, SieMatic, Poggenpohl: Wenn das Beste gerade gut genug ist — das ist bei Designerküchen wichtig.",
    slug: "kueche-luxus-design",
  },
];

const Ratgeber = () => {
  return (
    <PageLayout
      breadcrumbs={true}
      title={`Küchen-Ratgeber | ${BRAND.name}`}
      description={`Ratgeber rund um die neue Küche: Planung, Budget, Angebotsvergleich, Geräteauswahl und typische Lebenssituationen – kompakt erklärt von ${BRAND.name}.`}
      keywords="küchen ratgeber, neue küche planen, küchen budget, küchen angebote vergleichen, küchengeräte wählen, küchenkauf tipps"
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
            Alles rund um Planung, Budget, Angebotsvergleich und Geräteauswahl
            für Ihre neue Küche — in kompakten Experten-Guides zusammengefasst.
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
              Die häufigsten Fragen beim Kauf einer neuen Küche — verständlich erklärt.
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
                      Kostenlose Angebote einholen
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
              Unser Küchen-Team hilft Ihnen gerne bei allen Fragen rund um Planung,
              Budget und Studio-Auswahl.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/funnel/a">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Kostenlose Angebote einholen
                </Button>
              </Link>
              <Link to="/kuechenrechner">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto bg-white/10 border-white/30 hover:bg-white/20 text-white"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Budget-Check
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
