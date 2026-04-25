-- Sofortkauf-Alert (Suchagent) fuer Haendler.
--
-- 1. `public.dealer_instant_buy_alerts` speichert die Filter-Konfiguration pro
--    Haendler (1 Row pro User, user_id = PK). RLS erlaubt nur dem Eigentuemer
--    SELECT/INSERT/UPDATE/DELETE.
-- 2. `public.instant_buy_alerts_sent` dedupliziert den Versand: pro
--    (auction_id, user_id) maximal eine Alert-Mail. Keine RLS (nur
--    service_role-Zugriff; kein direkter PostgREST-Pfad).
-- 3. `admin_emails.email_type`-CHECK um `dealer_instant_buy_alert` erweitert,
--    damit der Log-Insert in der neuen Edge Function funktioniert.
-- 4. Cron-Job `send-instant-buy-alerts` laeuft alle 15 Minuten und ruft
--    die gleichnamige Edge Function auf (wie process-scheduled-emails und
--    send-dealer-auction-digest ueber Vault-Secrets).

-- ─── 1. Haendler-Filter-Tabelle ────────────────────────────────────────
create table if not exists public.dealer_instant_buy_alerts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  min_price numeric,
  max_price numeric,
  manufacturers text[] not null default '{}',
  body_types text[] not null default '{}',
  countries text[] not null default '{}',
  min_year int,
  max_year int,
  max_mileage int,
  last_alert_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.dealer_instant_buy_alerts is
  'Haendler-Suchagent fuer neue Sofortkauf-Inserate (sale_channel=instant_price). Wird alle 15 Minuten vom Cron `send-instant-buy-alerts` ausgewertet. Leere Filter-Arrays bedeuten "Alle Werte erlaubt".';

alter table public.dealer_instant_buy_alerts enable row level security;

drop policy if exists "dealer_instant_buy_alerts_select_own"
  on public.dealer_instant_buy_alerts;
create policy "dealer_instant_buy_alerts_select_own"
  on public.dealer_instant_buy_alerts
  for select
  using (auth.uid() = user_id);

drop policy if exists "dealer_instant_buy_alerts_insert_own"
  on public.dealer_instant_buy_alerts;
create policy "dealer_instant_buy_alerts_insert_own"
  on public.dealer_instant_buy_alerts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "dealer_instant_buy_alerts_update_own"
  on public.dealer_instant_buy_alerts;
create policy "dealer_instant_buy_alerts_update_own"
  on public.dealer_instant_buy_alerts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "dealer_instant_buy_alerts_delete_own"
  on public.dealer_instant_buy_alerts;
create policy "dealer_instant_buy_alerts_delete_own"
  on public.dealer_instant_buy_alerts
  for delete
  using (auth.uid() = user_id);

create index if not exists idx_dealer_instant_buy_alerts_enabled
  on public.dealer_instant_buy_alerts (enabled)
  where enabled = true;

-- ─── 2. Dedup-Log ──────────────────────────────────────────────────────
create table if not exists public.instant_buy_alerts_sent (
  auction_id uuid not null,
  user_id uuid not null,
  sent_at timestamptz not null default now(),
  primary key (auction_id, user_id)
);

comment on table public.instant_buy_alerts_sent is
  'Deduplication fuer Sofortkauf-Alerts. Jeder Haendler bekommt max. eine Alert-Mail pro Sofortkauf-Listing. Wird von send-instant-buy-alert befuellt.';

alter table public.instant_buy_alerts_sent enable row level security;

-- Kein Policy => PostgREST sieht die Tabelle fuer authenticated/anon nicht.
-- service_role bypass RLS, das reicht fuer den Cron-Flow.

create index if not exists idx_instant_buy_alerts_sent_user_sent_at
  on public.instant_buy_alerts_sent (user_id, sent_at desc);

