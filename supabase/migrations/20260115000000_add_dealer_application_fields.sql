-- Add new fields to dealer_applications table for enhanced registration
-- These fields capture additional business information required by the client

ALTER TABLE dealer_applications 
ADD COLUMN IF NOT EXISTS legal_form TEXT,
ADD COLUMN IF NOT EXISTS founded_year INTEGER,
ADD COLUMN IF NOT EXISTS handelsregister_number TEXT,
ADD COLUMN IF NOT EXISTS employee_count TEXT,
ADD COLUMN IF NOT EXISTS annual_revenue TEXT,
ADD COLUMN IF NOT EXISTS iban TEXT,
ADD COLUMN IF NOT EXISTS bic TEXT;

-- Add comments for documentation
COMMENT ON COLUMN dealer_applications.legal_form IS 'Legal form of the company: einzelunternehmen, gbr, ug, gmbh, ag';
COMMENT ON COLUMN dealer_applications.founded_year IS 'Year the company was established';
COMMENT ON COLUMN dealer_applications.handelsregister_number IS 'Trade register number (Handelsregisternummer), required for GmbH/AG';
COMMENT ON COLUMN dealer_applications.employee_count IS 'Number of employees: 1-5, 6-20, 21-50, 50+';
COMMENT ON COLUMN dealer_applications.annual_revenue IS 'Annual revenue bracket: <100k, 100k-500k, 500k-1m, 1m-5m, >5m';
COMMENT ON COLUMN dealer_applications.iban IS 'German IBAN for payment processing';
COMMENT ON COLUMN dealer_applications.bic IS 'BIC/SWIFT code for the bank';
