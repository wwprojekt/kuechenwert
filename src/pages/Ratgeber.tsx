import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import {
  ArrowRight,
  Book,
  Calculator,
  FileText,
  HelpCircle,
  MessageSquare,
  Sparkles,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BRAND } from "@/lib/brand";

// Solange es keine Ratgeber-Artikel gibt, leitet /ratgeber/:slug hierher um.

interface ResourceLink {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
}

const FIRST_ANSWERS: ResourceLink[] = [
  {
    to: "/faq",
    icon: HelpCircle,
    title: "Häufige Fragen",
    description:
      "Wie die Angebotsphase abläuft, was KüchenWert kostet und wie wir Küchenstudios prüfen – kurz beantwortet.",
    cta: "Zu den häufigen Fragen",
  },
  {
    to: "/kuechenrechner",
    icon: Calculator,
    title: "KüchenRechner",
    description:
      "Ein Richtwert für eine Küche wie Ihre – auf Basis öffentlich verfügbarer Marktpreise, keine verbindliche Preisauskunft.",
    cta: "Preis einschätzen",
  },
];

const REQUEST_PATHS: ResourceLink[] = [
  {
    to: "/funnel/c",
    icon: Sparkles,
    title: "Traumküche planen",
    description:
      "Raumfoto hochladen, Küche mit KI gestalten und einen geschätzten Preis sehen. Dazu machen Ihnen geprüfte Studios 7 Tage lang kostenlose Angebote.",
    cta: "Mit KI planen",
  },
  {
    to: "/formular",
    icon: FileText,
    title: "Angebote holen",
    description:
      "Wünsche in wenigen Schritten beschreiben – Küchenstudios aus Ihrer Region machen Ihnen 7 Tage lang Angebote.",
    cta: "Angebote holen",
  },
  {
    to: "/funnel/b",
    icon: TrendingDown,
    title: "Fertige Planung vergleichen",
    description:
      "Sie haben schon eine fertige Planung und einen Preis vom Studio? Andere Studios können Ihnen 72 Stunden lang ein günstigeres Angebot machen.",
    cta: "Planung vergleichen",
  },
];

const ResourceCard = ({ to, icon: Icon, title, description, cta }: ResourceLink) => (
  <Link
    to={to}
    className="group flex h-full flex-col rounded-xl border-2 bg-card p-6 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  >
    <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
    </span>
    <h3 className="mb-2 text-xl font-semibold text-foreground">{title}</h3>
    <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
    <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
      {cta}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
    </span>
  </Link>
);

const Ratgeber = () => {
  return (
    <PageLayout
      breadcrumbs={true}
      title={`Küchen-Ratgeber | ${BRAND.name}`}
      description={`Erste Antworten rund um Ihre neue Küche: häufige Fragen, KüchenRechner und die drei Wege zu Angeboten bei ${BRAND.name}.`}
      keywords="küchen ratgeber, neue küche planen, küchen budget, küchen angebote vergleichen, küchenkauf tipps"
      canonicalPath="/ratgeber"
      noIndex={true}
    >
      <PageHero size="md">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-hero mb-6 shadow-glow-sm">
            <Book className="h-8 w-8 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Ihr <span className="gradient-text">Küchen-Ratgeber</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-4 leading-relaxed">
            Ausführliche Ratgeber-Artikel sind in Arbeit. Bis dahin finden Sie hier die wichtigsten
            Anlaufstellen rund um Ihre neue Küche.
          </p>
        </div>
      </PageHero>

      <section className="py-16" aria-labelledby="erste-antworten">
        <div className="container max-w-5xl">
          <h2 id="erste-antworten" className="text-3xl md:text-4xl font-bold mb-8 text-center">
            Erste Antworten
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {FIRST_ANSWERS.map((resource) => (
              <ResourceCard key={resource.to} {...resource} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-muted/30" aria-labelledby="wege-zu-angeboten">
        <div className="container max-w-5xl">
          <div className="text-center mb-8">
            <h2 id="wege-zu-angeboten" className="text-3xl md:text-4xl font-bold mb-4">
              So kommen Sie zu Angeboten
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Drei Wege, alle kostenlos und unverbindlich – Sie entscheiden, ob und welches Angebot Sie annehmen.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {REQUEST_PATHS.map((resource) => (
              <ResourceCard key={resource.to} {...resource} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-br from-primary via-primary-light to-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Noch Fragen?</h2>
            <p className="text-xl mb-8 opacity-95">
              Unser Team hilft Ihnen gern weiter – telefonisch Montag bis Freitag von 10 bis 18 Uhr oder per E-Mail.
            </p>
            <Button asChild size="lg" variant="secondary">
              <Link to="/kontakt">
                <MessageSquare className="h-4 w-4 mr-2" aria-hidden="true" />
                Kontakt aufnehmen
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default Ratgeber;
