-- Organizations and members for PM module.
-- Lightweight tables that can coexist with or be replaced by FSA's shared org schema.

CREATE TABLE IF NOT EXISTS pm_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pm_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,            -- kebab-case identifier, e.g. "eric-jaffe"
  display_name TEXT NOT NULL,    -- human-readable, e.g. "Eric Jaffe"
  email TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slug)
);

-- Update pm_projects.org_id to reference pm_organizations
-- Drop any stale FK (may point to old "orgs" table) and recreate correctly
DO $$
BEGIN
  -- Drop existing constraint if it exists (may reference wrong table)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pm_projects_org_id_fkey'
      AND table_name = 'pm_projects'
  ) THEN
    ALTER TABLE pm_projects DROP CONSTRAINT pm_projects_org_id_fkey;
  END IF;

  -- Recreate pointing to pm_organizations
  ALTER TABLE pm_projects
    ADD CONSTRAINT pm_projects_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES pm_organizations(id);
END $$;

CREATE INDEX IF NOT EXISTS idx_pm_members_org ON pm_members(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_organizations_slug ON pm_organizations(slug);
