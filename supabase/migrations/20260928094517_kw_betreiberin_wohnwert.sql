-- Betreiberin von KüchenWert ist die WohnWert GmbH (Anschrift, HRB 230114 und
-- Geschäftsführung wie bisher, siehe Impressum von wohnwert24.de); die
-- Rechtstexte nannten noch die CaravanWert GmbH. Dazu im Impressum die
-- USt-ID und die Angabe nach § 18 Abs. 2 MStV.

update public.legal_pages
set content = replace(replace(replace(replace(content,
      '<strong>CaravanWert GmbH</strong>', '<strong>WohnWert GmbH</strong>'),
      'KüchenWert ist eine Marke der CaravanWert GmbH.', 'KüchenWert ist eine Marke der WohnWert GmbH.'),
      '§ 27 a Umsatzsteuergesetz: <em>wird nachgereicht</em>', '§ 27 a Umsatzsteuergesetz: DE462042479'),
      '<h2>Redaktionell verantwortlich</h2>', '<h2>Verantwortlich i. S. d. § 18 Abs. 2 MStV</h2>'),
    meta_description = replace(meta_description, 'CaravanWert GmbH', 'WohnWert GmbH'),
    updated_at = now()
where slug = 'impressum';

update public.legal_pages
set content = replace(content,
      'CaravanWert GmbH (Betreiberin der Marke KüchenWert)', 'WohnWert GmbH (Betreiberin der Marke KüchenWert)'),
    updated_at = now()
where slug = 'datenschutz';

update public.legal_pages
set content = replace(content,
      '<strong>CaravanWert GmbH</strong>, Hannoversche Str. 106', '<strong>WohnWert GmbH</strong>, Hannoversche Str. 106'),
    meta_description = replace(meta_description, 'CaravanWert GmbH', 'WohnWert GmbH'),
    updated_at = now()
where slug = 'agb';

do $$
begin
  if exists (
    select 1 from public.legal_pages
    where content || coalesce(meta_description, '') ilike '%caravanwert gmbh%'
  ) then
    raise exception 'legal_pages nennt noch die CaravanWert GmbH';
  end if;
  if not exists (
    select 1 from public.legal_pages
    where slug = 'impressum'
      and content like '%<strong>WohnWert GmbH</strong>%'
      and content like '%DE462042479%'
      and content like '%§ 18 Abs. 2 MStV%'
  ) then
    raise exception 'Impressum nicht wie erwartet aktualisiert';
  end if;
end $$;
