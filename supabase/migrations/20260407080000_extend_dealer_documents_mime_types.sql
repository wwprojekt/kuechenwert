-- Extend dealer-documents bucket allowed MIME types to include HEIC/HEIF
-- This is needed for iOS users who upload photos directly from their camera
-- Note: The dealer-document-upload Edge Function uses service_role and bypasses
-- this restriction, but this migration ensures consistency and future-proofing.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/heic',
  'image/heif'
]
WHERE id = 'dealer-documents';
