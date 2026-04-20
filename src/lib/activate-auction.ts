/**
 * Zentrale Aktivierungs-Logik für Auktionen
 *
 * Single source of truth für ALLE Admin-/System-getriebenen Aktivierungs-
 * pfade (AdminAuctions, AdminAuctionDetail, AdminMotorhomes,
 * AdminMotorhomeDetail). Stellt sicher, dass:
 *
 *   1. `starting_bid` zufällig 40-60 % vom Reserve gewählt wird
 *      (compute_random_starting_bid RPC), damit Käufer nicht das Reserve
 *      via Reverse-Engineering ablesen können.
 *   2. `end_time` = MARKETING_CONFIG.AUCTION_DURATION_DAYS (= 3 Tage,
 *      vorher hardcoded 7) bzw. INSTANT_PRICE_DURATION_DAYS bei
 *      Festpreis-Inseraten.
 *   3. `seller_initial_reserve` / `seller_initial_instant_price` gesetzt
 *      werden – ohne diese Anker greift weder der Soft-Brake noch die
 *      automatische Preis-Reduktion.
 *   4. Der Marketing-Phase-Trigger
 *      (`trg_set_marketing_phase_on_activation`) korrekt feuert –
 *      sowohl bei direktem INSERT mit status='active' als auch beim
 *      UPDATE (z.B. Recycling einer beendeten Auktion).
 *
 * Wenn die Logik der Auktions-Aktivierung sich ändert, wird hier (UND
 * im DB-Trigger / den Edge-Functions) angepasst – nicht in den 5
 * Admin-Pages.
 */
import { supabase } from "@/integrations/supabase/client";
import { MARKETING_CONFIG } from "@/lib/marketing-config";

export interface ActivateAuctionResult {
  /** Auctions-ID nach Aktivierung */
  auctionId: string;
  /** True, wenn die Auktion bereits aktiv war und nichts geändert wurde */
  alreadyActive: boolean;
  /** True, wenn eine bestehende beendete Auktion recycelt wurde */
  recycled: boolean;
  /** Berechnetes (zufälliges) Startgebot */
  startingBid: number;
  /** Reserve, das in der DB liegt */
  reservePrice: number;
  /** Soft-Cap (16 Tage Auktion / 30 Tage Festpreis) ab now() */
  marketingPhaseMaxUntil: Date;
}

/**
 * Computiert ein zufälliges Startgebot via DB-RPC.
 * Fallback: 50€ wenn RPC fehlschlägt (Service-Continuity).
 */
async function computeStartingBid(reservePrice: number): Promise<number> {
  const { data, error } = await supabase.rpc("compute_random_starting_bid", {
    p_reserve_price: reservePrice,
  });
  if (error || data == null) {
    return 50;
  }
  return Number(data);
}

/**
 * Aktiviert (oder recycelt) eine Auktion für ein Wohnmobil.
 *
 * Diese Funktion ist idempotent: wenn bereits eine aktive Auktion existiert,
 * wird sie zurückgegeben (mit `recycled = true`, aber ohne destructive cleanup).
 * Recycling einer beendeten/abgesagten Auktion löscht alte Bids/Invitations/Offers.
 *
 * Wirft, wenn:
 *   - Wohnmobil keine PLZ hat (Code: PLZ_MISSING)
 *   - Wohnmobil keinen Reservepreis hat (Code: RESERVE_MISSING)
 *   - DB-Operation fehlschlägt
 */
