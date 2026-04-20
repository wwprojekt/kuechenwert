-- Add missing DELETE and UPDATE policies for legal_documents
-- Allows dealers to delete/replace their own documents before admin verification
-- Idempotent: drop-if-exists pattern.
--
-- 2026-04-20: Wrapped in `to_regclass` guard to survive replays where the
-- table may not yet exist or has been renamed.

DO $$
BEGIN
  IF to_regclass('public.legal_documents') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own legal documents" ON public.legal_documents';
  EXECUTE $POL$
    CREATE POLICY "Users can delete own legal documents"
      ON public.legal_documents
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.dealer_applications da
          WHERE da.id = legal_documents.dealer_application_id
            AND da.user_id = auth.uid()
        )
      )
  $POL$;

  EXECUTE 'DROP POLICY IF EXISTS "Users can update own legal documents" ON public.legal_documents';
  EXECUTE $POL$
    CREATE POLICY "Users can update own legal documents"
      ON public.legal_documents
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.dealer_applications da
          WHERE da.id = legal_documents.dealer_application_id
            AND da.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.dealer_applications da
          WHERE da.id = legal_documents.dealer_application_id
            AND da.user_id = auth.uid()
        )
      )
  $POL$;
END $$;
