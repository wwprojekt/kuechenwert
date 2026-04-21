-- ============================================================================
-- Admin Cron-Health-Dashboard – SECURITY DEFINER RPCs
-- ----------------------------------------------------------------------------
-- Drei RPCs für ein Admin-Dashboard, das den Status aller pg_cron-Jobs sowie
-- der pg_net HTTP-Aufrufe sichtbar macht. Die Funktionen lesen aus den
-- privilegierten Schemas `cron` und `net`, die normalen Rollen verboten sind,
-- und bündeln die Auswertung serverseitig. Der Zugriff ist via has_role auf
-- 'admin' beschränkt; Nicht-Admins erhalten 42501.
--
-- Begründung SECURITY DEFINER:
--   * `cron.job` und `cron.job_run_details` gehören dem Postgres-Superuser;
--     authenticated/anon haben keinen Zugriff.
--   * `net._http_response` ebenso.
--   Daher müssen wir die Aggregation serverseitig in einer DEFINER-Funktion
--   ausführen und im Function-Body explizit die Admin-Rolle prüfen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) admin_get_cron_jobs_health
--    Liefert pro pg_cron-Job: Schedule, Aktivität, Run-Statistiken im Zeitfenster
--    sowie Details zum letzten Lauf.
-- ----------------------------------------------------------------------------
create or replace function public.admin_get_cron_jobs_health(p_hours integer default 24)
returns table (
  jobid              bigint,
  jobname            text,
  schedule           text,
  command            text,
  active             boolean,
  runs_total         bigint,
  runs_succeeded     bigint,
  runs_failed        bigint,
  last_run_start     timestamptz,
  last_run_end       timestamptz,
  last_run_status    text,
  last_run_message   text,
  last_run_duration_ms numeric,
  avg_duration_ms    numeric
)
language plpgsql
security definer
set search_path = public, pg_catalog, cron
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nicht autorisiert' using errcode = '42501';
  end if;

  if p_hours is null or p_hours <= 0 then
    p_hours := 24;
  end if;
  if p_hours > 168 then
    p_hours := 168; -- max 7 Tage
  end if;

  return query
  with runs as (
    select d.jobid,
           d.runid,
           d.status,
           d.return_message,
           d.start_time,
           d.end_time,
           extract(epoch from (d.end_time - d.start_time)) * 1000.0 as duration_ms,
           row_number() over (partition by d.jobid order by d.start_time desc) as rn
    from cron.job_run_details d
    where d.start_time >= now() - make_interval(hours => p_hours)
  ),
  agg as (
    select r.jobid,
           count(*)::bigint as runs_total,
           count(*) filter (where r.status = 'succeeded')::bigint as runs_succeeded,
           count(*) filter (where r.status <> 'succeeded')::bigint as runs_failed,
           round(avg(r.duration_ms)::numeric, 1) as avg_duration_ms
    from runs r
    group by r.jobid
  ),
  last_run as (
    select r.jobid,
           r.status,
           r.return_message,
           r.start_time,
           r.end_time,
           round(r.duration_ms::numeric, 1) as duration_ms
    from runs r
    where r.rn = 1
  )
  select j.jobid,
         j.jobname,
         j.schedule,
         j.command,
         j.active,
         coalesce(a.runs_total, 0) as runs_total,
         coalesce(a.runs_succeeded, 0) as runs_succeeded,
         coalesce(a.runs_failed, 0) as runs_failed,
         lr.start_time as last_run_start,
         lr.end_time   as last_run_end,
         lr.status     as last_run_status,
         lr.return_message as last_run_message,
         lr.duration_ms as last_run_duration_ms,
         a.avg_duration_ms
  from cron.job j
  left join agg a       on a.jobid = j.jobid
  left join last_run lr on lr.jobid = j.jobid
  order by j.jobname asc;
end;
$$;

comment on function public.admin_get_cron_jobs_health(integer) is
'Admin-only. Liefert Health-Statistiken aller pg_cron-Jobs im angegebenen Zeitfenster (Stunden, max. 168).';

-- ----------------------------------------------------------------------------
-- 2) admin_get_cron_run_history
--    Detaillierte Run-History eines einzelnen Jobs (für Detail-Drawer).
-- ----------------------------------------------------------------------------
create or replace function public.admin_get_cron_run_history(
  p_jobid bigint,
  p_limit integer default 50
)
returns table (
  runid          bigint,
  status         text,
  return_message text,
  start_time     timestamptz,
  end_time       timestamptz,
  duration_ms    numeric
)
language plpgsql
security definer
set search_path = public, pg_catalog, cron
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nicht autorisiert' using errcode = '42501';
  end if;

  if p_jobid is null then
    raise exception 'p_jobid ist erforderlich' using errcode = '22004';
  end if;

  if p_limit is null or p_limit <= 0 then
    p_limit := 50;
  end if;
  if p_limit > 500 then
    p_limit := 500;
  end if;

  return query
  select d.runid,
         d.status,
         d.return_message,
         d.start_time,
         d.end_time,
         round((extract(epoch from (d.end_time - d.start_time)) * 1000.0)::numeric, 1) as duration_ms
  from cron.job_run_details d
  where d.jobid = p_jobid
  order by d.start_time desc
  limit p_limit;
