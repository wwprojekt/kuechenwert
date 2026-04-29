import PageLayout from "@/components/PageLayout";
import {
  generateServiceSchema,
  generateBreadcrumbSchema,
  getBreadcrumbsFromPath,
} from "@/lib/seo";
import { ReviewStarsBadge } from "@/components/wertrechner/ReviewStarsBadge";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Euro,
  Clock,
  Shield,
  Phone,
  Mail,
  ArrowRight,
  Calculator,
  Users,
  Award,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand/config";

/**
 * Wertermittlung-Landing (Phase 3.6 Kuechen-Rebrand)
 *
 * Altes Caravan-Formular (Marke/Modell/Baujahr/Kilometerstand + DB-Insert in
 * value_assessment_leads) ist obsolet:
 *   - value_assessment_leads-Tabelle wurde in Phase 2.2 gedroppt
 *   - Kilometerstand ist kein Kuechen-Attribut
 *   - Die eigentliche Kuechen-Bewertung laeuft ueber Funnel A (17 Fragen, 2 Min)
 *
 * Diese Seite bleibt aus SEO-Sicht erhalten (eigener URL-Slug, Impressionen),
 * fungiert aber jetzt als Landing, die ueber die Vorteile aufklaert und zum
 * funktionierenden Funnel A weiterleitet.
 */
const Wertermittlung = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || BRAND.name;
  const supportPhone = settings?.support_phone || "";
  const contactEmail = settings?.contact_email || BRAND.supportEmail;

  return (
    <PageLayout
      breadcrumbs={true}
      title="Küchen-Wertermittlung — kostenlos in 24 h"
      description={`Lassen Sie Ihre gebrauchte Küche kostenlos und unverbindlich von ${siteName}-Experten bewerten. Professionelle Einschätzung des Marktwerts basierend auf Hersteller, Alter, Ausstattung und Zustand.`}
      keywords="Küchen-Wertermittlung, Küche bewerten, Küchenwert ermitteln, gebrauchte Küche Wert, Nobilia Wert, Häcker Wert, Küchenbewertung"
      canonicalPath="/wertermittlung"
      structuredData={[
        generateServiceSchema(
          "Kostenlose Küchen-Wertermittlung",
          "Professionelle Bewertung Ihrer gebrauchten Küche durch geprüfte Küchen-Händler. Kostenlos und unverbindlich.",
        ),
        generateBreadcrumbSchema(getBreadcrumbsFromPath("/wertermittlung")),
      ]}
    >
      <PageHero>
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Kostenlose Küchen-Wertermittlung
          </h1>
          <div className="flex justify-center mb-4">
            <ReviewStarsBadge size="md" variant="full" link linkTo="/wertrechner#reviews" />
          </div>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8">
            Erfahren Sie den aktuellen Marktwert Ihrer Küche — kostenlos,
            unverbindlich und von Experten bewertet.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span>100 % kostenlos</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span>Unverbindlich</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span>Experten-Einschätzung</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/funnel/a">
              <Button
                size="lg"
                className="w-full sm:w-auto gradient-hero hover:gradient-hero-hover shadow-lg hover:shadow-glow"
              >
                Jetzt kostenlos bewerten
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </PageHero>

      <div className="container py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Process */}
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6">
              So funktioniert die Wertermittlung
            </h2>
            <div className="space-y-6">
              {[
                {
                  step: "1",
                  title: "Daten eingeben",
                  description:
                    "17 einfache Fragen zu Ihrer Küche — Hersteller, Alter, Ausstattung, Grundriss, Geräte. Dauer: ca. 2 Minuten.",
                  icon: Calculator,
                },
                {
                  step: "2",
                  title: "Experten-Analyse",
                  description:
                    "Unsere geprüften Küchen-Händler analysieren den aktuellen Markt und vergleichen mit ähnlichen verkauften Küchen.",
                  icon: Users,
                },
                {
                  step: "3",
                  title: "Bewertung erhalten",
                  description:
                    "Sie erhalten eine detaillierte Einschätzung des Marktwerts — auf Wunsch inklusive konkreter Angebote mehrerer Händler.",
                  icon: Euro,
                },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <item.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link to="/funnel/a">
                <Button
                  size="lg"
                  className="w-full gradient-hero hover:gradient-hero-hover"
                >
                  Bewertung starten
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Benefits + Contact */}
          <div className="space-y-6">
            <Card className="p-6 bg-muted/50">
              <h3 className="font-semibold mb-4">Ihre Vorteile</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Euro, text: "100 % kostenlos" },
                  { icon: Clock, text: "Antwort in 24 h" },
                  { icon: Shield, text: "Unverbindlich" },
                  { icon: Award, text: "Experten-Team" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <item.icon className="w-5 h-5 text-primary" />
                    <span className="text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4">Lieber telefonisch?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Unser Küchen-Experten-Team berät Sie gerne persönlich —
                Mo–Fr von 8:00–18:00 Uhr.
              </p>
              <div className="space-y-3">
                {supportPhone && (
                  <a
                    href={`tel:${supportPhone.replace(/\s/g, "")}`}
                    className="flex items-center gap-3 text-primary hover:underline font-semibold"
                  >
                    <Phone className="w-5 h-5" />
                    {supportPhone}
                  </a>
                )}
                <a
                  href={`mailto:${contactEmail}`}
                  className="flex items-center gap-3 text-primary hover:underline font-semibold"
                >
                  <Mail className="w-5 h-5" />
                  {contactEmail}
                </a>
              </div>
            </Card>

            <Card className="p-6 border-primary/30 bg-primary/5">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Tipp: Sofort-Schätzung
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Unser <strong>{siteName}-Wertrechner</strong> liefert Ihnen eine
                erste Richtwert-Schätzung sofort online — ohne Anmeldung und
                ohne Warten.
              </p>
              <Link to="/wertrechner">
                <Button variant="outline" className="w-full">
                  Zum Wertrechner
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Wertermittlung;
