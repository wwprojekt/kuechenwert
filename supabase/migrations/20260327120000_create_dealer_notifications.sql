-- ============================================================
-- Migration: Create dealer_notifications table for In-App Notification Center
-- ============================================================

-- Create the dealer_notifications table
CREATE TABLE IF NOT EXISTS public.dealer_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'outbid',           -- Dealer was outbid on an auction
        'auction_won',      -- Dealer won an auction
        'auction_ending',   -- An auction the dealer bid on is ending soon
        'new_auction',      -- A new auction matching dealer preferences was listed
        'search_match',     -- A search alert matched a new motorhome
        'payment_reminder', -- Payment is due
        'system',           -- System announcements
        'bid_confirmed'     -- Bid was successfully placed
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,                -- Optional link to navigate to (e.g., /auktion/uuid)
    auction_id UUID REFERENCES public.auctions(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dealer_notifications_user_id 
    ON public.dealer_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_dealer_notifications_user_unread 
    ON public.dealer_notifications(user_id, is_read) 
    WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_dealer_notifications_created_at 
    ON public.dealer_notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.dealer_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see and manage their own notifications
CREATE POLICY "Users can view own notifications"
    ON public.dealer_notifications
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON public.dealer_notifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
    ON public.dealer_notifications
    FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can insert notifications (from Edge Functions)
CREATE POLICY "Service role can insert notifications"
    ON public.dealer_notifications
    FOR INSERT
    WITH CHECK (true);

-- Enable Realtime for this table so the frontend gets live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.dealer_notifications;

-- Create a helper function to mark all notifications as read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    UPDATE public.dealer_notifications
    SET is_read = true
    WHERE user_id = p_user_id AND is_read = false;
$$;

-- Auto-cleanup: Delete notifications older than 90 days (can be called via cron)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM public.dealer_notifications
    WHERE created_at < now() - interval '90 days';
$$;
