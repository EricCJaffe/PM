-- =============================================================================
-- Migration 029: Standup Agent — Cross-Org Daily Logs
-- Makes project_id nullable, adds org_id + log_type columns,
-- and expands generated_by CHECK for standup-agent.
--
-- Defensive: ensures all columns from 001 exist before referencing them,
-- in case the table was created without the full original schema.
-- =============================================================================

-- 0. Ensure all original 001 columns exist before we reference them
ALTER TABLE pm_daily_logs
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES pm_projects(id) ON DELETE CASCADE;

ALTER TABLE pm_daily_logs
  ADD COLUMN IF NOT EXISTS date DATE;

ALTER TABLE pm_daily_logs
  ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';

ALTER TABLE pm_daily_logs
  ADD COLUMN IF NOT EXISTS generated_by TEXT DEFAULT 'ai';

-- 1. Make project_id nullable (currently NOT NULL in 001)
ALTER TABLE pm_daily_logs
  ALTER COLUMN project_id DROP NOT NULL;

-- 2. Add org_id for cross-org standups
ALTER TABLE pm_daily_logs
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES pm_organizations(id) ON DELETE CASCADE;

-- 3. Add log_type discriminator
ALTER TABLE pm_daily_logs
  ADD COLUMN IF NOT EXISTS log_type TEXT NOT NULL DEFAULT 'daily'
  CHECK (log_type IN ('daily', 'standup', 'rollup', 'blocker', 'hub', 'decisions'));

-- 4. Expand generated_by CHECK for standup-agent
ALTER TABLE pm_daily_logs
  DROP CONSTRAINT IF EXISTS pm_daily_logs_generated_by_check;

ALTER TABLE pm_daily_logs
  ADD CONSTRAINT pm_daily_logs_generated_by_check
  CHECK (generated_by IN ('ai', 'manual', 'standup-agent'));

-- 5. Index for org-based standup queries
CREATE INDEX IF NOT EXISTS pm_daily_logs_org_idx
  ON pm_daily_logs(org_id, date);

-- 6. Unique constraint for org+date standups (prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS pm_daily_logs_org_date_standup_idx
  ON pm_daily_logs(org_id, date, log_type) WHERE org_id IS NOT NULL;
