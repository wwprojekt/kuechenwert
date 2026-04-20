-- Defense-in-depth: enforce that any motorhome listed as 'instant_price'
-- must carry a strictly positive instant_price. Without this guard the
-- wizard, the admin edit dialog and the auto-convert-wizard Edge Function
-- could (and historically did, see hotfix for e29b40cb) end up storing
-- sale_channel='instant_price' with instant_price IS NULL or 0, which then
-- breaks AuctionDetail (no Sofortkauf button, no price) and confuses the
-- close/extend lifecycle in check-expired-auctions.
--
-- Applied with NOT VALID so existing rows are not blocked; the application
-- layer (auto-convert-wizard, useWizardForm, MotorhomeEditDialog) enforces
-- the invariant going forward, and check-expired-auctions takes care of
-- legacy rows via the admin_festpreis_needs_price alert path.

ALTER TABLE motorhomes
  DROP CONSTRAINT IF EXISTS motorhomes_instant_price_positive;

ALTER TABLE motorhomes
  ADD CONSTRAINT motorhomes_instant_price_positive
  CHECK (
    sale_channel <> 'instant_price'
    OR (instant_price IS NOT NULL AND instant_price > 0)
  )
  NOT VALID;

COMMENT ON CONSTRAINT motorhomes_instant_price_positive ON motorhomes IS
  'Festpreis-Inserate (sale_channel = instant_price) müssen einen instant_price > 0 haben. NOT VALID, damit alte Inkonsistenzen nicht brechen — wird durch App-Layer + check-expired-auctions Admin-Alert für Altdaten abgefangen.';
