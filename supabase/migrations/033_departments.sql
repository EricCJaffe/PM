-- Migration 033: Departments table with flexible vocabulary
-- Departments are organizational units within a client org.
-- The "label" system allows clients to rename the base vocabulary
-- (vision, people, data, processes, meetings, issues) to their own terms.

-- ─── pm_departments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  slug        text NOT NULL,
  name        text NOT NULL,
  description text,
  head_name   text,                    -- department lead / point of contact
  head_email  text,
  member_count int DEFAULT 0,
  sort_order  int DEFAULT 0,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(org_id, slug)
);

-- ─── pm_department_vocab ─────────────────────────────────────────────
-- Allows each org (or department) to rename the base discovery sublayers.
-- base_term is our canonical key (vision, people, data, processes, meetings, issues).
-- display_label is what the client sees.
CREATE TABLE IF NOT EXISTS pm_department_vocab (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES pm_departments(id) ON DELETE CASCADE,
  base_term   text NOT NULL,           -- canonical: vision, people, data, processes, meetings, issues
  display_label text NOT NULL,         -- what the client calls it
  description text,
  sort_order  int DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(org_id, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid), base_term)
);

-- ─── Link departments to tasks/phases ────────────────────────────────
-- Add department_id to tasks so they can be scoped
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES pm_departments(id) ON DELETE SET NULL;

-- Add department_id to phases for department-specific phases
ALTER TABLE pm_phases ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES pm_departments(id) ON DELETE SET NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE pm_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_department_vocab ENABLE ROW LEVEL SECURITY;

-- Internal staff: full access
CREATE POLICY pm_departments_internal_read ON pm_departments
  FOR SELECT USING (pm_is_internal());
CREATE POLICY pm_departments_internal_write ON pm_departments
  FOR ALL USING (pm_is_internal_write());

CREATE POLICY pm_dept_vocab_internal_read ON pm_department_vocab
  FOR SELECT USING (pm_is_internal());
CREATE POLICY pm_dept_vocab_internal_write ON pm_department_vocab
  FOR ALL USING (pm_is_internal_write());

-- External users: read own org departments
CREATE POLICY pm_departments_external_read ON pm_departments
  FOR SELECT USING (pm_has_org_access(org_id));

CREATE POLICY pm_dept_vocab_external_read ON pm_department_vocab
  FOR SELECT USING (pm_has_org_access(org_id));

-- ─── Indexes ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_departments_org ON pm_departments(org_id);
CREATE INDEX IF NOT EXISTS idx_dept_vocab_org ON pm_department_vocab(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_department ON pm_tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_phases_department ON pm_phases(department_id);

-- ─── Seed default base vocabulary ────────────────────────────────────
-- These are the canonical terms used across all orgs by default.
-- Orgs can override by inserting into pm_department_vocab.
COMMENT ON TABLE pm_department_vocab IS 'Base terms: vision, people, data, processes, meetings, issues. Orgs override display_label per department or org-wide.';
