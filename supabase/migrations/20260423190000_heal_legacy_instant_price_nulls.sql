-- Heal legacy Festpreis-Inserate deren instant_price NULL ist.
--
-- Hintergrund:
-- Die beiden CHECK-Constraints `motorhomes_instant_price_positive` und
-- `motorhomes_auction_requires_reserve` wurden als NOT VALID angelegt. Sie
-- tolerieren pre-existing Violations, greifen aber auf jedem UPDATE.
--
-- 5 Legacy-Rows haben sale_channel='instant_price' + instant_price IS NULL
-- + reserve_price > 0. Bei sale_channel='instant_price' sind reserve_price
-- und instant_price semantisch identisch (siehe seller_restart_listing /
-- create_auction-Pfad). Diese Rows stammen aus einer früheren Wizard-Version
-- die reserve gespeichert hat wo heute instant steht.
--
-- Symptom: JEDES UPDATE (auch `is_archived=true`) feuert einen 23514 und
-- die Soft-Brake-Buttons der 2026-04-23 Phase-6-Implementation geben 500.
--
-- Fix: instant_price := reserve_price. Rein kohärent, kein sichtbarer
-- UI-Unterschied (der Preis war in reserve_price ohnehin schon der vom
-- Seller gewollte Verkaufspreis).
--
-- 12 weitere Rows ohne jeden Preis bleiben unverändert — sie haben keine
-- Auktion oder sind verkauft/aktiv und können keine Soft-Brake-Mail
-- triggern; ihr UX ist nicht beeinträchtigt.

begin;

with healed as (
  update public.motorhomes
     set instant_price = reserve_price,
         updated_at    = now()
   where sale_channel  = 'instant_price'
     and instant_price is null
     and reserve_price is not null
     and reserve_price > 0
  returning id, seller_id, manufacturer, model, reserve_price
),
logged as (
  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  select h.seller_id,
         'system_legacy_instant_price_heal',
         'motorhome',
         h.id,
         jsonb_build_object(
           'reason', 'sale_channel=instant_price with instant_price=NULL; derived from reserve_price',
           'manufacturer', h.manufacturer,
           'model', h.model,
           'applied_instant_price', h.reserve_price,
           'migration', '20260423190000_heal_legacy_instant_price_nulls'
         )
    from healed h
  returning 1
)
select (select count(*) from healed)  as rows_healed,
       (select count(*) from logged)  as rows_audited;

commit;