end;
$$;

comment on function public.admin_get_cron_run_history(bigint, integer) is
'Admin-only. Liefert die letzten N Run-Details eines pg_cron-Jobs.';

-- ----------------------------------------------------------------------------
-- 3) admin_get_http_response_health
--    Aggregierte HTTP-Antworten aus pg_net (von Edge-Function-Cron-Aufrufen).
--    Buckets: 2xx_success, 4xx_client, 5xx_server, 5xx_resource (546),
--    timeout, error.
-- ----------------------------------------------------------------------------
create or replace function public.admin_get_http_response_health(p_hours integer default 24)
returns table (
  status_class    text,
  total           bigint,
  last_seen       timestamptz,
  example_content text
)
language plpgsql
security definer
set search_path = public, pg_catalog, net
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nicht autorisiert' using errcode = '42501';
  end if;

  if p_hours is null or p_hours <= 0 then
    p_hours := 24;
  end if;
  if p_hours > 168 then
    p_hours := 168;
  end if;

  return query
  with classified as (
    select r.id,
           r.status_code,
           r.timed_out,
           r.error_msg,
           r.content,
           r.created,
           case
             when r.timed_out                      then 'timeout'
             when r.error_msg is not null          then 'transport_error'
             when r.status_code = 546              then '5xx_resource'
             when r.status_code between 200 and 299 then '2xx_success'
             when r.status_code between 300 and 399 then '3xx_redirect'
             when r.status_code between 400 and 499 then '4xx_client'
             when r.status_code between 500 and 599 then '5xx_server'
             else 'other'
           end as cls
    from net._http_response r
    where r.created >= now() - make_interval(hours => p_hours)
  ),
  ranked as (
    select c.cls,
           c.content,
           c.created,
           row_number() over (partition by c.cls order by c.created desc) as rn
    from classified c
  )
  select c.cls as status_class,
         count(*)::bigint as total,
         max(c.created) as last_seen,
         (
           select left(coalesce(r.content, ''), 240)
           from ranked r
           where r.cls = c.cls and r.rn = 1
         ) as example_content
  from classified c
  group by c.cls
  order by total desc;
end;
$$;

comment on function public.admin_get_http_response_health(integer) is
'Admin-only. Klassifiziert pg_net HTTP-Responses (Cron-Aufrufe) im Zeitfenster.';

-- ----------------------------------------------------------------------------
-- 4) admin_get_recent_http_failures
--    Liste der letzten fehlgeschlagenen HTTP-Responses (Status >=400, timeout
--    oder Transport-Fehler) – für eine Tabelle mit Detail-Drilldown.
-- ----------------------------------------------------------------------------
create or replace function public.admin_get_recent_http_failures(
  p_hours integer default 24,
  p_limit integer default 100
)
returns table (
  id              bigint,
  status_code     integer,
  timed_out       boolean,
  error_msg       text,
  content         text,
  created         timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog, net
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nicht autorisiert' using errcode = '42501';
  end if;

  if p_hours is null or p_hours <= 0 then
    p_hours := 24;
  end if;
  if p_hours > 168 then
    p_hours := 168;
  end if;

  if p_limit is null or p_limit <= 0 then
    p_limit := 100;
  end if;
  if p_limit > 500 then
    p_limit := 500;
  end if;

  return query
  select r.id,
         r.status_code,
         r.timed_out,
         r.error_msg,
         left(coalesce(r.content, ''), 4000) as content,
         r.created
  from net._http_response r
  where r.created >= now() - make_interval(hours => p_hours)
    and (
      r.timed_out = true
      or r.error_msg is not null
      or r.status_code is null
      or r.status_code >= 400
    )
  order by r.created desc
  limit p_limit;
end;
$$;

comment on function public.admin_get_recent_http_failures(integer, integer) is
'Admin-only. Liefert die letzten fehlgeschlagenen HTTP-Responses aus pg_net.';

-- ----------------------------------------------------------------------------
-- Permissions
--   Standardmäßig dürfen alle Rollen public-Funktionen ausführen, daher
--   restriktiver REVOKE und gezieltes GRANT an authenticated. Die Admin-
--   Prüfung erfolgt im Function-Body.
-- ----------------------------------------------------------------------------
revoke execute on function public.admin_get_cron_jobs_health(integer)         from public;
revoke execute on function public.admin_get_cron_run_history(bigint, integer)  from public;
revoke execute on function public.admin_get_http_response_health(integer)      from public;
revoke execute on function public.admin_get_recent_http_failures(integer, integer) from public;

grant execute on function public.admin_get_cron_jobs_health(integer)         to authenticated;
grant execute on function public.admin_get_cron_run_history(bigint, integer)  to authenticated;
grant execute on function public.admin_get_http_response_health(integer)      to authenticated;
grant execute on function public.admin_get_recent_http_failures(integer, integer) to authenticated;
