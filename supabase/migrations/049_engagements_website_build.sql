-- Migration 049: Add website_build service line and website_url to engagements
-- Also adds projected_mrr, projected_one_time, owner, notes columns if missing.

ALTER TABLE pm_engagements
  ADD COLUMN IF NOT EXISTS website_url        TEXT,
  ADD COLUMN IF NOT EXISTS projected_mrr      DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS projected_one_time DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS owner              TEXT,
  ADD COLUMN IF NOT EXISTS notes              TEXT;

-- Drop the old CHECK constraint on engagement_type and re-add with website_build
ALTER TABLE pm_engagements DROP CONSTRAINT IF EXISTS pm_engagements_engagement_type_check;
