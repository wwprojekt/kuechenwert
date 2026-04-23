-- Commission Tiers v2 — Mindestprovision 300 € netto, feinere Top-Stufen
--
-- Hintergrund: Operative Kosten (~500 €/Tag) ließen sich mit dem alten Modell
-- (Floor 150-500 €, Sätze 2,0 % → 1,0 %) nicht ansatzweise decken. Das neue
-- Modell hebt:
--   • den Mindest-Floor auf 300 € netto (effektive Untergrenze für jeden Deal)
--   • die Sätze im Niedrig- und Mittelsegment (3,5 % bis 2,0 %)
--   • führt feinere Premium-Stufen ein (80k–250k+ mit 1,2 % → 0,8 %)
--
-- Mathematisch sauber: an jeder Stufengrenze ist der Floor der nächsten Stufe
-- ≥ Provision an der oberen Grenze der vorherigen Stufe → keine Inversionen
-- (Verkauf höher → Provision niemals niedriger). Die Exclusion-Constraint
-- `commission_tiers_no_overlap_active` und der Audit-Trigger fangen das
-- automatisch korrekt ab.
--
-- Alte Tiers werden NICHT gelöscht, sondern auf is_active=false gesetzt —
-- bestehende Invoices und commission_calculations referenzieren tier_id und
-- müssen nachvollziehbar bleiben (steuerliche Aufbewahrungspflicht).

begin;

update public.commission_tiers
set is_active = false,
    updated_at = now()
where is_active = true;

insert into public.commission_tiers
  (min_amount, max_amount, rate_type, rate_value, min_commission, is_active)
values
  (    0,     10000, 'percentage', 3.5,  300, true),
  (10000,     15000, 'percentage', 3.2,  350, true),
  (15000,     20000, 'percentage', 3.0,  480, true),
  (20000,     30000, 'percentage', 2.8,  600, true),
  (30000,     50000, 'percentage', 2.0,  840, true),
  (50000,     80000, 'percentage', 1.5, 1000, true),
  (80000,    100000, 'percentage', 1.2, 1200, true),
  (100000,   130000, 'percentage', 1.1, 1200, true),
  (130000,   160000, 'percentage', 1.0, 1430, true),
  (160000,   250000, 'percentage', 0.9, 1600, true),
  (250000, 99999999, 'percentage', 0.8, 2250, true);

commit;
