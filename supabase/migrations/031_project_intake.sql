-- =============================================================================
-- Migration 031: Project Intake Form
-- Adds intake/context/feature-flag JSONB columns to pm_projects,
-- toolstack fields, engagement linkage, and project_id on pm_engagements.
-- =============================================================================

-- 1. Add intake columns to pm_projects
ALTER TABLE pm_projects
  ADD COLUMN IF NOT EXISTS intake_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS client_context JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS github_repo TEXT,
  ADD COLUMN IF NOT EXISTS vercel_project TEXT,
  ADD COLUMN IF NOT EXISTS supabase_ref TEXT,
  ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS engagement_id UUID REFERENCES pm_engagements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS intake_completed_at TIMESTAMPTZ;

-- 2. Add project_id to pm_engagements for reverse lookup
ALTER TABLE pm_engagements
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES pm_projects(id) ON DELETE SET NULL;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS pm_projects_engagement_idx
  ON pm_projects(engagement_id) WHERE engagement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pm_engagements_project_idx
  ON pm_engagements(project_id) WHERE project_id IS NOT NULL;
