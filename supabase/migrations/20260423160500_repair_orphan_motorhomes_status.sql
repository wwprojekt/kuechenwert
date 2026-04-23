-- ──────────────────────────────────────────────────────────────────────
-- Daten-Reparatur: 35 verwaiste Motorhomes auf status='not_sold' setzen.
--
-- Hintergrund:
--   * 30 Datensätze stammen vom Bulk-Update am 2026-04-20 11:35:50 UTC
--     (3,5h VOR Erstellung des Sync-Triggers trg_sync_motorhome_status
--     in Migration 20260420151441) — wurden nie automatisch synchronisiert.
--   * 5 Datensätze stammen vom Code-Bug in
--     check-expired-auctions/index.ts (Zeilen 947-951): Beim Beenden einer
--     abgelaufenen Kaufchance ohne Re-Listing wurde motorhomes.status
--     explizit auf 'active' überschrieben — direkt nach der korrekten
--     Trigger-Synchronisation auf 'not_sold'. Der Bug ist mit demselben
--     Commit gefixt (Code entfernt, Trigger übernimmt allein).
--
-- Verifizierung VOR Update:
--   * 35 motorhomes mit status IN ('available','active') haben mindestens
--     eine zugehörige auction in ('cancelled','ended')
--   * KEINER dieser 35 Datensätze hat eine andere aktive/draft/kaufchance
--     Auktion → safe to set to 'not_sold' ohne Konflikt.
--
-- Mapping orientiert sich am Trigger trg_sync_motorhome_status:
--   auctions.cancelled/ended  →  motorhomes.not_sold
--
-- Ausnahme: defekte Bestand-Rows werden übersprungen, weil ihre
-- CHECK-Constraints (NOT VALID, daher für Bestand grandfathered) bei jedem
-- UPDATE re-validated werden:
--   * motorhomes_instant_price_positive  → 2 instant_price-Listings ohne Preis
--   * motorhomes_auction_requires_reserve → 1 auction-Listing ohne reserve_price
-- Diese 3 Rows bleiben in 'available'/'active' bis sie via /admin/motorhomes
-- manuell bereinigt oder gelöscht werden. Die Hauptmasse (32/35) wird sauber
-- repariert.
-- ──────────────────────────────────────────────────────────────────────

BEGIN;

WITH orphan_motorhomes AS (
  SELECT DISTINCT m.id
  FROM public.motorhomes m
  JOIN public.auctions a ON a.motorhome_id = m.id
  WHERE a.status IN ('cancelled', 'ended')
    AND m.status NOT IN ('not_sold', 'sold', 'reserved')
    AND NOT (
      m.sale_channel = 'instant_price'
      AND (m.instant_price IS NULL OR m.instant_price <= 0)
    )
    AND NOT (
      m.sale_channel = 'auction'
      AND (m.reserve_price IS NULL OR m.reserve_price <= 0)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.auctions a2
      WHERE a2.motorhome_id = m.id
        AND a2.status IN ('active', 'kaufchance', 'draft')
    )
)
UPDATE public.motorhomes m
SET status = 'not_sold',
    updated_at = now()
FROM orphan_motorhomes om
WHERE m.id = om.id;

-- Sanity-Check: nach dem UPDATE darf es nur noch die ausgeschlossenen
-- Defekt-Rows als Desync geben (instant_price ohne Preis / auction ohne reserve).
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM public.motorhomes m
  JOIN public.auctions a ON a.motorhome_id = m.id
  WHERE a.status IN ('cancelled', 'ended')
    AND m.status NOT IN ('not_sold', 'sold', 'reserved')
    AND NOT (
      m.sale_channel = 'instant_price'
      AND (m.instant_price IS NULL OR m.instant_price <= 0)
    )
    AND NOT (
      m.sale_channel = 'auction'
      AND (m.reserve_price IS NULL OR m.reserve_price <= 0)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.auctions a2
      WHERE a2.motorhome_id = m.id
        AND a2.status IN ('active', 'kaufchance', 'draft')
    );
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Repair incomplete: % motorhomes still desynced', remaining;
  END IF;
END $$;

COMMIT;
