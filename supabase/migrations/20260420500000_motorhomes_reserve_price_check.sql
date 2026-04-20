-- =============================================================================
-- Migration: Defense-in-depth CHECK constraint to enforce that auction listings
-- always carry a positive reserve_price.
--
-- Background (AGB v7 §6.4 c):
-- The dynamic price reduction floor (-6 %) is anchored at
-- auctions.seller_initial_reserve, which is initialised from
-- motorhomes.reserve_price during auction creation. A NULL or zero reserve
-- breaks the floor logic and could theoretically allow sales at the
-- starting bid (€50). UI and Edge Function validation already prevent this
-- for new inserts/updates (Wizard, DealerListingCreate, ListingEdit,
-- auto-convert-wizard). This constraint is the last line of defence against
-- direct DB manipulation or future code paths that bypass the application
-- layer.
--
-- IMPORTANT: We use NOT VALID so existing legacy rows (11 active auctions
-- with reserve_price=NULL as of 2026-04-20) are NOT rejected. The admin has
-- been notified by email and will fix them manually via the admin UI.
-- Once those are fixed, a follow-up migration may run
--   ALTER TABLE motorhomes VALIDATE CONSTRAINT motorhomes_auction_requires_reserve;
-- to enforce the constraint on all rows.
-- =============================================================================

ALTER TABLE public.motorhomes
  ADD CONSTRAINT motorhomes_auction_requires_reserve
  CHECK (
    sale_channel <> 'auction'
    OR (reserve_price IS NOT NULL AND reserve_price > 0)
  )
  NOT VALID;

COMMENT ON CONSTRAINT motorhomes_auction_requires_reserve ON public.motorhomes IS
  'AGB v7 §6.4 c) Reduktionsboden: Auktions-Inserate brauchen einen positiven Mindestpreis. NOT VALID: schützt nur neue/aktualisierte Zeilen, Altbestand (11 Zeilen am 2026-04-20) wird per Admin-UI nachgepflegt. Einmal komplett: VALIDATE CONSTRAINT.';

-- Audit-log entry for traceability.
INSERT INTO public.audit_logs (action, entity_type, entity_id, details)
VALUES (
  'check_constraint_added',
  'motorhomes',
  NULL,
  jsonb_build_object(
    'constraint_name', 'motorhomes_auction_requires_reserve',
    'constraint_definition', 'CHECK (sale_channel <> ''auction'' OR (reserve_price IS NOT NULL AND reserve_price > 0))',
    'mode', 'NOT VALID',
    'reason', 'Defense-in-depth for AGB v7 §6.4 c) reduction floor.',
    'legacy_rows_grandfathered', (
      SELECT COUNT(*) FROM public.motorhomes m
      WHERE m.sale_channel = 'auction'
        AND (m.reserve_price IS NULL OR m.reserve_price <= 0)
    ),
    'follow_up', 'Run VALIDATE CONSTRAINT motorhomes_auction_requires_reserve once admin has filled all legacy reserves.'
  )
);
