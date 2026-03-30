-- Migration 047: Audit Workflows
-- Adds pm_audit_workflows table linking site audits to remediation/rebuild projects.
-- Adds portal settings columns for workflow visibility.
-- Adds audit_id to gap analysis for traceability.

-- ─── 1. New table: pm_audit_workflows ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pm_audit_workflows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id         UUID NOT NULL REFERENCES pm_site_audits(id) ON DELETE CASCADE,
  org_id           UUID REFERENCES pm_organizations(id) ON DELETE CASCADE,
  project_id       UUID REFERENCES pm_projects(id) ON DELETE SET NULL,
  workflow_type    TEXT NOT NULL CHECK (workflow_type IN ('remediation', 'rebuild', 'guided_rebuild')),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'complete')),
  target_scores    JSONB NOT NULL DEFAULT '{"overall": 80}',
  current_score    INTEGER,
  latest_audit_id  UUID REFERENCES pm_site_audits(id) ON DELETE SET NULL,
  config           JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_workflows_org ON pm_audit_workflows(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_workflows_audit ON pm_audit_workflows(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_workflows_status ON pm_audit_workflows(status) WHERE status = 'active';

-- ─── 2. Column additions ─────────────────────────────────────────────────────

-- Reverse link from audit to workflow
ALTER TABLE pm_site_audits
  ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES pm_audit_workflows(id) ON DELETE SET NULL;

-- Portal settings: workflow visibility toggles
ALTER TABLE pm_portal_settings
  ADD COLUMN IF NOT EXISTS show_site_audit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_workflow BOOLEAN NOT NULL DEFAULT true;

-- Gap analysis: trace back to source audit
ALTER TABLE pm_gap_analysis
  ADD COLUMN IF NOT EXISTS audit_id UUID REFERENCES pm_site_audits(id) ON DELETE SET NULL;

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE pm_audit_workflows ENABLE ROW LEVEL SECURITY;

-- Internal users: full access
CREATE POLICY pm_audit_workflows_internal_read ON pm_audit_workflows
  FOR SELECT USING (pm_is_internal());

CREATE POLICY pm_audit_workflows_internal_write ON pm_audit_workflows
  FOR ALL USING (pm_is_internal_write());

-- External users: read-only, scoped to their orgs
CREATE POLICY pm_audit_workflows_external_read ON pm_audit_workflows
  FOR SELECT USING (pm_has_org_access(org_id));

-- Service role bypasses RLS automatically.

-- ─── Done ────────────────────────────────────────────────────────────────────
