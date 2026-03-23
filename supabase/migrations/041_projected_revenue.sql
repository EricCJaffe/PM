-- Migration 041: Projected Revenue Fields
-- Adds MRR and one-time projected revenue to engagements and projects
-- Enables pipeline-stage MRR roll-up in the CRM view

-- ─── 1. Engagement revenue breakdown ─────────────────────────────────
-- Split estimated_value into recurring vs one-time components
ALTER TABLE pm_engagements
  ADD COLUMN IF NOT EXISTS projected_mrr DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS projected_one_time DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN pm_engagements.projected_mrr IS 'Monthly recurring revenue expected from this engagement';
COMMENT ON COLUMN pm_engagements.projected_one_time IS 'One-time project revenue expected from this engagement';

-- ─── 2. Project revenue fields ───────────────────────────────────────
ALTER TABLE pm_projects
  ADD COLUMN IF NOT EXISTS projected_mrr DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS projected_one_time DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN pm_projects.projected_mrr IS 'Monthly recurring revenue for this project';
COMMENT ON COLUMN pm_projects.projected_one_time IS 'One-time revenue for this project';
