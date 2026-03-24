-- =============================================================================
-- Migration 043: Site Audit Prospect Support
-- Makes org_id nullable on pm_site_audits and pm_audit_snapshots so audits
-- can be run against prospects (non-clients). Adds prospect_name column.
-- =============================================================================

-- 1. Add prospect_name column
ALTER TABLE pm_site_audits
  ADD COLUMN IF NOT EXISTS prospect_name TEXT;

-- 2. Make org_id nullable
ALTER TABLE pm_site_audits
  ALTER COLUMN org_id DROP NOT NULL;

-- 3. Same for snapshots
ALTER TABLE pm_audit_snapshots
  ADD COLUMN IF NOT EXISTS prospect_name TEXT;

ALTER TABLE pm_audit_snapshots
  ALTER COLUMN org_id DROP NOT NULL;

-- 4. Update RLS policies to allow prospect audits (org_id IS NULL)
-- Drop and recreate select policy to include prospect audits for internal users
DROP POLICY IF EXISTS site_audits_select ON pm_site_audits;
CREATE POLICY site_audits_select ON pm_site_audits FOR SELECT
  USING (pm_is_internal() OR (org_id IS NOT NULL AND pm_has_org_access(org_id)));

DROP POLICY IF EXISTS audit_snapshots_select ON pm_audit_snapshots;
CREATE POLICY audit_snapshots_select ON pm_audit_snapshots FOR SELECT
  USING (pm_is_internal() OR (org_id IS NOT NULL AND pm_has_org_access(org_id)));

-- 5. Index for prospect audits (no org_id)
CREATE INDEX IF NOT EXISTS idx_site_audits_prospect ON pm_site_audits(prospect_name)
  WHERE org_id IS NULL AND prospect_name IS NOT NULL;
