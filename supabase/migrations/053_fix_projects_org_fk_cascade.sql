-- Fix pm_projects_org_id_fkey to include ON DELETE CASCADE
-- Originally created in 003_orgs_and_members.sql without CASCADE, blocking client deletion

ALTER TABLE pm_projects
  DROP CONSTRAINT IF EXISTS pm_projects_org_id_fkey;

ALTER TABLE pm_projects
  ADD CONSTRAINT pm_projects_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES pm_organizations(id) ON DELETE CASCADE;
