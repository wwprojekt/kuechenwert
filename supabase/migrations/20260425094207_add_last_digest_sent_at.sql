-- Unterstuetzung fuer `digest_frequency='weekly'`: wir muessen wissen, wann
-- der letzte Dealer-Auction-Digest an einen User rausging, damit Weekly-
-- Haendler nicht jeden Montag doppelt eine Mail bekommen (falls der Cron
-- verzoegert anspringt und einmal pro Tag laeuft).
--
-- Bei `daily`-Haendlern existiert weiterhin die per-day-Dedup im
-- send-dealer-auction-digest (Check auf admin_emails.created_at >= todayStart),
-- die Spalte ist also ausschliesslich relevant fuer weekly.

alter table public.user_notification_preferences
  add column if not exists last_digest_sent_at timestamptz;

comment on column public.user_notification_preferences.last_digest_sent_at is
  'Zeitpunkt des letzten erfolgreich gesendeten Dealer-Auction-Digest. Wird fuer digest_frequency=weekly ausgewertet (nur senden wenn > 6 Tage vergangen).';
