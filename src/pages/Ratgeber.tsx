import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Book, Truck, AlertTriangle, ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ratgeberMeta } from "@/data/ratgeber/ratgeber-index";

const brands = [
  { name: "Hymer", slug: "hymer" },
  { name: "Dethleffs", slug: "dethleffs" },
  { name: "Knaus", slug: "knaus" },
  { name: "Bürstner", slug: "buerstner" },
  { name: "Carthago", slug: "carthago" },
  { name: "Hobby", slug: "hobby" },
  { name: "Adria", slug: "adria" },
  { name: "Weinsberg", slug: "weinsberg" },
  { name: "Carado", slug: "carado" },
  { name: "Sunlight", slug: "sunlight" },
  { name: "Pössl", slug: "poessl" },
  { name: "Chausson", slug: "chausson" },
  { name: "Rapido", slug: "rapido" },
  { name: "Concorde", slug: "concorde" },
  { name: "Laika", slug: "laika" },
];

const conditionGuides: { label: string; slug: string }[] = [
  { label: "Motorschaden", slug: "wohnmobil-mit-motorschaden-verkaufen" },
  { label: "Wasserschaden", slug: "wohnmobil-mit-wasserschaden-verkaufen" },
  { label: "Getriebeschaden", slug: "wohnmobil-mit-getriebeschaden-verkaufen" },
  { label: "Unfallschaden", slug: "wohnmobil-mit-unfallschaden-verkaufen" },
  { label: "Hagelschaden", slug: "wohnmobil-mit-hagelschaden-verkaufen" },
  { label: "Schimmel", slug: "wohnmobil-mit-schimmel-verkaufen" },
  { label: "Ohne TÜV", slug: "wohnmobil-ohne-tuev-verkaufen" },
  { label: "Hohe Laufleistung", slug: "wohnmobil-mit-hoher-laufleistung-verkaufen" },
  { label: "Reparaturstau", slug: "wohnmobil-mit-reparaturstau-verkaufen" },
  { label: "Leasingvertrag", slug: "wohnmobil-mit-leasingvertrag-verkaufen" },
  { label: "Trotz Finanzierung", slug: "wohnmobil-trotz-finanzierung-verkaufen" },
  { label: "Erbfall", slug: "wohnmobil-im-erbfall-verkaufen" },
  { label: "Scheidung", slug: "wohnmobil-bei-scheidung-verkaufen" },
];

const itemListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Wohnmobil Ratgeber",
  description: "88 Experten-Ratgeber rund um den Verkauf, die Bewertung und die Versteigerung von Wohnmobilen.",
  numberOfItems: ratgeberMeta.length,
  itemListElement: ratgeberMeta.map((m, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: m.h1,
    url: `https://caravanwert.de${m.path}`,
  })),
};

const Ratgeber = () => {
  return (
    <PageLayout
      breadcrumbs={true}
      title="Wohnmobil Ratgeber – 88 Experten-Guides"
      description="Umfassender Wohnmobil-Ratgeber: Marken-Guides für Hymer, Dethleffs, Knaus & 12 weitere, plus Ratgeber zu Schäden, Finanzierung, Erbfall und mehr."
      keywords="wohnmobil ratgeber, wohnmobil verkaufen ratgeber, wohnmobil bewertung, wohnmobil marken guide"
      canonicalPath="/ratgeber"
      structuredData={itemListSchema}
    >
      {/* Hero Section */}
      <PageHero size="lg">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-hero mb-6 shadow-glow-sm">
            <Book className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Ihr <span className="gradient-text">Wohnmobil-Ratgeber</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-4 leading-relaxed">
            88 Experten-Guides rund um Verkauf, Bewertung und Versteigerung Ihres Wohnmobils.
            Marken-spezifische Ratgeber für die 15 beliebtesten Hersteller plus Situationsratgeber für jede Lebenslage.
          </p>
          <p className="text-base text-muted-foreground">
            <strong>{ratgeberMeta.length} Ratgeber</strong> — 15 Marken — 13 Situationen
          </p>
        </div>
      </PageHero>

      {/* Brand Guides Section */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-hero mb-4 shadow-glow-sm">
              <Truck className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ratgeber nach Marke</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Für jede der 15 Top-Marken: Verkaufsratgeber, Preisguide, Wertermittlung, Verkaufsanleitung und Versteigerungs-Guide.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands.map((brand, index) => (
              <Card key={brand.slug} className="hover-lift border-2 animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">{brand.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link to={`/ratgeber/${brand.slug}-wohnmobil-verkaufen`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    <span>{brand.name} Wohnmobil verkaufen</span>
                  </Link>
                  <Link to={`/ratgeber/was-kostet-mein-${brand.slug}-wohnmobil`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    <span>Was kostet mein {brand.name}?</span>
                  </Link>
                  <Link to={`/ratgeber/${brand.slug}-wohnmobil-wert-ermitteln`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    <span>{brand.name} Wert ermitteln</span>
                  </Link>
                  <Link to={`/ratgeber/wie-verkaufe-ich-mein-${brand.slug}-wohnmobil`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    <span>Wie verkaufe ich meinen {brand.name}?</span>
                  </Link>
                  <Link to={`/ratgeber/${brand.slug}-wohnmobil-versteigern`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    <span>{brand.name} Wohnmobil versteigern</span>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Condition Guides Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-hero mb-4 shadow-glow-sm">
              <AlertTriangle className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ratgeber nach Situation</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ihr Wohnmobil hat einen Schaden oder Sie befinden sich in einer besonderen Situation? Hier finden Sie den passenden Ratgeber.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {conditionGuides.map((guide, index) => (
              <Link key={guide.slug} to={`/ratgeber/${guide.slug}`} className="group">
                <Card className="hover-lift border-2 h-full animate-fade-in group-hover:border-primary/50 transition-colors" style={{ animationDelay: `${index * 0.05}s` }}>
                  <CardHeader className="pb-0">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary shrink-0 group-hover:translate-x-1 transition-transform" />
                      {guide.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mt-2">
                      Wohnmobil trotz {guide.label.toLowerCase()} verkaufen — Tipps, Preise & Ablauf
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Expert Help CTA */}
      <section className="py-20 bg-gradient-to-br from-primary via-primary-light to-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <Users className="h-16 w-16 mx-auto mb-6 opacity-90" />
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Brauchen Sie persönliche Beratung?</h2>
            <p className="text-xl mb-8 opacity-95">
              Unsere Experten helfen Ihnen gerne bei allen Fragen rund um Bewertung und Verkauf Ihres Wohnmobils.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/verkaufen">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Jetzt kostenlos bewerten
                </Button>
              </Link>
              <Link to="/faq">
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 border-white/30 hover:bg-white/20 text-white">
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
