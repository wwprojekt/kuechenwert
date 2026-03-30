-- Extend motorhome_condition enum to include wizard form values
-- Wizard uses: Neuwertig, Sehr gepflegt, Gepflegt, Gebrauchsspuren, Reparaturbedürftig
-- DB had: Neuwertig, Sehr gut, Gut, Befriedigend, Reparaturbedürftig
-- Adding missing values so both old and new values work
ALTER TYPE motorhome_condition ADD VALUE IF NOT EXISTS 'Sehr gepflegt';
ALTER TYPE motorhome_condition ADD VALUE IF NOT EXISTS 'Gepflegt';
ALTER TYPE motorhome_condition ADD VALUE IF NOT EXISTS 'Gebrauchsspuren';
