-- Drosselt zwei nicht-zeitkritische Cron-Jobs.
--
-- Stand 2026-04-22 10:00 UTC: 288 + 257 Cron-Runs/24 h fuer Jobs deren
-- Latenz-Anforderung in Wahrheit "ein paar Minuten Verzoegerung sind ok"
-- ist. Die alle 5 min-Frequenz war historisch fuer schnellere Tests gewaehlt.
--
-- Aenderungen:
--   process-scheduled-emails  : */5  -> */15  (288 -> 96 Runs/24h)
--   process-abandoned-wizards : */5  -> */15  (257 -> 96 Runs/24h)
--
-- Auswirkung User: Geplante Marketing-Mails werden ggf. bis zu 15 min
-- spaeter geschickt statt bis zu 5 min. Abandoned-Wizard-Emails werden
-- bis zu 15 min nach der Schwelle (typ. 24-48h Inaktivitaet) versendet.
-- Beides ist fuer das Nutzererlebnis nicht spuerbar.
--
-- Schedules wurden bereits live via cron.alter_job() angepasst.
-- Dieses Migration-File dokumentiert den Stand fuer db reset / CI.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-emails') THEN
    PERFORM cron.alter_job(
      job_id := (SELECT jobid FROM cron.job WHERE jobname = 'process-scheduled-emails'),
      schedule := '*/15 * * * *'
    );
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-abandoned-wizards') THEN
    PERFORM cron.alter_job(
      job_id := (SELECT jobid FROM cron.job WHERE jobname = 'process-abandoned-wizards'),
      schedule := '*/15 * * * *'
    );
  END IF;
END $$;
