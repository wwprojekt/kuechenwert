-- ============================================================================
-- KuechenWert Phase 2.1 Seeds
--
-- Teil 1: Stammdaten-Kataloge (9 Tabellen, ~135 Zeilen)
-- Teil 2: Lead-Pricing-Defaults (16 Rules) + Commission-Tiers (5 Tiers)
-- Teil 3: kitchen_price_brackets (288 Brackets via Prozedur)
--
-- Alle Seeds idempotent via `on conflict ... do nothing` bzw. `delete + insert`
-- im Falle von kitchen_price_brackets.
-- ============================================================================

-- ---------------------------------------------------------------------
-- Teil 1: STAMMDATEN-KATALOGE
-- ---------------------------------------------------------------------

insert into public.catalog_kitchen_brands (name, slug, segment, sort_order) values
  ('Nobilia',          'nobilia',          'mittel',  10),
  ('Hacker',           'haecker',          'mittel',  20),
  ('Schuller',         'schueller',        'mittel',  30),
  ('Nolte',            'nolte',            'mittel',  40),
  ('Pino',             'pino',             'budget',  50),
  ('Bauformat',        'bauformat',        'budget',  60),
  ('Burger',           'burger',           'mittel',  70),
  ('Beckermann',       'beckermann',       'mittel',  80),
  ('Ballerina',        'ballerina',        'mittel',  90),
  ('Rotpunkt',         'rotpunkt',         'mittel',  100),
  ('Stoermer',         'stoermer',         'mittel',  110),
  ('Rational',         'rational',         'premium', 120),
  ('Leicht',           'leicht',           'premium', 130),
  ('SieMatic',         'siematic',         'premium', 140),
  ('Bulthaup',         'bulthaup',         'luxus',   150),
  ('Poggenpohl',       'poggenpohl',       'luxus',   160),
  ('Eggersmann',       'eggersmann',       'luxus',   170),
  ('Next125',          'next125',          'premium', 180),
  ('Zeyko',            'zeyko',            'premium', 190),
  ('Allmilmoe',        'allmilmoe',        'premium', 200),
  ('Sachsenkuechen',   'sachsenkuechen',   'mittel',  210),
  ('Express Kuechen',  'express-kuechen',  'budget',  220),
  ('IKEA',             'ikea',             'budget',  230),
  ('XXXLutz',          'xxxlutz',          'budget',  240),
  ('Hoeffner',         'hoeffner',         'budget',  250),
  ('Sonstiger',        'sonstiger',        null,      999)
on conflict (name) do nothing;

insert into public.catalog_front_materials (name, category, description, sort_order) values
  ('Melamin / Schichtstoff',       'kunststoff', 'Folierte Spanplatte mit Melaminharz', 10),
  ('Kunststoff (Polymer/PET)',     'kunststoff', 'Hochwertige Kunststoffbeschichtung',  20),
  ('Acryl',                        'kunststoff', 'Hochglanz-Kunststofffront',           30),
  ('Lack matt',                    'lack',       'MDF mit Mattlack',                    40),
  ('Lack hochglanz',               'lack',       'MDF mit Hochglanzlack',               50),
  ('UV-Lack hochglanz',            'lack',       'UV-gehaertet, sehr widerstandsfaehig', 60),
  ('UV-Lack matt',                 'lack',       'UV-gehaerteter Mattlack',             70),
  ('Lack-Soft (Anti-Fingerprint)', 'lack',       'Soft-Touch matt mit Fingerabdruck-Schutz', 80),
  ('Echtholz furniert',            'echtholz',   'Traeger MDF/Span mit Echtholzfurnier', 90),
  ('Massivholz',                   'echtholz',   'Vollholz-Front',                      100),
  ('Glas matt',                    'glas',       'Lackiertes Glas, matt',               110),
  ('Glas hochglanz',               'glas',       'Lackiertes Glas, hochglanz',          120),
  ('Glas satiniert',               'glas',       'Mattiertes Glas',                     130),
  ('Edelstahl',                    'metall',     'Echte Edelstahlfront',                140),
  ('Aluminium',                    'metall',     'Aluminium- oder Alurahmen',           150),
  ('Beton-Optik',                  'beton',      'Front in Beton-Look',                 160),
  ('Keramik',                      'sonstiges',  'Keramikfront (selten)',               170),
  ('Sonstige',                     'sonstiges',  null,                                  999)
on conflict (name, category) do nothing;

