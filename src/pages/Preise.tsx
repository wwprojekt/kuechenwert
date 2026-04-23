import { useState } from "react";
import PageLayout from "@/components/PageLayout";
import { generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Calculator, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { useCommissionFromTiers } from "@/lib/commissionCalculator";
import { CommissionTierTable } from "@/components/CommissionTierTable";

const Preise = () => {
  const [calcAmount, setCalcAmount] = useState(15000);
  const calcResult = useCommissionFromTiers(calcAmount);

  const sellerFreeServices = [
    "Verkaufsinserat erstellen",
    "Verkaufsinserat verlängern für neue Bieterrunde",
    "Online-Nachverhandlung",
    "Fahrzeug versteigern",
    "Keine Verkaufspflicht wenn Mindestgebot nicht erreicht wird",
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

  return (
    <PageLayout
      breadcrumbs={true}
      title="Preise & Leistungen – Wohnmobil-Verkauf"
      description="Transparente Preise für den Wohnmobil-Verkauf bei CaravanWert. Kostenlose Bewertung, faire Provisionen und keine versteckten Gebühren für Verkäufer und Käufer."
      keywords="Preise, Kosten, Gebühren, Wohnmobil verkaufen, Provision"
      canonicalPath="/preise"
      structuredData={generateBreadcrumbSchema(getBreadcrumbsFromPath("/preise"))}
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
                  Für Verkäufer – kostenlos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
                <ul className="space-y-3">
                  {sellerFreeServices.map((service, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm sm:text-base">{service}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Für Käufer */}
            <Card className="border-2 hover:border-primary/20 transition-all duration-300">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-xl sm:text-2xl text-center">
                  Für Käufer (Händler)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-muted-foreground mb-4">
                      Kostenlose Leistungen
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
                  <Separator />
                  <div>
                    <h3 className="font-semibold text-muted-foreground mb-2">
                      Vermittlungsprovision
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Nur bei erfolgreichem Kauf – gestaffelt nach Kaufpreis:
                    </p>
                    <CommissionTierTable variant="full-table" />
                    <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      Alle Beträge zzgl. MwSt. Volumenrabatte für Vielkäufer möglich.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Commission Calculator */}
      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="container px-4 sm:px-6 lg:px-8">
          <div className="max-w-lg mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="w-5 h-5 text-primary" />
                  Provisionsrechner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="calc-amount">Kaufpreis (€)</Label>
                  <Input
                    id="calc-amount"
                    type="number"
                    min={0}
                    step={500}
                    value={calcAmount || ''}
                    onChange={(e) => setCalcAmount(Number(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                {calcAmount > 0 && calcResult.commission > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Kaufpreis</span>
                      <span className="font-medium">€{calcAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Provision ({calcResult.rate.toLocaleString('de-DE')}%{calcResult.isMinApplied ? ', Mindestprovision' : ''})
                      </span>
                      <span className="font-medium">€{calcResult.commission.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Gesamtkosten (netto)</span>
                      <span className="text-primary">€{calcResult.totalCost.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">zzgl. MwSt. auf die Provision</p>
                  </div>
                )}
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
