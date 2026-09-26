-- ============================================================================
-- Funktionskörper nach der Umbenennung motorhomes -> kitchens reparieren
--
-- Die Tabelle public.motorhomes heißt public.kitchens, alle Spalten
-- motorhome_id heißen kitchen_id, und die Hilfsfunktionen
-- process_search_alerts_for_motorhome / update_motorhome_damage_status heißen
-- process_search_alerts_for_kitchen / update_kitchen_damage_status.
-- PostgreSQL passt gespeicherte Funktionskörper dabei nicht an: 28 Funktionen
-- (davon 7 Trigger) scheiterten zur Laufzeit mit 42P01/42703. Unter anderem
-- brach der Trigger auf user_roles jede Studio-Freischaltung ab, und das
-- Anlegen von Küchen-Inseraten scheiterte am Suchalarm-Trigger.
--
-- Ersetzt werden nur Bezeichner. Zeichenketten in einfachen Anführungszeichen
-- (JSON-Schlüssel wie 'motorhome_id', Fehlercodes, audit entity_type) und
-- Parameternamen (p_motorhome_id, motorhome_id_param) bleiben unverändert,
-- damit sich weder Signaturen noch API-Antworten ändern. Idempotent; der
-- Block bricht ab, falls danach noch Verweise übrig sind.
-- ============================================================================
do $$
declare
  r record;
  v_def text;
  v_new text;
  v_fixed integer := 0;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosrc ~ '\m(motorhomes|motorhome_id|process_search_alerts_for_motorhome|update_motorhome_damage_status)\M'
  loop
    v_def := pg_get_functiondef(r.oid);
    v_new := regexp_replace(v_def, '(?<!'')\mmotorhomes\M(?!'')', 'kitchens', 'g');
    v_new := regexp_replace(v_new, '(?<!'')\mmotorhome_id\M(?!'')', 'kitchen_id', 'g');
    v_new := regexp_replace(v_new, '\mprocess_search_alerts_for_motorhome\M', 'process_search_alerts_for_kitchen', 'g');
    v_new := regexp_replace(v_new, '\mupdate_motorhome_damage_status\M', 'update_kitchen_damage_status', 'g');
    if v_new is distinct from v_def then
      execute v_new;
      v_fixed := v_fixed + 1;
    end if;
  end loop;
  raise notice 'kw_fix_kitchen_rename_in_functions: % Funktionen korrigiert', v_fixed;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (
        regexp_replace(p.prosrc, '''[^'']*''', '', 'g') ~ '\m(motorhomes|motorhome_id)\M'
        or p.prosrc ~ '\m(process_search_alerts_for_motorhome|update_motorhome_damage_status)\M'
      )
  ) then
    raise exception 'kw_fix_kitchen_rename_in_functions: es verweisen noch Funktionen auf motorhomes/motorhome_id';
  end if;
end $$;
