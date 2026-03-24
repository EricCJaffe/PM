-- =============================================================================
-- Migration 045: Rename pm_daily_logs.date → log_date
-- Avoids PostgreSQL reserved word conflict and aligns with actual DB schema.
-- =============================================================================

-- Handle three possible states:
-- 1. Only "date" exists → rename it
-- 2. Both "date" and "log_date" exist → migrate data, drop old column
-- 3. Only "log_date" exists → nothing to do
DO $$
DECLARE
  has_date BOOLEAN;
  has_log_date BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pm_daily_logs' AND column_name = 'date'
  ) INTO has_date;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pm_daily_logs' AND column_name = 'log_date'
  ) INTO has_log_date;

  IF has_date AND has_log_date THEN
    -- Both columns exist: copy any non-null date values into log_date where log_date is null
    UPDATE pm_daily_logs SET log_date = "date" WHERE log_date IS NULL AND "date" IS NOT NULL;
    ALTER TABLE pm_daily_logs DROP COLUMN "date";
  ELSIF has_date AND NOT has_log_date THEN
    ALTER TABLE pm_daily_logs RENAME COLUMN "date" TO log_date;
  END IF;

  -- Ensure NOT NULL constraint
  ALTER TABLE pm_daily_logs ALTER COLUMN log_date SET NOT NULL;
END $$;

-- Recreate indexes that referenced the old column name
DROP INDEX IF EXISTS pm_daily_logs_org_idx;
CREATE INDEX IF NOT EXISTS pm_daily_logs_org_idx
  ON pm_daily_logs(org_id, log_date);

DROP INDEX IF EXISTS pm_daily_logs_org_date_standup_idx;
CREATE UNIQUE INDEX IF NOT EXISTS pm_daily_logs_org_date_standup_idx
  ON pm_daily_logs(org_id, log_date, log_type) WHERE org_id IS NOT NULL;
