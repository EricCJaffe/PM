-- Additive migration: ensures all columns exist on tables that may have been
-- created before the full schema was finalized.
-- Safe to run multiple times (IF NOT EXISTS / exception handling).

-- ─── pm_project_templates ────────────────────────────────────────────
ALTER TABLE pm_project_templates ADD COLUMN IF NOT EXISTS phases JSONB NOT NULL DEFAULT '[]';
ALTER TABLE pm_project_templates ADD COLUMN IF NOT EXISTS description TEXT;

-- ─── pm_projects ─────────────────────────────────────────────────────
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS owner TEXT DEFAULT '';
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS template_slug TEXT REFERENCES pm_project_templates(slug);
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS budget NUMERIC;
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
DO $$ BEGIN
  ALTER TABLE pm_projects ADD CONSTRAINT pm_projects_status_check
    CHECK (status IN ('active','complete','paused','archived','on-hold'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── pm_phases ───────────────────────────────────────────────────────
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS phase_order INT NOT NULL DEFAULT 0;
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS "group" TEXT;
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not-started';
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0;
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS due_date DATE;
DO $$ BEGIN
  ALTER TABLE pm_phases ADD CONSTRAINT pm_phases_status_check
    CHECK (status IN ('not-started','in-progress','complete','blocked','pending','on-hold'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE pm_phases ADD CONSTRAINT pm_phases_progress_check
    CHECK (progress >= 0 AND progress <= 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── pm_tasks ────────────────────────────────────────────────────────
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES pm_phases(id) ON DELETE SET NULL;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not-started';
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS depends_on TEXT[] DEFAULT '{}';
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS risk_id UUID;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]';
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
DO $$ BEGIN
  ALTER TABLE pm_tasks ADD CONSTRAINT pm_tasks_status_check
    CHECK (status IN ('not-started','in-progress','complete','blocked','pending','on-hold'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── pm_risks ────────────────────────────────────────────────────────
ALTER TABLE pm_risks ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE pm_risks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE pm_risks ADD COLUMN IF NOT EXISTS probability TEXT DEFAULT 'medium';
ALTER TABLE pm_risks ADD COLUMN IF NOT EXISTS impact TEXT DEFAULT 'medium';
ALTER TABLE pm_risks ADD COLUMN IF NOT EXISTS mitigation TEXT;
ALTER TABLE pm_risks ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE pm_risks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
DO $$ BEGIN
  ALTER TABLE pm_risks ADD CONSTRAINT pm_risks_probability_check
    CHECK (probability IN ('low','medium','high'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE pm_risks ADD CONSTRAINT pm_risks_impact_check
    CHECK (impact IN ('low','medium','high'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE pm_risks ADD CONSTRAINT pm_risks_status_check
    CHECK (status IN ('open','mitigated','closed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── pm_files ────────────────────────────────────────────────────────
ALTER TABLE pm_files ADD COLUMN IF NOT EXISTS file_type TEXT NOT NULL DEFAULT 'project';
ALTER TABLE pm_files ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE pm_files ADD COLUMN IF NOT EXISTS frontmatter JSONB DEFAULT '{}';
ALTER TABLE pm_files ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT now();
DO $$ BEGIN
  ALTER TABLE pm_files ADD CONSTRAINT pm_files_file_type_check
    CHECK (file_type IN ('project','phase','task','risk','decision','status','resource','report','daily'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
