-- Fix pm_tasks FK: repoint org_id from stale "orgs" table to "pm_organizations"
ALTER TABLE pm_tasks DROP CONSTRAINT IF EXISTS pm_tasks_org_id_fkey;
ALTER TABLE pm_tasks
  ADD CONSTRAINT pm_tasks_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES pm_organizations(id) ON DELETE CASCADE;
