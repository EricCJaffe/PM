-- Add contact / profile fields to pm_organizations so they can serve as client records.
ALTER TABLE pm_organizations
  ADD COLUMN IF NOT EXISTS address   TEXT,
  ADD COLUMN IF NOT EXISTS phone     TEXT,
  ADD COLUMN IF NOT EXISTS website   TEXT,
  ADD COLUMN IF NOT EXISTS notes     TEXT;
