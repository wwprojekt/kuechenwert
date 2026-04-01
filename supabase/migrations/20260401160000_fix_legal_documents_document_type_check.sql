-- Fix: Extend legal_documents document_type check constraint to include
-- ausweis_front, ausweis_back, trade_license, and hrb document types.
-- These types are used by the dealer-document-upload edge function and
-- PendingDealerDocumentUpload component but were missing from the constraint,
-- causing INSERT failures (error code 23514).

ALTER TABLE public.legal_documents
  DROP CONSTRAINT IF EXISTS legal_documents_document_type_check;

ALTER TABLE public.legal_documents
  ADD CONSTRAINT legal_documents_document_type_check
  CHECK (document_type = ANY (ARRAY[
    'hrb_register'::text,
    'gewerbenachweis'::text,
    'ust_id_certificate'::text,
    'other'::text,
    'ausweis_front'::text,
    'ausweis_back'::text,
    'trade_license'::text,
    'hrb'::text
  ]));
