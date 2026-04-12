import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import VehicleCard from "./VehicleCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const Listings = () => {
  const { data: auctions, isLoading } = useQuery({
    queryKey: ['home-auctions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auctions')
        .select(`
          *,
          vehicle:vehicles(
            *,
            photos:vehicle_photos(*)
          )
        `)
        .eq('status', 'active')
        .order('end_time', { ascending: true })
        .limit(4);

      if (error) throw error;
      return data;
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
              const vehicle = auction.vehicle;
              if (!vehicle) return null;

              const sortedPhotos = [...(vehicle.photos || [])].sort(
                (a: any, b: any) => (a.display_order ?? 999) - (b.display_order ?? 999)
              );
              const primaryPhoto = sortedPhotos[0]?.url || '';
              
              return (
                <VehicleCard
                  key={auction.id}
                  id={vehicle.id}
                  title={vehicle.description || `${vehicle.manufacturer} ${vehicle.model}`}
                  manufacturer={vehicle.manufacturer}
                  model={vehicle.model}
                  year={vehicle.year}
                  mileage={vehicle.mileage}
                  image={primaryPhoto}
                  beds={vehicle.sleeping_places}
                  passengers={vehicle.seats}
                  bodyType={vehicle.body_type}
                  isAuction={true}
                  currentBid={auction.current_bid}
                  startingBid={auction.starting_bid}
                  instantPrice={vehicle.instant_price}
                  saleChannel={vehicle.sale_channel}
                  endTime={auction.end_time}
                  status={vehicle.status}
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
