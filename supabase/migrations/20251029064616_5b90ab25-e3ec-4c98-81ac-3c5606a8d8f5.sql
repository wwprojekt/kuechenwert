-- Update storage bucket privacy settings
-- Note: Storage policies must be configured through Supabase dashboard due to permission restrictions

UPDATE storage.buckets 
SET public = false 
WHERE name IN ('motorhome-photos', 'branding');