-- Händler können kennzeichnen, ob Umsatzsteuer auf der Fahrzeug-Verkaufsrechnung
-- gesondert ausgewiesen wird (relevant für Bieter / Steuerlogik).
ALTER TABLE public.motorhomes ADD COLUMN IF NOT EXISTS mwst_ausweisbar BOOLEAN;

COMMENT ON COLUMN public.motorhomes.mwst_ausweisbar IS
  'true = USt. auf Kaufrechnung gesondert; false = z. B. Differenzbesteuerung / Kleinunternehmer; NULL = Altbestand';
