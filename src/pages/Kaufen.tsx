import PageLayout from "@/components/PageLayout";
import { logger } from "@/lib/logger";
import { AuctionCardSkeletonGrid } from "@/components/skeletons";
import PageHero from "@/components/PageHero";
import RelatedContent, { kaufenRelatedLinks } from "@/components/RelatedContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Shield, Search, Star, CheckCircle2, Bell, ArrowUpDown, Filter, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { FilterSidebar, type FilterState } from "@/components/FilterSidebar";
import MotorhomeCard from "@/components/MotorhomeCard";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateServiceSchema } from "@/lib/seo";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { anonymizePostalCode } from "@/lib/plzCoordinates";
import { trackEvent } from "@/lib/analyticsService";
import { ensureValidRLSSession, isNetworkError } from "@/lib/sessionGuard";
import { handleAndLogError } from "@/lib/errorLogService";
import type { Database } from "@/integrations/supabase/types";

type AuctionRow = Database["public"]["Tables"]["auctions"]["Row"];
type MotorhomeRow = Database["public"]["Tables"]["motorhomes"]["Row"];
type PhotoRow = Database["public"]["Tables"]["motorhome_photos"]["Row"];

interface AuctionWithMotorhome extends AuctionRow {
  motorhome: MotorhomeRow & {
    photos: PhotoRow[];
  };
}

type SortOption = 'ending_soon' | 'newest' | 'price_asc' | 'price_desc' | 'year_desc' | 'year_asc' | 'mileage_asc' | 'mileage_desc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'ending_soon', label: 'Bald endend' },
  { value: 'newest', label: 'Neueste zuerst' },
  { value: 'price_asc', label: 'Preis aufsteigend' },
  { value: 'price_desc', label: 'Preis absteigend' },
  { value: 'year_desc', label: 'Baujahr neueste' },
  { value: 'year_asc', label: 'Baujahr älteste' },
  { value: 'mileage_asc', label: 'Km niedrigste' },
  { value: 'mileage_desc', label: 'Km höchste' },
];

