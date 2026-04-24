/**
 * AdminPriceHistoryCard
 *
 * Zeigt dem Admin auf einen Blick:
 *   - Urspr. Mindestpreis (seller_initial_reserve) aus dem Wizard
 *   - Urspr. Festpreis  (seller_initial_instant_price) aus dem Wizard
 *   - Aktuellen Reserve- / Sofortpreis an der neuesten Auktion
 *   - Delta (absolut + %) wenn sich zwischen "Initial" und "Aktuell"
 *     etwas verschoben hat — egal ob vom Admin runtergehandelt,
 *     vom Seller selbst gesenkt oder automatisch per Auto-Relist.
 *   - Kompakte Historie aller `price_change_requests` (Seller-Wünsche).
 *
 * Einsatz: überall wo ein Admin auf ein Wohnmobil / eine Auktion klickt
 * (AdminMotorhomeDetail, AdminAuctionDetail, MotorhomeDetailDialog).
 *
 * Die `seller_initial_*` Spalten sind column-level REVOKED auf `auctions`.
 * Wir lesen sie über den SECURITY-DEFINER-RPC `get_auction_owner_meta`,
 * der sowohl für Admins als auch Owner die Werte freigibt (für nicht-
 * berechtigte Rollen kommt ein 42501, was wir zum Fallback nutzen).
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  TrendingDown,
  TrendingUp,
  Minus,
  Euro,
  Sparkles,
  History,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AdminPriceHistoryCardProps {
  /** Die `motorhomes.id`. Pflicht — daran hängt alles. */
  motorhomeId: string;
  /**
   * Optional die spezifische `auctions.id` für die Preis-Anker gelesen
   * werden. Ohne Angabe wird die neueste Auktion des Motorhomes
   * verwendet — das ist in 99% der Admin-Views das Gewünschte.
   */
  auctionId?: string | null;
  className?: string;
  /**
   * Wenn true: kleinere Darstellung ohne Request-Historie, geeignet für
   * Dialoge mit wenig Platz. Default false.
   */
  compact?: boolean;
}

type MotorhomePriceRow = {
  reserve_price: number | null;
  instant_price: number | null;
  sale_channel: string | null;
};

type AuctionPriceRow = {
  id: string;
  reserve_price: number | null;
  starting_bid: number | null;
  created_at: string;
  status: string;
  auction_round: number | null;
};

type OwnerMetaRow = {
  auction_id: string;
  seller_initial_reserve: number | null;
  seller_initial_instant_price: number | null;
};

type PriceChangeRequestRow = {
  id: string;
  auction_id: string | null;
  current_reserve: number | null;
  current_instant: number | null;
  requested_reserve: number | null;
  requested_instant: number | null;
  reason: string;
  status: string;
  admin_note: string | null;
  processed_at: string | null;
  created_at: string;
};

