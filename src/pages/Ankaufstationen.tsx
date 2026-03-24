import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Mail, Clock, CheckCircle2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { Link } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";
import { generateServiceSchema, generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";

interface PurchaseStation {
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
  opening_hours: any;
}

const Ankaufstationen = () => {
  const [stations, setStations] = useState<PurchaseStation[]>([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();
  const siteName = settings?.site_name || 'CaravanWert';

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_stations')
        .select('*')
        .eq('is_active', true)
        .order('city');

      if (error) throw error;
      setStations(data || []);
    } catch (error) {
      logger.error('Error fetching stations:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout
      breadcrumbs={true}
      title="Ankaufstationen – Wohnmobil vor Ort abgeben"
      description="Finden Sie eine CaravanWert-Ankaufstation in Ihrer Nähe. Persönliche Übergabe, sofortige Barzahlung und professionelle Abwicklung deutschlandweit."
      keywords="ankaufstation, wohnmobil übergabe, abgabestelle, wohnmobil verkaufen vor ort"
      canonicalPath="/ankaufstationen"
      structuredData={[generateServiceSchema("Wohnmobil-Ankaufstation", "Persönliche Übergabe Ihres Wohnmobils an einer unserer Ankaufstationen mit sofortiger Barzahlung."), generateBreadcrumbSchema(getBreadcrumbsFromPath("/ankaufstationen"))]}
    >
      <PageHero size="md">
        <div className="text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 flex items-center justify-center gap-3">
            <Building2 className="w-10 h-10 text-primary" />
            Unsere Ankaufstationen
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Besuchen Sie eine unserer Ankaufstationen für die persönliche Übergabe Ihres Wohnmobils und erhalten Sie sofortige Bezahlung
          </p>
        </div>
      </PageHero>
      
      <div className="py-12 md:py-20">
        <div className="container mx-auto px-4">

          {/* Stations Grid */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Lade Stationen...</p>
            </div>
          ) : stations.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Derzeit sind keine Ankaufstationen verfügbar.</p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stations.map((station) => (
                <Card key={station.id} className="hover-lift shadow-elegant">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      {station.name}
                    </CardTitle>
                    <CardDescription>{station.city}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Address */}
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p>{station.address}</p>
                        <p>{station.postal_code} {station.city}</p>
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a href={`tel:${station.phone}`} className="text-primary hover:underline">
                          {station.phone}
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <a href={`mailto:${station.email}`} className="text-primary hover:underline">
                          {station.email}
                        </a>
                      </div>
                    </div>

                    {/* Manager */}
                    {station.manager_name && (
                      <div className="text-sm text-muted-foreground">
                        Ansprechpartner: {station.manager_name}
                      </div>
                    )}

                    {/* Payment Methods */}
                    <div className="pt-4 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Zahlungsmethoden:</p>
                      <div className="flex flex-wrap gap-2">
                        {station.accepts_cash_payment && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                            <CheckCircle2 className="w-3 h-3" />
                            Barzahlung
                          </span>
                        )}
                        {station.accepts_sepa_instant && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                            <CheckCircle2 className="w-3 h-3" />
                            SEPA Instant
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Opening Hours */}
                    {station.opening_hours && (
                      <div className="pt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Öffnungszeiten
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {typeof station.opening_hours === 'string' 
                            ? station.opening_hours 
                            : 'Mo-Fr: 9-18 Uhr'}
                        </p>
                      </div>
                    )}

                    <Button asChild className="w-full mt-4">
                      <Link to={`/verkaufen/wizard?station=${station.id}`}>
                        Termin vereinbaren
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Info Section */}
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Schnelle Abwicklung
              </h3>
              <p className="text-sm text-muted-foreground">
                Übergabe und Bezahlung erfolgen direkt vor Ort innerhalb von 30 Minuten
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Sichere Zahlung
              </h3>
              <p className="text-sm text-muted-foreground">
                Wählen Sie zwischen Barzahlung oder sofortiger SEPA-Überweisung
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Professionelle Übergabe
              </h3>
              <p className="text-sm text-muted-foreground">
                Vollständige Dokumentation mit digitalem Übergabeprotokoll
              </p>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Ankaufstationen;