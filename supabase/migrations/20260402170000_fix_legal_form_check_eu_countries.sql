-- Fix: dealer_applications_legal_form_check erweitern für alle EU-Länder
-- 
-- Problem: Die Constraint erlaubte nur deutsche Rechtsformen (GmbH, UG, AG, etc.)
-- aber das Frontend unterstützt 28 EU-Länder mit länderspezifischen Rechtsformen.
-- Beim Anlegen eines NL-Händlers mit Rechtsform 'BV' schlug die Constraint fehl.
--
-- Lösung: Constraint durch eine erweiterte Version ersetzen, die alle Rechtsformen
-- aus euCountries.ts akzeptiert, oder einfach die Constraint entfernen und die
-- Validierung dem Frontend überlassen (da die Werte dynamisch pro Land sind).

-- Alte Constraint entfernen
ALTER TABLE public.dealer_applications DROP CONSTRAINT IF EXISTS dealer_applications_legal_form_check;

-- Neue Constraint: NULL erlaubt + alle EU-Rechtsformen aus euCountries.ts
ALTER TABLE public.dealer_applications ADD CONSTRAINT dealer_applications_legal_form_check
CHECK (
  legal_form IS NULL OR legal_form = ANY (ARRAY[
    -- DE (Deutschland)
    'Einzelunternehmen', 'GmbH', 'UG', 'GbR', 'KG', 'OHG', 'AG', 'GmbH & Co. KG',
    -- AT (Österreich)
    'OG', 'GesbR',
    -- CH (Schweiz)
    'KlG', 'KmG',
    -- NL (Niederlande)
    'Eenmanszaak', 'BV', 'NV', 'VOF', 'CV', 'Maatschap',
    -- BE (Belgien) - Eenmanszaak, BV, NV, VOF, CV already listed
    -- FR (Frankreich)
    'EI', 'SARL', 'SAS', 'SA', 'EURL', 'SCI',
    -- IT (Italien)
    'Ditta individuale', 'SRL', 'SPA',
    -- (SAS already listed from FR, SNC shared)
    'SNC',
    -- ES (Spanien)
    'Autónomo', 'SL', 'SC', 'SLL',
    -- (SA already listed)
    -- PT (Portugal)
    'ENI', 'Lda',
    -- (SA, SNC already listed)
    -- PL (Polen)
    'JDG', 'Sp. z o.o.', 'Sp.k.', 'Sp.j.',
    -- (SA already listed)
    -- CZ (Tschechien)
    'OSVČ', 's.r.o.', 'a.s.', 'v.o.s.', 'k.s.',
    -- SK (Slowakei)
    'SZČO',
    -- (s.r.o., a.s., v.o.s., k.s. already listed)
    -- HU (Ungarn)
    'EV', 'Kft', 'Rt', 'Bt', 'Kkt',
    -- RO (Rumänien)
    'PFA',
    -- (SRL, SA, SNC, SCS already listed)
    'SCS',
    -- BG (Bulgarien)
    'ET', 'OOD', 'AD', 'SD', 'KD',
    -- HR (Kroatien)
    'Obrt', 'd.o.o.', 'd.d.', 'j.d.o.o.',
    -- SI (Slowenien)
    's.p.', 'k.d.', 'd.n.o.',
    -- (d.o.o., d.d. already listed)
    -- DK (Dänemark)
    'Enkeltmandsvirksomhed', 'ApS', 'A/S', 'I/S', 'K/S',
    -- SE (Schweden)
    'Enskild firma', 'AB', 'HB', 'KB',
    -- FI (Finnland)
    'Toiminimi', 'Oy', 'Oyj', 'Ky', 'Ay',
    -- IE (Irland)
    'Sole Trader', 'Ltd', 'PLC', 'LP',
    -- LU (Luxemburg)
    'SCA',
    -- (EI, SARL, SA, SCS already listed)
    -- GR (Griechenland)
    'Ατομική', 'ΕΠΕ', 'ΑΕ', 'ΟΕ', 'ΙΚΕ',
    -- EE (Estland)
    'FIE', 'OÜ', 'AS',
    -- LV (Lettland)
    'IK', 'SIA',
    -- (AS already listed)
    -- LT (Litauen)
    'IĮ', 'UAB', 'TŪB', 'KŪB',
    -- (AB already listed)
    -- MT (Malta) + CY (Zypern)
    -- (Sole Trader, Ltd, PLC already listed)
    -- Sonstige (Zukunftssicherheit)
    'Sonstige'
  ])
);
