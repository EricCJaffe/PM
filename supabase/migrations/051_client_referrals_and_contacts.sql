-- Migration 051: Client referrals and secondary contacts
-- Adds referral tracking and fixed secondary contact slots to pm_organizations.
-- RLS already exists on pm_organizations; reassert it here to keep migration intent explicit.

ALTER TABLE pm_organizations
  ADD COLUMN IF NOT EXISTS referred_by TEXT,
  ADD COLUMN IF NOT EXISTS billing_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS billing_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS billing_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS technical_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS technical_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS technical_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS other_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS other_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS other_contact_phone TEXT;

ALTER TABLE pm_organizations ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN pm_organizations.referred_by IS
  'Free-text referral source for the client, e.g. person, partner, or organization.';
COMMENT ON COLUMN pm_organizations.billing_contact_name IS
  'Billing contact display name for invoices and payment coordination.';
COMMENT ON COLUMN pm_organizations.billing_contact_email IS
  'Billing contact email address.';
COMMENT ON COLUMN pm_organizations.billing_contact_phone IS
  'Billing contact phone number.';
COMMENT ON COLUMN pm_organizations.technical_contact_name IS
  'Technical contact display name for implementation and support coordination.';
COMMENT ON COLUMN pm_organizations.technical_contact_email IS
  'Technical contact email address.';
COMMENT ON COLUMN pm_organizations.technical_contact_phone IS
  'Technical contact phone number.';
COMMENT ON COLUMN pm_organizations.other_contact_name IS
  'Additional non-primary contact display name.';
COMMENT ON COLUMN pm_organizations.other_contact_email IS
  'Additional non-primary contact email address.';
COMMENT ON COLUMN pm_organizations.other_contact_phone IS
  'Additional non-primary contact phone number.';
