import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Building2, EyeOff, Handshake, MapPin, type LucideIcon } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BRAND } from "@/lib/brand";
import { generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";

const PRINCIPLES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: BadgeCheck,
    title: "Manuelle Freischaltung",
    text: "Küchenstudios registrieren sich bei uns. Jedes Küchenstudio wird vor der Freischaltung von unserem Team manuell geprüft – erst dann sieht es Projekte. Bei Bedarf fragen wir Nachweise wie einen Gewerbenachweis an.",
  },
  {
    icon: EyeOff,
    title: "Anonymer Projektaustausch",
    text: "Studios sehen zuerst nur Ihren PLZ-Bereich und Ihr Projekt, nicht Ihren Namen. Ihre Kontaktdaten erhalten höchstens drei Studios für Rückfragen und das Studio, dessen Angebot Sie annehmen.",
  },
  {
    icon: MapPin,
    title: "Regional wachsend",
    text: "Unser Studio-Netzwerk wächst regional. Bei Ihrer Anfrage prüfen wir, ob Studios in Ihrer Nähe teilnehmen – sonst melden wir uns persönlich.",
  },
  {
    icon: Handshake,
    title: "Sie entscheiden",
    text: "Angebote sind für Sie kostenlos und unverbindlich. Ob und welches Angebot Sie annehmen, entscheiden Sie. Den Kaufvertrag über Ihre Küche schließen Sie direkt mit dem Studio.",
  },
];

const Kuechenstudios = () => (
  <PageLayout
    breadcrumbs={true}
    title={`Küchenstudios bei ${BRAND.name}`}
    description={`Wie ${BRAND.name} mit Küchenstudios zusammenarbeitet: manuelle Prüfung vor der Freischaltung, anonymer Projektaustausch und ein regional wachsendes Studio-Netzwerk.`}
    keywords="küchenstudio angebote, küchenstudio region, küchenangebote vergleichen, küchenstudio partner werden"
    canonicalPath="/kuechenstudios"
    structuredData={generateBreadcrumbSchema(getBreadcrumbsFromPath("/kuechenstudios"))}
  >
    <PageHero size="md">
      <div className="mx-auto max-w-3xl text-center animate-fade-in">
        <h1 className="mb-4 flex items-center justify-center gap-3 text-4xl font-bold text-foreground md:text-5xl">
          <Building2 className="h-10 w-10 text-primary" aria-hidden="true" />
          Küchenstudios bei {BRAND.name}
        </h1>
        <p className="text-lg text-muted-foreground">
          Bei {BRAND.name} machen Ihnen Küchenstudios aus Ihrer Region Angebote für Ihre neue Küche. So wählen wir
          die Studios aus und so läuft die Zusammenarbeit.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="gap-2">
            <Link to="/formular">
              Angebote holen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2">
            <Link to="/haendler">
              Partner werden
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </PageHero>

    <section className="py-12 md:py-20" aria-labelledby="zusammenarbeit">
      <div className="container mx-auto max-w-5xl px-4">
        <h2 id="zusammenarbeit" className="mb-8 text-center text-3xl font-bold md:text-4xl">
          So arbeiten wir mit Küchenstudios
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {PRINCIPLES.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="p-6">
              <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-muted/30 py-12 md:py-20">
      <div className="container mx-auto grid max-w-5xl gap-6 px-4 md:grid-cols-2">
        <Card className="flex flex-col p-6 md:p-8">
          <h2 className="mb-3 text-2xl font-bold">Sie planen eine neue Küche?</h2>
          <p className="mb-6 flex-1 text-muted-foreground">
            Beschreiben Sie Ihre Wünsche in wenigen Schritten. Küchenstudios aus Ihrer Region machen Ihnen 7 Tage lang
            Angebote – kostenlos und unverbindlich.
          </p>
          <Button asChild size="lg" className="gap-2 self-start">
            <Link to="/formular">
              Angebote holen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </Card>
        <Card className="flex flex-col p-6 md:p-8">
          <h2 className="mb-3 text-2xl font-bold">Sie führen ein Küchenstudio?</h2>
          <p className="mb-6 flex-1 text-muted-foreground">
            Registrierung und Angebotsabgabe sind kostenlos. Die Kontaktfreischaltung ist optional und kostenpflichtig,
            eine Provision fällt nur an, wenn Kund:innen Ihr Angebot annehmen.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link to="/haendler">
                Partner werden
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/preise">Preise ansehen</Link>
            </Button>
          </div>
        </Card>
      </div>
    </section>
  </PageLayout>
);

export default Kuechenstudios;
