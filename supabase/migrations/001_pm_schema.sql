-- BusinessOS Project Management Schema
-- Assumes shared Supabase project with existing auth + org/tenant schema

-- ─── Project Templates ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  phases JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Projects ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  template_slug TEXT REFERENCES pm_project_templates(slug),
  start_date DATE DEFAULT CURRENT_DATE,
  target_date DATE,
  budget NUMERIC,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','complete','paused','archived','on-hold')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slug)
);

-- ─── Phases ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  "order" INT NOT NULL DEFAULT 0,
  "group" TEXT,
  status TEXT NOT NULL DEFAULT 'not-started'
    CHECK (status IN ('not-started','in-progress','complete','blocked','pending','on-hold')),
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  owner TEXT,
  start_date DATE,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, slug)
);

-- ─── Tasks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES pm_phases(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'not-started'
    CHECK (status IN ('not-started','in-progress','complete','blocked','pending','on-hold')),
  due_date DATE,
  depends_on TEXT[] DEFAULT '{}',
  risk_id UUID,
  subtasks JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, slug)
);

-- ─── Risks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  probability TEXT DEFAULT 'medium' CHECK (probability IN ('low','medium','high')),
  impact TEXT DEFAULT 'medium' CHECK (impact IN ('low','medium','high')),
  mitigation TEXT,
  owner TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','mitigated','closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, slug)
);

-- ─── Daily Logs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  generated_by TEXT DEFAULT 'ai' CHECK (generated_by IN ('ai','manual')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, date)
);

-- ─── File Index ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_type TEXT NOT NULL
    CHECK (file_type IN ('project','phase','task','risk','decision','status','resource','report','daily')),
  title TEXT NOT NULL,
  frontmatter JSONB DEFAULT '{}',
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, storage_path)
);

-- ─── Indexes ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pm_projects_org ON pm_projects(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_projects_status ON pm_projects(status);
CREATE INDEX IF NOT EXISTS idx_pm_phases_project ON pm_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_project ON pm_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_phase ON pm_tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_status ON pm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_pm_risks_project ON pm_risks(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_files_project ON pm_files(project_id);

-- ─── Updated-at Trigger ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pm_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER pm_projects_updated_at
  BEFORE UPDATE ON pm_projects
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();

CREATE OR REPLACE TRIGGER pm_tasks_updated_at
  BEFORE UPDATE ON pm_tasks
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();