function formatPrice(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Delta-Berechnung. Gibt null zurück wenn einer der Werte fehlt. */
function computeDelta(
  initial: number | null | undefined,
  current: number | null | undefined,
): { abs: number; pct: number } | null {
  if (initial == null || current == null) return null;
  if (initial <= 0) return null;
  const abs = current - initial;
  const pct = (abs / initial) * 100;
  return { abs, pct };
}

export function AdminPriceHistoryCard({
  motorhomeId,
  auctionId = null,
  className,
  compact = false,
}: AdminPriceHistoryCardProps) {
  // ---------------------------------------------------------------------
  // 1) aktuelle Motorhome-Preise
  // ---------------------------------------------------------------------
  const motorhomeQuery = useQuery({
    queryKey: ["admin-price-history-mh", motorhomeId],
    queryFn: async (): Promise<MotorhomePriceRow | null> => {
      const { data, error } = await supabase
        .from("motorhomes")
        .select("reserve_price, instant_price, sale_channel")
        .eq("id", motorhomeId)
        .maybeSingle();
      if (error) throw error;
      return data as MotorhomePriceRow | null;
    },
    enabled: !!motorhomeId,
    staleTime: 30_000,
  });

  // ---------------------------------------------------------------------
  // 2) neueste (oder explizit gegebene) Auktion
  //    Wir fragen nur granted columns ab (Startgebot/Reserve sind public)
  // ---------------------------------------------------------------------
  const auctionQuery = useQuery({
    queryKey: ["admin-price-history-auction", motorhomeId, auctionId],
    queryFn: async (): Promise<AuctionPriceRow | null> => {
      if (auctionId) {
        const { data, error } = await supabase
          .from("auctions")
          .select("id, reserve_price, starting_bid, created_at, status, auction_round")
          .eq("id", auctionId)
          .maybeSingle();
        if (error) throw error;
        return data as AuctionPriceRow | null;
      }
      const { data, error } = await supabase
        .from("auctions")
        .select("id, reserve_price, starting_bid, created_at, status, auction_round")
        .eq("motorhome_id", motorhomeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as AuctionPriceRow | null;
    },
    enabled: !!motorhomeId,
    staleTime: 30_000,
  });

  // ---------------------------------------------------------------------
  // 3) owner-meta mit seller_initial_* via RPC (admin/owner-only)
  // ---------------------------------------------------------------------
  const resolvedAuctionId = auctionQuery.data?.id ?? null;
  const ownerMetaQuery = useQuery({
    queryKey: ["admin-price-history-owner-meta", resolvedAuctionId],
    queryFn: async (): Promise<OwnerMetaRow | null> => {
      if (!resolvedAuctionId) return null;
      const { data, error } = await supabase.rpc("get_auction_owner_meta", {
        p_auction_id: resolvedAuctionId,
      });
      if (error) {
        // 42501 = permission denied. Für Nicht-Admin/Nicht-Owner ist
        // das erwartet — wir geben null zurück und zeigen später den
        // Fallback an. Alles andere werfen wir als echten Fehler.
        const pgCode = (error as { code?: string }).code;
        if (pgCode === "42501") return null;
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        auction_id: row.auction_id,
        seller_initial_reserve:
          row.seller_initial_reserve != null ? Number(row.seller_initial_reserve) : null,
        seller_initial_instant_price:
          row.seller_initial_instant_price != null
            ? Number(row.seller_initial_instant_price)
            : null,
      };
    },
    enabled: !!resolvedAuctionId,
    staleTime: 60_000,
    retry: false,
  });

  // ---------------------------------------------------------------------
  // 4) Seller-Preisänderungs-Anfragen (compact skipped)
  // ---------------------------------------------------------------------
  const priceRequestsQuery = useQuery({
    queryKey: ["admin-price-history-requests", motorhomeId],
    queryFn: async (): Promise<PriceChangeRequestRow[]> => {
      const { data, error } = await supabase
        .from("price_change_requests")
        .select(
          "id, auction_id, current_reserve, current_instant, requested_reserve, requested_instant, reason, status, admin_note, processed_at, created_at",
        )
        .eq("motorhome_id", motorhomeId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as PriceChangeRequestRow[];
    },
    enabled: !!motorhomeId && !compact,
    staleTime: 30_000,
  });

  // ---------------------------------------------------------------------
  // Abgeleitete Werte
  // ---------------------------------------------------------------------
  const saleChannel = motorhomeQuery.data?.sale_channel ?? null;
  const isFestpreis = saleChannel === "instant_price";

  // Für den Delta-Vergleich:
  //   - Festpreis:    initial_instant  → aktueller instant_price
  //   - Auktion (+ Sofortkauf): initial_reserve → auction.reserve_price
  //     (der Mindestpreis ist der relevante Verhandlungs-Anker)
  const initialReserve = ownerMetaQuery.data?.seller_initial_reserve ?? null;
  const initialInstant = ownerMetaQuery.data?.seller_initial_instant_price ?? null;
  const currentReserve =
    auctionQuery.data?.reserve_price ?? motorhomeQuery.data?.reserve_price ?? null;
  const currentInstant = motorhomeQuery.data?.instant_price ?? null;

  const reserveDelta = useMemo(
    () => computeDelta(initialReserve, currentReserve),
    [initialReserve, currentReserve],
  );
  const instantDelta = useMemo(
    () => computeDelta(initialInstant, currentInstant),
    [initialInstant, currentInstant],
  );

  // Status für das "Headline-Badge"
  const headlineMode: "unchanged" | "reduced" | "raised" | "unknown" | "no-initial" = useMemo(() => {
    // Wenn das Inserat weder reserve- noch instant-Anker hat, ist es ein
    // Legacy-Inserat (aus Wizard-Version vor `seller_initial_*`).
    if (initialReserve == null && initialInstant == null) return "no-initial";

    const relevantDelta = isFestpreis ? instantDelta : reserveDelta;
    if (!relevantDelta) return "unknown";
    if (Math.abs(relevantDelta.abs) < 1) return "unchanged";
    return relevantDelta.abs < 0 ? "reduced" : "raised";
  }, [initialReserve, initialInstant, isFestpreis, instantDelta, reserveDelta]);

  const anyLoading =
    motorhomeQuery.isLoading || auctionQuery.isLoading || ownerMetaQuery.isLoading;
  const anyError =
    motorhomeQuery.isError || auctionQuery.isError || ownerMetaQuery.isError;

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
  if (anyLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Preisverlauf
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (anyError || !motorhomeQuery.data) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Preisverlauf
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Preisverlauf konnte nicht geladen werden.
          </p>
        </CardContent>
      </Card>
    );
  }

  const approvedRequests = (priceRequestsQuery.data ?? []).filter(
    (r) => r.status === "approved",
  );

  return (
    <Card
      className={cn(
        "border-l-4",
        headlineMode === "reduced" && "border-l-amber-500",
        headlineMode === "raised" && "border-l-emerald-500",
        headlineMode === "unchanged" && "border-l-muted-foreground/40",
        (headlineMode === "no-initial" || headlineMode === "unknown") &&
          "border-l-muted-foreground/20",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Preisverlauf (Admin)
          </CardTitle>
          <HeadlineBadge
            mode={headlineMode}
            delta={isFestpreis ? instantDelta : reserveDelta}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {headlineMode === "no-initial" ? (
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/40 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Kein Initial-Anker</p>
              <p>
                Dieses Inserat stammt aus einer älteren Wizard-Version ohne
                gespeicherten Startpreis. Der aktuelle Preis ist daher die einzige
                verfügbare Referenz.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Mindestpreis-Spur — nur wenn relevant (Auktion oder Auktion+Sofortkauf) */}
            {!isFestpreis && (
              <PriceComparisonTile
                label="Mindestpreis"
                initial={initialReserve}
                current={currentReserve}
                delta={reserveDelta}
              />
            )}
            {/* Sofortpreis / Festpreis-Spur — wenn vorhanden */}
            {(initialInstant != null || currentInstant != null) && (
              <PriceComparisonTile
                label={isFestpreis ? "Festpreis" : "Sofortkauf-Preis"}
                initial={initialInstant}
                current={currentInstant}
                delta={instantDelta}
              />
            )}
          </div>
        )}

        {auctionQuery.data && auctionQuery.data.auction_round != null &&
          auctionQuery.data.auction_round > 1 && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <History className="w-3 h-3" />
              Auktionsrunde {auctionQuery.data.auction_round}
              {" — der Preis kann durch Auto-Relist gesenkt worden sein."}
            </div>
          )}

        {!compact && approvedRequests.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <History className="w-3 h-3" />
              Genehmigte Preisänderungs-Anfragen vom Verkäufer ({approvedRequests.length})
            </p>
            <ul className="space-y-1.5 text-xs">
              {approvedRequests.slice(0, 5).map((req) => {
                const reserveChanged =
                  req.current_reserve != null &&
                  req.requested_reserve != null &&
                  Number(req.current_reserve) !== Number(req.requested_reserve);
                const instantChanged =
                  req.current_instant != null &&
                  req.requested_instant != null &&
                  Number(req.current_instant) !== Number(req.requested_instant);
                return (
                  <li
                    key={req.id}
                    className="flex items-start gap-2 p-2 rounded bg-muted/30"
                  >
                    <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-muted-foreground">
                        {format(new Date(req.processed_at ?? req.created_at), "dd.MM.yyyy", {
                          locale: de,
                        })}
                        {reserveChanged && (
                          <>
                            {" "}
                            · Reserve{" "}
                            <span className="text-foreground">
                              {formatPrice(Number(req.current_reserve))} →{" "}
                              {formatPrice(Number(req.requested_reserve))}
                            </span>
                          </>
                        )}
                        {instantChanged && (
                          <>
                            {" "}
                            · Sofort{" "}
                            <span className="text-foreground">
                              {formatPrice(Number(req.current_instant))} →{" "}
                              {formatPrice(Number(req.requested_instant))}
                            </span>
                          </>
                        )}
                      </p>
                      {req.reason && (
                        <p className="text-muted-foreground/80 italic mt-0.5 truncate">
                          „{req.reason}"
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------

function HeadlineBadge({
  mode,
  delta,
}: {
  mode: "unchanged" | "reduced" | "raised" | "unknown" | "no-initial";
  delta: { abs: number; pct: number } | null;
}) {
  if (mode === "no-initial") {
    return (
      <Badge variant="outline" className="text-xs">
        Legacy-Inserat
      </Badge>
    );
  }
  if (mode === "unknown") {
    return (
      <Badge variant="outline" className="text-xs">
        Keine Referenz
      </Badge>
    );
  }
  if (mode === "unchanged") {
    return (
      <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
        <Minus className="w-3 h-3" />
        Unverändert
      </Badge>
    );
  }
  if (!delta) return null;
  if (mode === "reduced") {
    return (
      <Badge
        variant="outline"
        className="text-xs gap-1 border-amber-500 text-amber-700 dark:text-amber-400"
      >
        <TrendingDown className="w-3 h-3" />
        {formatPrice(delta.abs)} ({delta.pct.toFixed(1)}%)
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-xs gap-1 border-emerald-500 text-emerald-700 dark:text-emerald-400"
    >
      <TrendingUp className="w-3 h-3" />+{formatPrice(delta.abs)} (+{delta.pct.toFixed(1)}%)
    </Badge>
  );
}

function PriceComparisonTile({
  label,
  initial,
  current,
  delta,
}: {
  label: string;
  initial: number | null;
  current: number | null;
  delta: { abs: number; pct: number } | null;
}) {
  const hasInitial = initial != null;
  const hasCurrent = current != null;
  const reduced = delta ? delta.abs < 0 : false;
  const raised = delta ? delta.abs > 0 : false;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Euro className="w-3 h-3" />
        {label}
      </p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Start (Wizard)
          </p>
          <p className={cn("text-sm font-semibold", !hasInitial && "text-muted-foreground")}>
            {hasInitial ? formatPrice(initial) : "—"}
          </p>
        </div>
        <div className="text-muted-foreground px-1">→</div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Aktuell
          </p>
          <p
            className={cn(
              "text-sm font-semibold",
              !hasCurrent && "text-muted-foreground",
              reduced && "text-amber-700 dark:text-amber-400",
              raised && "text-emerald-700 dark:text-emerald-400",
            )}
          >
            {hasCurrent ? formatPrice(current) : "—"}
          </p>
        </div>
      </div>
      {delta && Math.abs(delta.abs) >= 1 && (
        <p
          className={cn(
            "text-xs",
            reduced && "text-amber-700 dark:text-amber-400",
            raised && "text-emerald-700 dark:text-emerald-400",
          )}
        >
          {reduced ? "−" : "+"}
          {formatPrice(Math.abs(delta.abs))} (
          {delta.pct > 0 ? "+" : ""}
          {delta.pct.toFixed(1)}%)
        </p>
      )}
    </div>
  );
}

export default AdminPriceHistoryCard;
