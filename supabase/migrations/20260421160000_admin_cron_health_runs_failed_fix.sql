-- ============================================================================
-- Fix admin_get_cron_jobs_health: runs_failed nur echte Failures, nicht
-- "starting"/"running". pg_cron status-Werte: starting | running | succeeded
-- | failed. Vorherige Implementierung nutzte `<> 'succeeded'` und hätte
-- laufende Jobs fälschlich als Fehler gezählt.
-- ============================================================================
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
    p_hours := 168;
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
           count(*) filter (where r.status = 'failed')::bigint as runs_failed,
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
