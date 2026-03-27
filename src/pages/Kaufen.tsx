import PageLayout from "@/components/PageLayout";
import { logger } from "@/lib/logger";
import { AuctionCardSkeletonGrid } from "@/components/skeletons";
import PageHero from "@/components/PageHero";
import RelatedContent, { kaufenRelatedLinks } from "@/components/RelatedContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Search, Star, CheckCircle2, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { FilterSidebar, type FilterState } from "@/components/FilterSidebar";
import MotorhomeCard from "@/components/MotorhomeCard";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateServiceSchema } from "@/lib/seo";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { anonymizePostalCode } from "@/lib/plzCoordinates";
import type { Database } from "@/integrations/supabase/types";

type AuctionRow = Database["public"]["Tables"]["auctions"]["Row"];
type MotorhomeRow = Database["public"]["Tables"]["motorhomes"]["Row"];
type PhotoRow = Database["public"]["Tables"]["motorhome_photos"]["Row"];

interface AuctionWithMotorhome extends AuctionRow {
  motorhome: MotorhomeRow & {
    photos: PhotoRow[];
  };
}

const Kaufen = () => {
  const { settings } = useSettings();
  const { user } = useAuth();
  const { isDealer } = useUserRole();
  const [showSaveSearchDialog, setShowSaveSearchDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [saveSearchFrequency, setSaveSearchFrequency] = useState('immediate');
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [auctions, setAuctions] = useState<AuctionWithMotorhome[]>([]);
  const [bidCounts, setBidCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 500000],
    yearRange: [1990, 2026],
    vehicleTypes: [],
    brand: null,
    beds: null,
    searchQuery: "",
    // New Phase 3 filters
    countries: [],
    mileageMin: null,
    mileageMax: null,
    transmission: null,
    accidentFree: null,
    buyNowOnly: false,
  });
  const { toast } = useToast();

  const fetchAuctions = useCallback(async () => {
      try {
        // Fetch active auctions with motorhome details
        const { data: auctionData, error: auctionError } = await supabase
          .from("auctions")
          .select(`
            *,
            motorhome:motorhomes(
              *,
              photos:motorhome_photos(*)
            )
          `)
          .eq("status", "active")
          .order("end_time", { ascending: true });

        if (auctionError) throw auctionError;

        setAuctions(auctionData || []);

        // Fetch bid counts for each auction
        if (auctionData && auctionData.length > 0) {
          const counts: Record<string, number> = {};
          for (const auction of auctionData) {
            const { count } = await supabase
              .from("bids")
              .select("*", { count: "exact", head: true })
              .eq("auction_id", auction.id);
            counts[auction.id] = count || 0;
          }
          setBidCounts(counts);
        }
      } catch (error: unknown) {
        logger.error("Error fetching auctions:", error);
        toast({
          title: "Fehler",
          description: "Auktionen konnten nicht geladen werden",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
  }, [toast]);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  // Real-time updates for new auctions with stale update prevention
  useEffect(() => {
    let isSubscribed = true; // Track mount state
    
    const channel = supabase
      .channel("auctions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auctions",
          filter: "status=eq.active",
        },
        () => {
          // Guard: Only refetch if component is still mounted
          if (!isSubscribed) return;
          fetchAuctions();
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false; // Mark as unmounted
      supabase.removeChannel(channel);
    };
  }, [fetchAuctions]);

  // Apply filters to auctions
  const filteredAuctions = useMemo(() => {
    return auctions.filter((auction) => {
      const motorhome = auction.motorhome;
      if (!motorhome) return false;

      // Price filter
      const currentPrice = auction.current_bid || auction.starting_bid || 0;
      if (currentPrice < filters.priceRange[0] || currentPrice > filters.priceRange[1]) {
        return false;
      }

      // Year filter
      if (motorhome.year < filters.yearRange[0] || motorhome.year > filters.yearRange[1]) {
        return false;
      }

      // Vehicle type filter
      if (filters.vehicleTypes.length > 0 && !filters.vehicleTypes.includes(motorhome.body_type)) {
        return false;
      }

      // Brand filter
      if (filters.brand && motorhome.manufacturer !== filters.brand) {
        return false;
      }

      // Beds filter
      if (filters.beds) {
        const bedsNum = parseInt(filters.beds);
        const motorhomeBeds = motorhome.beds || 0;
        if (filters.beds === "6") {
          if (motorhomeBeds < 6) return false;
        } else {
          if (motorhomeBeds !== bedsNum) return false;
        }
      }

      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const manufacturer = (motorhome.manufacturer || "").toLowerCase();
        const model = (motorhome.model || "").toLowerCase();
        if (!manufacturer.includes(query) && !model.includes(query)) {
          return false;
        }
      }

      // Country filter (Phase 3)
      if (filters.countries.length > 0) {
        const motorhomeCountry = (motorhome as any).country || 'DE';
        if (!filters.countries.includes(motorhomeCountry)) {
          return false;
        }
      }

      // Mileage filter (Phase 3)
      if (filters.mileageMin !== null && motorhome.mileage < filters.mileageMin) {
        return false;
      }
      if (filters.mileageMax !== null && motorhome.mileage > filters.mileageMax) {
        return false;
      }

      // Transmission filter (Phase 3)
      if (filters.transmission && motorhome.transmission !== filters.transmission) {
        return false;
      }

      // Accident free filter (Phase 3)
      if (filters.accidentFree === true && motorhome.accident_free !== true) {
        return false;
      }

      // Buy Now filter (Phase 3)
      if (filters.buyNowOnly) {
        const hasInstantPrice = motorhome.instant_price && 
          motorhome.sale_channel === 'instant_price';
        if (!hasInstantPrice) {
          return false;
        }
      }

      return true;
    });
  }, [auctions, filters]);

  const benefits = [
    {
      icon: Shield,
      title: "Geprüfte Qualität",
      description: "Alle Fahrzeuge werden von unseren Experten gründlich geprüft und aufbereitet."
    },
    {
      icon: Star,
      title: "Große Auswahl",
      description: "Über 500 Wohnmobile und Wohnwagen verschiedener Marken und Preisklassen."
    },
    {
      icon: CheckCircle2,
      title: "Garantie inklusive",
      description: "12 Monate Garantie auf alle Fahrzeuge für Ihre Sicherheit."
    },
    {
      icon: Search,
      title: "Transparente Preise",
      description: "Faire Preisgestaltung ohne versteckte Kosten oder Überraschungen."
    }
  ];

  // Service structured data
  const serviceSchema = generateServiceSchema(
    'Wohnmobil Kauf Service',
    'Große Auswahl an geprüften Wohnmobilen und Wohnwagen. Faire Preise, 12 Monate Garantie und persönliche Beratung.'
  );

  return (
    <PageLayout
      breadcrumbs={true}
      title="Wohnmobil Kaufen"
      description="Große Auswahl an geprüften Wohnmobilen und Wohnwagen. Faire Preise, 12 Monate Garantie und persönliche Beratung an 6 Standorten in Deutschland."
      keywords="wohnmobil kaufen, wohnwagen kaufen, camper kaufen, gebrauchte wohnmobile, wohnmobil ankaufstationen"
      canonicalPath="/kaufen"
      structuredData={serviceSchema}
    >
      {/* Hero Section */}
      <PageHero size="sm">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
            Wohnmobile <span className="gradient-text">kaufen</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-6">
            Entdecken Sie unsere große Auswahl an geprüften Wohnmobilen. Qualität, Transparenz und faire Preise.
          </p>
        </div>
      </PageHero>

      {/* Main Content: Sidebar + Listings */}
      <section className="py-12 md:py-16">
        <div className="container">
          <div className="grid lg:grid-cols-[300px_1fr] gap-8">
            {/* Sidebar */}
            <aside className="lg:sticky lg:top-24 h-fit">
              <FilterSidebar 
                onFilterChange={setFilters}
                resultCount={filteredAuctions.length}
              />
            </aside>

            {/* Listings Grid */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">
                    {isLoading ? "L\u00e4dt..." : `${filteredAuctions.length} Auktionen gefunden`}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Aktive Auktionen</p>
                </div>
                {user && isDealer && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setSaveSearchName('');
                      setShowSaveSearchDialog(true);
                    }}
                  >
                    <Bell className="h-4 w-4" />
                    <span className="hidden sm:inline">Suche speichern</span>
                  </Button>
                )}
              </div>

              {/* Save Search Dialog */}
              {showSaveSearchDialog && (
                <div className="mb-6 p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
                  <h3 className="font-semibold mb-3">Suchauftrag speichern</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Erhalten Sie eine Benachrichtigung, wenn neue Fahrzeuge Ihren Kriterien entsprechen.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Name des Suchauftrags</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        placeholder="z.B. Kastenwagen unter 50.000\u20ac"
                        value={saveSearchName}
                        onChange={(e) => setSaveSearchName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Benachrichtigungsfrequenz</label>
                      <select
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        value={saveSearchFrequency}
                        onChange={(e) => setSaveSearchFrequency(e.target.value)}
                      >
                        <option value="immediate">Sofort</option>
                        <option value="daily">T\u00e4glich</option>
                        <option value="weekly">W\u00f6chentlich</option>
                      </select>
                    </div>
                    <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                      <strong>Aktuelle Filter:</strong>{' '}
                      {filters.brand ? `Marke: ${filters.brand}` : 'Alle Marken'}
                      {filters.vehicleTypes.length > 0 ? ` \u2022 Typ: ${filters.vehicleTypes.join(', ')}` : ''}
                      {filters.priceRange[1] < 500000 ? ` \u2022 Max: \u20ac${filters.priceRange[1].toLocaleString('de-DE')}` : ''}
                      {filters.yearRange[0] > 1990 ? ` \u2022 Ab ${filters.yearRange[0]}` : ''}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSaveSearchDialog(false)}
                      >
                        Abbrechen
                      </Button>
                      <Button
                        size="sm"
                        disabled={!saveSearchName.trim() || isSavingSearch}
                        onClick={async () => {
                          if (!user || !saveSearchName.trim()) return;
                          setIsSavingSearch(true);
                          try {
                            const criteria: Record<string, any> = {};
                            if (filters.brand) criteria.manufacturer = filters.brand;
                            if (filters.vehicleTypes.length > 0) criteria.body_type = filters.vehicleTypes[0];
                            if (filters.priceRange[1] < 500000) criteria.max_price = filters.priceRange[1];
                            if (filters.yearRange[0] > 1990) criteria.min_year = filters.yearRange[0];
                            if (filters.yearRange[1] < 2026) criteria.max_year = filters.yearRange[1];
                            if (filters.beds) criteria.sleeping_places = parseInt(filters.beds);

                            const { error } = await supabase
                              .from('search_alerts')
                              .insert({
                                dealer_id: user.id,
                                alert_name: saveSearchName.trim(),
                                search_criteria: criteria,
                                email_enabled: true,
                                alert_frequency: saveSearchFrequency,
                                max_price: criteria.max_price || null,
                                is_active: true,
                              });

                            if (error) throw error;

                            toast({
                              title: 'Suchauftrag gespeichert',
                              description: 'Sie erhalten Benachrichtigungen bei passenden Fahrzeugen.',
                            });
                            setShowSaveSearchDialog(false);
                          } catch (error) {
                            logger.error('Error saving search alert:', error);
                            toast({
                              title: 'Fehler',
                              description: 'Der Suchauftrag konnte nicht gespeichert werden.',
                              variant: 'destructive',
                            });
                          } finally {
                            setIsSavingSearch(false);
                          }
                        }}
                      >
                        {isSavingSearch ? 'Speichert...' : 'Speichern'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {isLoading ? (
                <AuctionCardSkeletonGrid count={6} />
              ) : filteredAuctions.length > 0 ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredAuctions.map((auction) => {
                    const firstPhoto = auction.motorhome?.photos?.sort((a: any, b: any) => 
                      a.display_order - b.display_order
                    )[0]?.url;
                    
                    return (
                      <MotorhomeCard
                        key={auction.id}
                        id={auction.id}
                        title={`${auction.motorhome?.manufacturer || ''} ${auction.motorhome?.model || ''}`}
                        manufacturer={auction.motorhome?.manufacturer || 'Unbekannt'}
                        model={auction.motorhome?.model || ''}
                        year={auction.motorhome?.year || 0}
                        mileage={auction.motorhome?.mileage || 0}
                        image={firstPhoto || ''}
                        listingNumber={auction.motorhome?.listing_number}
                        bodyType={auction.motorhome?.body_type}
                        country={auction.motorhome?.country}
                        location={auction.motorhome?.postal_code ? anonymizePostalCode(auction.motorhome.postal_code) : undefined}
                        isAuction={true}
                        currentBid={auction.current_bid}
                        startingBid={auction.starting_bid}
                        instantPrice={auction.motorhome?.instant_price}
                        saleChannel={auction.motorhome?.sale_channel}
                        endTime={auction.end_time}
                        bidCount={bidCounts[auction.id] || 0}
                        status={auction.motorhome?.status}
                        linkTo={`/auktion/${auction.id}`}
                      />
                    );
                  })}
                </div>
              ) : (
                <Card className="p-12">
                  <div className="text-center">
                    <p className="text-xl font-semibold text-muted-foreground mb-2">
                      Keine aktiven Auktionen
                    </p>
                    <p className="text-muted-foreground">
                      Aktuell sind keine Auktionen verfügbar. Schauen Sie später wieder vorbei!
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Warum bei uns kaufen?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Vertrauen Sie auf unsere Expertise und profitieren Sie von zahlreichen Vorteilen beim Fahrzeugkauf.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="hover-lift border-2 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardHeader>
                  <div className="h-14 w-14 rounded-xl gradient-hero flex items-center justify-center mb-4 shadow-glow-sm">
                    <benefit.icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-xl">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{benefit.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Buying Process */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">So kaufen Sie bei uns</h2>
              <p className="text-lg text-muted-foreground">
                Einfach, transparent und sicher - Ihr Weg zum neuen Wohnmobil in 4 Schritten.
              </p>
            </div>

            <div className="space-y-8">
              {[
                {
                  step: "1",
                  title: "Fahrzeug aussuchen",
                  description: "Durchsuchen Sie unsere aktuellen Angebote online oder besuchen Sie uns vor Ort für eine persönliche Beratung."
                },
                {
                  step: "2",
                  title: "Probefahrt vereinbaren",
                  description: "Testen Sie Ihr Wunschfahrzeug ausgiebig. Unsere Experten beantworten alle Ihre Fragen."
                },
                {
                  step: "3",
                  title: "Finanzierung klären",
                  description: "Wir helfen Ihnen bei der Finanzierung und erstellen individuelle Angebote für Sie."
                },
                {
                  step: "4",
                  title: "Fahrzeug übernehmen",
                  description: "Nach der Vertragsunterzeichnung können Sie Ihr neues Wohnmobil sofort mitnehmen."
                }
              ].map((item, index) => (
                <div key={index} className="flex gap-6 items-start animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="h-16 w-16 rounded-xl gradient-hero flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-lg">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SEO Content */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="max-w-4xl mx-auto prose prose-lg">
            <h2 className="text-3xl font-bold mb-6">Wohnmobil kaufen - Worauf sollten Sie achten?</h2>
            
            <h3 className="text-2xl font-bold mt-8 mb-4">Welches Wohnmobil passt zu mir?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Die Wahl des richtigen Wohnmobils hängt von Ihren individuellen Bedürfnissen ab. Berücksichtigen Sie die Anzahl der Reisenden, 
              Ihre bevorzugten Reiseziele, die geplante Nutzungshäufigkeit und Ihr Budget. Unsere Berater helfen Ihnen gerne, 
              das perfekte Fahrzeug zu finden.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">Gebraucht oder neu kaufen?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Gebrauchte Wohnmobile bieten ein ausgezeichnetes Preis-Leistungs-Verhältnis. Alle unsere Fahrzeuge werden gründlich geprüft 
              und mit 12 Monaten Garantie ausgeliefert. So erhalten Sie Qualität zum fairen Preis mit der Sicherheit eines Neukaufs.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">Welche Finanzierungsmöglichkeiten gibt es?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Wir bieten flexible Finanzierungslösungen an, die auf Ihre persönliche Situation zugeschnitten sind. Von klassischen 
              Ratenkrediten bis zu Leasing-Modellen - wir finden gemeinsam die beste Option für Sie.
            </p>
          </div>
        </div>
      </section>

      {/* Related Content for Internal Linking */}
      <RelatedContent
        title="Weitere Informationen"
        description="Hilfreiche Ressourcen für Ihren Wohnmobil-Kauf"
        links={kaufenRelatedLinks}
      />

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary via-primary-light to-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Besuchen Sie uns!</h2>
            <p className="text-xl mb-8 opacity-95">
              Vereinbaren Sie noch heute einen Termin für eine Probefahrt oder lassen Sie sich persönlich beraten.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/kontakt">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Termin vereinbaren
                </Button>
              </Link>
              {settings?.support_phone && (
                <a href={`tel:${settings.support_phone.replace(/\s/g, '')}`}>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 border-white/30 hover:bg-white/20 text-white">
                    Jetzt anrufen
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default Kaufen;
