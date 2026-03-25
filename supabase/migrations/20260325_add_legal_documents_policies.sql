-- Add missing DELETE and UPDATE policies for legal_documents
-- Allows dealers to delete/replace their own documents before admin verification

CREATE POLICY "Users can delete own legal documents"
  ON public.legal_documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM dealer_applications da
      WHERE da.id = legal_documents.dealer_application_id
        AND da.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own legal documents"
  ON public.legal_documents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM dealer_applications da
      WHERE da.id = legal_documents.dealer_application_id
        AND da.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dealer_applications da
      WHERE da.id = legal_documents.dealer_application_id
        AND da.user_id = auth.uid()
    )
  );
