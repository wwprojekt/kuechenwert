-- ============================================================================
-- log_error absichern (28.09.2026)
--
-- Die RPC ist für anon freigegeben und läuft als SECURITY DEFINER. Bisher
-- übernahm sie Nutzer-ID, E-Mail und Rolle ungeprüft vom Client (Einträge
-- ließen sich beliebigen Nutzern unterschieben, beim Deduplizieren sogar
-- nachträglich umhängen), hatte weder Größen- noch Mengenbegrenzung und
-- speicherte Projektlinks (Zugangsschlüssel) aus page_url.
--
-- Jetzt: Identität aus auth.uid(), Längen- und JSON-Größenlimits, Rate-Limit
-- pro Nutzer bzw. IP (30/min) plus globaler Deckel (2000/10 min), Projektlinks
-- geschwärzt, unbekannte Schweregrade → low. Die alte 17-Parameter-Variante
-- wird nicht mehr aufgerufen und entfällt.
-- ============================================================================

drop function if exists public.log_error(text, text, text, text, text, text, text, text, uuid, text, text, text, text, jsonb, text, text, text);

create or replace function public.kw_clip_json(p_value jsonb, p_max_bytes integer, p_fallback jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case
    when p_value is null then p_fallback
    when octet_length(p_value::text) > p_max_bytes then jsonb_build_object('truncated', true, 'bytes', octet_length(p_value::text))
    else p_value
  end;
$$;

create or replace function public.kw_redact_project_links(p_value text)
returns text
language sql
immutable
set search_path = public, pg_catalog
as $$
  select regexp_replace(p_value, '/projekt/[A-Za-z0-9_-]{16,}', '/projekt', 'g');
$$;

create or replace function public.log_error(
  p_error_code text,
  p_error_message text,
  p_error_category text default 'unknown',
  p_severity text default 'low',
  p_page_url text default '',
  p_page_path text default '',
  p_page_title text default null,
  p_component_name text default null,
  p_user_id uuid default null,
  p_user_role text default null,
  p_user_email text default null,
  p_stack_trace text default null,
  p_original_error text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_user_agent text default null,
  p_browser text default null,
  p_device_type text default null,
  p_error_hash text default null,
  p_session_id text default null,
  p_app_version text default null,
  p_http_status integer default null,
  p_request_info jsonb default '{}'::jsonb,
  p_breadcrumbs jsonb default '[]'::jsonb,
  p_environment text default 'production',
  p_error_source text default 'caught',
  p_screen_resolution text default null,
  p_connection_type text default null,
  p_memory_usage jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  -- DEFINER: anonyme Besucher dürfen Fehler melden, aber error_logs nicht
  -- direkt beschreiben. Identität, Größen und Menge bestimmt diese Funktion;
  -- p_user_id, p_user_role und p_user_email werden ignoriert.
  v_uid uuid := auth.uid();
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_ip text := coalesce(
    nullif(trim(v_headers->>'cf-connecting-ip'), ''),
    nullif(trim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)), ''),
    'unknown'
  );
  v_allowed boolean;
  v_email text;
  v_role text := 'anonymous';
  v_hash text := left(nullif(trim(p_error_hash), ''), 128);
  v_existing_id uuid;
  v_id uuid;
begin
  if coalesce(trim(p_error_message), '') = '' then
    return null;
  end if;

  select allowed into v_allowed
  from public.planner_rate_limit_increment('log_error:' || coalesce(v_uid::text, v_ip), 60, 30);
  if v_allowed is false then
    return null;
  end if;
  select allowed into v_allowed from public.planner_rate_limit_increment('log_error:global', 600, 2000);
  if v_allowed is false then
    return null;
  end if;

  if v_uid is not null then
    select u.email into v_email from auth.users u where u.id = v_uid;
    select r.role::text into v_role
    from public.user_roles r
    where r.user_id = v_uid
    order by case r.role::text when 'admin' then 1 when 'dealer' then 2 else 3 end
    limit 1;
    v_role := coalesce(v_role, 'customer');
  end if;

  if v_hash is not null then
    select id into v_existing_id
    from public.error_logs
    where error_hash = v_hash
      and is_resolved = false
      and created_at > now() - interval '24 hours'
    order by created_at desc
    limit 1;

    if v_existing_id is not null then
      update public.error_logs
      set occurrence_count = occurrence_count + 1,
          last_seen_at = now(),
          updated_at = now(),
          user_id = coalesce(user_id, v_uid),
          user_email = coalesce(user_email, v_email),
          user_role = case when user_id is null and v_uid is not null then v_role else user_role end
      where id = v_existing_id;
      return v_existing_id;
    end if;
  end if;

  insert into public.error_logs (
    error_code, error_message, error_category, severity,
    page_url, page_path, page_title, component_name,
    user_id, user_role, user_email,
    stack_trace, original_error, metadata,
    user_agent, browser, device_type,
    error_hash, session_id, app_version,
    http_status, request_info, breadcrumbs,
    environment, error_source, screen_resolution,
    connection_type, memory_usage,
    first_seen_at, last_seen_at
  ) values (
    left(coalesce(nullif(trim(p_error_code), ''), 'UNKNOWN'), 100),
    left(p_error_message, 2000),
    left(coalesce(nullif(trim(p_error_category), ''), 'unknown'), 50),
    case when p_severity in ('low', 'medium', 'high', 'critical') then p_severity else 'low' end,
    left(public.kw_redact_project_links(coalesce(p_page_url, '')), 1000),
    left(public.kw_redact_project_links(coalesce(p_page_path, '')), 500),
    left(p_page_title, 300),
    left(p_component_name, 200),
    v_uid, v_role, v_email,
    left(p_stack_trace, 8000),
    left(public.kw_redact_project_links(p_original_error), 4000),
    public.kw_clip_json(p_metadata, 16384, '{}'::jsonb),
    left(p_user_agent, 500),
    left(p_browser, 100),
    left(p_device_type, 50),
    v_hash,
    left(p_session_id, 100),
    left(p_app_version, 50),
    case when p_http_status between 100 and 599 then p_http_status end,
    public.kw_clip_json(p_request_info, 8192, '{}'::jsonb),
    public.kw_clip_json(p_breadcrumbs, 16384, '[]'::jsonb),
    case when p_environment in ('production', 'staging', 'development') then p_environment else 'production' end,
    left(coalesce(nullif(trim(p_error_source), ''), 'caught'), 50),
    left(p_screen_resolution, 50),
    left(p_connection_type, 50),
    public.kw_clip_json(p_memory_usage, 2048, null),
    now(), now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.kw_clip_json(jsonb, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.kw_redact_project_links(text) from public, anon, authenticated;

revoke execute on function public.log_error(text, text, text, text, text, text, text, text, uuid, text, text, text, text, jsonb, text, text, text, text, text, text, integer, jsonb, jsonb, text, text, text, text, jsonb) from public;
grant execute on function public.log_error(text, text, text, text, text, text, text, text, uuid, text, text, text, text, jsonb, text, text, text, text, text, text, integer, jsonb, jsonb, text, text, text, text, jsonb) to anon, authenticated, service_role;
