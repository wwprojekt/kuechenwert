-- Bug 3 cleanup: remove phantom kaufchance_invitations rows for auctions
-- that are no longer in the kaufchance phase. The new close-auction code
-- prevents future phantoms by deleting before re-inserting; this migration
-- cleans the historical mess so admin views and reports show accurate state.
--
-- Deletes invitations attached to auctions in:
--   active    – auction was relisted/restarted, leftover from previous round
--   ended     – auction ended without sale, invitation is meaningless
--   cancelled – auction was cancelled, invitation is meaningless
--
-- Keeps invitations on:
--   kaufchance – currently in negotiation, must NOT be touched
--   sold       – historical record of who was invited to a closed deal
--   draft      – not possible (close-auction never runs on drafts)

WITH deleted AS (
  DELETE FROM public.kaufchance_invitations ki
  USING public.auctions a
  WHERE a.id = ki.auction_id
    AND a.status IN ('active', 'ended', 'cancelled')
  RETURNING ki.id, ki.auction_id, ki.bidder_id, a.status
)
SELECT status AS auction_status, COUNT(*) AS deleted_count
FROM deleted
GROUP BY status
ORDER BY deleted_count DESC;
