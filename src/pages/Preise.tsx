import PageLayout from "@/components/PageLayout";
import { generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { StudioPricing } from "@/components/pricing/StudioPricing";
import { BRAND } from "@/lib/brand";

const customerFreeServices = [
  "KüchenRechner: Preisspanne als Richtwert mit 4 kurzen Fragen",
  "Angebote von geprüften Küchenstudios einholen",
  "Günstigere Angebote für Ihre fertige Planung vom Studio",
  "KI-Konfigurator mit Visualisierung im eigenen Raum",
  "Alle Angebote auf Ihrer persönlichen Projektseite vergleichen",
  "Persönlicher Support per Telefon und E-Mail",
  "Keine Abnahmepflicht, keine Gebühren",
];

const dealerFreeServices = [
  "Registrierung und Prüfung Ihres Studios",
  "Projekt-Börse mit Projekten aus Ihrem Einzugsgebiet",
  "Angebote abgeben und bis zum Ende der Angebotsphase senken",
  "E-Mail bei neuen Projekten in Ihrer Region",
  "Export für Planungssoftware (JSON, DXF)",
];

const dealerPaidServices = [
  "Kontaktfreischaltung – optional, Preis je nach Budget, vor dem Kauf sichtbar",
  "Provision – nur, wenn die Kund:in Ihr Angebot annimmt",
];

const CHECK_ICON_CLASS = "h-5 w-5 text-primary flex-shrink-0 mt-0.5";

const Preise = () => {
  return (
    <PageLayout
      breadcrumbs={true}
      title={`Preise & Leistungen – für Privatkunden kostenlos | ${BRAND.name}`}
      description={`Preise bei ${BRAND.name}: Für Privatkunden kostenlos. Küchenstudios zahlen eine optionale Kontaktfreischaltung und eine gestaffelte Provision, wenn die Kund:in ihr Angebot annimmt.`}
      keywords="Preise, Kosten, Gebühren, Küche kaufen, Küchen-Provision, Küchenstudio Partner, Küchenwert"
      canonicalPath="/preise"
      structuredData={generateBreadcrumbSchema(getBreadcrumbsFromPath("/preise"))}
    >
      <PageHero>
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Preise & Leistungen
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Für Privatkunden kostenlos und unverbindlich. Küchenstudios zahlen nur für freiwillige Kontaktfreischaltungen und
            eine Provision, wenn die Kund:in ihr Angebot annimmt.
          </p>
        </div>
      </PageHero>

      <section aria-labelledby="leistungen" className="py-12 sm:py-16 md:py-20">
        <div className="container px-4 sm:px-6 lg:px-8">
          <h2 id="leistungen" className="sr-only">Leistungen im Überblick</h2>
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {/* Fuer Privatkunden */}
            <Card className="border-2 hover:border-primary/20 transition-all duration-300">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-xl sm:text-2xl text-center">
                  Für Privatkunden – kostenlos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
                <ul className="space-y-3">
                  {customerFreeServices.map((service) => (
                    <li key={service} className="flex items-start gap-3">
                      <CheckCircle2 className={CHECK_ICON_CLASS} aria-hidden="true" />
                      <span className="text-sm sm:text-base">{service}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm text-muted-foreground">
                  Sie entscheiden frei, ob Sie ein Angebot annehmen. Den Kaufvertrag schließen Sie direkt mit dem Küchenstudio.
                </p>
              </CardContent>
            </Card>

            {/* Fuer Kuechenstudios */}
            <Card className="border-2 hover:border-primary/20 transition-all duration-300">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-xl sm:text-2xl text-center">
                  Für Küchenstudios
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-muted-foreground mb-4">
                      Kostenlos
                    </h4>
                    <ul className="space-y-3">
                      {dealerFreeServices.map((service) => (
                        <li key={service} className="flex items-start gap-3">
                          <CheckCircle2 className={CHECK_ICON_CLASS} aria-hidden="true" />
                          <span className="text-sm sm:text-base">{service}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-muted-foreground mb-4">
                      Kostenpflichtig
                    </h4>
                    <ul className="space-y-3">
                      {dealerPaidServices.map((service) => (
                        <li key={service} className="flex items-start gap-3">
                          <CheckCircle2 className={CHECK_ICON_CLASS} aria-hidden="true" />
                          <span className="text-sm sm:text-base">{service}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Keine Grundgebühr, keine Mindestabnahme, keine Vertragslaufzeit.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section aria-labelledby="studio-preise" className="py-12 sm:py-16 bg-muted/30">
        <div className="container px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h2 id="studio-preise" className="text-2xl sm:text-3xl font-bold mb-3">
              Preise für Küchenstudios
            </h2>
            <p className="text-muted-foreground">
              Registrierung und Angebotsabgabe sind kostenlos. Kosten entstehen nur, wenn Sie einen Kontakt freischalten oder die
              Kund:in Ihr Angebot annimmt.
            </p>
          </div>
          <StudioPricing />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
        <div className="container px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Bereit loszulegen?
            </h2>
            <p className="text-muted-foreground mb-8 text-lg">
              Starten Sie Ihre kostenlose Anfrage – oder registrieren Sie Ihr Küchenstudio und sehen Sie Projekte aus Ihrer Region.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="gap-2">
                <Link to="/formular">
                  Kostenlos Angebote erhalten
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2">
                <Link to="/haendler">
                  Für Küchenstudios
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default Preise;
