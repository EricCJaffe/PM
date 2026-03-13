-- Additive migration: ensures all columns exist on tables that may have been
-- created before the full schema was finalized.
-- Safe to run multiple times (IF NOT EXISTS / exception handling).

-- ─── pm_project_templates ────────────────────────────────────────────
ALTER TABLE pm_project_templates ADD COLUMN IF NOT EXISTS phases JSONB NOT NULL DEFAULT '[]';
ALTER TABLE pm_project_templates ADD COLUMN IF NOT EXISTS description TEXT;

-- ─── pm_projects ─────────────────────────────────────────────────────
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS owner TEXT DEFAULT '';
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS template_slug TEXT REFERENCES pm_project_templates(slug);
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS budget NUMERIC;
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ─── pm_phases ───────────────────────────────────────────────────────
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS "group" TEXT;
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0;
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS due_date DATE;

-- ─── pm_tasks ────────────────────────────────────────────────────────
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS depends_on TEXT[] DEFAULT '{}';
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS risk_id UUID;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]';
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ─── pm_risks ────────────────────────────────────────────────────────
ALTER TABLE pm_risks ADD COLUMN IF NOT EXISTS mitigation TEXT;
ALTER TABLE pm_risks ADD COLUMN IF NOT EXISTS owner TEXT;

-- ─── pm_files ────────────────────────────────────────────────────────
ALTER TABLE pm_files ADD COLUMN IF NOT EXISTS frontmatter JSONB DEFAULT '{}';
ALTER TABLE pm_files ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT now();

-- ─── Ensure triggers exist ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION pm_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pm_projects_updated_at ON pm_projects;
CREATE TRIGGER pm_projects_updated_at
  BEFORE UPDATE ON pm_projects
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();

DROP TRIGGER IF EXISTS pm_tasks_updated_at ON pm_tasks;
CREATE TRIGGER pm_tasks_updated_at
  BEFORE UPDATE ON pm_tasks
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();
