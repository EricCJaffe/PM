-- =============================================================================
-- Migration 046: Fix pm_daily_logs org_id foreign key
-- Ensures project_id is nullable and org_id FK correctly references
-- pm_organizations(id). Drops and recreates the constraint to fix any
-- stale or misconfigured FK from prior migrations.
-- =============================================================================

-- 1. Ensure project_id is nullable (may still be NOT NULL if 029 failed partially)
ALTER TABLE pm_daily_logs
  ALTER COLUMN project_id DROP NOT NULL;

-- 2. Drop the potentially broken org_id FK and recreate it cleanly
ALTER TABLE pm_daily_logs
  DROP CONSTRAINT IF EXISTS pm_daily_logs_org_id_fkey;

-- Ensure org_id column exists
ALTER TABLE pm_daily_logs
  ADD COLUMN IF NOT EXISTS org_id UUID;

-- Re-add the FK constraint referencing pm_organizations(id)
ALTER TABLE pm_daily_logs
  ADD CONSTRAINT pm_daily_logs_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES pm_organizations(id) ON DELETE CASCADE;

-- 3. Ensure log_type column exists with correct CHECK
ALTER TABLE pm_daily_logs
  ADD COLUMN IF NOT EXISTS log_type TEXT NOT NULL DEFAULT 'daily';

-- 4. Ensure generated_by allows 'standup-agent'
ALTER TABLE pm_daily_logs
  DROP CONSTRAINT IF EXISTS pm_daily_logs_generated_by_check;

ALTER TABLE pm_daily_logs
  ADD CONSTRAINT pm_daily_logs_generated_by_check
  CHECK (generated_by IN ('ai', 'manual', 'standup-agent'));

-- 5. Re-create indexes (safe with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS pm_daily_logs_org_idx
  ON pm_daily_logs(org_id, log_date);

CREATE UNIQUE INDEX IF NOT EXISTS pm_daily_logs_org_date_standup_idx
  ON pm_daily_logs(org_id, log_date, log_type) WHERE org_id IS NOT NULL;