-- ─── 3. admin_emails.email_type CHECK um neuen Wert erweitern ──────────
alter table public.admin_emails
  drop constraint if exists admin_emails_email_type_check;

alter table public.admin_emails
  add constraint admin_emails_email_type_check
  check (email_type = any (array[
    'single'::text, 'broadcast'::text, 'reply'::text, 'inbound'::text, 'auto'::text,
    'welcome'::text, 'auto_response'::text,
    'wizard_resume'::text, 'wizard_recovery_first'::text, 'wizard_recovery_followup'::text,
    'appointment_confirmation'::text, 'appointment_pin'::text, 'appointment_reminder'::text,
    'auction_ending_soon'::text, 'auction_summary'::text, 'auction_winner'::text,
    'auction_new'::text, 'auction_update'::text, 'auction_ended'::text,
    'auction_new_auction'::text, 'auction_new_bid'::text, 'auction_outbid'::text,
    'auction_won'::text, 'auction_lost'::text, 'auction_auction_started'::text,
    'auction_seller_sold'::text, 'auction_seller_not_sold'::text,
    'auction_kaufchance_invite'::text, 'auction_seller_kaufchance'::text,
    'auction_seller_relisted'::text, 'auction_kaufchance_expired'::text,
    'auction_seller_auto_relisted'::text, 'auction_auction_relisted'::text,
    'auction_seller_new_offer'::text, 'auction_admin_new_offer'::text,
    'auction_buyer_offer_rejected'::text, 'auction_buyer_counter_offer'::text,
    'auction_seller_buyer_rejected'::text,
    'auction_seller_festpreis_extended'::text, 'auction_admin_festpreis_needs_price'::text,
    'auction_seller_festpreis_round_warning'::text, 'auction_seller_auction_round_warning'::text,
    'auction_seller_soft_brake'::text, 'auction_seller_festpreis_cap_reached'::text,
    'auction_seller_existing_listing_optin'::text,
    'bid_confirmed'::text, 'bid_outbid'::text,
    'payment_confirmation'::text, 'payment_reminder'::text,
    'invoice'::text, 'inactivity'::text,
    'favorite_notification'::text, 'favorite_price_change'::text,
    'expert_valuation'::text, 'registration_invite'::text,
    'wrong_number_followup'::text, 'no_answer_followup'::text,
    'considering_followup'::text, 'done_followup'::text,
    'purchase_inquiry_dealer'::text, 'purchase_inquiry_customer'::text,
    'purchase_contract'::text, 'purchase_contract_notification'::text,
    'handover_protocol_blank'::text,
    'lead_admin_wertermittlung'::text, 'lead_admin_wertrechner'::text,
    'lead_admin_wizard'::text, 'lead_admin_kontakt'::text, 'lead_admin_dealer'::text,
    'lead_user_wertermittlung'::text, 'lead_user_wertrechner'::text,
    'lead_user_wizard'::text, 'lead_user_kontakt'::text, 'lead_user_dealer'::text,
    'dealer_welcome'::text, 'dealer_approved'::text, 'dealer_rejected'::text,
    'dealer_suspended'::text, 'dealer_reactivated'::text,
    'dealer_level_change'::text, 'dealer_registration_invite'::text,
    'dealer_first_nudge'::text, 'dealer_auction_digest'::text,
    'dealer_instant_buy_alert'::text,
    'dunning_level_1'::text, 'dunning_level_2'::text, 'dunning_level_3'::text,
    'dunning_level_4'::text, 'dunning_level_5'::text,
    'scheduled'::text, 'vehicle_question'::text,
    'dealer_documents_request'::text, 'google_review_request'::text
  ]));

-- ─── 4. Cron: send-instant-buy-alerts alle 15 Minuten ─────────────────
do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-instant-buy-alerts') then
    perform cron.unschedule('send-instant-buy-alerts');
  end if;
end $$;

select cron.schedule(
  'send-instant-buy-alerts',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-instant-buy-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
