-- Add the persisted country field for customer billing profiles.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_country VARCHAR;
