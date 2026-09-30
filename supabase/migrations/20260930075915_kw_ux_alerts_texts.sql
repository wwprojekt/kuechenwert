-- ============================================================================
-- UX-Alerts: verständliche Texte (30.09.2026)
--
-- Feldnamen statt technischer Schlüssel in Titeln und Fehlerlisten
-- (kw_ux_field_label, z. B. existing_offer_studio → „Name des
-- Küchenstudios“) und Einzahl bei einem Durchlauf bzw. einer Anfrage.
-- Die Erkennung selbst ist unverändert (20260930074720_kw_ux_alerts).
-- ============================================================================

create or replace function public.kw_ux_field_label(p_field text)
returns text
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case
    when p_field is null then null
    when p_field ~ '^wall-[a-z]$' then 'Wand ' || upper(right(p_field, 1))
    else coalesce((
      select m.label
      from (values
        ('first_name', 'Vorname'), ('last_name', 'Nachname'), ('email', 'E-Mail'), ('phone', 'Telefon'),
        ('salutation', 'Anrede'), ('postal_code', 'Postleitzahl'), ('postal-code', 'Postleitzahl'),
        ('plz-early', 'Postleitzahl'), ('funnel-plz', 'Postleitzahl'), ('plz', 'Postleitzahl'), ('city', 'Ort'),
        ('existing_offer_price', 'Angebotspreis'), ('existing_offer_studio', 'Name des Küchenstudios'),
        ('offer_delivery', 'Unterlagen hochladen oder nachreichen'), ('uploads', 'Unterlagen'),
        ('remove_file', 'Datei entfernen'), ('consent_share', 'Einwilligung zur Weitergabe'),
        ('share_with_studios', 'Einwilligung zur Weitergabe'), ('consent_call', 'Einwilligung zum Rückruf'),
        ('consent_studio_call', 'Anrufe durch Studios'), ('contact_by_phone', 'Telefonkontakt'),
        ('anruf', 'Telefonkontakt'), ('marketing', 'Werbe-Einwilligung'), ('ai_training', 'KI-Training'),
        ('ceiling', 'Raumhöhe'), ('wishes', 'Wünsche'), ('timeframe', 'Zeitrahmen'), ('zeitrahmen', 'Zeitrahmen'),
        ('kitchen_form', 'Küchenform'), ('kuechenform', 'Küchenform'), ('room_type', 'Raum'),
        ('housing_type', 'Wohnsituation'), ('extra_appliances', 'Zusatzgeräte'), ('budget_eur', 'Budget')
      ) as m(key, label)
      where m.key = regexp_replace(p_field, '^kontakt-', '')
    ), p_field)
  end
$$;

revoke execute on function public.kw_ux_field_label(text) from public, anon;
grant execute on function public.kw_ux_field_label(text) to authenticated, service_role;

