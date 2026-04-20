import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import MotorhomeCard from "./MotorhomeCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const Listings = () => {
  const { data: auctions, isLoading } = useQuery({
    queryKey: ['home-auctions'],
    queryFn: async () => {
      // Performance: 2-Roundtrip-Strategie statt nested embed.
      // Hintergrund: Der vorherige `photos:motorhome_photos(url, display_order)`
      // Embed mit `.order(..., { referencedTable: 'motorhome.photos' })` und
      // `.limit(1, { referencedTable: 'motorhome.photos' })` funktioniert NICHT
      // korrekt mit PostgREST (400-Fehler beim nested order, Limit greift nicht
      // auf den Embed). Resultat war: pro Auction wurden ALLE ~20 Photos
      // mitgeschickt → ~80 Bilder im Browser für die Homepage statt 4.
      // Siehe Kaufen.tsx für die ausführliche Diagnose.
      //
      // Fix: Auctions ohne photos selecten, dann eine zweite Query auf
      // motorhome_photos mit display_order=0 (= Cover-Foto, DB-verifiziert).
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('auctions')
        .select(`
          id, motorhome_id, current_bid, starting_bid, end_time, created_at,
          last_price_reduction_at, marketing_phase_started_at,
          motorhome:motorhomes(
            id, manufacturer, model, year, mileage, body_type, country,
            instant_price, sale_channel, status, account_type,
            sleeping_places, seats, description
          )
        `)
        .eq('status', 'active')
        .gt('end_time', nowIso)
        .order('end_time', { ascending: true })
        .limit(4);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const motorhomeIds = data
        .map((a) => (a as unknown as { motorhome_id?: string }).motorhome_id)
        .filter((id): id is string => Boolean(id));

      // Cover-Foto + pre-resized card-Variante (480px, ~30 KB). card_url wird
      // asynchron von resize-photo-variants gefüllt; bis dahin Fallback auf
      // die Original-URL, damit Cards auch für unverarbeitete Photos laden.
      let coverByMotorhomeId = new Map<string, string>();
      if (motorhomeIds.length > 0) {
        const { data: photoRows } = await supabase
          .from('motorhome_photos')
          .select('url, card_url, motorhome_id')
          .in('motorhome_id', motorhomeIds)
          .eq('display_order', 0);

        if (photoRows) {
          coverByMotorhomeId = new Map(
            (photoRows as Array<{ url: string; card_url: string | null; motorhome_id: string }>)
              .filter((p) => (p.card_url || p.url) && p.motorhome_id)
              .map((p) => [p.motorhome_id, p.card_url || p.url])
          );
        }
      }

      return data.map((a) => {
        const typed = a as unknown as {
          motorhome_id?: string;
          motorhome?: { id?: string } | null;
        };
        const cover = typed.motorhome_id
          ? coverByMotorhomeId.get(typed.motorhome_id)
          : undefined;
        return {
          ...(a as object),
          motorhome: typed.motorhome
            ? {
                ...typed.motorhome,
                photos: cover ? [{ url: cover, display_order: 0 }] : [],
              }
            : null,
        };
      });
    }
  });
  return (
    <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-muted/30 cv-auto">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-10 lg:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4">
            Aktuelle Wohnmobil-Angebote
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
            Entdecken Sie unsere neuesten Ankaufsangebote von geprüften Händlern
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 mb-6 sm:mb-8">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-[200px] w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))
          ) : auctions && auctions.length > 0 ? (
            auctions.map((auction) => {
              const motorhome = auction.motorhome;
              if (!motorhome) return null;

              // Server liefert pro Listing nur die erste Foto-Zeile (geordnet
              // nach display_order). Kein clientseitiges Sortieren mehr nötig.
              const primaryPhoto = motorhome.photos?.[0]?.url || '';
              
              return (
                <MotorhomeCard
                  key={auction.id}
                  id={motorhome.id}
                  title={motorhome.description || `${motorhome.manufacturer} ${motorhome.model}`}
                  manufacturer={motorhome.manufacturer}
                  model={motorhome.model}
                  year={motorhome.year}
                  mileage={motorhome.mileage}
                  image={primaryPhoto}
                  beds={motorhome.sleeping_places}
                  passengers={motorhome.seats}
                  bodyType={motorhome.body_type}
                  isAuction={true}
                  currentBid={auction.current_bid}
                  startingBid={auction.starting_bid}
                  instantPrice={motorhome.instant_price}
                  saleChannel={motorhome.sale_channel}
                  endTime={auction.end_time}
                  status={motorhome.status}
                  lastPriceReductionAt={(auction as any).last_price_reduction_at}
                  marketingPhaseStartedAt={(auction as any).marketing_phase_started_at}
                  auctionCreatedAt={auction.created_at}
                  linkTo={`/auktion/${auction.id}`}
                />
              );
            })
          ) : (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Derzeit sind keine aktiven Auktionen verfügbar.
            </div>
          )}
        </div>

        <div className="text-center">
          <Button 
            variant="outline" 
            size="lg" 
            className="border-2 hover-lift-sm h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base w-full sm:w-auto"
            asChild
          >
            <Link to="/kaufen">
              Alle Angebote anzeigen
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Listings;