insert into public.catalog_handle_types (name, slug, description, sort_order) values
  ('Mit aufgesetztem Griff',                'mit-griff',         'Klassischer Griff (Buegel, Knauf, Stange)',   10),
  ('Grifflos (Push-to-Open)',               'grifflos-push',     'Komplett ohne Griff, Oeffnen durch Druck',    20),
  ('Grifflos (elektrisch)',                 'grifflos-servo',    'Servo-elektrisches Oeffnen',                  30),
  ('Pseudogrifflos (J-Profil)',             'pseudogrifflos-j',  'Griffleiste in der Front (J-Profil)',         40),
  ('Pseudogrifflos (C-Profil / horizontal)','pseudogrifflos-c',  'Horizontale Griffmulde / C-Profil',           50),
  ('Mischvariante',                         'mischvariante',     'Verschiedene Grifftypen kombiniert',          60)
on conflict (slug) do nothing;

insert into public.catalog_worktop_materials (name, slug, description, sort_order) values
  ('Schichtstoff / HPL',            'schichtstoff',     'Spanplatte mit HPL-Beschichtung',          10),
  ('Massivholz',                    'massivholz',       'Eiche, Buche, Nussbaum, ...',              20),
  ('Naturstein - Granit',           'granit',           'Natuerlicher Stein, sehr robust',          30),
  ('Naturstein - Marmor',           'marmor',           'Edel, aber empfindlich',                   40),
  ('Quarzkomposit',                 'quarzkomposit',    'Silestone, Caesarstone u.ae.',             50),
  ('Keramik (Sinterstein)',         'keramik',          'Neolith, Dekton, Lapitec u.ae.',           60),
  ('Edelstahl',                     'edelstahl',        'Profi-Look, hygienisch',                   70),
  ('Beton',                         'beton',            'Roher oder versiegelter Beton',            80),
  ('Glas',                          'glas',             'Glasarbeitsplatte (selten)',               90),
  ('Kunststein (Mineralwerkstoff)', 'mineralwerkstoff', 'Corian, Hi-Macs u.ae.',                    100)
on conflict (slug) do nothing;

insert into public.catalog_worktop_designs (material_id, name, manufacturer, sort_order)
select m.id, d.name, d.manufacturer, d.sort_order
from public.catalog_worktop_materials m
join (values
  ('keramik',          'Calacatta Roma',          'Neolith',     10),
  ('keramik',          'Calacatta Borghini',      'Neolith',     20),
  ('keramik',          'Estatuario',              'Neolith',     30),
  ('keramik',          'Iron Grey',               'Neolith',     40),
  ('keramik',          'Aspen White',             'Dekton',      50),
  ('keramik',          'Kelya',                   'Dekton',      60),
  ('keramik',          'Sirius',                  'Dekton',      70),
  ('keramik',          'Helena',                  'Lapitec',     80),
  ('quarzkomposit',    'Calacatta Gold',          'Silestone',   10),
  ('quarzkomposit',    'Eternal Statuario',       'Silestone',   20),
  ('quarzkomposit',    'Lyra',                    'Silestone',   30),
  ('quarzkomposit',    'White Attica',            'Caesarstone', 40),
  ('quarzkomposit',    'Calacatta Nuvo',          'Caesarstone', 50),
  ('granit',           'Star Galaxy',             null,          10),
  ('granit',           'Nero Assoluto',           null,          20),
  ('granit',           'Padang Cristallo TG-34',  null,          30),
  ('granit',           'Black Pearl',             null,          40),
  ('marmor',           'Carrara',                 null,          10),
  ('marmor',           'Calacatta',               null,          20),
  ('marmor',           'Statuario',               null,          30),
  ('mineralwerkstoff', 'Solid Glacier White',     'Corian',      10),
  ('mineralwerkstoff', 'Designer White',          'Hi-Macs',     20),
  ('schichtstoff',     'Beton Optik',             null,          10),
  ('schichtstoff',     'Eiche Sonoma',            null,          20),
  ('schichtstoff',     'Marmor Optik',            null,          30)
) as d(material_slug, name, manufacturer, sort_order) on m.slug = d.material_slug
on conflict (material_id, name) do nothing;

