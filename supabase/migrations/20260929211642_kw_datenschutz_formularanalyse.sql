-- ============================================================================
-- Datenschutzerklärung: Formularanalyse (29.09.2026)
--
-- Abschnitt 7 („Statistik (nur mit Einwilligung)“) beschreibt die neue
-- Funnel-Telemetrie genauer (kw_funnel_events, 20260929211605): Schritte,
-- Verweildauer, angeklickte oder leer gelassene Felder, Hinweise und
-- technische Fehler – ohne Eingaben, 90 Tage. Sie läuft wie die bisherige
-- Schrittanalyse nur mit Statistik-Einwilligung, bestehende Einwilligungen
-- gelten weiter. Bricht ab, wenn der Text zwischenzeitlich geändert wurde.
-- ============================================================================

do $$
declare
  v_old text := 'Zusätzlich speichern wir Seitenaufrufe und diese Schritte pseudonymisiert in unserer eigenen Datenbank.</p>';
  v_new text := 'Zusätzlich speichern wir Seitenaufrufe und den Ablauf in unseren Formularen pseudonymisiert in unserer eigenen Datenbank: '
    || 'welche Schritte Sie aufrufen, wie lange Sie dort bleiben, welche Felder Sie anklicken oder leer lassen und welche Hinweise '
    || 'oder technischen Fehler dabei erscheinen. Ihre Eingaben selbst speichern wir dafür nicht. Diese Formulardaten löschen wir nach 90 Tagen.</p>';
  v_content text;
begin
  select content into v_content from public.legal_pages where slug = 'datenschutz';
  if v_content is null then
    raise exception 'Datenschutzerklärung fehlt';
  end if;
  if strpos(v_content, 'Diese Formulardaten löschen wir nach 90 Tagen.') > 0 then
    return;
  end if;
  if strpos(v_content, v_old) = 0 then
    raise exception 'Datenschutzerklärung wurde zwischenzeitlich geändert – Ersetzung abgebrochen';
  end if;
  update public.legal_pages
     set content = replace(v_content, v_old, v_new),
         updated_at = now(),
         published_at = now(),
         version = version + 1
   where slug = 'datenschutz';
end $$;
