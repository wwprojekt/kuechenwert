-- ============================================================================
-- Fix: dealer_applications - tax_id und trade_license_number optional machen
-- Diese Felder sind bei der Erstregistrierung oft noch nicht verfügbar
-- und können später vom Händler nachgereicht werden.
-- ============================================================================

-- tax_id von NOT NULL auf nullable ändern
ALTER TABLE dealer_applications
  ALTER COLUMN tax_id DROP NOT NULL,
  ALTER COLUMN tax_id SET DEFAULT NULL;

-- trade_license_number von NOT NULL auf nullable ändern
ALTER TABLE dealer_applications
  ALTER COLUMN trade_license_number DROP NOT NULL,
  ALTER COLUMN trade_license_number SET DEFAULT NULL;

-- Kommentar hinzufügen für Dokumentation
COMMENT ON COLUMN dealer_applications.tax_id IS 'Steuernummer - wird optional bei der Registrierung abgefragt, kann nachgereicht werden';
COMMENT ON COLUMN dealer_applications.trade_license_number IS 'Gewerbescheinnummer - wird optional bei der Registrierung abgefragt, kann nachgereicht werden';
