-- Migration 016: Expand address fields on organizations
-- Adds address_line2, city, state, zip for structured addresses

ALTER TABLE pm_organizations
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip TEXT;
