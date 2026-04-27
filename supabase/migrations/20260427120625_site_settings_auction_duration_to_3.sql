-- Legacy-Feld `site_settings.default_auction_duration_days` konsistent auf 3 Tage ziehen.
--
-- Hintergrund:
--   Das Feld stammt aus der ursprünglichen Schema-Migration
--   (20251029033748) mit `DEFAULT 7`. Seit der Marketing-Phase-Refactor-Reihe
--   (20260420211000 „soft_close_5_minutes_sync" Kommentar: „reduzierte
--   Auktionsdauer 3 Tage statt 7") wird die tatsächliche Auktionsdauer
--   ausschließlich aus `src/lib/marketing-config.ts`
--   (`MARKETING_CONFIG.AUCTION_DURATION_DAYS = 3`) gelesen —
--   siehe `src/lib/activate-auction.ts`, `supabase/functions/close-auction`,
--   `supabase/functions/end-kaufchance`, `supabase/functions/check-expired-auctions`.
--
--   Das DB-Feld wird weder in Edge-Functions noch im Frontend gelesen,
--   nur in `SettingsContext` geladen und bisher im Admin-Formular editiert.
--   Das Admin-UI-Feld wird im selben Commit entfernt.
--
-- Ziel dieser Migration:
--   - Default des Spalten-Werts von 7 auf 3 ziehen (kein Code-Pfad liest den
--     Wert, aber er ist öffentlich via `public_site_settings` view sichtbar
--     und soll die Realität spiegeln).
--   - Existierende Row (die genau eine, Singleton-ID) auf 3 updaten.
--
-- Rollback: trivial via `ALTER TABLE ... SET DEFAULT 7; UPDATE ... SET ...= 7`.

ALTER TABLE public.site_settings
  ALTER COLUMN default_auction_duration_days SET DEFAULT 3;

UPDATE public.site_settings
   SET default_auction_duration_days = 3
 WHERE default_auction_duration_days <> 3;

COMMENT ON COLUMN public.site_settings.default_auction_duration_days IS
  'LEGACY / INFORMATIONAL ONLY: Die tatsächliche Auktionsdauer kommt aus MARKETING_CONFIG.AUCTION_DURATION_DAYS (3 Tage) in src/lib/marketing-config.ts und den mirrored Edge-Function-Configs. Dieser Spaltenwert wird nirgends im Auktions-Lifecycle gelesen und ist nur konsistent auf 3 gehalten, damit die Anzeige nicht vom Code abweicht.';