create or replace function public.kw_ux_detect_alerts()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  -- DEFINER: läuft stündlich per pg_cron (ohne JWT) und auf Klick für Admins;
  -- liest Telemetrie, Fehlerprotokoll und Planer tabellenübergreifend und
  -- schreibt kw_ux_alerts, auf die Clients nur den Status setzen dürfen.
  v_run timestamptz := now();
  v_since_24h timestamptz := v_run - interval '24 hours';
  v_since_7d timestamptz := v_run - interval '7 days';
  v_since_35d timestamptz := v_run - interval '35 days';
  v_candidates integer;
  v_closed integer;
  v_open integer;
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  drop table if exists pg_temp._ux_candidates, pg_temp._ux_labels, pg_temp._ux_sessions, pg_temp._ux_reach, pg_temp._ux_reach7;

  create temp table _ux_candidates (
    alert_key text primary key,
    kind text not null,
    category text not null,
    severity text not null,
    funnel text,
    step text,
    step_index smallint,
    step_label text,
    field text,
    title text not null,
    detail text not null,
    hint text not null,
    metrics jsonb not null,
    window_hours integer not null
  ) on commit drop;

  create temp table _ux_labels on commit drop as
  select distinct on (e.funnel, e.step_index) e.funnel, e.step_index, e.step, nullif(e.metadata->>'label', '') as label
  from public.kw_funnel_events e
  where e.event = 'step_enter' and e.created_at > v_since_35d
  order by e.funnel, e.step_index, e.id desc;

  create temp table _ux_sessions on commit drop as
  select e.funnel, e.session_id,
         min(e.created_at) as started_at,
         max(e.created_at) as last_seen,
         max(e.step_index) filter (where e.event = 'step_enter') as furthest,
         bool_or(e.event = 'next_clicked') as answered,
         bool_or(e.event = 'submit_succeeded') as converted
  from public.kw_funnel_events e
  where e.created_at > v_since_35d
  group by e.funnel, e.session_id;

  create temp table _ux_reach on commit drop as
  select distinct e.funnel, e.step_index, e.session_id
  from public.kw_funnel_events e
  where e.event = 'step_enter' and e.created_at > v_since_35d;

  create temp table _ux_reach7 on commit drop as
  select r.funnel, r.step_index, count(*) as reached
  from _ux_reach r
  join _ux_sessions s on s.funnel = r.funnel and s.session_id = r.session_id
  where s.started_at > v_since_7d
  group by r.funnel, r.step_index;

  -- ── kaputt: JavaScript-Fehler (24 h, ab 2 Durchläufen mit derselben Meldung)
  insert into _ux_candidates
  select 'js_error:' || x.funnel || ':' || md5(x.msg), 'js_error', 'kaputt', 'high',
         x.funnel, x.step, x.step_index, l.label, null,
         'JavaScript-Fehler im Funnel',
         format('„%s“ bei %s Durchläufen (%s-mal in 24 Stunden), zuletzt im Schritt „%s“.',
                x.msg, x.sessions, x.n, coalesce(l.label, x.step)),
         'Schritt im Browser öffnen, die Konsole prüfen und den Fehler beheben. Solange er auftritt, kann der Funnel an dieser Stelle hängen bleiben.',
         jsonb_build_object('sessions', x.sessions, 'count', x.n, 'message', x.msg, 'chunk', x.chunk, 'last_seen', x.last_seen),
         24
  from (
    select e.funnel,
           left(coalesce(nullif(e.metadata->>'message', ''), 'unbekannt'), 160) as msg,
           count(*) as n,
           count(distinct e.session_id) as sessions,
           max(e.created_at) as last_seen,
           (array_agg(e.step order by e.id desc))[1] as step,
           (array_agg(e.step_index order by e.id desc))[1] as step_index,
           bool_or(coalesce(e.metadata->>'chunk' = 'true', false)) as chunk
    from public.kw_funnel_events e
    where e.event = 'js_error' and e.created_at > v_since_24h
    group by e.funnel, 2
  ) x
  left join _ux_labels l on l.funnel = x.funnel and l.step_index = x.step_index
  where x.sessions >= 2;

  -- ── kaputt: Absenden scheitert (24 h, schon ab 1 Durchlauf – die Anfrage ist verloren)
  insert into _ux_candidates
  select 'submit_failed:' || x.funnel, 'submit_failed', 'kaputt', 'high',
         x.funnel, x.step, x.step_index, l.label, null,
         'Absenden schlägt fehl',
         format('In 24 Stunden ist das Absenden %s-mal fehlgeschlagen (betroffen: %s). Gründe: %s.',
                x.n, case when x.sessions = 1 then '1 Durchlauf' else x.sessions || ' Durchläufe' end, x.reasons),
         'Diese Anfragen sind nicht angekommen. rate_limited oder Bot-Prüfung: Rate-Limit und Turnstile prüfen; http_5xx oder network: Logs der Edge Functions kw-lead, kw-lead-b und kw-planner ansehen.',
         jsonb_build_object('sessions', x.sessions, 'count', x.n, 'reasons', x.reasons, 'last_seen', x.last_seen),
         24
  from (
    select e.funnel,
           count(*) as n,
           count(distinct e.session_id) as sessions,
           max(e.created_at) as last_seen,
           string_agg(distinct coalesce(nullif(e.metadata->>'reason', ''), 'unbekannt'), ', ') as reasons,
           (array_agg(e.step order by e.id desc))[1] as step,
           (array_agg(e.step_index order by e.id desc))[1] as step_index
    from public.kw_funnel_events e
    where e.event = 'submit_failed' and e.created_at > v_since_24h
    group by e.funnel
  ) x
  left join _ux_labels l on l.funnel = x.funnel and l.step_index = x.step_index
  where x.sessions >= 1;

  -- ── kaputt: Mehrfachklicks auf dasselbe Element (24 h, ab 2 Durchläufen)
  insert into _ux_candidates
  select 'rage_click:' || x.funnel || ':' || x.step_index || ':' || md5(x.target), 'rage_click', 'kaputt', 'medium',
         x.funnel, x.step, x.step_index, l.label, x.field,
         'Mehrfachklicks auf „' || x.target || '“',
         format('%s Durchläufe haben in 24 Stunden mehrmals schnell hintereinander auf „%s“ geklickt (Schritt „%s“).',
                x.sessions, x.target, coalesce(l.label, x.step)),
         'Reagiert das Element zu langsam oder gar nicht? Sofort einen Ladezustand zeigen, Klickflächen vergrößern; sieht etwas nur klickbar aus, das Aussehen ändern oder es klickbar machen.',
         jsonb_build_object('sessions', x.sessions, 'count', x.n, 'target', x.target, 'dead', x.dead),
         24
  from (
    select e.funnel, e.step, e.step_index,
           coalesce(nullif(e.metadata->>'label', ''), public.kw_ux_field_label(e.field_name), nullif(e.metadata->>'tag', ''), 'unbekannt') as target,
           (array_agg(e.field_name order by e.id desc))[1] as field,
           bool_or(coalesce(e.metadata->>'dead' = 'true', false)) as dead,
           count(*) as n,
           count(distinct e.session_id) as sessions
    from public.kw_funnel_events e
    where e.event = 'rage_click' and e.created_at > v_since_24h
    group by e.funnel, e.step, e.step_index, 4
  ) x
  left join _ux_labels l on l.funnel = x.funnel and l.step_index = x.step_index
  where x.sessions >= 2
  on conflict (alert_key) do nothing;

  -- ── kaputt: Fehlerprotokoll auf Funnel-Seiten (24 h, ab 2 Vorkommen oder kritisch)
  insert into _ux_candidates
  select 'error_log:' || coalesce(el.error_hash, md5(coalesce(el.error_message, '') || coalesce(el.page_path, ''))), 'error_log', 'kaputt', 'high',
         case
           when el.page_path like '/formular%' or el.page_path like '/funnel/a%' then 'a'
           when el.page_path like '/funnel/b%' then 'b'
           when el.page_path like '/funnel/c%' then 'c'
         end,
         null, null, null, null,
         'Fehler auf ' || el.page_path,
         format('„%s“ (%s-mal, zuletzt %s Uhr).', left(coalesce(el.error_message, 'unbekannt'), 160), coalesce(el.occurrence_count, 1),
                to_char(coalesce(el.last_seen_at, el.created_at) at time zone 'Europe/Berlin', 'DD.MM. HH24:MI')),
         'Browser, Schritte davor und Stacktrace stehen im Fehlerprotokoll. Nach dem Fix dort als erledigt markieren.',
         jsonb_build_object('count', coalesce(el.occurrence_count, 1), 'page', el.page_path, 'error_id', el.id, 'severity', el.severity),
         24
  from public.error_logs el
  where coalesce(el.last_seen_at, el.created_at) > v_since_24h
    and (el.page_path like '/formular%' or el.page_path like '/funnel/%')
    and not coalesce(el.is_resolved, false)
    and (coalesce(el.occurrence_count, 1) >= 2 or el.severity = 'critical')
  on conflict (alert_key) do nothing;

  -- ── kaputt: KI-Visualisierung scheitert (24 h, ab 2 Fehlern und 20 %)
  insert into _ux_candidates
  select 'render_failed', 'render_failed', 'kaputt', 'high',
         'c', 'visualisierung', null, 'Visualisierung', null,
         'KI-Visualisierung schlägt fehl',
         format('%s von %s Visualisierungen sind in 24 Stunden fehlgeschlagen. Letzter Fehler: %s', r.failed, r.total, coalesce(r.last_error, 'unbekannt')),
         'Modelle, Ausweichmodell und Tageslimit unter Admin → KI & Preis-Engine prüfen; fällt ein Anbieter aus, auf ein anderes Modell umstellen.',
         jsonb_build_object('failed', r.failed, 'total', r.total, 'rate', round(r.failed::numeric / nullif(r.total, 0), 3)),
         24
  from (
    select count(*) filter (where pr.status = 'failed') as failed,
           count(*) filter (where pr.status in ('success', 'failed')) as total,
           (array_agg(left(pr.error_message, 160) order by pr.created_at desc) filter (where pr.status = 'failed'))[1] as last_error
    from public.planner_renders pr
    where pr.created_at > v_since_24h
  ) r
  where r.failed >= 2 and r.failed::numeric / nullif(r.total, 0) >= 0.2;

  -- ── abbruch: Planungen mit KI-Bild ohne Anfrage (7 Tage, alle Besucher, ab 3 Planungen)
  insert into _ux_candidates
  select 'planner_no_request', 'planner_no_request', 'abbruch', 'medium',
         'c', 'visualisierung', null, 'Visualisierung', null,
         'KI-Bilder ohne Anfrage',
         format('%s Planungen mit fertigem KI-Bild in 7 Tagen, daraus %s (%s %%).',
                p.with_render, case when p.with_lead = 1 then '1 Anfrage' else p.with_lead || ' Anfragen' end,
                round(100.0 * p.with_lead / nullif(p.with_render, 0))),
         'Wer sein KI-Bild sieht, fragt kaum an: „Angebote erhalten“ direkt unter dem Bild anbieten, Preisrahmen und Nutzen (kostenlos, unverbindlich, geprüfte Studios) daneben zeigen und den Kontaktschritt kurz halten.',
         jsonb_build_object('with_render', p.with_render, 'with_lead', p.with_lead),
         168
  from (
    select count(*) as with_render, count(*) filter (where ps.lead_id is not null) as with_lead
    from public.planner_sessions ps
    where ps.created_at > v_since_7d
      and ps.created_at < v_run - interval '2 hours'
      and exists (select 1 from public.planner_renders pr where pr.session_id = ps.id and pr.status = 'success')
  ) p
  where p.with_render >= 3 and p.with_lead::numeric / nullif(p.with_render, 0) <= 0.2;

  -- ── abbruch: Durchläufe mit Antworten, aber keine Anfrage (7 Tage, ab 10)
  insert into _ux_candidates
  select 'no_conversions:' || s.funnel, 'no_conversions', 'abbruch', 'high',
         s.funnel, null, null, null, null,
         'Keine Anfrage trotz Durchläufen',
         format('%s Durchläufe mit mindestens einer Antwort in 7 Tagen, aber keine abgeschickte Anfrage.', count(*)),
         'Den Funnel selbst bis zum Absenden durchspielen (Handy und Rechner). Wo die meisten aussteigen, zeigen die Abbruch-Alerts.',
         jsonb_build_object('answered', count(*)),
         168
  from _ux_sessions s
  where s.started_at > v_since_7d and s.answered
  group by s.funnel
  having count(*) >= 10 and not bool_or(s.converted);

  -- ── abbruch: Schritt mit vielen Abbrüchen (7 Tage) oder deutlich mehr als in den 4 Wochen davor
  insert into _ux_candidates
  select 'dropoff:' || d.funnel || ':' || d.step_index, 'dropoff', 'abbruch', 'medium',
         d.funnel, l.step, d.step_index, l.label, null,
         case when d.spike then 'Mehr Abbrüche bei „' else 'Viele Abbrüche bei „' end || coalesce(l.label, l.step, d.step_index::text) || '“',
         case
           when d.spike then format('%s von %s Durchläufen enden hier (%s %%, in den 4 Wochen davor %s %%).',
                                    d.dropped, d.reached, round(100.0 * d.dropped / nullif(d.reached, 0)),
                                    round(100.0 * d.base_dropped / nullif(d.base_reached, 0)))
           else format('%s von %s Durchläufen enden hier (%s %%).', d.dropped, d.reached, round(100.0 * d.dropped / nullif(d.reached, 0)))
         end,
         case
           when l.step = 'kontakt' then 'Letzter Schritt vor dem Absenden: Pflichtfelder auf das Nötigste kürzen, Nutzen und Datenschutz direkt am Button nennen und erklären, wofür Telefonnummer und E-Mail gebraucht werden.'
           when l.step = 'visualisierung' then 'Nach dem KI-Bild fehlt der Anstoß: „Angebote erhalten“ prominent unter dem Bild, Preisrahmen und nächste Schritte zeigen, Wartezeit beim Erzeugen überbrücken.'
           when d.funnel = 'c' and d.step_index = 0 then 'Der Einstieg wirkt aufwendig: Foto als freiwillig kennzeichnen, Maße vorbelegt lassen und „ohne Foto weiter“ betonen.'
           else 'Frage und Antworten vereinfachen, bei nicht zwingenden Fragen „Überspringen“ anbieten und Hilfetext sowie Zeitangabe prüfen.'
         end,
         jsonb_build_object('reached', d.reached, 'dropped', d.dropped, 'rate', round(d.dropped::numeric / nullif(d.reached, 0), 3),
                            'base_reached', d.base_reached, 'base_dropped', d.base_dropped),
         168
  from (
    select a.*,
           public.kw_wilson_lower(a.dropped, a.reached) as lb,
           coalesce(a.base_reached >= 10 and a.reached >= 10
             and a.dropped::numeric / nullif(a.reached, 0) - a.base_dropped::numeric / nullif(a.base_reached, 0) >= 0.15
             and public.kw_wilson_lower(a.dropped, a.reached) > a.base_dropped::numeric / nullif(a.base_reached, 0), false) as spike
    from (
      select r.funnel, r.step_index,
             count(*) filter (where s.started_at > v_since_7d) as reached,
             count(*) filter (where s.started_at > v_since_7d and not s.converted and s.furthest = r.step_index) as dropped,
             count(*) filter (where s.started_at <= v_since_7d) as base_reached,
             count(*) filter (where s.started_at <= v_since_7d and not s.converted and s.furthest = r.step_index) as base_dropped
      from _ux_reach r
      join _ux_sessions s on s.funnel = r.funnel and s.session_id = r.session_id
      where s.last_seen < v_run - interval '30 minutes'
      group by r.funnel, r.step_index
    ) a
    where a.reached > 0
  ) d
  left join _ux_labels l on l.funnel = d.funnel and l.step_index = d.step_index
  where not (d.funnel = 'a' and d.step_index = 0)
    and d.dropped >= 3
    and (d.lb >= 0.25 or d.spike);

  -- ── reibung: fehlende Pflichtangaben (7 Tage, ab 3 Durchläufen und 15 %)
  insert into _ux_candidates
  with v as (
    select e.funnel, e.step_index, e.session_id, e.error_fields
    from public.kw_funnel_events e
    join _ux_sessions s on s.funnel = e.funnel and s.session_id = e.session_id
    where e.event = 'validation_failed' and s.started_at > v_since_7d
  ),
  agg as (
    select v.funnel, v.step_index, count(distinct v.session_id) as sessions
    from v
    group by v.funnel, v.step_index
  ),
  flds as (
    select z.funnel, z.step_index, string_agg(public.kw_ux_field_label(z.f) || ' (' || z.n || ')', ', ' order by z.n desc, z.f) as fields
    from (
      select v.funnel, v.step_index, f, count(*) as n
      from v, unnest(v.error_fields) as f
      group by v.funnel, v.step_index, f
    ) z
    group by z.funnel, z.step_index
  )
  select 'validation:' || agg.funnel || ':' || agg.step_index, 'validation', 'reibung', 'medium',
         agg.funnel, l.step, agg.step_index, l.label, null,
         'Pflichtangaben fehlen oft bei „' || coalesce(l.label, l.step, agg.step_index::text) || '“',
         format('%s von %s Durchläufen scheiterten mindestens einmal an Pflichtangaben. Häufigste Felder: %s.',
                agg.sessions, r7.reached, coalesce(flds.fields, 'unbekannt')),
         'Pflichtfelder vorher kennzeichnen, Beispiel oder Format direkt am Feld zeigen und prüfen, ob die Angabe wirklich Pflicht sein muss.',
         jsonb_build_object('sessions', agg.sessions, 'reached', r7.reached, 'fields', flds.fields),
         168
  from agg
  join _ux_reach7 r7 on r7.funnel = agg.funnel and r7.step_index = agg.step_index
  left join flds on flds.funnel = agg.funnel and flds.step_index = agg.step_index
  left join _ux_labels l on l.funnel = agg.funnel and l.step_index = agg.step_index
  where agg.sessions >= 3 and public.kw_wilson_lower(agg.sessions, r7.reached) >= 0.15;

  -- ── reibung: Felder, die leer verlassen oder oft korrigiert werden (7 Tage)
  insert into _ux_candidates
  with f as (
    select e.funnel, e.field_name,
           (array_agg(e.step order by e.id desc))[1] as step,
           (array_agg(e.step_index order by e.id desc))[1] as step_index,
           count(distinct e.session_id) filter (where e.event = 'field_focus') as focus_sessions,
           count(distinct e.session_id) filter (where e.event = 'field_blur_empty') as empty_sessions,
           count(distinct e.session_id) filter (where e.event = 'field_corrected') as corrected_sessions
    from public.kw_funnel_events e
    where e.created_at > v_since_7d
      and e.field_name is not null
      and e.event in ('field_focus', 'field_blur_empty', 'field_corrected')
    group by e.funnel, e.field_name
  )
  select 'field_empty:' || f.funnel || ':' || f.field_name, 'field_empty', 'reibung', 'low',
         f.funnel, f.step, f.step_index, l.label, f.field_name,
         'Feld „' || public.kw_ux_field_label(f.field_name) || '“ wird oft leer verlassen',
         format('%s von %s Durchläufen klicken in das Feld und verlassen es ohne Eingabe (Schritt „%s“).',
                f.empty_sessions, f.focus_sessions, coalesce(l.label, f.step)),
         'Beschriftung und Platzhalter prüfen: Ist klar, was hier hingehört und ob es Pflicht ist? Freiwilliges als „optional“ kennzeichnen oder weglassen.',
         jsonb_build_object('focus_sessions', f.focus_sessions, 'empty_sessions', f.empty_sessions),
         168
  from f
  left join _ux_labels l on l.funnel = f.funnel and l.step_index = f.step_index
  where f.empty_sessions >= 3 and public.kw_wilson_lower(f.empty_sessions, greatest(f.focus_sessions, f.empty_sessions)) >= 0.3
  union all
  select 'field_corrected:' || f.funnel || ':' || f.field_name, 'field_corrected', 'reibung', 'low',
         f.funnel, f.step, f.step_index, l.label, f.field_name,
         'Feld „' || public.kw_ux_field_label(f.field_name) || '“ wird oft korrigiert',
         format('%s von %s Durchläufen gehen zurück in das schon ausgefüllte Feld (Schritt „%s“).',
                f.corrected_sessions, f.focus_sessions, coalesce(l.label, f.step)),
         'Format erklären (Beispiel direkt am Feld), passende Tastatur und Autofill setzen und Fehler schon beim Verlassen des Felds melden.',
         jsonb_build_object('focus_sessions', f.focus_sessions, 'corrected_sessions', f.corrected_sessions),
         168
  from f
  left join _ux_labels l on l.funnel = f.funnel and l.step_index = f.step_index
  where f.corrected_sessions >= 3 and public.kw_wilson_lower(f.corrected_sessions, greatest(f.focus_sessions, f.corrected_sessions)) >= 0.2;

  -- ── reibung: Zögern, Zurück, Exit-Dialog, lange Schritte (7 Tage)
  insert into _ux_candidates
  with st as (
    select e.funnel, e.step_index,
           count(distinct e.session_id) filter (where e.event = 'idle') as idle_sessions,
           count(distinct e.session_id) filter (where e.event = 'back_clicked') as back_sessions,
           count(distinct e.session_id) filter (where e.event = 'exit_intent') as exit_sessions,
           count(distinct e.session_id) filter (where e.event = 'exit_confirmed') as exit_confirmed,
           percentile_cont(0.5) within group (order by e.time_on_step_ms::double precision)
             filter (where e.event = 'next_clicked' and e.time_on_step_ms is not null) as median_ms,
           count(*) filter (where e.event = 'next_clicked' and e.time_on_step_ms is not null) as timed
    from public.kw_funnel_events e
    where e.created_at > v_since_7d
    group by e.funnel, e.step_index
  ),
  j as (
    select st.*, r7.reached, l.step, l.label
    from st
    join _ux_reach7 r7 on r7.funnel = st.funnel and r7.step_index = st.step_index
    left join _ux_labels l on l.funnel = st.funnel and l.step_index = st.step_index
  )
  select 'idle:' || j.funnel || ':' || j.step_index, 'idle', 'reibung', 'low',
         j.funnel, j.step, j.step_index, j.label, null,
         'Nutzer zögern bei „' || coalesce(j.label, j.step, j.step_index::text) || '“',
         format('%s von %s Durchläufen waren hier mindestens 25 Sekunden ohne Eingabe.', j.idle_sessions, j.reached),
         'Die Frage verständlicher machen: Beispiele oder Bilder zeigen, einen kurzen Tipp einblenden oder eine „Weiß ich nicht“-Antwort anbieten.',
         jsonb_build_object('idle_sessions', j.idle_sessions, 'reached', j.reached),
         168
  from j
  where j.idle_sessions >= 3 and public.kw_wilson_lower(j.idle_sessions, greatest(j.reached, j.idle_sessions)) >= 0.25
  union all
  select 'back:' || j.funnel || ':' || j.step_index, 'back', 'reibung', 'low',
         j.funnel, j.step, j.step_index, j.label, null,
         'Oft zurück bei „' || coalesce(j.label, j.step, j.step_index::text) || '“',
         format('%s von %s Durchläufen gehen von hier einen Schritt zurück.', j.back_sessions, j.reached),
         'Nutzer wollen eine frühere Antwort ändern: den Zusammenhang zur vorigen Frage erklären oder die beiden Schritte zusammenlegen.',
         jsonb_build_object('back_sessions', j.back_sessions, 'reached', j.reached),
         168
  from j
  where j.back_sessions >= 3 and public.kw_wilson_lower(j.back_sessions, greatest(j.reached, j.back_sessions)) >= 0.25
  union all
  select 'exit_intent:' || j.funnel || ':' || j.step_index, 'exit_intent', 'reibung', 'low',
         j.funnel, j.step, j.step_index, j.label, null,
         'Nutzer wollen bei „' || coalesce(j.label, j.step, j.step_index::text) || '“ aussteigen',
         format('%s Durchläufe klickten hier aufs Logo und sahen den Abbruch-Dialog, %s davon verließen den Funnel.', j.exit_sessions, j.exit_confirmed),
         'Was fehlt an dieser Stelle? Vertrauen (Datenschutz, geprüfte Studios), Dauer bis zum Ziel oder eine zu persönliche Frage sind typische Gründe.',
         jsonb_build_object('exit_sessions', j.exit_sessions, 'exit_confirmed', j.exit_confirmed, 'reached', j.reached),
         168
  from j
  where j.exit_sessions >= 3
  union all
  select 'slow:' || j.funnel || ':' || j.step_index, 'slow', 'reibung', 'low',
         j.funnel, j.step, j.step_index, j.label, null,
         '„' || coalesce(j.label, j.step, j.step_index::text) || '“ dauert lange',
         format('Bis „Weiter“ vergehen hier im Median %s Sekunden (%s Durchläufe).', round((j.median_ms / 1000)::numeric), j.timed),
         'Den Schritt aufteilen oder vereinfachen: weniger Felder, sinnvolle Vorbelegung, Erklärung kürzen.',
         jsonb_build_object('median_ms', round(j.median_ms::numeric), 'timed', j.timed),
         168
  from j
  where j.timed >= 3 and j.median_ms >= 120000 and coalesce(j.step, '') not in ('visualisierung', 'kontakt');

  select count(*) into v_candidates from _ux_candidates;

  insert into public.kw_ux_alerts as a (
    alert_key, kind, category, severity, funnel, step, step_index, step_label, field,
    title, detail, hint, metrics, window_hours, status, first_seen_at, last_seen_at, occurrences
  )
  select c.alert_key, c.kind, c.category, c.severity, c.funnel, c.step, c.step_index, c.step_label, c.field,
         c.title, c.detail, c.hint, c.metrics, c.window_hours, 'open', v_run, v_run, 1
  from _ux_candidates c
  on conflict (alert_key) do update set
    kind = excluded.kind,
    category = excluded.category,
    severity = excluded.severity,
    funnel = excluded.funnel,
    step = excluded.step,
    step_index = excluded.step_index,
    step_label = excluded.step_label,
    field = excluded.field,
    title = excluded.title,
    detail = excluded.detail,
    hint = excluded.hint,
    metrics = excluded.metrics,
    window_hours = excluded.window_hours,
    last_seen_at = v_run,
    occurrences = a.occurrences + 1,
    first_seen_at = case when a.status = 'resolved' then v_run else a.first_seen_at end,
    reopened_count = a.reopened_count + case when a.status = 'resolved' then 1 else 0 end,
    status = 'open',
    resolved_at = null,
    resolved_by = null,
    resolved_note = null,
    auto_resolved = false
  -- Manuell erledigt: erst nach Ablauf des Zeitfensters wieder, dann nur mit Daten nach dem Fix.
  where a.status = 'open'
     or a.auto_resolved
     or a.resolved_at is null
     or a.resolved_at < v_run - make_interval(hours => a.window_hours);

  update public.kw_ux_alerts
     set status = 'resolved',
         resolved_at = v_run,
         auto_resolved = true,
         resolved_note = 'Seit 24 Stunden nicht mehr aufgetreten'
   where status = 'open' and last_seen_at < v_run - interval '24 hours';
  get diagnostics v_closed = row_count;

  select count(*) into v_open from public.kw_ux_alerts where status = 'open';

  return jsonb_build_object('checked_at', v_run, 'candidates', v_candidates, 'open', v_open, 'auto_resolved', v_closed);
end;
$$;

revoke execute on function public.kw_ux_detect_alerts() from public, anon;
grant execute on function public.kw_ux_detect_alerts() to authenticated, service_role;
