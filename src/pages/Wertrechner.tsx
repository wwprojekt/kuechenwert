import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calculator, Clock, Shield, TrendingUp, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import {
  generateWertrechnerSchema,
  generateBreadcrumbSchema,
  getBreadcrumbsFromPath,
  generateServiceSchema,
} from "@/lib/seo";
import { BRAND } from "@/lib/brand/config";

/**
 * Wertrechner-Landing (Phase 3.6 Kuechen-Rebrand)
 *
 * Der alte Caravan-Wertrechner basierte auf mileage/body_type/accident_free
 * und ist fuer Kuechen inhaltlich nicht tragfaehig. Ein eigenstaendiges
 * Kuechen-Preismodell (lib/valuation/**) wird separat in Phase 2
 * "valuation-rewrite" geschrieben.
 *
 * Bis dahin dient /wertrechner als SEO-optimierte Landing, die User zur
 * funktionsfaehigen Kuechen-Bewertung (Funnel A) fuehrt — 17 Fragen, 2 Min,
 * kostenlose Experten-Einschaetzung durch gepruefte Haendler.
 */
const Wertrechner = () => {
  const schemas = [
    generateServiceSchema(
      "Küchen-Wertrechner",
      "Kostenloser Online-Wertrechner für gebrauchte Küchen. Basierend auf Hersteller, Alter, Ausstattung und Zustand erhalten Sie eine realistische Sofort-Schätzung in 2 Minuten.",
    ),
    generateWertrechnerSchema({ averageRating: 0, reviewCount: 0 }),
    generateBreadcrumbSchema(getBreadcrumbsFromPath("/wertrechner")),
  ];

  const benefits = [
    {
      icon: Calculator,
      title: "Präzise Bewertung",
      description:
        "Marktdaten zu Hersteller (Nobilia, Häcker, Nolte, SieMatic, Bulthaup etc.), Alter und Ausstattung liefern Ihnen eine realistische Schätzung.",
    },
    {
      icon: Clock,
      title: "In 2 Minuten fertig",
      description:
        "17 einfache Fragen zu Ihrer Küche — keine Registrierung, keine Verpflichtung, kein Warten.",
    },
    {
      icon: Shield,
      title: "100 % kostenlos",
      description:
        "Die Bewertung ist unverbindlich und komplett gratis — auch wenn Sie sich gegen einen Verkauf entscheiden.",
    },
    {
      icon: TrendingUp,
      title: "Experten-Plus",
      description:
        "Auf Wunsch prüfen geprüfte Küchen-Händler Ihre Angaben und senden konkrete, verbindliche Angebote.",
    },
  ];

  const factors = [
    {
      title: "Hersteller",
      description:
        "Nobilia, Häcker, Nolte, SieMatic, Bulthaup, LEICHT, next125, Schüller und viele weitere Marken — der Wertverlauf variiert erheblich zwischen Herstellern.",
    },
    {
      title: "Alter & Zustand",
      description:
        "Baujahr, Gebrauchsspuren, funktionale Integrität der Geräte sowie Ausstattungsstand (z.B. Softclose-Scharniere, Glasfronten) fließen in die Bewertung ein.",
    },
    {
      title: "Ausstattung & Geräte",
      description:
        "Elektrogeräte-Hersteller (Bosch, Siemens, Miele, Neff, AEG, Gaggenau), Arbeitsplatten-Material (Laminat, Keramik, Quarzstein), Kochinsel, integrierte Haube — alles beeinflusst den Preis.",
    },
    {
      title: "Grundriss & Maße",
      description:
        "L-Form, U-Form, Küchenzeile oder Kochinsel — die Umzugsfähigkeit und Anpassbarkeit an einen neuen Grundriss spielen eine große Rolle für den Wiederverkaufswert.",
    },
  ];

  return (
    <PageLayout
      breadcrumbs={true}
      title="Küchen-Wertrechner — kostenlose Bewertung in 2 Minuten"
      description="Ermitteln Sie den Wert Ihrer gebrauchten Küche mit unserem kostenlosen Online-Wertrechner. Basierend auf Hersteller, Alter, Ausstattung und Zustand — einfach, schnell und unverbindlich."
      keywords="Küchen-Wertrechner, Küche Wert berechnen, Küchenwert ermitteln, gebrauchte Küche Wert, Nobilia Wert, Häcker Wert, Küchenbewertung kostenlos"
      canonicalPath="/wertrechner"
      structuredData={schemas}
    >
      {/* Hero */}
      <PageHero size="lg">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-hero mb-6 shadow-glow-sm">
            <Calculator className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Küchen-<span className="gradient-text">Wertrechner</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
            Erhalten Sie in nur 2 Minuten eine kostenlose, realistische
            Wertschätzung für Ihre gebrauchte Küche — basierend auf Hersteller,
            Alter, Ausstattung und Zustand.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/funnel/a">
              <Button
                size="lg"
                className="w-full sm:w-auto gradient-hero hover:gradient-hero-hover shadow-lg hover:shadow-glow"
              >
                Kostenlose Bewertung starten
              </Button>
            </Link>
            <Link to="/verkaufen">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Mehr über den Verkauf erfahren
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            Kein Login · Unverbindlich · DSGVO-konform
          </p>
        </div>
      </PageHero>

      {/* Benefits */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">
              Warum unseren Wertrechner nutzen?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Unser Küchen-Wertrechner kombiniert aktuelle Marktdaten mit der
              Expertise unserer geprüften Händler-Partner.
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

      {/* Factors */}
      <section className="py-20">
        <div className="container max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">
              Was beeinflusst den Wert Ihrer Küche?
            </h2>
            <p className="text-lg text-muted-foreground">
              Vier Hauptfaktoren bestimmen den Wiederverkaufswert einer
              gebrauchten Küche.
            </p>
          </div>

          <div className="space-y-6">
            {factors.map((factor, index) => (
              <Card
                key={index}
                className="border-2 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <CardTitle className="text-xl mb-2">
                        {factor.title}
                      </CardTitle>
                      <CardDescription className="text-base leading-relaxed">
                        {factor.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary via-primary-light to-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Bereit für die Bewertung?
            </h2>
            <p className="text-xl mb-8 opacity-95">
              Starten Sie jetzt die kostenlose Bewertung Ihrer Küche bei{" "}
              {BRAND.name} — in 2 Minuten zum Richtwert.
            </p>
            <Link to="/funnel/a">
              <Button size="lg" variant="secondary">
                Jetzt kostenlos bewerten
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default Wertrechner;
