-- Bug-Fix: Es existieren ZWEI Cron-Jobs, die exakt dieselbe Edge-Function
-- process-dunning aufrufen:
--   * jobid 2  'process-payment-reminders'  schedule '0 9 * * *'
--   * jobid 25 'process-dunning'            schedule '0 11 * * *'
-- Die in process-dunning enthaltene Dedup-Logik (reminder_level je Rechnung)
-- verhindert zwar doppelte Mahn-Mails an Händler, der zweite Aufruf erzeugt
-- aber unnötige Last und ist verwirrend (zweimal "succeeded" pro Tag in den
-- Cron-Logs). Der ältere Job 'process-payment-reminders' wird entfernt; der
-- offiziell benannte 'process-dunning' bleibt aktiv (11:00 Uhr UTC = 13:00 MESZ).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-payment-reminders') THEN
    PERFORM cron.unschedule('process-payment-reminders');
  END IF;
END $$;
