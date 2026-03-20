-- Add kaufchance status to auction_status enum
-- This status is used for auctions that ended without meeting the reserve price
-- and are now open for post-auction negotiations

ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'kaufchance';