export async function activateAuctionForMotorhome(
  motorhomeId: string,
): Promise<ActivateAuctionResult> {
  // 1) Wohnmobil laden + validieren
  const { data: motorhome, error: mhErr } = await supabase
    .from("motorhomes")
    .select("reserve_price, postal_code, sale_channel, instant_price")
    .eq("id", motorhomeId)
    .single();

  if (mhErr || !motorhome) {
    throw new Error(mhErr?.message ?? "Wohnmobil nicht gefunden");
  }

  if (!motorhome.postal_code) {
    const err = new Error("PLZ_MISSING");
    (err as Error & { code?: string }).code = "PLZ_MISSING";
    throw err;
  }

  const isInstantOnly = motorhome.sale_channel === "instant_price";

  // Reserve = instant_price bei Festpreis, sonst reserve_price
  const reservePrice = Number(
    isInstantOnly ? motorhome.instant_price : motorhome.reserve_price,
  );

  if (!reservePrice || reservePrice <= 0) {
    const err = new Error("RESERVE_MISSING");
    (err as Error & { code?: string }).code = "RESERVE_MISSING";
    throw err;
  }

  // 2) Startgebot zufällig wählen (außer Festpreis-only → 0)
  const startingBid = isInstantOnly ? 0 : await computeStartingBid(reservePrice);

  // 3) Dauer aus zentraler Config
  const durationDays = isInstantOnly
    ? MARKETING_CONFIG.INSTANT_PRICE_DURATION_DAYS
    : MARKETING_CONFIG.AUCTION_DURATION_DAYS;

  const now = new Date();
  const endTime = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  // 4) Bestehende Auktion prüfen (1:1 zu motorhomes).
  // P4-Hardening: seller_initial_* sind via column-REVOKE für authenticated
  // geblockt — wir holen sie über die SECURITY DEFINER RPC
  // `get_auction_marketing_anchors` (Owner+Admin sehen sie). Für die Status-
  // Prüfung selbst (id + status) reicht ein normaler SELECT.
  const { data: existing } = await supabase
    .from("auctions")
    .select("id, status")
    .eq("motorhome_id", motorhomeId)
    .maybeSingle();

  let existingSellerInitialReserve: number | null = null;
  let existingSellerInitialInstantPrice: number | null = null;
  if (existing) {
    const { data: anchors } = await supabase.rpc(
      "get_auction_marketing_anchors",
      { p_motorhome_id: motorhomeId },
    );
    const anchorRow = Array.isArray(anchors) ? anchors[0] : null;
    if (anchorRow) {
      existingSellerInitialReserve =
        anchorRow.seller_initial_reserve != null
          ? Number(anchorRow.seller_initial_reserve)
          : null;
      existingSellerInitialInstantPrice =
        anchorRow.seller_initial_instant_price != null
          ? Number(anchorRow.seller_initial_instant_price)
          : null;
    }
  }

  // Berechne marketing-phase-max-until LOKAL für die Result-Rückgabe.
  // (Der DB-Trigger setzt den Wert, aber wir brauchen ihn schon hier
  // für die Toast-Anzeige im Admin-UI.)
  const maxDays = isInstantOnly
    ? MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_DAYS
    : MARKETING_CONFIG.AUCTION_DURATION_DAYS * MARKETING_CONFIG.AUCTION_MAX_ROUNDS +
      MARKETING_CONFIG.AUCTION_MAX_ROUNDS;
  const marketingPhaseMaxUntil = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);

  // ─── Pfad A: Bestehende Auktion ────────────────────────────────────────
  if (existing) {
    // Bereits aktiv → no-op
    if (existing.status === "active") {
      return {
        auctionId: existing.id,
        alreadyActive: true,
        recycled: false,
        startingBid,
        reservePrice,
        marketingPhaseMaxUntil,
      };
    }

    // Recycling: alten Lifecycle-Datenkram löschen
    const cleanups = [
      supabase.from("bids").delete().eq("auction_id", existing.id),
      supabase.from("kaufchance_invitations").delete().eq("auction_id", existing.id),
      supabase.from("post_auction_offers").delete().eq("auction_id", existing.id),
    ];
    for (const op of cleanups) {
      const { error: delErr } = await op;
      if (delErr) throw delErr;
    }

    // dynamic_pricing & auto_relist: wenn die bestehende Auktion noch keinen
    // Anker (seller_initial_reserve) hatte, war sie aus einem Pre-P4-Pfad
    // (Dealer-Quick-Insert oder Bestand) angelegt. In dem Fall müssen wir die
    // Marketing-Phase-Defaults nachziehen, damit der Soft-Brake & die
    // automatische Preis-Reduktion greifen können.
    const needsDefaults = existingSellerInitialReserve == null
      && existingSellerInitialInstantPrice == null;
    const dynamicPricingDefault = isInstantOnly
      ? MARKETING_CONFIG.INSTANT_PRICE_DYNAMIC_PRICING_DEFAULT
      : MARKETING_CONFIG.AUCTION_DYNAMIC_PRICING_DEFAULT;

    const updateData: Record<string, unknown> = {
      status: "active",
      starting_bid: startingBid,
      current_bid: null,
      reserve_price: reservePrice,
      start_time: now.toISOString(),
      end_time: endTime.toISOString(),
      kaufchance_expires_at: null,
      kaufchance_min_price: null,
      // Anker für Reduktions-Logik: nur setzen, falls noch nicht da
      // (Recycling einer wirklich neuen System-Auktion behält ihren Anker).
      seller_initial_reserve:
        existingSellerInitialReserve ?? (isInstantOnly ? null : reservePrice),
      seller_initial_instant_price:
        existingSellerInitialInstantPrice ?? (isInstantOnly ? reservePrice : null),
      // auction_round explizit zurücksetzen (Recycling einer
      // abgeschlossenen alten Auktion startet wieder bei Runde 1).
      auction_round: 1,
      ...(needsDefaults
        ? { dynamic_pricing: dynamicPricingDefault, auto_relist: true }
        : {}),
    };

    const { error: updateErr } = await supabase
      .from("auctions")
      .update(updateData)
      .eq("id", existing.id);
    if (updateErr) throw updateErr;

    // Motorhome-Status mitziehen
    const { error: mhStatusErr } = await supabase
      .from("motorhomes")
      .update({ status: "active" })
      .eq("id", motorhomeId);
    if (mhStatusErr) throw mhStatusErr;

    return {
      auctionId: existing.id,
      alreadyActive: false,
      recycled: true,
      startingBid,
      reservePrice,
      marketingPhaseMaxUntil,
    };
  }

  // ─── Pfad B: Neue Auktion ─────────────────────────────────────────────
  const insertData: Record<string, unknown> = {
    motorhome_id: motorhomeId,
    status: "active",
    starting_bid: startingBid,
    reserve_price: reservePrice,
    start_time: now.toISOString(),
    end_time: endTime.toISOString(),
    seller_initial_reserve: isInstantOnly ? null : reservePrice,
    seller_initial_instant_price: isInstantOnly ? reservePrice : null,
    // dynamic_pricing-Default richtet sich nach dem Channel.
    dynamic_pricing: isInstantOnly
      ? MARKETING_CONFIG.INSTANT_PRICE_DYNAMIC_PRICING_DEFAULT
      : MARKETING_CONFIG.AUCTION_DYNAMIC_PRICING_DEFAULT,
  };

  const { data: created, error: insertErr } = await supabase
    .from("auctions")
    .insert(insertData)
    .select("id")
    .single();
  if (insertErr || !created) throw insertErr ?? new Error("Insert failed");

  // Motorhome-Status mitziehen
  const { error: mhStatusErr } = await supabase
    .from("motorhomes")
    .update({ status: "active" })
    .eq("id", motorhomeId);
  if (mhStatusErr) throw mhStatusErr;

  return {
    auctionId: created.id,
    alreadyActive: false,
    recycled: false,
    startingBid,
    reservePrice,
    marketingPhaseMaxUntil,
  };
}
