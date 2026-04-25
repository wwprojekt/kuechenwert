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
      // ─────────────────────────────────────────────────────────────────
      // PRIMARY: Edge-Cached Worker (caravanwert.de/api/auctions/active)
      // ─────────────────────────────────────────────────────────────────
      // Liefert vorgekochtes JSON mit ALLEN active Auctions (CF KV cache).
      // Wir brauchen für die Homepage nur die ersten 4 (sortiert nach
      // end_time asc) — slice ist negligible.
      // Bei Fehler/Timeout (>3 s): transparent fallback auf direkte Queries.
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 3000);
        const res = await fetch('/api/auctions/active', {
          signal: controller.signal,
          credentials: 'omit',
          headers: { accept: 'application/json' },
        });
        window.clearTimeout(timeoutId);
        if (res.ok) {
          const payload = (await res.json()) as { auctions?: unknown[] };
          const list = Array.isArray(payload.auctions) ? payload.auctions : [];
          // Worker liefert pro Auction motorhome.photos = [{url, medium_url, display_order}]
          // → exakt das Format das die Render-Logik unten erwartet.
          return list.slice(0, 4) as Array<{
            id: string;
            current_bid: number | null;
            starting_bid: number | null;
            end_time: string;
            created_at: string;
            start_time?: string | null;
            auction_round?: number | null;
            last_price_reduction_at?: string | null;
            marketing_phase_started_at?: string | null;
            motorhome_id?: string | null;
            motorhome: {
              id: string;
              manufacturer: string;
              model: string;
              year: number;
              mileage: number;
              body_type: string | null;
              country: string | null;
              instant_price: number | null;
              sale_channel: string | null;
              status: string;
              account_type: string | null;
              sleeping_places: number | null;
              seats: number | null;
              description: string | null;
              photos: Array<{ url: string; medium_url: string | null; display_order: number }>;
            } | null;
          }>;
        }
      } catch {
        // Network-Error, AbortError, JSON-Parse — fallback unten
      }

      // ─────────────────────────────────────────────────────────────────
      // FALLBACK: Direkte 2-Roundtrip-Strategie (auctions + photos).
      // (Hintergrund: nested embed `motorhome.photos(...)` mit referencedTable
      // order/limit ist in PostgREST buggy, deshalb 2 Queries — siehe Kaufen.tsx.)
      // ─────────────────────────────────────────────────────────────────
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('auctions')
        .select(`
          id, motorhome_id, current_bid, starting_bid, end_time, created_at,
          start_time, auction_round,
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

      // Cover-Foto + pre-resized Varianten:
      //  - card_url   480px WebP (~10-25 KB) — Standard-Render
      //  - medium_url 1024px WebP (~50-100 KB) — Retina via srcset
      // Async befüllt von der process-photo Edge Function (post-upload).
      // Fallback: card_url || medium_url || url, damit unprozessierte Photos
      // weiterhin gerendert werden.
      type Cover = { small: string; medium: string | null };
      let coverByMotorhomeId = new Map<string, Cover>();
      if (motorhomeIds.length > 0) {
        const { data: photoRows } = await supabase
          .from('motorhome_photos')
          .select('url, card_url, medium_url, motorhome_id')
          .in('motorhome_id', motorhomeIds)
          .eq('display_order', 0);

        if (photoRows) {
          coverByMotorhomeId = new Map(
            (photoRows as Array<{
              url: string;
              card_url: string | null;
              medium_url: string | null;
              motorhome_id: string;
            }>)
              .filter((p) => (p.card_url || p.medium_url || p.url) && p.motorhome_id)
              .map((p) => [
                p.motorhome_id,
                {
                  small: p.card_url || p.medium_url || p.url,
                  medium: p.medium_url,
                },
              ])
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
                photos: cover
                  ? [{ url: cover.small, medium_url: cover.medium, display_order: 0 }]
                  : [],
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
            auctions.map((auction, idx) => {
              const motorhome = auction.motorhome;
              if (!motorhome) return null;

              // Server liefert pro Listing nur die erste Foto-Zeile (geordnet
              // nach display_order). Kein clientseitiges Sortieren mehr nötig.
              const primaryPhoto = motorhome.photos?.[0]?.url || '';
              const primaryPhotoMedium = (motorhome.photos?.[0] as
                | { medium_url?: string | null }
                | undefined)?.medium_url;

              // Erste 4 Cards (xl:grid-cols-4) sind LCP-Kandidaten auf der
              // Homepage. eager + fetchpriority spart laut Lighthouse ~10 s.
              const isAboveFold = idx < 4;

              return (
                <MotorhomeCard
                  key={auction.id}
                  priority={isAboveFold}
                  id={motorhome.id}
                  title={motorhome.description || `${motorhome.manufacturer} ${motorhome.model}`}
                  manufacturer={motorhome.manufacturer}
                  model={motorhome.model}
                  year={motorhome.year}
                  mileage={motorhome.mileage}
                  image={primaryPhoto}
                  imageMedium={primaryPhotoMedium ?? null}
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
                  auctionStartTime={(auction as { start_time?: string | null }).start_time ?? null}
                  auctionRound={(auction as { auction_round?: number | null }).auction_round ?? null}
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
