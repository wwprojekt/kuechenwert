
-- FIX BUG-7: Cleanup-Funktionen existieren aber werden nie aufgerufen.
-- rate_limits, error_logs, alte notifications wachsen endlos.
-- Lösung: Cron-Jobs die die bestehenden Cleanup-Funktionen regelmäßig aufrufen.

-- 1. rate_limits: Abgelaufene Rate-Limit-Einträge stündlich bereinigen
SELECT cron.schedule(
  'cleanup-expired-rate-limits',
  '15 * * * *',  -- Jede Stunde um :15
  $$SELECT public.cleanup_expired_rate_limits();$$
);

-- 2. error_logs: Alte Error-Logs wöchentlich bereinigen (> 90 Tage)
SELECT cron.schedule(
  'cleanup-old-error-logs',
  '0 3 * * 0',  -- Sonntags um 03:00
  $$SELECT public.cleanup_old_error_logs();$$
);

-- 3. notifications: Alte Notifications monatlich bereinigen
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 4 1 * *',  -- Jeden 1. des Monats um 04:00
  $$SELECT public.cleanup_old_notifications();$$
);

-- 4. analytics: Alte Analytics-Daten quartalsweise bereinigen (> 90 Tage)
SELECT cron.schedule(
  'cleanup-old-analytics',
  '0 5 1 1,4,7,10 *',  -- Quartalsweise am 1. Jan/Apr/Jul/Okt um 05:00
  $$SELECT public.clean_old_analytics_data(90);$$
);
