-- Phase 2.5c: INSERT-Policies fuer Lead-Funnel.
--
-- Die leads-Tabelle erlaubt aktuell nur Admins zum INSERT. Fuer den Funnel-Bau
-- brauchen wir, dass anonymous + authenticated Nutzer ein Lead einreichen
-- koennen - aber NUR mit validen Defaults und sinnvollen Feldern.
--
-- Sicherheit fuer die Zukunft:
--   - Rate-Limit via IP/Supabase-Edge-Function kommt spaeter.
--   - Bot-Protection via Cloudflare Turnstile kommt spaeter.
--   - Hier nur DB-Level-Validierung (Felder, Enums, NOT NULL).

-- Anonymous Nutzer (nicht eingeloggt): koennen ein Lead einreichen,
-- ohne user_id, mit Default-status='new'/tier='standard'/score=0.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'leads'
      and policyname = 'Leads: anon insert via funnel'
  ) then
    create policy "Leads: anon insert via funnel"
      on public.leads
      for insert
      to anon
      with check (
        funnel_type in ('a', 'b', 'traumkueche')
        and postal_code is not null
        and length(postal_code) = 5
        and postal_code ~ '^[0-9]{5}$'
        and status = 'new'
        and tier = 'standard'
        and score = 0
        and user_id is null
      );
  end if;
end $$;

-- Authenticated Nutzer: koennen ein Lead einreichen, entweder ohne user_id
-- oder mit ihrer eigenen auth.uid() als user_id.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'leads'
      and policyname = 'Leads: authenticated insert own'
  ) then
    create policy "Leads: authenticated insert own"
      on public.leads
      for insert
      to authenticated
      with check (
        funnel_type in ('a', 'b', 'traumkueche')
        and postal_code is not null
        and length(postal_code) = 5
        and postal_code ~ '^[0-9]{5}$'
        and status = 'new'
        and tier = 'standard'
        and score = 0
        and (user_id is null or user_id = auth.uid())
      );
  end if;
end $$;

-- Catalog-Tabellen: Lesezugriff fuer alle (anon + authenticated).
-- Fuer Funnel-Stammdaten-Loader brauchen wir das. Schreibzugriff bleibt
-- nur fuer admin (bereits durch bestehende Policies geregelt).
do $$
declare
  tbl text;
begin
  for tbl in (
    select unnest(array[
      'catalog_kitchen_brands',
      'catalog_front_materials',
      'catalog_handle_types',
      'catalog_worktop_materials',
      'catalog_worktop_designs',
      'catalog_appliance_categories',
      'catalog_appliance_brands',
      'catalog_sink_brands',
      'catalog_sink_materials'
    ])
  ) loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl
        and policyname = format('%s: public read active', tbl)
    ) then
      execute format(
        'create policy %L on public.%I for select to anon, authenticated using (is_active = true)',
        format('%s: public read active', tbl),
        tbl
      );
    end if;
  end loop;
end $$;