insert into public.catalog_appliance_categories (name, slug, sort_order) values
  ('Backofen',              'backofen',           10),
  ('Herd / Kochfeld',       'kochfeld',           20),
  ('Dunstabzugshaube',      'dunstabzug',         30),
  ('Muldenlueftung',        'muldenlueftung',     35),
  ('Geschirrspueler',       'geschirrspueler',    40),
  ('Kuehlschrank',          'kuehlschrank',       50),
  ('Gefrierschrank',        'gefrierschrank',     60),
  ('Mikrowelle',            'mikrowelle',         70),
  ('Dampfgarer',            'dampfgarer',         80),
  ('Kaffeevollautomat',     'kaffeevollautomat',  90),
  ('Weinkuehlschrank',      'weinkuehler',        100),
  ('Waermeschublade',       'waermeschublade',    110)
on conflict (slug) do nothing;

insert into public.catalog_appliance_brands (name, slug, segment, sort_order) values
  ('Bosch',         'bosch',         'mittel',  10),
  ('Siemens',       'siemens',       'mittel',  20),
  ('Neff',          'neff',          'mittel',  30),
  ('Miele',         'miele',         'premium', 40),
  ('AEG',           'aeg',           'mittel',  50),
  ('Bauknecht',     'bauknecht',     'budget',  60),
  ('Liebherr',      'liebherr',      'premium', 70),
  ('Gaggenau',      'gaggenau',      'luxus',   80),
  ('V-Zug',         'v-zug',         'premium', 90),
  ('Beko',          'beko',          'budget',  100),
  ('Privileg',      'privileg',      'budget',  110),
  ('Constructa',    'constructa',    'budget',  120),
  ('Whirlpool',     'whirlpool',     'budget',  130),
  ('Samsung',       'samsung',       'mittel',  140),
  ('LG',            'lg',            'mittel',  150),
  ('Smeg',          'smeg',          'premium', 160),
  ('Electrolux',    'electrolux',    'mittel',  170),
  ('De Dietrich',   'de-dietrich',   'premium', 180),
  ('Kueppersbusch', 'kueppersbusch', 'premium', 190),
  ('Sonstige',      'sonstige',      null,      999)
on conflict (slug) do nothing;

insert into public.catalog_sink_brands (name, slug, sort_order) values
  ('Blanco',          'blanco',        10),
  ('Franke',          'franke',        20),
  ('Schock',          'schock',        30),
  ('Villeroy & Boch', 'villeroy-boch', 40),
  ('Naber',           'naber',         50),
  ('Reginox',         'reginox',       60),
  ('Systemceram',     'systemceram',   70),
  ('Pyramis',         'pyramis',       80),
  ('Bosch',           'bosch-sink',    90),
  ('IKEA',            'ikea-sink',     100),
  ('Sonstige',        'sonstige-sink', 999)
on conflict (slug) do nothing;

insert into public.catalog_sink_materials (name, slug, sort_order) values
  ('Edelstahl',                           'edelstahl-sink',    10),
  ('Granit-Komposit (Silgranit/Cristadur)','granit-komposit',  20),
  ('Keramik',                             'keramik-sink',      30),
  ('Tectonite (Faser)',                   'tectonite',         40),
  ('Mineralguss (Mineralwerkstoff)',      'mineralguss',       50),
  ('Kupfer / Messing',                    'kupfer',            60),
  ('Sonstige',                            'sonstige-sink-mat', 999)
on conflict (slug) do nothing;


-- ---------------------------------------------------------------------
-- Teil 2: LEAD-PRICING + COMMISSION-TIERS
-- ---------------------------------------------------------------------

insert into public.lead_pricing_rules
  (budget_min_cents, budget_max_cents, tier, percent_of_budget, min_price_cents, notes) values
  (0,       1000000, 'standard',  0.30,  3500, 'Bis 10k - Standard'),
  (0,       1000000, 'qualified', 0.50,  4500, 'Bis 10k - Qualifiziert'),
  (0,       1000000, 'premium',   0.85,  6000, 'Bis 10k - Premium'),
  (0,       1000000, 'hot',       1.20,  8000, 'Bis 10k - Hot'),
  (1000000, 1500000, 'standard',  0.35,  4500, '10-15k - Standard'),
  (1000000, 1500000, 'qualified', 0.50,  5500, '10-15k - Qualifiziert'),
  (1000000, 1500000, 'premium',   0.70,  7500, '10-15k - Premium'),
  (1000000, 1500000, 'hot',       0.95, 10000, '10-15k - Hot'),
  (1500000, 2500000, 'standard',  0.30,  5500, '15-25k - Standard'),
  (1500000, 2500000, 'qualified', 0.45,  7500, '15-25k - Qualifiziert'),
  (1500000, 2500000, 'premium',   0.60, 10000, '15-25k - Premium'),
  (1500000, 2500000, 'hot',       0.85, 13000, '15-25k - Hot'),
  (2500000, null,    'standard',  0.25,  7500, 'ueber 25k - Standard'),
  (2500000, null,    'qualified', 0.35, 10000, 'ueber 25k - Qualifiziert'),
  (2500000, null,    'premium',   0.50, 13000, 'ueber 25k - Premium'),
  (2500000, null,    'hot',       0.70, 17000, 'ueber 25k - Hot')
