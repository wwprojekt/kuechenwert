
-- FIX POT-2: Rechnungen dürfen NIEMALS hart gelöscht werden (Aufbewahrungspflicht §14b UStG).
-- Statt DELETE wird ein Status 'cancelled' gesetzt.
-- Bestehende DELETE-Policies für invoices entfernen und durch Trigger ersetzen.

-- Trigger: Verhindert das Löschen von Rechnungen
CREATE OR REPLACE FUNCTION public.prevent_invoice_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Rechnungen dürfen nicht gelöscht werden (Aufbewahrungspflicht). Nutzen Sie stattdessen den Status "cancelled".';
  RETURN NULL;
END;
$$;

-- Trigger nur erstellen wenn er noch nicht existiert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'prevent_invoice_delete' AND tgrelid = 'public.invoices'::regclass
  ) THEN
    CREATE TRIGGER prevent_invoice_delete
      BEFORE DELETE ON public.invoices
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_invoice_deletion();
  END IF;
END $$;

-- Gleiches für invoice_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'prevent_invoice_item_delete' AND tgrelid = 'public.invoice_items'::regclass
  ) THEN
    CREATE TRIGGER prevent_invoice_item_delete
      BEFORE DELETE ON public.invoice_items
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_invoice_deletion();
  END IF;
END $$;


-- FIX POT-1/POT-4: Soft-Delete für quick_leads und contact_messages
-- Spalte 'deleted_at' hinzufügen statt Zeilen zu löschen

-- quick_leads: deleted_at Spalte
ALTER TABLE public.quick_leads
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- contact_messages: deleted_at Spalte  
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Kommentar: Admin-UI sollte statt DELETE ein UPDATE SET deleted_at = now() machen.
-- SELECT-Queries sollten WHERE deleted_at IS NULL filtern.
COMMENT ON COLUMN public.quick_leads.deleted_at IS 'Soft-Delete: Wenn gesetzt, gilt der Lead als gelöscht. NULL = aktiv.';
COMMENT ON COLUMN public.contact_messages.deleted_at IS 'Soft-Delete: Wenn gesetzt, gilt die Nachricht als gelöscht. NULL = aktiv.';
