-- =============================================================================
-- Migration 045: Rename pm_daily_logs.date → log_date
-- Avoids PostgreSQL reserved word conflict and aligns with actual DB schema.
-- =============================================================================

-- Rename the column (idempotent: will fail if already renamed, wrapped in DO block)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pm_daily_logs' AND column_name = 'date'
  ) THEN
    ALTER TABLE pm_daily_logs RENAME COLUMN "date" TO log_date;
  END IF;
END $$;

-- Recreate indexes that referenced the old column name
DROP INDEX IF EXISTS pm_daily_logs_org_idx;
CREATE INDEX IF NOT EXISTS pm_daily_logs_org_idx
  ON pm_daily_logs(org_id, log_date);

DROP INDEX IF EXISTS pm_daily_logs_org_date_standup_idx;
CREATE UNIQUE INDEX IF NOT EXISTS pm_daily_logs_org_date_standup_idx
  ON pm_daily_logs(org_id, log_date, log_type) WHERE org_id IS NOT NULL;
