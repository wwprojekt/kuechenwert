-- ============================================================================
-- Datenschutzerklärung: Ergebnis im Traumküchen-Planer (30.09.2026)
--
-- Abschnitt 3 („Anfragen über unsere Formulare“) sagt jetzt, dass der Planer
-- Visualisierung und Preisschätzung erst nach Name, E-Mail und Telefon zeigt
-- und per E-Mail schickt, und dass Studios die Planung ohne Angebotswunsch
-- nicht sehen (Leads ohne Ausschreibung, 20260930081500). Rechtsgrundlage und
-- Speicherdauer („Anfragen ohne Ausschreibung nach 180 Tagen“) gelten
-- unverändert. Bricht ab, wenn der Text zwischenzeitlich geändert wurde.
-- ============================================================================

do $$
declare
  v_old text := 'Bei einem Angebotsvergleich (vorhandenes Studio-Angebot) besprechen wir Ihr Angebot vorher telefonisch mit Ihnen.</p>';
  v_new text := 'Bei einem Angebotsvergleich (vorhandenes Studio-Angebot) besprechen wir Ihr Angebot vorher telefonisch mit Ihnen. '
    || 'Im Traumküchen-Planer zeigen wir Ihnen Visualisierung und Preisschätzung, sobald Sie Name, E-Mail-Adresse und Telefonnummer '
    || 'angegeben haben, und schicken Ihnen beides mit dem Link zu Ihrer Projektseite per E-Mail. Möchten Sie dabei keine Angebote, '
    || 'sehen Küchenstudios Ihre Planung nicht; Angebote können Sie später auf Ihrer Projektseite anfordern.</p>';
  v_content text;
begin
  select content into v_content from public.legal_pages where slug = 'datenschutz';
  if v_content is null then
    raise exception 'Datenschutzerklärung fehlt';
  end if;
  if strpos(v_content, 'Im Traumküchen-Planer zeigen wir Ihnen Visualisierung und Preisschätzung') > 0 then
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
