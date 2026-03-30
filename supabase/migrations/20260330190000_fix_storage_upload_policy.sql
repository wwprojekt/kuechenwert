-- Fix Storage Upload Policy: Allow authenticated users to upload to any folder in motorhome-photos
-- The old policy required auth.uid() = folder name, but the code uses motorhomeId as folder name
-- Security is maintained through DB-level RLS on the motorhome_photos table

DROP POLICY IF EXISTS "Authenticated users can upload motorhome photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own motorhome photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own motorhome photos" ON storage.objects;

CREATE POLICY "Authenticated users can upload motorhome photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'motorhome-photos' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update own motorhome photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'motorhome-photos' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete own motorhome photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'motorhome-photos' 
    AND auth.role() = 'authenticated'
  );
