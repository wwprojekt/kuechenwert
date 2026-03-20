-- Add user suspension system to profiles table
-- This enables administrators to suspend/activate user accounts

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- Add index for efficient filtering of suspended users
CREATE INDEX IF NOT EXISTS idx_profiles_is_suspended ON profiles(is_suspended) WHERE is_suspended = true;

-- Add comments for documentation
COMMENT ON COLUMN profiles.is_suspended IS 'Whether the user account is suspended';
COMMENT ON COLUMN profiles.suspended_at IS 'Timestamp when the account was suspended';
COMMENT ON COLUMN profiles.suspended_reason IS 'Reason for the account suspension';
