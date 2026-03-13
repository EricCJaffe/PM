-- =====================================================================
-- BusinessOS PM — FULL SETUP (run once in Supabase SQL Editor)
-- Combines: 001_pm_schema + 002_add_missing_columns + 003_orgs_and_members + template seeds
-- Safe to re-run (uses IF NOT EXISTS / IF NOT EXISTS / upsert logic)
-- =====================================================================

-- ═══════════════════════════════════════════════════════════════════════
-- 001: Core PM Schema
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pm_project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  phases JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS pm_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  generated_by TEXT DEFAULT 'ai' CHECK (generated_by IN ('ai','manual')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, date)
);

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pm_projects_org ON pm_projects(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_projects_status ON pm_projects(status);
CREATE INDEX IF NOT EXISTS idx_pm_phases_project ON pm_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_project ON pm_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_phase ON pm_tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_status ON pm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_pm_risks_project ON pm_risks(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_files_project ON pm_files(project_id);

-- Updated-at trigger
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

-- ═══════════════════════════════════════════════════════════════════════
-- 002: Add missing columns (safe if they already exist)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS owner TEXT DEFAULT '';
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS template_slug TEXT;
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS budget NUMERIC;
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS "group" TEXT;
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0;
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS depends_on TEXT[] DEFAULT '{}';
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS risk_id UUID;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]';
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE pm_risks ADD COLUMN IF NOT EXISTS mitigation TEXT;
ALTER TABLE pm_risks ADD COLUMN IF NOT EXISTS owner TEXT;

ALTER TABLE pm_files ADD COLUMN IF NOT EXISTS frontmatter JSONB DEFAULT '{}';
ALTER TABLE pm_files ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT now();

-- ═══════════════════════════════════════════════════════════════════════
-- 003: Organizations & Members
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pm_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pm_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slug)
);

-- FK from projects to organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pm_projects_org_id_fkey'
      AND table_name = 'pm_projects'
  ) THEN
    ALTER TABLE pm_projects
      ADD CONSTRAINT pm_projects_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES pm_organizations(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pm_members_org ON pm_members(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_organizations_slug ON pm_organizations(slug);

-- ═══════════════════════════════════════════════════════════════════════
-- SEED: Project Templates (upsert — safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO pm_project_templates (slug, name, description, phases) VALUES
(
  'saas-rollout',
  'SaaS App Rollout',
  '26-phase rollout for SaaS products, grouped into Build, Go-to-Market, Grow, and Foundation stages.',
  '[
    {"order":1,"slug":"idea-validation","name":"Idea Validation & Problem Definition","group":"BUILD"},
    {"order":2,"slug":"market-research","name":"Market Research & Competitor Analysis","group":"BUILD"},
    {"order":3,"slug":"business-model","name":"Business Model & Monetization","group":"BUILD"},
    {"order":4,"slug":"product-design","name":"Product Design & UX","group":"BUILD"},
    {"order":5,"slug":"tech-architecture","name":"Technical Architecture & Stack","group":"BUILD"},
    {"order":6,"slug":"mvp-development","name":"MVP Development","group":"BUILD"},
    {"order":7,"slug":"testing-qa","name":"Testing & QA","group":"BUILD"},
    {"order":8,"slug":"launch-planning","name":"Launch Planning","group":"GO-TO-MARKET"},
    {"order":9,"slug":"marketing-content","name":"Marketing & Content Strategy","group":"GO-TO-MARKET"},
    {"order":10,"slug":"sales-enablement","name":"Sales Enablement","group":"GO-TO-MARKET"},
    {"order":11,"slug":"conversion-optimization","name":"Conversion Optimization","group":"GO-TO-MARKET"},
    {"order":12,"slug":"revenue-tracking","name":"Revenue & Metrics Tracking","group":"GROW"},
    {"order":13,"slug":"customer-success","name":"Customer Success & Support","group":"GROW"},
    {"order":14,"slug":"product-iteration","name":"Product Iteration & Roadmap","group":"GROW"},
    {"order":15,"slug":"partnerships","name":"Partnerships & Integrations","group":"GROW"},
    {"order":16,"slug":"scaling","name":"Scaling Infrastructure & Team","group":"GROW"},
    {"order":17,"slug":"legal-compliance","name":"Legal & Compliance","group":"FOUNDATION"},
    {"order":18,"slug":"finance-accounting","name":"Finance & Accounting","group":"FOUNDATION"},
    {"order":19,"slug":"hr-culture","name":"HR & Culture","group":"FOUNDATION"},
    {"order":20,"slug":"security-privacy","name":"Security & Privacy","group":"FOUNDATION"},
    {"order":21,"slug":"devops-infra","name":"DevOps & Infrastructure","group":"FOUNDATION"},
    {"order":22,"slug":"analytics-bi","name":"Analytics & BI","group":"FOUNDATION"},
    {"order":23,"slug":"documentation","name":"Documentation & Knowledge Base","group":"FOUNDATION"},
    {"order":24,"slug":"community","name":"Community & Developer Relations","group":"FOUNDATION"},
    {"order":25,"slug":"vendor-management","name":"Vendor Management","group":"FOUNDATION"},
    {"order":26,"slug":"staffing","name":"Staffing & Contractors","group":"FOUNDATION"}
  ]'::jsonb
),
(
  'ministry-discovery',
  'Ministry / Org Discovery',
  '7-phase discovery process for ministry and organizational transformation.',
  '[
    {"order":0,"slug":"prayer-commitment","name":"Prayer & Commitment"},
    {"order":1,"slug":"vision-alignment","name":"Vision Alignment"},
    {"order":2,"slug":"leadership-assessment","name":"Leadership Assessment"},
    {"order":3,"slug":"department-discovery","name":"Department Discovery"},
    {"order":4,"slug":"gap-analysis","name":"Gap Analysis & Prioritization"},
    {"order":5,"slug":"roadmap-creation","name":"Roadmap Creation"},
    {"order":6,"slug":"equip-empower-release","name":"Equip, Empower, Release"}
  ]'::jsonb
),
(
  'tech-stack-modernization',
  'Tech Stack Modernization (PMBOK)',
  'PMBOK-aligned tech modernization with 12 management sections and parallel workstreams.',
  '[
    {"order":1,"slug":"integration-mgmt","name":"Integration Management"},
    {"order":2,"slug":"scope-mgmt","name":"Scope Management"},
    {"order":3,"slug":"schedule-mgmt","name":"Schedule Management"},
    {"order":4,"slug":"cost-mgmt","name":"Cost Management"},
    {"order":5,"slug":"quality-mgmt","name":"Quality Management"},
    {"order":6,"slug":"resource-mgmt","name":"Resource Management"},
    {"order":7,"slug":"communications-mgmt","name":"Communications Management"},
    {"order":8,"slug":"risk-mgmt","name":"Risk Management"},
    {"order":9,"slug":"procurement-mgmt","name":"Procurement Management"},
    {"order":10,"slug":"stakeholder-mgmt","name":"Stakeholder Management"},
    {"order":11,"slug":"change-mgmt","name":"Change Management"},
    {"order":12,"slug":"governance","name":"Governance & Reporting"}
  ]'::jsonb
),
(
  'custom',
  'Custom',
  'Blank slate project. Define your own phases, tasks, and structure.',
  '[]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  phases = EXCLUDED.phases;
