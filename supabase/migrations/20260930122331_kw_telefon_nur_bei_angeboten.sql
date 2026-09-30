-- ============================================================================
-- Datenschutzerklärung: Telefonnummer nur bei Angeboten (30.09.2026)
--
-- Der Traumküchen-Planer verlangt die Telefonnummer nur noch mit „Ja,
-- Angebote“ (oder für eine gewünschte Beratung per Telefon); Visualisierung
-- und Preisschätzung gibt es schon mit Name und E-Mail-Adresse. Die
-- erweiterten Conversions senden die Telefonnummer nur, wenn sie angegeben
-- wurde. Bricht ab, wenn der Text zwischenzeitlich geändert wurde.
-- ============================================================================

do $$
declare
  v_content text;
  v_pairs text[][] := array[
    array[
      'sobald Sie Name, E-Mail-Adresse und Telefonnummer angegeben haben,',
      'sobald Sie Name und E-Mail-Adresse angegeben haben (möchten Sie Angebote, auch Ihre Telefonnummer),'
    ],
    array[
      'übermitteln wir dafür E-Mail-Adresse, Telefonnummer, Name und Postleitzahl',
      'übermitteln wir dafür E-Mail-Adresse, Telefonnummer (sofern angegeben), Name und Postleitzahl'
    ]
  ];
  i integer;
begin
  select content into v_content from public.legal_pages where slug = 'datenschutz';
  if v_content is null then
    raise exception 'Datenschutzerklärung fehlt';
  end if;
  if strpos(v_content, 'möchten Sie Angebote, auch Ihre Telefonnummer') > 0 then
    return;
  end if;
  for i in 1 .. array_length(v_pairs, 1) loop
    if strpos(v_content, v_pairs[i][1]) = 0 then
      raise exception 'Datenschutzerklärung wurde zwischenzeitlich geändert (%) – Ersetzung abgebrochen', left(v_pairs[i][1], 60);
    end if;
    v_content := replace(v_content, v_pairs[i][1], v_pairs[i][2]);
  end loop;
  update public.legal_pages
     set content = v_content,
         updated_at = now(),
         published_at = now(),
         version = version + 1
   where slug = 'datenschutz';
end $$;
