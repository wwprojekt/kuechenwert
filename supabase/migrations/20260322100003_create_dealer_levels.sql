-- =============================================
-- Migration: Händler-Status-System (Gamification)
-- Berechnet automatisch den Status-Level basierend auf Aktivität
-- Levels: Bronze, Silber, Gold, Platin
-- =============================================

-- 1. Tabelle für Händler-Levels
CREATE TABLE IF NOT EXISTS dealer_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'bronze' CHECK (level IN ('bronze', 'silber', 'gold', 'platin')),
  total_bids INTEGER NOT NULL DEFAULT 0,
  won_auctions INTEGER NOT NULL DEFAULT 0,
  total_volume NUMERIC(12, 2) NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  level_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dealer_id)
);

-- 2. Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_dealer_levels_dealer_id ON dealer_levels(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_levels_level ON dealer_levels(level);

-- 3. RLS aktivieren
ALTER TABLE dealer_levels ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Händler können nur ihren eigenen Level sehen
CREATE POLICY "Dealer can view own level"
  ON dealer_levels FOR SELECT
  USING (auth.uid() = dealer_id);

-- Admins können alle sehen
CREATE POLICY "Admins can view all levels"
  ON dealer_levels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dealer_applications
      WHERE dealer_applications.user_id = auth.uid()
      AND dealer_applications.status = 'approved'
    )
    OR auth.uid() IN (
      SELECT id FROM profiles WHERE primary_role = 'admin'
    )
  );

-- Service role kann alles (für Edge Functions)
CREATE POLICY "Service role full access"
  ON dealer_levels FOR ALL
  USING (auth.role() = 'service_role');

-- 5. Funktion zum Berechnen und Aktualisieren des Händler-Levels
CREATE OR REPLACE FUNCTION update_dealer_level(p_dealer_id UUID)
RETURNS void AS $$
DECLARE
  v_total_bids INTEGER;
  v_won_auctions INTEGER;
  v_total_volume NUMERIC(12, 2);
  v_points INTEGER;
  v_level TEXT;
BEGIN
  -- Zähle Gebote
  SELECT COUNT(*) INTO v_total_bids
  FROM bids WHERE bidder_id = p_dealer_id;

  -- Zähle gewonnene Auktionen
  SELECT COUNT(*) INTO v_won_auctions
  FROM motorhomes WHERE sold_to = p_dealer_id;

  -- Berechne Gesamtvolumen
  SELECT COALESCE(SUM(a.current_bid), 0) INTO v_total_volume
  FROM motorhomes m
  JOIN auctions a ON a.id = (
    SELECT id FROM auctions WHERE motorhome_id = m.id LIMIT 1
  )
  WHERE m.sold_to = p_dealer_id;

  -- Punkte berechnen:
  -- 1 Punkt pro Gebot, 10 Punkte pro gewonnene Auktion, 1 Punkt pro 1000€ Volumen
  v_points := v_total_bids + (v_won_auctions * 10) + FLOOR(v_total_volume / 1000);

  -- Level bestimmen
  v_level := CASE
    WHEN v_points >= 200 THEN 'platin'
    WHEN v_points >= 100 THEN 'gold'
    WHEN v_points >= 30 THEN 'silber'
    ELSE 'bronze'
  END;

  -- Upsert
  INSERT INTO dealer_levels (dealer_id, level, total_bids, won_auctions, total_volume, points, level_updated_at, updated_at)
  VALUES (p_dealer_id, v_level, v_total_bids, v_won_auctions, v_total_volume, v_points, now(), now())
  ON CONFLICT (dealer_id)
  DO UPDATE SET
    level = v_level,
    total_bids = v_total_bids,
    won_auctions = v_won_auctions,
    total_volume = v_total_volume,
    points = v_points,
    level_updated_at = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger: Level automatisch aktualisieren nach neuem Gebot
CREATE OR REPLACE FUNCTION trigger_update_dealer_level_on_bid()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_dealer_level(NEW.bidder_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_bid_update_dealer_level ON bids;
CREATE TRIGGER on_bid_update_dealer_level
  AFTER INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_dealer_level_on_bid();

-- 7. Trigger: Level automatisch aktualisieren wenn Fahrzeug verkauft wird
CREATE OR REPLACE FUNCTION trigger_update_dealer_level_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sold_to IS NOT NULL AND (OLD.sold_to IS NULL OR OLD.sold_to != NEW.sold_to) THEN
    PERFORM update_dealer_level(NEW.sold_to);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_sale_update_dealer_level ON motorhomes;
CREATE TRIGGER on_sale_update_dealer_level
  AFTER UPDATE ON motorhomes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_dealer_level_on_sale();
