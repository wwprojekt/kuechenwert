-- Schedule-Drift Detection RPC for /admin/cron-health.
--
-- Compares the *actual* run-frequency of each pg_cron job (last 2h) against
-- its configured schedule and returns a severity classification. Drift is
-- flagged when actual deviates >= 50% from expected.
--
-- Background: 2026-04-21 incident. A schedule change for process-photo-* crons
-- was committed to git but never persisted to the DB; the jobs ran 5x too fast
-- for 16h and overloaded the connection pool. This RPC + UI panel ensures any
-- future schedule drift becomes visible at a glance instead of slipping by.

create or replace function public.admin_get_cron_schedule_drift()
returns table (
  jobid                  bigint,
  jobname                text,
  schedule               text,
  expected_runs_per_hour numeric,
  actual_runs_per_hour   numeric,
  drift_ratio            numeric,
  severity               text
)
language plpgsql
security definer
set search_path = public, pg_catalog, cron
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nicht autorisiert' using errcode = '42501';
  end if;

  return query
  with parsed as (
    select j.jobid,
           j.jobname,
           j.schedule,
           j.active,
           case
             when btrim(j.schedule) in ('* * * * *', '*/1 * * * *') then 60.0
             when btrim(j.schedule) ~ '^\*/([0-9]+) \* \* \* \*$'
               then 60.0 / nullif(
                 (regexp_match(btrim(j.schedule), '^\*/([0-9]+) \* \* \* \*$'))[1]::numeric,
                 0
               )
             when btrim(j.schedule) ~ '^[0-9]+ \* \* \* \*$' then 1.0
             else null
           end as expected_per_hour
    from cron.job j
    where j.active = true
  ),
  actual as (
    select d.jobid,
           count(*)::numeric / 2.0 as actual_per_hour
    from cron.job_run_details d
    where d.start_time >= now() - interval '2 hours'
    group by d.jobid
  )
  select p.jobid,
         p.jobname,
         p.schedule,
         round(p.expected_per_hour, 2) as expected_runs_per_hour,
         round(coalesce(a.actual_per_hour, 0), 2) as actual_runs_per_hour,
         case
           when p.expected_per_hour is null or p.expected_per_hour = 0 then null
           else round(coalesce(a.actual_per_hour, 0) / p.expected_per_hour, 2)
         end as drift_ratio,
         case
           when p.expected_per_hour is null then 'unknown_schedule'
           when coalesce(a.actual_per_hour, 0) > p.expected_per_hour * 1.5 then 'too_fast'
           when coalesce(a.actual_per_hour, 0) < p.expected_per_hour * 0.5 then 'too_slow'
           else 'ok'
         end as severity
  from parsed p
  left join actual a on a.jobid = p.jobid
  where p.expected_per_hour is not null
  order by
    case
      when coalesce(a.actual_per_hour, 0) > p.expected_per_hour * 1.5 then 0
      when coalesce(a.actual_per_hour, 0) < p.expected_per_hour * 0.5 then 1
      else 2
    end,
    p.jobname;
end;
$$;

comment on function public.admin_get_cron_schedule_drift() is
'Admin-only. Compares actual cron run-frequency (last 2h) against the configured schedule. Returns severity too_fast / too_slow / ok / unknown_schedule per job.';

revoke execute on function public.admin_get_cron_schedule_drift() from public;
grant  execute on function public.admin_get_cron_schedule_drift() to authenticated;
