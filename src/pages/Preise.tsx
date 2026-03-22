import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Preise = () => {
  const sellerFreeServices = [
    "Verkaufsinserat erstellen",
    "Verkaufsinserat verlängern für neue Bieterrunde",
    "Online-Nachverhandlung",
    "Fahrzeug versteigern",
    "Verkauf ablehnen bei Unterschreiten des Mindestverkaufspreises",
    "Vorgefertigter, rechtssicherer Kaufvertrag",
    "Unterstützung bei der Inseraterstellung",
    "Telefonischer Kundensupport",
  ];

  const buyerFreeServices = [
    "Unbegrenzte Gebotsabgabe",
    "Bietagent",
    "Merkliste und Suchauftrag",
    "Online Fragen an Verkäufer stellen",
    "Online-Nachverhandlung",
    "Vorgefertigter, rechtssicherer Kaufvertrag",
  ];

  const buyerPaidServices = [
    "Fahrzeug ersteigern (Provision)",
  ];

  return (
    <PageLayout
      breadcrumbs={true}
      title="Preise & Leistungen"
      description="Transparent und fair – unsere Konditionen für Verkäufer und Käufer bei CaravanWert"
      keywords="Preise, Kosten, Gebühren, Wohnmobil verkaufen, Provision"
    >
      <PageHero>
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Preise & Leistungen
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Transparent und fair – unsere Konditionen für Verkäufer und Käufer
          </p>
        </div>
      </PageHero>

      <section className="py-12 sm:py-16 md:py-20">
        <div className="container px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {/* Für Verkäufer */}
            <Card className="border-2 hover:border-primary/20 transition-all duration-300">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-xl sm:text-2xl text-center">
                  Für Verkäufer
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-muted-foreground mb-4">
                      kostenlose Leistungen
                    </h3>
                    <ul className="space-y-3">
                      {sellerFreeServices.map((service, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm sm:text-base">{service}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Für Käufer */}
            <Card className="border-2 hover:border-primary/20 transition-all duration-300">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-xl sm:text-2xl text-center">
                  Für Käufer
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-muted-foreground mb-4">
                      kostenlose Leistungen
                    </h3>
                    <ul className="space-y-3">
                      {buyerFreeServices.map((service, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm sm:text-base">{service}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-muted-foreground mb-4">
                      kostenpflichtige Leistungen
                    </h3>
                    <ul className="space-y-3">
                      {buyerPaidServices.map((service, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm sm:text-base">{service}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
              Verkaufen Sie Ihr Wohnmobil kostenlos oder finden Sie Ihr Traumfahrzeug in unseren Auktionen.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/verkaufen/wizard">
                <Button size="lg" className="gap-2">
                  Jetzt kostenlos verkaufen
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/kaufen">
                <Button variant="outline" size="lg" className="gap-2">
                  Auktionen durchstöbern
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default Preise;
