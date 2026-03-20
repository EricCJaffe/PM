-- Migration 023: CRM Engagement Workflow
-- Adds: pm_engagements, pm_engagement_task_templates, client_status on orgs
-- Extends: pm_tasks with engagement_id + completed_at
-- Updates: pipeline_status CHECK to use 7-stage deal model

-- ─── 1. Add client_status to organizations ──────────────────────────
-- Separates relationship status (prospect/client/inactive) from deal pipeline stages
ALTER TABLE pm_organizations
  ADD COLUMN IF NOT EXISTS client_status TEXT NOT NULL DEFAULT 'prospect'
  CHECK (client_status IN ('prospect', 'client', 'inactive'));

-- Update pipeline_status to the 7-stage deal model
-- First drop the old CHECK constraint, then add the new one
ALTER TABLE pm_organizations DROP CONSTRAINT IF EXISTS pm_organizations_pipeline_status_check;
ALTER TABLE pm_organizations
  ADD CONSTRAINT pm_organizations_pipeline_status_check
  CHECK (pipeline_status IN ('lead', 'qualified', 'discovery_complete', 'proposal_sent', 'negotiation', 'closed_won', 'closed_lost'));

-- Migrate existing data: prospect → lead, client → closed_won, inactive → closed_lost
UPDATE pm_organizations SET pipeline_status = 'lead' WHERE pipeline_status = 'prospect';
UPDATE pm_organizations SET pipeline_status = 'closed_won', client_status = 'client' WHERE pipeline_status = 'client';
UPDATE pm_organizations SET pipeline_status = 'closed_lost', client_status = 'inactive' WHERE pipeline_status = 'inactive';

-- ─── 2. Engagements table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_engagements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL DEFAULT 'Initial Engagement',
  type                  TEXT NOT NULL DEFAULT 'new_prospect'
    CHECK (type IN ('new_prospect', 'existing_client')),
  deal_stage            TEXT NOT NULL DEFAULT 'lead'
    CHECK (deal_stage IN ('lead', 'qualified', 'discovery_complete', 'proposal_sent', 'negotiation', 'closed_won', 'closed_lost')),
  assigned_to           TEXT,  -- member slug (team member picker)
  estimated_value       DECIMAL(12,2),
  probability_override  INTEGER CHECK (probability_override IS NULL OR (probability_override >= 0 AND probability_override <= 100)),
  expected_close_date   DATE,
  closed_reason         TEXT,
  discovery_notes       TEXT,
  engagement_type       TEXT,  -- service line: process_audit, ai_automation, marketing, business_consulting, website_dev, other
  referral_source       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_engagements_org ON pm_engagements(org_id);
CREATE INDEX IF NOT EXISTS idx_pm_engagements_stage ON pm_engagements(deal_stage);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION pm_engagements_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pm_engagements_updated_at ON pm_engagements;
CREATE TRIGGER pm_engagements_updated_at
  BEFORE UPDATE ON pm_engagements
  FOR EACH ROW EXECUTE FUNCTION pm_engagements_updated_at();

-- RLS
ALTER TABLE pm_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_engagements_internal_all" ON pm_engagements
  USING (pm_is_internal())
  WITH CHECK (pm_is_internal_write());

CREATE POLICY "pm_engagements_external_read" ON pm_engagements
  FOR SELECT USING (pm_has_org_access(org_id));

-- ─── 3. Engagement task templates (stage-triggered auto-tasks) ──────
CREATE TABLE IF NOT EXISTS pm_engagement_task_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_stage       TEXT NOT NULL
    CHECK (trigger_stage IN ('lead', 'qualified', 'discovery_complete', 'proposal_sent', 'negotiation', 'closed_won', 'closed_lost')),
  title               TEXT NOT NULL,
  description         TEXT,
  due_offset_days     INTEGER NOT NULL DEFAULT 0,  -- business days from stage entry
  nudge_after_days    INTEGER DEFAULT 1,           -- days overdue before notification
  engagement_type     TEXT NOT NULL DEFAULT 'both'
    CHECK (engagement_type IN ('new_prospect', 'existing_client', 'both')),
  sort_order          INTEGER NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pm_engagement_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_engagement_task_templates_read" ON pm_engagement_task_templates
  FOR SELECT USING (true);

CREATE POLICY "pm_engagement_task_templates_write" ON pm_engagement_task_templates
  USING (pm_is_internal_write())
  WITH CHECK (pm_is_internal_write());

-- ─── 4. Extend pm_tasks for engagements ─────────────────────────────
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS engagement_id UUID REFERENCES pm_engagements(id) ON DELETE SET NULL;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS nudge_after_days INTEGER;
ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS last_nudge_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pm_tasks_engagement ON pm_tasks(engagement_id) WHERE engagement_id IS NOT NULL;

-- ─── 5. Seed engagement task templates ──────────────────────────────
INSERT INTO pm_engagement_task_templates (trigger_stage, title, description, due_offset_days, nudge_after_days, engagement_type, sort_order) VALUES
-- Lead stage
('lead', 'Schedule discovery call with prospect', 'Reach out and book an initial meeting to understand their needs', 2, 1, 'new_prospect', 1),

-- Qualified stage
('qualified', 'Conduct discovery meeting and log notes', 'Complete the discovery session and document findings in client notes', 0, 1, 'new_prospect', 1),

-- Discovery Complete stage
('discovery_complete', 'Generate proposal documents (MSA + SOW)', 'Create the master service agreement and statement of work based on discovery', 5, 2, 'new_prospect', 1),
('discovery_complete', 'Scope engagement and build SOW', 'Define the scope and create the statement of work for this engagement', 3, 2, 'existing_client', 2),
('discovery_complete', 'Internal review of proposal documents', 'Have a team member review all documents before sending to client', 1, 1, 'both', 3),

-- Proposal Sent stage
('proposal_sent', 'Follow up — no response (2 day check)', 'Check in with the prospect if no response after 2 business days', 2, 0, 'both', 1),
('proposal_sent', 'Second follow-up attempt (5 day check)', 'Send a second follow-up if still no response', 5, 0, 'both', 2),

-- Closed Won stage
('closed_won', 'Countersign executed documents', 'Sign the MSA/SOW from our side to finalize the agreement', 1, 0, 'both', 1),
('closed_won', 'Confirm billing method and payment terms', 'Set up invoicing — monthly retainer and/or project billing', 2, 1, 'both', 2),
('closed_won', 'Schedule onboarding kickoff meeting', 'Book the first working session with the new client', 3, 1, 'new_prospect', 3),
('closed_won', 'Collect client tech stack and tool access', 'Gather credentials, tool access, and system details needed for delivery', 3, 1, 'new_prospect', 4),
('closed_won', 'Review and refine project plan', 'Adjust the auto-generated project plan based on signed SOW', 3, 1, 'both', 5),
('closed_won', 'Assign team members to project tasks', 'Distribute project tasks to the appropriate team members', 3, 1, 'both', 6);
