-- Migration 035: Discovery/Onboarding Project & Gap Analysis
-- Discovery is the first phase of an "onboarding project" that lives under a client.
-- The onboarding project populates the discovery phase based on engagement type,
-- then feeds into the main process project for remaining phases.
--
-- Gap analysis captures findings from discovery — what's missing, what needs attention.

-- ─── Extend pm_projects for onboarding project type ─────────────────
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS project_type text DEFAULT 'standard';
-- project_type values: 'standard' | 'onboarding' | 'personal'
-- 'onboarding' projects are discovery-phase projects that feed into process projects

ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS parent_project_id uuid REFERENCES pm_projects(id) ON DELETE SET NULL;
-- When an onboarding project completes, it can spawn/link to the main process project.
-- parent_project_id links the child process project back to its onboarding project.

ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT 'not-started';
-- Tracks onboarding completion: not-started | discovery | gap-analysis | planning | active | complete

-- ─── pm_gap_analysis ─────────────────────────────────────────────────
-- Structured findings from discovery process.
-- Each row = one gap identified during discovery.
CREATE TABLE IF NOT EXISTS pm_gap_analysis (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES pm_projects(id) ON DELETE SET NULL,
  engagement_id   uuid REFERENCES pm_engagements(id) ON DELETE SET NULL,
  department_id   uuid REFERENCES pm_departments(id) ON DELETE SET NULL,

  -- Gap details
  category        text NOT NULL,         -- vision, people, data, processes, meetings, issues, other
  title           text NOT NULL,
  current_state   text,                  -- what exists now
  desired_state   text,                  -- what should exist
  gap_description text,                  -- the delta
  severity        text DEFAULT 'medium', -- low, medium, high, critical
  priority        int DEFAULT 0,         -- 0 = unranked, higher = more urgent

  -- Resolution tracking
  status          text DEFAULT 'identified', -- identified, acknowledged, planned, in-progress, resolved
  resolution_notes text,
  resolved_at     timestamptz,
  task_id         uuid REFERENCES pm_tasks(id) ON DELETE SET NULL,  -- linked remediation task

  -- Metadata
  discovered_by   text,                  -- member slug
  discovered_at   timestamptz DEFAULT now(),
  source          text,                  -- interview, observation, document-review, audit, other

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ─── pm_discovery_interviews ─────────────────────────────────────────
-- Structured interview/meeting records during discovery.
-- Links to client notes but adds discovery-specific fields.
CREATE TABLE IF NOT EXISTS pm_discovery_interviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES pm_projects(id) ON DELETE SET NULL,
  engagement_id   uuid REFERENCES pm_engagements(id) ON DELETE SET NULL,
  department_id   uuid REFERENCES pm_departments(id) ON DELETE SET NULL,
  note_id         uuid REFERENCES pm_client_notes(id) ON DELETE SET NULL,

  -- Interview details
  title           text NOT NULL,
  interviewee_name text,
  interviewee_role text,
  interview_date  date NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes int,

  -- Discovery sublayer focus
  focus_areas     text[] DEFAULT '{}',   -- which base terms this covers: vision, people, etc.

  -- Structured findings
  key_findings    jsonb DEFAULT '[]',    -- [{finding, category, severity}]
  action_items    jsonb DEFAULT '[]',    -- [{item, assigned_to, due_date}]
  follow_up_needed boolean DEFAULT false,

  -- Status
  status          text DEFAULT 'scheduled', -- scheduled, completed, cancelled, follow-up
  summary         text,                  -- AI-generated or manual summary

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ─── pm_onboarding_checklists ────────────────────────────────────────
-- Template-driven checklist for onboarding steps.
-- Populated when an onboarding project is created based on engagement type.
CREATE TABLE IF NOT EXISTS pm_onboarding_checklists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES pm_organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  engagement_id   uuid REFERENCES pm_engagements(id) ON DELETE SET NULL,

  -- Checklist item
  category        text NOT NULL,         -- discovery, setup, kickoff, documentation, handoff
  title           text NOT NULL,
  description     text,
  sort_order      int DEFAULT 0,
  is_required     boolean DEFAULT true,

  -- Completion
  status          text DEFAULT 'pending', -- pending, in-progress, complete, skipped
  completed_by    text,                  -- member slug
  completed_at    timestamptz,
  task_id         uuid REFERENCES pm_tasks(id) ON DELETE SET NULL,  -- auto-generated task link

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE pm_gap_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_discovery_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_onboarding_checklists ENABLE ROW LEVEL SECURITY;

-- Gap analysis
CREATE POLICY pm_gap_internal_read ON pm_gap_analysis FOR SELECT USING (pm_is_internal());
CREATE POLICY pm_gap_internal_write ON pm_gap_analysis FOR ALL USING (pm_is_internal_write());
CREATE POLICY pm_gap_external_read ON pm_gap_analysis FOR SELECT USING (pm_has_org_access(org_id));

-- Discovery interviews
CREATE POLICY pm_interviews_internal_read ON pm_discovery_interviews FOR SELECT USING (pm_is_internal());
CREATE POLICY pm_interviews_internal_write ON pm_discovery_interviews FOR ALL USING (pm_is_internal_write());
CREATE POLICY pm_interviews_external_read ON pm_discovery_interviews FOR SELECT USING (pm_has_org_access(org_id));

-- Onboarding checklists
CREATE POLICY pm_onboard_checklist_internal_read ON pm_onboarding_checklists FOR SELECT USING (pm_is_internal());
CREATE POLICY pm_onboard_checklist_internal_write ON pm_onboarding_checklists FOR ALL USING (pm_is_internal_write());
CREATE POLICY pm_onboard_checklist_external_read ON pm_onboarding_checklists FOR SELECT USING (pm_has_org_access(org_id));

-- ─── Indexes ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gap_analysis_org ON pm_gap_analysis(org_id);
CREATE INDEX IF NOT EXISTS idx_gap_analysis_project ON pm_gap_analysis(project_id);
CREATE INDEX IF NOT EXISTS idx_gap_analysis_dept ON pm_gap_analysis(department_id);
CREATE INDEX IF NOT EXISTS idx_gap_analysis_engagement ON pm_gap_analysis(engagement_id);
CREATE INDEX IF NOT EXISTS idx_gap_analysis_status ON pm_gap_analysis(status);

CREATE INDEX IF NOT EXISTS idx_discovery_interviews_org ON pm_discovery_interviews(org_id);
CREATE INDEX IF NOT EXISTS idx_discovery_interviews_project ON pm_discovery_interviews(project_id);
CREATE INDEX IF NOT EXISTS idx_discovery_interviews_dept ON pm_discovery_interviews(department_id);

CREATE INDEX IF NOT EXISTS idx_onboard_checklist_project ON pm_onboarding_checklists(project_id);
CREATE INDEX IF NOT EXISTS idx_onboard_checklist_engagement ON pm_onboarding_checklists(engagement_id);

CREATE INDEX IF NOT EXISTS idx_projects_type ON pm_projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_parent ON pm_projects(parent_project_id);
