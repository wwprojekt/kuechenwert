-- Add missing body_type values for Wohnwagen types
-- Wizard allows Wohnwagen, Faltcaravan, Mobilheim but DB enum only had
-- Teilintegriert, Alkoven, Vollintegriert, Kastenwagen, Campingbus
ALTER TYPE motorhome_body_type ADD VALUE IF NOT EXISTS 'Wohnwagen';
ALTER TYPE motorhome_body_type ADD VALUE IF NOT EXISTS 'Faltcaravan';
ALTER TYPE motorhome_body_type ADD VALUE IF NOT EXISTS 'Mobilheim';