const ITEMS_PER_PAGE = 12;

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
  const [sortBy, setSortBy] = useState<SortOption>('ending_soon');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 500000],
    yearRange: [1980, 2026],
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

  // ── Concurrency guards ────────────────────────────────────────────────
  // Realtime can re-trigger fetchAuctions while a previous call is still in
  // flight (especially with flaky mobile networks). Without dedup we'd:
  //   - waste bandwidth (parallel identical queries)
  //   - log the same "Failed to fetch" multiple times
  //   - show a toast even though a successful refetch is seconds away
  // hasInitialDataRef tracks whether we have shown auctions at least once,
  // so we can suppress the "load failed" toast on background refreshes.
  const inFlightRef = useRef(false);
  const hasInitialDataRef = useRef(false);

  const fetchAuctions = useCallback(async (retryCount = 0, isBackgroundRefresh = false) => {
      // Dedup: skip if a fetch is already running. The in-flight call will
      // pick up the latest data anyway. Realtime triggers will catch the
      // *next* change; we don't lose updates here.
      if (retryCount === 0 && inFlightRef.current) {
        logger.debug("Kaufen: fetchAuctions skipped (already in flight)");
        return;
      }
      if (retryCount === 0) inFlightRef.current = true;

      // ─────────────────────────────────────────────────────────────────
      // PRIMARY PATH: Edge-Cached Worker (caravanwert.de/api/auctions/active)
      // ─────────────────────────────────────────────────────────────────
      // Der Worker (CF Edge KV) liefert ein vorgekochtes JSON mit
      // {auctions, bidCounts} aus — typisch <100 ms TTFB ab CF Edge.
      // Cache-Strategie: 30 s FRESH → 60 s STALE-WHILE-REVALIDATE → sync-Refresh.
      //
      // Bei JEDEM Fehler (Network-Error, AbortError, non-200, JSON-Parse-Error)
      // fallen wir transparent zurück auf die direkte 3-Roundtrip-Supabase-
      // Logik unten. Kein User-facing Error, kein Datenverlust.
      //
      // Wichtig: Wir verzichten bei Retries (>0) auf den Worker-Pfad — wenn
      // der erste Versuch direkt zu Supabase ging, soll der Retry konsistent
      // dort weiterprobieren statt zwischen den Pfaden zu springen.
      if (retryCount === 0) {
        try {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 3000);
          const res = await fetch("/api/auctions/active", {
            signal: controller.signal,
            credentials: "omit",
            headers: { accept: "application/json" },
          });
          window.clearTimeout(timeoutId);

          if (res.ok) {
            const payload = (await res.json()) as {
              auctions?: AuctionWithMotorhome[];
              bidCounts?: Record<string, number>;
            };
            const list = Array.isArray(payload.auctions) ? payload.auctions : [];
            setAuctions(list);
            setBidCounts(payload.bidCounts ?? {});
            hasInitialDataRef.current = true;
            // Logging optional — hilft beim Debuggen ob/wie der Cache greift
            const cacheStatus = res.headers.get("x-cache-status") ?? "unknown";
            const cacheAgeMs = res.headers.get("x-cache-age-ms") ?? "?";
            logger.debug(
              `Kaufen: worker hit (${cacheStatus}, age=${cacheAgeMs}ms, ${list.length} auctions)`
            );
            inFlightRef.current = false;
            setIsLoading(false);
            return;
          }
          logger.warn(
            `Kaufen: worker returned ${res.status}, falling back to direct supabase`
          );
        } catch (workerErr) {
          // Network-Error, AbortError (>3 s), JSON-Parse — alles unkritisch,
          // wir machen einfach den klassischen Pfad.
          logger.warn(
            "Kaufen: worker fetch failed, falling back to direct supabase",
            workerErr
          );
        }
      }

      try {
        // ─────────────────────────────────────────────────────────────────
        // FALLBACK PATH: Direkte Supabase-Queries (3 Roundtrips)
        // Performance-Strategie für /kaufen (re-architected 2026-04-20)
        // ─────────────────────────────────────────────────────────────────
        // Der vorherige nested Embed `motorhome.photos(...)` mit den Optionen
        //   .order("display_order", { referencedTable: "motorhome.photos" })
        //   .limit(1,                { referencedTable: "motorhome.photos" })
        // hat sich als BUG herausgestellt:
        //   • PostgREST gibt 400 zurück: "failed to parse order
        //     (motorhome.photos.display_order.asc)" — der nested Pfad mit
        //     zwei Aliases (`motorhome` → `photos`) ist nicht parsable.
        //   • supabase-js retried den Request silent ohne den Order-Param,
        //     sendet dann nur noch `motorhome.photos.limit=1`. Der Limit-
        //     Param wird von PostgREST aber NUR auf das Top-Level wirkt;
        //     auf den verschachtelten Embed greift er gar nicht.
        //   • Resultat: pro Auction werden ALLE Photos geladen (bis zu 23
        //     Stück) statt 1. Bei 85 aktiven Auctions = ~1500 Bilder im
        //     <img>-Pool, Browser-Connection-Pool kollabiert, einzelne
        //     Bilder-Requests warten 30-60 Sekunden. Das ist die Ursache
        //     der "extrem langsamen /kaufen-Seite".
        //
        // Lösung: Photos in eine SEPARATE dritte Query auslagern. Wir laden
        // genau `display_order = 0` für alle relevanten motorhome_ids in
        // einem Roundtrip. Verifiziert via DB-Query (2026-04-20):
        // ALLE 155 Motorhomes mit Photos haben min(display_order) = 0,
        // also liefert der Filter exakt das jeweils erste/Cover-Foto.
        //
        // Trade-off: 1 zusätzlicher Roundtrip, aber:
        //   • Die Photo-Query ist winzig (~85 Zeilen × 200 Bytes = 17 KB)
        //   • Läuft parallel via Promise.all — Wall-Clock = max(...)
        //   • JSON-Payload sinkt von ~250 KB → ~70 KB (auctions+motorhomes)
        //     plus ~17 KB (photos) = ~87 KB total
        //   • Browser muss nur noch 85 Bilder laden statt 1500+
        // ─────────────────────────────────────────────────────────────────
        const nowIso = new Date().toISOString();

        const auctionsPromise = supabase
          .from("auctions")
          .select(`
            id, motorhome_id, current_bid, starting_bid, end_time, created_at,
            last_price_reduction_at, marketing_phase_started_at,
            motorhome:motorhomes(
              id, manufacturer, model, year, mileage, listing_number, body_type,
              country, postal_code, instant_price, sale_channel, status,
              account_type, sleeping_places, transmission, accident_free
            )
          `)
          .eq("status", "active")
          .gt("end_time", nowIso)
          .order("end_time", { ascending: true });

        // Bids-Count: nur Bids aktiver, noch laufender Auktionen — !inner-Join
        // filtert serverseitig, wir bekommen ~5 KB statt der ganzen Bid-Tabelle.
        const bidsPromise = supabase
          .from("bids")
          .select("auction_id, auction:auctions!inner(status,end_time)")
          .eq("auction.status", "active")
          .gt("auction.end_time", nowIso);

        const [
          { data: auctionData, error: auctionError },
          { data: bidRows, error: bidsError },
        ] = await Promise.all([auctionsPromise, bidsPromise]);

        if (auctionError) throw auctionError;

        // ── Photos in separater dritter Query holen ─────────────────────
        // display_order = 0 ist garantiert das Cover-Foto (DB-verifiziert).
        // .in() ist O(N log N) im Index, läuft in <100ms für ≤500 IDs.
        const motorhomeIds = (auctionData ?? [])
          .map((a) => (a as unknown as { motorhome_id?: string }).motorhome_id)
          .filter((id): id is string => Boolean(id));

        // Cover-Foto + pre-resized card-Variante (480px, ~25-40 KB JPEG).
        // card_url wird async im Hintergrund via resize-photo-variants Edge
        // Function gefüllt. Fallback auf Original-URL (url), damit die Seite
        // auch für noch unverarbeitete Bilder funktioniert. Der Payload
        // sinkt so von ~150-300 KB pro Card auf ~30 KB, ohne Breaking Change.
        // Wir holen card_url (480px) und medium_url (1024px). Der Card
        // verwendet card_url als src und beide via srcset für Retina-Geräte.
        // Fallback: card_url || medium_url || url, damit auch Photos ohne
        // Variants (alte oder noch nicht prozessierte) funktionieren.
        type CoverEntry = { small: string; medium: string | null };
        let firstPhotoByMotorhomeId = new Map<string, CoverEntry>();
        if (motorhomeIds.length > 0) {
          const { data: photoRows, error: photoErr } = await supabase
            .from("motorhome_photos")
            .select("url, card_url, medium_url, motorhome_id")
            .in("motorhome_id", motorhomeIds)
            .eq("display_order", 0);

          if (photoErr) {
            logger.warn("Kaufen: cover-photo query failed (non-blocking)", photoErr);
          } else if (photoRows) {
            firstPhotoByMotorhomeId = new Map(
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

        // Stitch: Photo-Array mit genau 0 oder 1 Eintrag injizieren, damit
        // der bestehende Render-Code (`auction.motorhome?.photos?.[0]?.url`)
        // ohne Änderung weiter funktioniert.
        const stitched = (auctionData ?? []).map((a) => {
          const typed = a as unknown as {
            motorhome_id?: string;
            motorhome?: { id?: string } | null;
          };
          const cover = typed.motorhome_id
            ? firstPhotoByMotorhomeId.get(typed.motorhome_id)
            : undefined;
          return {
            ...(a as object),
            motorhome: typed.motorhome
              ? {
                  ...typed.motorhome,
                  // Wir hängen sowohl url (= small/card) als auch
                  // medium_url an, damit MotorhomeCard srcset bauen kann.
                  photos: cover
                    ? [{ url: cover.small, medium_url: cover.medium, display_order: 0 }]
                    : [],
                }
              : null,
          };
        });

        setAuctions(stitched as unknown as AuctionWithMotorhome[]);
        hasInitialDataRef.current = true;

        // Bid-Counts aus der parallelen Query aggregieren. Bei Fehler nur loggen
        // — die Liste rendert trotzdem, die Bid-Badges zeigen einfach 0.
        if (bidsError) {
          logger.warn("Kaufen: bid count query failed (non-blocking)", bidsError);
        } else if (bidRows && bidRows.length > 0) {
          const counts: Record<string, number> = {};
          for (const b of bidRows as Array<{ auction_id: string }>) {
            counts[b.auction_id] = (counts[b.auction_id] || 0) + 1;
          }
          setBidCounts(counts);
        } else {
          setBidCounts({});
        }
      } catch (error: unknown) {
        if (retryCount < 2) {
          logger.warn(`Auction fetch failed (attempt ${retryCount + 1}), retrying...`);
          await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
          return fetchAuctions(retryCount + 1, isBackgroundRefresh);
        }

        // Final failure after 3 attempts. Route through handleAndLogError —
        // it translates to German, sets the dedup marker so the global
        // console.error interceptor doesn't write a second log entry, and
        // chooses the right severity for pure network errors.
        const germanMsg = handleAndLogError(error, {
          componentName: "Kaufen.fetchAuctions",
          category: "api",
          severity: isNetworkError(error) ? "low" : "medium",
        });

        // Suppress the "please reload" toast on background refreshes when
        // we already have data on screen. The user can still browse the
        // marketplace — the next Realtime event or page action will trigger
        // a fresh fetch.
        const shouldShowToast = !isBackgroundRefresh || !hasInitialDataRef.current;
        if (shouldShowToast) {
          toast({
            title: "Fehler",
            description: isNetworkError(error)
              ? germanMsg
              : "Auktionen konnten nicht geladen werden. Bitte Seite neu laden.",
            variant: "destructive",
          });
        }
      } finally {
        if (retryCount === 0 || retryCount >= 2) {
          inFlightRef.current = false;
          setIsLoading(false);
        }
      }
  }, [toast]);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  // Auf /kaufen ist Realtime-Live-Updates auf jedes Auctions-Update Overkill.
  //
  // Vorher: Channel ohne Filter auf table=auctions → JEDER current_bid-Update
  // (also jedes Gebot im ganzen System) triggerte einen Listen-Refetch der
  // gesamten Marketplace-Page, debounced auf 1.5 s. Bei einer Bid-Welle waren
  // das 40 Refetches/Minute pro offenem /kaufen-Tab × N Tabs.
  //
  // Jetzt: Polling alle 30 s + Refetch beim Window-Focus. Für eine
  // Browse-Page reicht das vollständig — Bid-Counts können maximal 30 s
  // veraltet sein, und der Card-Timer läuft sowieso lokal via useNow() weiter.
  // User die Live-Bidding sehen wollen klicken auf eine Auktion, dort gibt es
  // den scharfen postgres_changes-Channel auf bids+auctions (gefiltert auf
  // diese eine ID).
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchAuctions(0, true);
    }, 30_000);
    const onFocus = () => fetchAuctions(0, true);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchAuctions]);

  // Dynamic brands from available auctions
  const availableBrands = useMemo(() => {
    const brandSet = new Set<string>();
    auctions.forEach((auction) => {
      if (auction.motorhome?.manufacturer) {
        brandSet.add(auction.motorhome.manufacturer);
      }
    });
    return Array.from(brandSet).sort();
  }, [auctions]);

  // Apply filters to auctions
  const filteredAuctions = useMemo(() => {
    return auctions.filter((auction) => {
      const motorhome = auction.motorhome;
      if (!motorhome) return false;

      // Price filter — use instant_price for Festpreis listings
      const currentPrice = motorhome.sale_channel === 'instant_price'
        ? Number(motorhome.instant_price || 0)
        : (auction.current_bid || auction.starting_bid || 0);
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
        const motorhomeBeds = (motorhome as any).sleeping_places || 0;
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
          Number(motorhome.instant_price) > 0;
        if (!hasInstantPrice) {
          return false;
        }
      }

      return true;
    });
  }, [auctions, filters]);

  // Sort filtered auctions
  const sortedAuctions = useMemo(() => {
    const sorted = [...filteredAuctions];
    switch (sortBy) {
      case 'ending_soon':
        sorted.sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime());
        break;
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'price_asc': {
        const getPrice = (a: any) => a.motorhome?.sale_channel === 'instant_price'
          ? Number(a.motorhome?.instant_price || 0)
          : (a.current_bid || a.starting_bid || 0);
        sorted.sort((a, b) => getPrice(a) - getPrice(b));
        break;
      }
      case 'price_desc': {
        const getPriceDesc = (a: any) => a.motorhome?.sale_channel === 'instant_price'
          ? Number(a.motorhome?.instant_price || 0)
          : (a.current_bid || a.starting_bid || 0);
        sorted.sort((a, b) => getPriceDesc(b) - getPriceDesc(a));
        break;
      }
      case 'year_desc':
        sorted.sort((a, b) => (b.motorhome?.year || 0) - (a.motorhome?.year || 0));
        break;
      case 'year_asc':
        sorted.sort((a, b) => (a.motorhome?.year || 0) - (b.motorhome?.year || 0));
        break;
      case 'mileage_asc':
        sorted.sort((a, b) => (a.motorhome?.mileage || 0) - (b.motorhome?.mileage || 0));
        break;
      case 'mileage_desc':
        sorted.sort((a, b) => (b.motorhome?.mileage || 0) - (a.motorhome?.mileage || 0));
        break;
    }
    return sorted;
  }, [filteredAuctions, sortBy]);

  // Paginated auctions
  const paginatedAuctions = useMemo(() => {
    return sortedAuctions.slice(0, visibleCount);
  }, [sortedAuctions, visibleCount]);

  const hasMore = visibleCount < sortedAuctions.length;

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [filters, sortBy]);

  // Check if any filter is active (for the empty state message)
  const hasActiveFilters = useMemo(() => {
    return (
      filters.priceRange[0] > 0 ||
      filters.priceRange[1] < 500000 ||
      filters.yearRange[0] > 1980 ||
      filters.yearRange[1] < 2026 ||
      filters.vehicleTypes.length > 0 ||
      filters.brand !== null ||
      filters.beds !== null ||
      filters.searchQuery !== "" ||
      filters.countries.length > 0 ||
      filters.mileageMin !== null ||
      filters.mileageMax !== null ||
      filters.transmission !== null ||
      filters.accidentFree !== null ||
      filters.buyNowOnly
    );
  }, [filters]);

  // Count active filters for mobile badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 500000) count++;
    if (filters.yearRange[0] > 1980 || filters.yearRange[1] < 2026) count++;
    if (filters.vehicleTypes.length > 0) count++;
    if (filters.brand !== null) count++;
    if (filters.beds !== null) count++;
    if (filters.searchQuery !== "") count++;
    if (filters.countries.length > 0) count++;
    if (filters.mileageMin !== null || filters.mileageMax !== null) count++;
    if (filters.transmission !== null) count++;
    if (filters.accidentFree !== null) count++;
    if (filters.buyNowOnly) count++;
    return count;
  }, [filters]);

  const benefits = [
    {
      icon: Shield,
      title: "Geprüfte Qualität",
      description: "Alle Fahrzeuge werden von unseren Experten gründlich geprüft und aufbereitet."
    },
    {
      icon: Star,
      title: "Große Auswahl",
      description: "Wohnmobile und Wohnwagen verschiedener Marken und Preisklassen."
    },
    {
      icon: CheckCircle2,
      title: "Geprüfte Qualität",
      description: "Alle Fahrzeuge werden von unseren Händlern sorgfältig geprüft."
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
    'Auswahl an geprüften Wohnmobilen und Wohnwagen. Faire Preise und persönliche Beratung.'
  );

  // Stable callback to prevent FilterSidebar useEffect from re-triggering on every render
  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    const activeFilters = Object.entries(newFilters).filter(([k, v]) => {
      if (k === 'priceRange') return (v as number[])[0] > 0 || (v as number[])[1] < 500000;
      if (k === 'yearRange') return (v as number[])[0] > 1980 || (v as number[])[1] < new Date().getFullYear();
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v !== '';
      return false;
    }).map(([k]) => k);
    if (activeFilters.length > 0) {
      trackEvent('filter_applied', { category: 'auction', properties: { filters: activeFilters, brand: newFilters.brand, vehicleTypes: newFilters.vehicleTypes } });
    }
  }, []);

  // Shared filter sidebar component (used in both desktop and mobile)
  const filterContent = useMemo(() => (
    <FilterSidebar 
      onFilterChange={handleFilterChange}
      resultCount={filteredAuctions.length}
      availableBrands={availableBrands}
    />
  ), [handleFilterChange, filteredAuctions.length, availableBrands]);

  return (
    <PageLayout
      breadcrumbs={true}
      title="Wohnmobil Kaufen"
      description="Auswahl an geprüften Wohnmobilen und Wohnwagen. Faire Preise und persönliche Beratung."
      keywords="wohnmobil kaufen, wohnwagen kaufen, camper kaufen, gebrauchte wohnmobile, wohnmobil ankaufstationen"
      canonicalPath="/kaufen"
      structuredData={serviceSchema}
    >
      {/* Hero Section */}
      <PageHero size="sm">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-xl sm:text-2xl md:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
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
            {/* Desktop Sidebar - hidden on mobile */}
            <aside className="hidden lg:block lg:sticky lg:top-24 h-fit">
              {filterContent}
            </aside>

            {/* Listings Grid */}
            <div>
              {/* Dealer Registration CTA for non-authenticated visitors */}
              {!user && (
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/5 via-cyan-50/50 to-primary/5 border-2 border-primary/20">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Sie sind Händler? Registrieren Sie sich kostenlos und bieten Sie mit!</p>
                        <p className="text-xs text-muted-foreground">Keine Gebühren · Provision nur bei Zuschlag · <Link to="/wohnmobil-haendler-werden" className="text-primary hover:underline">Mehr erfahren</Link></p>
                      </div>
                    </div>
                    <Link to="/register/haendler" className="flex-shrink-0">
                      <Button size="sm" className="gap-1.5">
                        Händler werden
                        <ArrowUpDown className="h-3.5 w-3.5 rotate-90" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
              {/* Header with sort, filter button (mobile), and save search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  {/* Mobile Filter Button */}
                  <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="lg:hidden gap-2 relative">
                        <Filter className="h-4 w-4" />
                        Filter
                        {activeFilterCount > 0 && (
                          <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                            {activeFilterCount}
                          </span>
                        )}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[340px] sm:w-[380px] overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                          <Filter className="h-5 w-5 text-primary" />
                          Filter
                        </SheetTitle>
                      </SheetHeader>
                      <div className="mt-4">
                        {filterContent}
                      </div>
                    </SheetContent>
                  </Sheet>

                  <div>
                    <h2 className="text-2xl font-bold">
                      {isLoading ? "Lädt..." : `${filteredAuctions.length} Inserate gefunden`}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Aktive Angebote</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Sort Dropdown */}
                  <Select value={sortBy} onValueChange={(value) => { setSortBy(value as SortOption); trackEvent('sort_changed', { category: 'auction', label: value }); }}>
                    <SelectTrigger className="w-[180px] h-9">
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Sortieren" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Save Search Button (Dealer only) */}
                  {user && isDealer && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 h-9"
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
                        placeholder="z.B. Kastenwagen unter 50.000€"
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
                        <option value="daily">Täglich</option>
                        <option value="weekly">Wöchentlich</option>
                      </select>
                    </div>
                    <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                      <strong>Aktuelle Filter:</strong>{' '}
                      {filters.brand ? `Marke: ${filters.brand}` : 'Alle Marken'}
                      {filters.vehicleTypes.length > 0 ? ` • Typ: ${filters.vehicleTypes.join(', ')}` : ''}
                      {filters.priceRange[1] < 500000 ? ` • Max: €${filters.priceRange[1].toLocaleString('de-DE')}` : ''}
                      {filters.yearRange[0] > 1980 ? ` • Ab ${filters.yearRange[0]}` : ''}
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
                            const sessionValid = await ensureValidRLSSession();
                            if (!sessionValid) return;

                            const criteria: Record<string, any> = {};
                            if (filters.brand) criteria.manufacturer = filters.brand;
                            if (filters.vehicleTypes.length > 0) criteria.body_type = filters.vehicleTypes[0];
                            if (filters.priceRange[1] < 500000) criteria.max_price = filters.priceRange[1];
                            if (filters.yearRange[0] > 1980) criteria.min_year = filters.yearRange[0];
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
              ) : paginatedAuctions.length > 0 ? (
                <>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {paginatedAuctions.map((auction, idx) => {
                      // Server liefert pro Listing nur die erste Foto-Zeile
                      // (geordnet nach display_order). Kein Client-Side Sort
                      // mehr nötig.
                      const firstPhoto = auction.motorhome?.photos?.[0]?.url;
                      const firstPhotoMedium = (auction.motorhome?.photos?.[0] as
                        | { medium_url?: string | null }
                        | undefined)?.medium_url;
                      // Erste 3 Cards (Above-the-fold auf Desktop xl:grid-cols-3)
                      // bekommen eager loading + fetchpriority=high. Lighthouse
                      // markiert das LCP-Bild aktuell als lazy-loaded → 14 s
                      // LCP. Mit priority sinkt das auf <2 s.
                      const isAboveFold = idx < 3;

                      return (
                        <MotorhomeCard
                          key={auction.id}
                          priority={isAboveFold}
                          id={auction.motorhome?.id || auction.motorhome_id}
                          title={`${auction.motorhome?.manufacturer || ''} ${auction.motorhome?.model || ''}`}
                          manufacturer={auction.motorhome?.manufacturer || 'Unbekannt'}
                          model={auction.motorhome?.model || ''}
                          year={auction.motorhome?.year || 0}
                          mileage={auction.motorhome?.mileage || 0}
                          image={firstPhoto || ''}
                          imageMedium={firstPhotoMedium ?? null}
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
                          accountType={auction.motorhome?.account_type}
                          lastPriceReductionAt={(auction as any).last_price_reduction_at}
                          marketingPhaseStartedAt={(auction as any).marketing_phase_started_at}
                          auctionCreatedAt={auction.created_at}
                          linkTo={`/auktion/${auction.id}`}
                        />
                      );
                    })}
                  </div>

                  {/* Load More Button */}
                  {hasMore && (
                    <div className="flex justify-center mt-8">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                        className="gap-2"
                      >
                        Weitere {Math.min(ITEMS_PER_PAGE, sortedAuctions.length - visibleCount)} von {sortedAuctions.length} anzeigen
                      </Button>
                    </div>
                  )}
                </>
              ) : hasActiveFilters ? (
                /* Improved empty state when filters are active */
                <Card className="p-12">
                  <div className="text-center">
                    <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-xl font-semibold text-muted-foreground mb-2">
                      Keine Ergebnisse für Ihre Filterauswahl
                    </p>
                    <p className="text-muted-foreground mb-6">
                      Versuchen Sie, Ihre Filter anzupassen oder zurückzusetzen, um mehr Fahrzeuge zu finden.
                    </p>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        setFilters({
                          priceRange: [0, 500000],
                          yearRange: [1980, 2026],
                          vehicleTypes: [],
                          brand: null,
                          beds: null,
                          searchQuery: "",
                          countries: [],
                          mileageMin: null,
                          mileageMax: null,
                          transmission: null,
                          accidentFree: null,
                          buyNowOnly: false,
                        });
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Filter zurücksetzen
                    </Button>
                  </div>
                </Card>
              ) : (
                /* Empty state when no auctions exist at all */
                <Card className="p-12">
                  <div className="text-center">
                    <p className="text-xl font-semibold text-muted-foreground mb-2">
                      Keine aktiven Inserate
                    </p>
                    <p className="text-muted-foreground">
                      Aktuell sind keine Inserate verfügbar. Schauen Sie später wieder vorbei!
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
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">Warum bei uns kaufen?</h2>
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
              <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-4">So kaufen Sie bei uns</h2>
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
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6">Wohnmobil kaufen - Worauf sollten Sie achten?</h2>
            
            <h3 className="text-2xl font-bold mt-8 mb-4">Welches Wohnmobil passt zu mir?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Die Wahl des richtigen Wohnmobils hängt von Ihren individuellen Bedürfnissen ab. Berücksichtigen Sie die Anzahl der Reisenden, 
              Ihre bevorzugten Reiseziele, die geplante Nutzungshäufigkeit und Ihr Budget. Unsere Berater helfen Ihnen gerne, 
              das perfekte Fahrzeug zu finden.
            </p>

            <h3 className="text-2xl font-bold mt-8 mb-4">Gebraucht oder neu kaufen?</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Gebrauchte Wohnmobile bieten ein ausgezeichnetes Preis-Leistungs-Verhältnis. Alle unsere Fahrzeuge werden gründlich geprüft 
              So erhalten Sie Qualität zum fairen Preis.
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
            <h2 className="text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold mb-6">Besuchen Sie uns!</h2>
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
