import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  Building2,
  ArrowRight,
  Truck,
  Wrench,
  Loader2,
  Handshake,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { Link } from "react-router-dom";
import { BRAND } from "@/lib/brand";
import {
  generateServiceSchema,
  generateBreadcrumbSchema,
  getBreadcrumbsFromPath,
} from "@/lib/seo";

/**
 * Ankaufstationen / Montage-Partner (Phase 3.9 Rebuild).
 *
 * Alte Logik (CaravanWert): Kunden waehlen eine lokale Ankaufstation, geben
 * Fahrzeugdaten ein, Station kauft vor Ort bar auf.
 *
 * Neue Logik (KueWert): Lokale Montage- & Ankauf-Partner (Kuechenstudios,
 * Schreinereien, Entsorgungsfirmen) die auf Wunsch die Kueche vor Ort
 * besichtigen, demontieren und abholen. Der eigentliche Ankauf laeuft
 * weiterhin ueber den Funnel (/funnel/a). Diese Seite ist das
 * Marketing-Schaufenster fuer das Partner-Netzwerk.
 *
 * Das DB-Objekt `purchase_stations` wird weiter gelesen (gleicher Record-Typ),
 * aber semantisch als "Montage-Partner" interpretiert. Das vehicle-
 * Inquiry-Formular wurde entfernt – stattdessen verlinken wir auf /funnel/a.
 */
interface MontagePartner {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string;
  manager_name: string | null;
  accepts_cash_payment: boolean;
  accepts_sepa_instant: boolean;
  opening_hours: unknown;
}

const Ankaufstationen = () => {
  const [partners, setPartners] = useState<MontagePartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchPartners = async () => {
      try {
        const { data, error } = await supabase
          .from("purchase_stations")
          .select("*")
          .eq("is_active", true)
          .order("city");
        if (error) throw error;
        if (!cancelled) setPartners((data as MontagePartner[]) ?? []);
      } catch (error) {
        logger.error("Error fetching montage partners:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchPartners();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageLayout
      breadcrumbs={true}
      title={`Montage-Partner & Küchen-Showrooms | ${BRAND.name}`}
      description={`Lokale ${BRAND.name}-Partner in Ihrer Nähe: Küchen-Besichtigung, Demontage und Abholung vor Ort. Jetzt Partner finden oder kostenlose Küchen-Bewertung starten.`}
      keywords="küchen montage partner, küchen abholung, küchen demontage, küchenstudio partner, küchen-showroom"
      canonicalPath="/ankaufstationen"
      structuredData={[
        generateServiceSchema(
          "Küchen-Montage-Partner",
          `Lokale Partner aus dem ${BRAND.name}-Netzwerk übernehmen auf Wunsch Besichtigung, Demontage und Abholung Ihrer gebrauchten Küche.`
        ),
        generateBreadcrumbSchema(getBreadcrumbsFromPath("/ankaufstationen")),
      ]}
    >
      <PageHero size="md">
        <div className="text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 flex items-center justify-center gap-3">
            <Building2 className="w-10 h-10 text-primary" />
            Unsere Montage-Partner
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Lokale Küchenstudios, Schreinereien und Demontage-Profis aus dem {BRAND.name}-Netzwerk –
            auf Wunsch besichtigen, demontieren und holen sie Ihre Küche direkt vor Ort ab.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/funnel/a">
              <Button size="lg" className="gap-2">
                Kostenlose Küchen-Bewertung
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/haendler">
              <Button size="lg" variant="outline" className="gap-2">
                Partner werden
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </PageHero>

      <div className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
              <p className="text-muted-foreground">Lade Partner...</p>
            </div>
          ) : partners.length === 0 ? (
            <Card className="p-8 md:p-12 text-center max-w-3xl mx-auto">
              <Handshake className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-3">
                Wir bauen unser Partner-Netzwerk gerade auf
              </h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Aktuell arbeiten wir mit regionalen Küchen-Händlern und Demontage-Spezialisten
                zusammen, die Ihre Küche fachgerecht abholen. Starten Sie einfach die kostenlose
                Bewertung – wir verbinden Sie mit passenden Partnern in Ihrer Region.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/funnel/a">
                  <Button size="lg" className="gap-2">
                    Kostenlose Bewertung starten
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/haendler">
                  <Button size="lg" variant="outline" className="gap-2">
                    Als Partner bewerben
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {partners.map((partner) => (
                <Card
                  key={partner.id}
                  className="hover-lift shadow-elegant transition-all hover:border-primary/50"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      {partner.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{partner.city}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p>{partner.address}</p>
                        <p>
                          {partner.postal_code} {partner.city}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {partner.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <a
                            href={`tel:${partner.phone}`}
                            className="text-primary hover:underline"
                          >
                            {partner.phone}
                          </a>
                        </div>
                      )}
                      {partner.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <a
                            href={`mailto:${partner.email}`}
                            className="text-primary hover:underline break-all"
                          >
                            {partner.email}
                          </a>
                        </div>
                      )}
                    </div>

                    {partner.manager_name && (
                      <div className="text-sm text-muted-foreground">
                        Ansprechpartner: {partner.manager_name}
                      </div>
                    )}

                    {partner.opening_hours ? (
                      <div className="pt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Öffnungszeiten
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {typeof partner.opening_hours === "string"
                            ? partner.opening_hours
                            : "Mo-Fr: 9-18 Uhr"}
                        </p>
                      </div>
                    ) : null}

                    <Link to="/funnel/a" className="block">
                      <Button className="w-full mt-2 gap-2">
                        <span>Küchen-Anfrage starten</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Info Section */}
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                Abholung vor Ort
              </h3>
              <p className="text-sm text-muted-foreground">
                Unsere Partner holen Ihre Küche nach Terminabsprache bei Ihnen zuhause ab – auch
                aus oberen Etagen.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                Professionelle Demontage
              </h3>
              <p className="text-sm text-muted-foreground">
                Schreiner und Küchenmonteure demontieren Ihre Küche fachgerecht – Arbeitsplatte,
                Geräte, Unterschränke werden sauber getrennt.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Faire Abwicklung
              </h3>
              <p className="text-sm text-muted-foreground">
                Transparentes Angebot, sichere Bezahlung und ein vorgefertigter Kaufvertrag –
                auch bei Abholung durch einen Partner.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Ankaufstationen;
