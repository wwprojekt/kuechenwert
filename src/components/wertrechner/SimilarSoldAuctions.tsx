import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AUCTION_PUBLIC_COLUMNS } from "@/lib/auction-columns";
import { BODY_TYPE_TO_DB_ENUM } from "@/lib/valuation/bodyTypes";
import { proxiedImageUrl } from "@/lib/imageTransform";
import { TrendingUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SoldAuctionCard {
  id: string;
  motorhome_id: string;
  current_bid: number;
  end_time: string;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  body_type: string | null;
  photo_url: string | null;
}

interface Props {
  vehicleType: string;
  bodyType: string;
  year: number;
  maxItems?: number;
}

const formatEUR = (v: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

/**
 * "Aehnlich verkaufte Fahrzeuge" - zeigt 1-4 abgeschlossene Auktionen (status
 * sold oder ended mit current_bid > 0) als Markt-Referenz im Wertrechner-
 * Ergebnisschritt. Datenbasis = echte Verkaufspreise auf CaravanWert.
 *
 * Scope: matching body_type (ueber DB-Enum-Mapping), gleiches Baujahr +/- 6 Jahre.
 * Laedt still — wenn 0 Treffer oder DB-Fehler, rendert das Component nichts
 * (nicht-blockierend).
 */
export const SimilarSoldAuctions = ({ vehicleType, bodyType, year, maxItems = 4 }: Props) => {
  const [items, setItems] = useState<SoldAuctionCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const dbBodyType = BODY_TYPE_TO_DB_ENUM[bodyType] ?? bodyType;
        const yearFrom = year - 6;
        const yearTo = year + 6;

        // Step 1: Motorhomes nach body_type + year-range filtern (eigenstaendig,
        // damit wir keinen nested-column-filter auf auctions brauchen).
        const { data: mhData, error: mhErr } = await (supabase
          .from("motorhomes") as unknown as {
            select: (cols: string) => {
              eq: (col: string, v: string) => {
                gte: (col: string, v: number) => {
                  lte: (col: string, v: number) => Promise<{ data: unknown; error: unknown }>;
                };
              };
            };
          })
          .select("id, manufacturer, model, year, mileage, body_type")
          .eq("body_type", dbBodyType)
          .gte("year", yearFrom)
          .lte("year", yearTo);

        if (mhErr || !mhData || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }

        const mhArr = mhData as Array<{
          id: string;
          manufacturer: string | null;
          model: string | null;
          year: number | null;
          mileage: number | null;
          body_type: string | null;
        }>;
        const mhById = new Map(mhArr.map((m) => [m.id, m] as const));
        const mhIds = mhArr.map((m) => m.id);
        if (mhIds.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }

        // Step 2: abgeschlossene Auktionen mit current_bid > 1000 holen.
        const { data: auctionData } = await supabase
          .from("auctions")
          .select(AUCTION_PUBLIC_COLUMNS)
          .in("motorhome_id", mhIds as never)
          .in("status", ["sold", "ended"] as never)
          .gt("current_bid", 1000)
          .order("end_time", { ascending: false })
          .limit(maxItems * 3);

        const auctionsArr = (auctionData ?? []) as unknown as Array<{
          id: string;
          motorhome_id: string;
          current_bid: string | number | null;
          end_time: string;
        }>;

        const motorhomeIds = auctionsArr.map((a) => a.motorhome_id);
        const photoMap: Record<string, string> = {};
        if (motorhomeIds.length > 0) {
          const { data: photos } = await supabase
            .from("motorhome_photos")
            .select("motorhome_id, card_url, url, is_primary, display_order")
            .in("motorhome_id", motorhomeIds as never)
            .order("is_primary", { ascending: false })
            .order("display_order", { ascending: true });

          if (photos && Array.isArray(photos)) {
            for (const p of photos as Array<{ motorhome_id: string; card_url: string | null; url: string | null }>) {
              if (photoMap[p.motorhome_id]) continue;
              const src = p.card_url ?? p.url;
              if (src) photoMap[p.motorhome_id] = proxiedImageUrl(src, { width: 480, quality: 70 });
            }
          }
        }

        const mapped: SoldAuctionCard[] = auctionsArr.slice(0, maxItems).map((a) => {
          const mh = mhById.get(a.motorhome_id);
          return {
            id: a.id,
            motorhome_id: a.motorhome_id,
            current_bid: Number(a.current_bid ?? 0),
            end_time: a.end_time,
            manufacturer: mh?.manufacturer ?? null,
            model: mh?.model ?? null,
            year: mh?.year ?? null,
            mileage: mh?.mileage ?? null,
            body_type: mh?.body_type ?? null,
            photo_url: photoMap[a.motorhome_id] ?? null,
          };
        });

        if (!cancelled) {
          setItems(mapped);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vehicleType, bodyType, year, maxItems]);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="border-t pt-4 sm:pt-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-teal-700" />
        </div>
        <div>
          <h4 className="font-semibold text-sm">Tatsächlich verkaufte Vergleichsfahrzeuge</h4>
          <p className="text-xs text-muted-foreground">Echte Endpreise aus abgeschlossenen CaravanWert-Auktionen</p>
        </div>
      </div>

      <div className={cn(
        "grid gap-2 sm:gap-3",
        items.length === 1 ? "grid-cols-1" : items.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4",
      )}>
        {items.map((a) => (
          <Link
            key={a.id}
            to={`/fahrzeug/${a.motorhome_id}`}
            className="group rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all"
          >
            {a.photo_url ? (
              <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                <img
                  src={a.photo_url}
                  alt={`${a.manufacturer} ${a.model}`}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ) : (
              <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-slate-400" />
              </div>
            )}
            <div className="p-2 sm:p-3">
              <p className="text-[11px] font-medium text-muted-foreground truncate">
                {a.manufacturer} {a.model}
              </p>
              <p className="text-[11px] text-muted-foreground">
                BJ {a.year}
                {a.mileage ? ` · ${a.mileage.toLocaleString("de-DE")} km` : ""}
              </p>
              <p className="text-sm font-bold text-teal-700 mt-1">{formatEUR(a.current_bid)}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3 text-green-600" />
                Verkauft auf CaravanWert
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
