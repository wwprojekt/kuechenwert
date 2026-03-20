-- Add document fields to dealer_applications table
ALTER TABLE public.dealer_applications
ADD COLUMN trade_license_document_url text,
ADD COLUMN additional_documents jsonb DEFAULT '[]'::jsonb,
ADD COLUMN ust_id_verified boolean DEFAULT false;

-- Create storage bucket for dealer documents if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dealer-documents',
  'dealer-documents',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for dealer-documents bucket
CREATE POLICY "Users can upload own dealer documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dealer-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own dealer documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'dealer-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all dealer documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'dealer-documents' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can delete own dealer documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'dealer-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);