-- Fix: Add missing SELECT policy for legal_documents
-- Without this policy, dealers cannot see their own uploaded documents in the dashboard.
-- The PendingDealerDocumentUpload component queries legal_documents but gets 0 rows,
-- causing uploaded documents to appear as not uploaded.

CREATE POLICY "Users can view own legal documents"
  ON public.legal_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dealer_applications da
      WHERE da.id = legal_documents.dealer_application_id
        AND da.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );
