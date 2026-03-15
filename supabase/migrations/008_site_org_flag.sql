-- BusinessOS PM — Site-Level Organization Support
-- Adds is_site_org flag to pm_organizations to identify the platform owner org
-- Members of the site org are available as assignees across ALL client orgs.

ALTER TABLE pm_organizations
  ADD COLUMN IF NOT EXISTS is_site_org BOOLEAN NOT NULL DEFAULT false;

-- Only one org can be the site org
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_organizations_site_org
  ON pm_organizations (is_site_org) WHERE is_site_org = true;

COMMENT ON COLUMN pm_organizations.is_site_org IS
  'When true, members of this org are available as assignees across all client orgs.';
