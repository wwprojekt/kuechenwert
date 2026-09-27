-- Newsletter ist Werbung und braucht eine ausdrueckliche Einwilligung
-- (§ 7 Abs. 2 UWG). Der alte Default `true` haette jede neu angelegte
-- Praeferenz-Zeile stillschweigend zum Newsletter angemeldet.
-- promotional_emails steht bereits auf `false`, broadcast_emails_enabled
-- (Plattform-Hinweise, keine Werbung) bleibt `true`.
alter table public.user_notification_preferences
  alter column newsletter_enabled set default false;

comment on column public.user_notification_preferences.newsletter_enabled is
  'Opt-in fuer den Newsletter. NULL/false = keine Einwilligung.';
comment on column public.user_notification_preferences.promotional_emails is
  'Opt-in fuer Werbe-Rundmails (send-broadcast-email mit is_promotional). NULL/false = keine Einwilligung.';
comment on column public.user_notification_preferences.broadcast_emails_enabled is
  'Opt-out fuer Plattform-Hinweise. Nur false schliesst aus.';
