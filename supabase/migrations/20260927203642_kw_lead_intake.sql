-- Gemeinsamer Lead-Eingang der Funnels A, B und C (Edge Functions kw-lead,
-- kw-lead-b, kw-planner):
--  * Klick-IDs der Werbekampagne am Lead (nur mit Marketing-Einwilligung
--    vom Browser gesendet), damit Anfragen Kampagnen zugeordnet werden können.
--  * submission_id gegen Doppel-Leads bei Doppelklick oder Wiederholung.
--  * Lead und Einwilligungen in einer Transaktion.
--  * Upload-Tokens für Dateien nach dem Absenden (Funnel B, signierte URLs).
--  * Turnstile-Secret aus Supabase Vault für die Edge Functions.

alter table public.leads
  add column if not exists gclid text,
  add column if not exists gbraid text,
  add column if not exists wbraid text,
  add column if not exists msclkid text,
  add column if not exists fbclid text,
  add column if not exists submission_id uuid;

create unique index if not exists leads_submission_id_key
  on public.leads (submission_id)
  where submission_id is not null;

create table if not exists public.lead_upload_tokens (
  token_hash text primary key,
  lead_id uuid not null references public.leads (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists lead_upload_tokens_lead_id_idx on public.lead_upload_tokens (lead_id);
alter table public.lead_upload_tokens enable row level security;
revoke all on public.lead_upload_tokens from anon, authenticated;

-- SECURITY DEFINER: nur für Edge Functions mit service_role, die alle Felder
-- vorher prüfen. Übernimmt genau die Spalten, die im JSON stehen, damit
-- DB-Defaults (id, created_at, status …) greifen.
create or replace function public.kw_insert_lead_with_consents(p_lead jsonb, p_consents jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_cols text;
  v_id uuid;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into v_cols
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'leads'
     and p_lead ? c.column_name;

  if v_cols is null then
    raise exception 'kw_insert_lead_with_consents: keine bekannten Spalten';
  end if;

  execute format(
    'insert into public.leads (%1$s) select %1$s from jsonb_populate_record(null::public.leads, $1) returning id',
    v_cols
  ) into v_id using p_lead;

  insert into public.lead_consents (lead_id, user_id, purpose, granted, text_version, ip_address, user_agent)
  select v_id,
         nullif(c->>'user_id', '')::uuid,
         c->>'purpose',
         coalesce((c->>'granted')::boolean, false),
         c->>'text_version',
         nullif(c->>'ip_address', '')::inet,
         nullif(c->>'user_agent', '')
    from jsonb_array_elements(coalesce(p_consents, '[]'::jsonb)) c;

  return v_id;
end;
$$;

revoke execute on function public.kw_insert_lead_with_consents(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.kw_insert_lead_with_consents(jsonb, jsonb) to service_role;

-- SECURITY DEFINER: liest das Turnstile-Secret aus Vault; nur service_role.
create or replace function public.kw_turnstile_secret()
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select decrypted_secret
    from vault.decrypted_secrets
   where name = 'cloudflare_turnstile_secret'
   order by created_at desc
   limit 1;
$$;

revoke execute on function public.kw_turnstile_secret() from public, anon, authenticated;
grant execute on function public.kw_turnstile_secret() to service_role;
