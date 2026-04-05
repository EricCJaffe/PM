-- Migration 048: Process Discovery Workflow
-- Adds process_discovery workflow type, department intake table,
-- and department tracking columns.

-- ─── 1. Extend workflow_type constraint ──────────────────────────────────────

ALTER TABLE pm_audit_workflows
  DROP CONSTRAINT IF EXISTS pm_audit_workflows_workflow_type_check;
ALTER TABLE pm_audit_workflows
  ADD CONSTRAINT pm_audit_workflows_workflow_type_check
  CHECK (workflow_type IN ('remediation', 'rebuild', 'guided_rebuild', 'process_discovery'));

-- Allow process_discovery workflows without an audit (audit_id nullable)
ALTER TABLE pm_audit_workflows
  ALTER COLUMN audit_id DROP NOT NULL;

-- ─── 2. Department tracking columns ─────────────────────────────────────────

ALTER TABLE pm_departments
  ADD COLUMN IF NOT EXISTS process_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processes_documented INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS playbook_document_id UUID REFERENCES generated_documents(id) ON DELETE SET NULL;

-- ─── 3. Department intake table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pm_department_intake (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id      UUID NOT NULL REFERENCES pm_audit_workflows(id) ON DELETE CASCADE,
  org_id           UUID NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  department_id    UUID NOT NULL REFERENCES pm_departments(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'not-started'
                   CHECK (status IN ('not-started', 'in-progress', 'complete', 'reviewed', 'approved')),
  responses        JSONB NOT NULL DEFAULT '{}',
  pillar_scores    JSONB NOT NULL DEFAULT '{}',
  ai_summary       TEXT,
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  approved_by      TEXT,
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_dept_intake_workflow ON pm_department_intake(workflow_id);
CREATE INDEX IF NOT EXISTS idx_dept_intake_org ON pm_department_intake(org_id);
CREATE INDEX IF NOT EXISTS idx_dept_intake_dept ON pm_department_intake(department_id);

-- ─── 4. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE pm_department_intake ENABLE ROW LEVEL SECURITY;

CREATE POLICY dept_intake_internal_read ON pm_department_intake
  FOR SELECT USING (pm_is_internal());

CREATE POLICY dept_intake_internal_write ON pm_department_intake
  FOR ALL USING (pm_is_internal_write());

CREATE POLICY dept_intake_external_read ON pm_department_intake
  FOR SELECT USING (pm_has_org_access(org_id));

-- External users can update their own department intake forms
CREATE POLICY dept_intake_external_update ON pm_department_intake
  FOR UPDATE USING (pm_has_org_access(org_id))
  WITH CHECK (pm_has_org_access(org_id));

-- ─── Done ────────────────────────────────────────────────────────────────────
