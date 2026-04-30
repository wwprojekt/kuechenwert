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
  Eye,
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
 * Kuechenstudios & Showrooms (Phase 3.9 Rebuild, Phase 3 Re-Rebrand).
 *
 * Alte Logik (CaravanWert): "Ankaufstationen" fuer gebrauchte Fahrzeuge.
 *
 * Neue Logik (KueWert): Lokale Partner aus dem Studio-Netzwerk, die
 *   1) Beratung und Aufmass vor Ort anbieten (Showroom-Besuch)
 *   2) Die finale Montage beim Kunden durchfuehren
 *   3) Nachbetreuung leisten (Service, Ersatzteile)
 *
 * Kein "Ankauf" von Gebraucht-Kuechen — der Kunde PLANT eine NEUE Kueche.
 * Das Partner-Netzwerk ist das lokale Schaufenster unserer Funnels.
 *
 * Das DB-Objekt `purchase_stations` wird weiter gelesen (gleicher Record-Typ),
 * aber semantisch als "Studio-Partner / Showroom" interpretiert. Alle CTAs
 * fuehren in Funnel A (Angebote einholen).
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
      title={`Küchenstudios & Showrooms in Ihrer Nähe | ${BRAND.name}`}
      description={`Lokale ${BRAND.name}-Partner-Studios: Showroom-Besuch, Vor-Ort-Beratung, Aufmass und Montage. Finden Sie Ihren passenden Studio-Partner oder starten Sie direkt mit einer kostenlosen Anfrage.`}
      keywords="küchenstudio nähe, küchen showroom, küchen vor ort beratung, küchen partner, küchen montage"
      canonicalPath="/ankaufstationen"
      structuredData={[
        generateServiceSchema(
          "Küchenstudio-Partner & Showrooms",
          `Lokale Partner aus dem ${BRAND.name}-Netzwerk bieten Ihnen Showroom-Besuch, individuelle Beratung, Aufmass und fachgerechte Montage Ihrer neuen Küche.`
        ),
        generateBreadcrumbSchema(getBreadcrumbsFromPath("/ankaufstationen")),
      ]}
    >
      <PageHero size="md">
        <div className="text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 flex items-center justify-center gap-3">
            <Building2 className="w-10 h-10 text-primary" />
            Küchenstudios &amp; Showrooms
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Lokale Küchenstudios, Fachhändler und Möbelhäuser aus dem {BRAND.name}-Netzwerk –
            Vor-Ort-Beratung, Showroom-Besuche und fachgerechte Montage Ihrer neuen Küche.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/funnel/a">
              <Button size="lg" className="gap-2">
                Kostenlose Angebote erhalten
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
                Wir bauen unser Studio-Netzwerk gerade auf
              </h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Aktuell arbeiten wir mit regionalen Küchenstudios, Fachhändlern und Möbelhäusern
                zusammen, die Sie persönlich beraten und Ihre neue Küche planen. Starten Sie mit
                der kostenlosen Anfrage — wir verbinden Sie mit passenden Partnern in Ihrer Region.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/funnel/a">
                  <Button size="lg" className="gap-2">
                    Kostenlose Anfrage starten
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
                            : "Mo-Fr: 10-18 Uhr"}
                        </p>
                      </div>
                    ) : null}

                    <Link to="/funnel/a" className="block">
                      <Button className="w-full mt-2 gap-2">
                        <span>Beratungstermin anfragen</span>
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
                <Eye className="w-5 h-5 text-primary" />
                Showroom-Besuch
              </h3>
              <p className="text-sm text-muted-foreground">
                Sehen, fühlen, erleben: Unsere Partner-Studios zeigen Ihnen Fronten,
                Arbeitsplatten und Geräte live – ohne Kaufdruck.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                Aufmass &amp; Montage
              </h3>
              <p className="text-sm text-muted-foreground">
                Vom professionellen Aufmass vor Ort bis zur finalen Installation:
                Ausgebildete Küchenmonteure kümmern sich um alle Details.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Faire Konditionen
              </h3>
              <p className="text-sm text-muted-foreground">
                Transparentes Angebot, rechtssicherer Vertrag und Nachbetreuung —
                alle Partner durchlaufen unser KYC/KYB-Prüfverfahren.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Ankaufstationen;
