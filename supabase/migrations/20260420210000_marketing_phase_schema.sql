-- Migration: Marketing-Phase Schema-Erweiterung für auctions
--
-- Phase 1.1 des Marketing-Phase-Rollouts. Fügt die Felder hinzu, die der
-- neue Auktions-Lifecycle (3 Tage + 24h Kaufchance + max 4 Runden + bis
-- zu 16 Tage Bindung + -2% Auto-Reduktion pro Runde + -6% Floor) braucht.
--
-- Wichtige Designentscheidungen:
--   * `seller_initial_reserve` / `seller_initial_instant_price` sind Anker
--     für die Reduktionslogik (max -6 % bei Auktion, max -10 % bei
--     Festpreis vom Initial-Wert) und werden NIE an Käufer/Händler
--     ausgespielt – siehe RLS-Policy am Ende dieser Migration.
--   * `dynamic_pricing` ist ein eigenes Verkäufer-Opt-out, getrennt von
--     `auto_relist`, weil Verkäufer eine Verlängerung wollen können
--     OHNE automatische Preissenkung.
--   * `marketing_phase_started_at` markiert den Start der Bindungsphase
--     (= Aktivierung). `marketing_phase_max_until` ist das Hard-Cap, an
--     dem der Soft-Brake greift (16 Tage Auktion, 30 Tage Festpreis).
--   * `agb_version_at_start` snapshottet die zum Aktivierungszeitpunkt
--     akzeptierte AGB-Version (juristische Absicherung pro Inserat).
--
-- Backfill-Strategie für Bestand:
--   * `seller_initial_*` = aktueller Wert (so dass künftige Reduktionen
--     einen Anker haben, aber zum jetzigen Zeitpunkt 0 % Reduktion
--     vorliegen).
--   * `dynamic_pricing` = FALSE für Bestand (Opt-in via separater
--     Migration in Phase 7 + Mail-Aktion).
--   * `marketing_phase_*` = NULL für Bestand (wird in Phase 7 mit
--     60-Tage Soft-Cap befüllt).

ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS seller_initial_reserve       NUMERIC,
  ADD COLUMN IF NOT EXISTS seller_initial_instant_price NUMERIC,
  ADD COLUMN IF NOT EXISTS dynamic_pricing              BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS marketing_phase_started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_phase_max_until    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agb_version_at_start         TEXT;

COMMENT ON COLUMN public.auctions.seller_initial_reserve IS
  'Verkäufer-Wunschpreis (Reserve) zum Zeitpunkt der Aktivierung. Anker für die Reduktionslogik (-6 % Floor). NICHT für Käufer/Händler sichtbar.';
COMMENT ON COLUMN public.auctions.seller_initial_instant_price IS
  'Verkäufer-Wunschpreis (Festpreis) zum Zeitpunkt der Aktivierung. Anker für -10 % Floor. NICHT für Käufer/Händler sichtbar.';
COMMENT ON COLUMN public.auctions.dynamic_pricing IS
  'Verkäufer-Opt-in für automatische Preissenkung pro Runde. Default: TRUE bei Auktion, FALSE bei Festpreis (siehe MARKETING_CONFIG).';
COMMENT ON COLUMN public.auctions.marketing_phase_started_at IS
  'Beginn der Marketingphase (= Aktivierung). Wird bei Auto-Relist NICHT zurückgesetzt, da die Bindung kontinuierlich läuft.';
COMMENT ON COLUMN public.auctions.marketing_phase_max_until IS
  'Hard-Cap der Marketingphase. Bei Überschreitung greift der Soft-Brake (3-Buttons-Mail).';
COMMENT ON COLUMN public.auctions.agb_version_at_start IS
  'AGB-Version, die der Verkäufer bei Aktivierung akzeptiert hat. Snapshot für juristische Absicherung.';

-- ─── Backfill für Bestand ───────────────────────────────────────────────
-- Wir greifen auf motorhomes.instant_price zurück, weil instant_price
-- historisch dort liegt (auctions speichert für Festpreis nur reserve_price).
UPDATE public.auctions a
   SET seller_initial_reserve = COALESCE(a.seller_initial_reserve, a.reserve_price),
       seller_initial_instant_price = COALESCE(
         a.seller_initial_instant_price,
         (SELECT m.instant_price FROM public.motorhomes m WHERE m.id = a.motorhome_id)
       ),
       dynamic_pricing = FALSE
 WHERE a.seller_initial_reserve IS NULL
   AND a.status IN ('active', 'kaufchance', 'draft', 'ended');

-- ─── Indizes für Cron-Performance ───────────────────────────────────────
-- check-expired-auctions filtert auf marketing_phase_max_until < NOW()
CREATE INDEX IF NOT EXISTS idx_auctions_marketing_phase_max_until
  ON public.auctions (marketing_phase_max_until)
  WHERE status IN ('active', 'kaufchance');

-- ─── Sichere Käufer-/Händler-View OHNE seller_initial_* ─────────────────
-- Statt Column-Level RLS (komplex in Postgres) bauen wir eine View,
-- die Frontend/Public-Endpoints nutzen können. RLS auf der Tabelle
-- bleibt erhalten; die View erbt sie via SECURITY INVOKER.
DROP VIEW IF EXISTS public.auctions_public CASCADE;
CREATE VIEW public.auctions_public
WITH (security_invoker = true) AS
SELECT
  id,
  motorhome_id,
  status,
  starting_bid,
  current_bid,
  reserve_price,                       -- aktueller (evtl. reduzierter) Wert ist OK
  start_time,
  end_time,
  kaufchance_expires_at,
  kaufchance_min_price,
  auto_relist,
  auction_round,
  dynamic_pricing,
  marketing_phase_started_at,
  marketing_phase_max_until,
  soft_close_extension_minutes,
  created_at,
  updated_at
FROM public.auctions;

COMMENT ON VIEW public.auctions_public IS
  'Öffentliche Auktions-View OHNE seller_initial_*. Käufer- und Händler-Frontends können diese View direkt nutzen, um versehentliches Leaken des Verkäufer-Anker-Preises zu verhindern.';

GRANT SELECT ON public.auctions_public TO anon, authenticated;
