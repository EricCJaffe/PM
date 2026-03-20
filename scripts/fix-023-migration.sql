-- Recovery script: Run this in Supabase SQL Editor BEFORE re-running migration 023
-- This cleans up any partial state from the failed first attempt

-- 1. Drop the new constraint if it was partially added
ALTER TABLE pm_organizations DROP CONSTRAINT IF EXISTS pm_organizations_pipeline_status_check;

-- 2. Migrate data: map old values to new ones
UPDATE pm_organizations SET pipeline_status = 'closed_won' WHERE pipeline_status = 'client';
UPDATE pm_organizations SET pipeline_status = 'closed_lost' WHERE pipeline_status = 'inactive';
UPDATE pm_organizations SET pipeline_status = 'lead' WHERE pipeline_status = 'prospect';

-- 3. Now add the new constraint (should succeed since data is migrated)
ALTER TABLE pm_organizations
  ADD CONSTRAINT pm_organizations_pipeline_status_check
  CHECK (pipeline_status IN ('lead', 'qualified', 'discovery_complete', 'proposal_sent', 'negotiation', 'closed_won', 'closed_lost'));

-- 4. Set client_status values based on migrated pipeline_status
-- (client_status column may or may not exist from partial run)
DO $$ BEGIN
  ALTER TABLE pm_organizations
    ADD COLUMN IF NOT EXISTS client_status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (client_status IN ('prospect', 'client', 'inactive'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

UPDATE pm_organizations SET client_status = 'client' WHERE pipeline_status = 'closed_won';
UPDATE pm_organizations SET client_status = 'inactive' WHERE pipeline_status = 'closed_lost';

-- 5. Verify
SELECT name, pipeline_status, client_status FROM pm_organizations;
