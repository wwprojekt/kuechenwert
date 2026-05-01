-- Fix Encoding-Bug im kitchen_condition Enum.
--
-- Der Wert "Reparaturbedürftig" (mit "ü") wurde in einer früheren Migration
-- doppelt UTF-8-encoded als "ReparaturbedÃ¼rftig" gespeichert. Alle anderen
-- Stellen im Code (validation.ts, KitchenEditDialog, AdminKitchens,
-- DealerListingCreate, VehicleInfoStep, ConvertToKitchenDialog) verwendeten
-- bereits den korrekten Wert mit Umlaut — es gab also einen latenten
-- Mismatch zwischen DB und Frontend, der bisher nicht aufgefallen ist, weil
-- keine kitchens-Records den Wert hatten (0 affected rows).
--
-- Die Datei `src/integrations/supabase/types.ts` wurde im selben Commit
-- manuell auf "Reparaturbedürftig" korrigiert.

DO $$
BEGIN
  -- Idempotent: nur umbenennen wenn der kaputte Wert noch existiert UND der
  -- neue Wert noch nicht. So ist die Migration safe bei einem erneuten Lauf.
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'kitchen_condition'
      AND e.enumlabel = 'ReparaturbedÃ¼rftig'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'kitchen_condition'
      AND e.enumlabel = 'Reparaturbedürftig'
  ) THEN
    EXECUTE $sql$
      ALTER TYPE kitchen_condition
      RENAME VALUE 'ReparaturbedÃ¼rftig' TO 'Reparaturbedürftig'
    $sql$;
  END IF;
END $$;
