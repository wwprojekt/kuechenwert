-- ============================================
-- Auction Addenda (Nachträge des Verkäufers)
-- ============================================
-- Allows sellers to add public notes/addenda to their auctions
-- after the auction has gone live. These are displayed with
-- timestamps on the public auction page so bidders can see
-- what information was added after the auction started.
--
-- SAFETY: This migration only CREATES new objects.
-- It does NOT alter or drop any existing tables, columns, or policies.
-- Existing auctions and motorhomes are completely unaffected.

CREATE TABLE IF NOT EXISTS public.auction_addenda (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID REFERENCES public.auctions(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.auction_addenda ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read addenda (they are public information on the auction page)
CREATE POLICY "Anyone can view auction addenda"
  ON public.auction_addenda FOR SELECT
  USING (true);

-- Policy: Sellers can insert addenda for their own auctions only
-- Uses the same join pattern as post_auction_offers: addenda → auctions → motorhomes → seller_id
CREATE POLICY "Sellers can create addenda for own auctions"
  ON public.auction_addenda FOR INSERT
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (
      SELECT 1 FROM public.auctions a
      JOIN public.motorhomes m ON a.motorhome_id = m.id
      WHERE a.id = auction_addenda.auction_id
        AND m.seller_id = auth.uid()
    )
  );

-- Policy: Admins can manage all addenda
CREATE POLICY "Admins can manage all addenda"
  ON public.auction_addenda FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Index for fast lookups by auction_id (used on every auction page load)
CREATE INDEX IF NOT EXISTS idx_auction_addenda_auction
  ON public.auction_addenda(auction_id, created_at ASC);