on conflict (budget_min_cents, budget_max_cents, tier) do nothing;

insert into public.lead_commission_tiers
  (order_value_min_cents, order_value_max_cents, percent, min_cents, notes) values
  (0,       1000000, 2.00, 20000, '0-10k EUR -> 2% mind. 200 EUR'),
  (1000000, 1500000, 1.80, 25000, '10-15k EUR -> 1.8% mind. 250 EUR'),
  (1500000, 2500000, 1.60, 30000, '15-25k EUR -> 1.6% mind. 300 EUR'),
  (2500000, 4000000, 1.40, 40000, '25-40k EUR -> 1.4% mind. 400 EUR'),
  (4000000, null,    1.20, 60000, 'ueber 40k EUR -> 1.2% mind. 600 EUR')
on conflict (order_value_min_cents, order_value_max_cents) do nothing;


-- ---------------------------------------------------------------------
-- Teil 3: 288 KITCHEN_PRICE_BRACKETS
-- ---------------------------------------------------------------------
-- (style_segment x appliance_segment x worktop_tier x kitchen_form)
-- Form-Faktoren: zeile=1.00, l=1.15, u=1.30, parallel=1.25, g=1.35, insel=1.50
-- Basispreise in Cent: style(450k-2.2M), appliance(150k-1.2M), worktop(80k-550k)
-- Max = Min * 1.35 (Spreizung fuer Preis-Range).

delete from public.kitchen_price_brackets;

do $$
declare
  v_styles    text[]    := array['budget','mittel','premium','luxus'];
  v_appls     text[]    := array['budget','mittel','premium','luxus'];
  v_tops      text[]    := array['basic','mid','premium'];
  v_forms     text[]    := array['zeile','l','u','parallel','g','insel'];
  v_form_mult numeric[] := array[1.00, 1.15, 1.30, 1.25, 1.35, 1.50];
  v_style text; v_appl text; v_top text; v_form text;
  v_style_base integer; v_appl_base integer; v_top_base integer;
  v_base_min integer; v_base_max integer;
  v_form_factor numeric; v_min integer; v_max integer; v_form_idx integer;
begin
  foreach v_style in array v_styles loop
    v_style_base := case v_style
      when 'budget'  then  450000
      when 'mittel'  then  750000
      when 'premium' then 1200000
      when 'luxus'   then 2200000
    end;
    foreach v_appl in array v_appls loop
      v_appl_base := case v_appl
        when 'budget'  then  150000
        when 'mittel'  then  280000
        when 'premium' then  550000
        when 'luxus'   then 1200000
      end;
      foreach v_top in array v_tops loop
        v_top_base := case v_top
          when 'basic'   then  80000
          when 'mid'     then 250000
          when 'premium' then 550000
        end;
        v_base_min := v_style_base + v_appl_base + v_top_base;
        v_base_max := round(v_base_min * 1.35);
        v_form_idx := 1;
        foreach v_form in array v_forms loop
          v_form_factor := v_form_mult[v_form_idx];
          v_min := round(v_base_min * v_form_factor);
          v_max := round(v_base_max * v_form_factor);
          insert into public.kitchen_price_brackets
            (style_segment, appliance_segment, worktop_tier, kitchen_form,
             price_min_cents, price_max_cents, active)
          values
            (v_style::style_segment_enum, v_appl::style_segment_enum,
             v_top::worktop_tier_enum, v_form::kitchen_form_enum,
             v_min, v_max, true);
          v_form_idx := v_form_idx + 1;
        end loop;
      end loop;
    end loop;
  end loop;
end $$;

-- Sanity-Check: 4 * 4 * 3 * 6 = 288 Brackets
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.kitchen_price_brackets;
  if v_count <> 288 then
    raise exception 'Kitchen-Price-Brackets Seed-Count falsch: % (erwartet 288)', v_count;
  end if;
end $$;
