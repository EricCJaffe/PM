-- ============================================================================
-- Backfill: Reverb Church — MinistryOS Discovery & Transformation
-- Paste this entire script into the Supabase SQL Editor and click "Run"
-- ============================================================================

BEGIN;

-- 1. Upsert organization (client)
INSERT INTO pm_organizations (slug, name)
VALUES ('reverb-church', 'Reverb Church')
ON CONFLICT (slug) DO NOTHING;

-- 2. Upsert owner member
INSERT INTO pm_members (org_id, slug, display_name, email, role)
VALUES (
  (SELECT id FROM pm_organizations WHERE slug = 'reverb-church'),
  'eric-jaffe', 'Eric Jaffe', 'ejaffejax@gmail.com', 'owner'
)
ON CONFLICT (org_id, slug) DO NOTHING;

-- 3. Delete existing Reverb Church project if it exists (CASCADE removes phases/tasks)
DELETE FROM pm_projects
WHERE slug = 'reverb-church'
  AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church');

-- 4. Create the project
INSERT INTO pm_projects (org_id, slug, name, description, owner, template_slug, start_date, status)
VALUES (
  (SELECT id FROM pm_organizations WHERE slug = 'reverb-church'),
  'reverb-church',
  'Reverb Church',
  'MinistryOS Discovery & Transformation — 7-phase discovery and implementation framework for Reverb Church.',
  'eric-jaffe',
  CASE WHEN EXISTS (SELECT 1 FROM pm_project_templates WHERE slug = 'ministry-discovery')
       THEN 'ministry-discovery' ELSE NULL END,
  CURRENT_DATE,
  'active'
);

-- ============================================================================
-- 5. Insert all 11 phases
-- ============================================================================

-- Helper: grab project ID
DO $$
DECLARE
  v_project_id UUID;
  v_phase_id   UUID;
BEGIN
  SELECT id INTO v_project_id
  FROM pm_projects
  WHERE slug = 'reverb-church'
    AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church');

  -- ── DISCOVERY ─────────────────────────────────────────────────────────

  -- Phase 0: Prayer & Commitment
  INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
  VALUES (v_project_id, 'p0-prayer-commitment', 'Prayer & Commitment', 0, 'DISCOVERY', 'not-started', 0)
  RETURNING id INTO v_phase_id;

  INSERT INTO pm_tasks (project_id, phase_id, slug, name, status) VALUES
    (v_project_id, v_phase_id, 'leadership-prayer-guide', 'Leadership Prayer Guide', 'not-started'),
    (v_project_id, v_phase_id, 'spiritual-alignment', 'Spiritual Alignment', 'not-started'),
    (v_project_id, v_phase_id, 'commitment-letters', 'Commitment Letters', 'not-started'),
    (v_project_id, v_phase_id, 'stakeholder-buy-in', 'Stakeholder Buy-In', 'not-started');

  -- Phase 1: Organizational Understanding
  INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
  VALUES (v_project_id, 'p1-organizational-understanding', 'Organizational Understanding', 1, 'DISCOVERY', 'not-started', 0)
  RETURNING id INTO v_phase_id;

  INSERT INTO pm_tasks (project_id, phase_id, slug, name, status) VALUES
    (v_project_id, v_phase_id, 'org-chart-structure', 'Org Chart & Structure', 'not-started'),
    (v_project_id, v_phase_id, 'department-inventory', 'Department Inventory', 'not-started'),
    (v_project_id, v_phase_id, 'staff-volunteer-mapping', 'Staff & Volunteer Mapping', 'not-started'),
    (v_project_id, v_phase_id, 'decision-making-structures', 'Decision Making Structures', 'not-started'),
    (v_project_id, v_phase_id, 'communication-flows', 'Communication Flows', 'not-started'),
    (v_project_id, v_phase_id, 'culture-assessment', 'Culture Assessment', 'not-started');

  -- Phase 2: Current State Assessment
  INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
  VALUES (v_project_id, 'p2-current-state-assessment', 'Current State Assessment', 2, 'DISCOVERY', 'not-started', 0)
  RETURNING id INTO v_phase_id;

  INSERT INTO pm_tasks (project_id, phase_id, slug, name, status) VALUES
    (v_project_id, v_phase_id, 'process-maturity-scoring', 'Process Maturity Scoring', 'not-started'),
    (v_project_id, v_phase_id, 'tool-stack-audit', 'Tool Stack Audit', 'not-started'),
    (v_project_id, v_phase_id, 'existing-automations', 'Existing Automations', 'not-started'),
    (v_project_id, v_phase_id, 'pain-point-inventory', 'Pain Point Inventory', 'not-started'),
    (v_project_id, v_phase_id, 'data-flow-mapping', 'Data Flow Mapping', 'not-started'),
    (v_project_id, v_phase_id, 'gap-analysis', 'Gap Analysis', 'not-started');

  -- ── DEEP DIVE ─────────────────────────────────────────────────────────

  -- Phase 3: Department Discovery (7-Layer Analysis)
  -- Each department is a task with 7 discovery layers as subtasks
  INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
  VALUES (v_project_id, 'p3-department-discovery', 'Department Discovery (7-Layer Analysis)', 3, 'DEEP-DIVE', 'not-started', 0)
  RETURNING id INTO v_phase_id;

  INSERT INTO pm_tasks (project_id, phase_id, slug, name, description, status, subtasks) VALUES
    (v_project_id, v_phase_id, 'dept-operations', 'Operations',
     '7-layer discovery analysis for Operations. Layers: Mission Alignment, Success Metrics, People / Org, Communication, Processes, Pain Points, Automation Opportunities',
     'not-started',
     '[{"text":"Mission Alignment","done":false},{"text":"Success Metrics","done":false},{"text":"People / Org","done":false},{"text":"Communication","done":false},{"text":"Processes","done":false},{"text":"Pain Points","done":false},{"text":"Automation Opportunities","done":false}]'::jsonb),

    (v_project_id, v_phase_id, 'dept-communications-marketing', 'Communications & Marketing',
     '7-layer discovery analysis for Communications & Marketing. Layers: Mission Alignment, Success Metrics, People / Org, Communication, Processes, Pain Points, Automation Opportunities',
     'not-started',
     '[{"text":"Mission Alignment","done":false},{"text":"Success Metrics","done":false},{"text":"People / Org","done":false},{"text":"Communication","done":false},{"text":"Processes","done":false},{"text":"Pain Points","done":false},{"text":"Automation Opportunities","done":false}]'::jsonb),

    (v_project_id, v_phase_id, 'dept-finance-stewardship', 'Finance & Stewardship',
     '7-layer discovery analysis for Finance & Stewardship. Layers: Mission Alignment, Success Metrics, People / Org, Communication, Processes, Pain Points, Automation Opportunities',
     'not-started',
     '[{"text":"Mission Alignment","done":false},{"text":"Success Metrics","done":false},{"text":"People / Org","done":false},{"text":"Communication","done":false},{"text":"Processes","done":false},{"text":"Pain Points","done":false},{"text":"Automation Opportunities","done":false}]'::jsonb),

    (v_project_id, v_phase_id, 'dept-volunteer-management', 'Volunteer Management',
     '7-layer discovery analysis for Volunteer Management. Layers: Mission Alignment, Success Metrics, People / Org, Communication, Processes, Pain Points, Automation Opportunities',
     'not-started',
     '[{"text":"Mission Alignment","done":false},{"text":"Success Metrics","done":false},{"text":"People / Org","done":false},{"text":"Communication","done":false},{"text":"Processes","done":false},{"text":"Pain Points","done":false},{"text":"Automation Opportunities","done":false}]'::jsonb),

    (v_project_id, v_phase_id, 'dept-donor-relations', 'Donor Relations',
     '7-layer discovery analysis for Donor Relations. Layers: Mission Alignment, Success Metrics, People / Org, Communication, Processes, Pain Points, Automation Opportunities',
     'not-started',
     '[{"text":"Mission Alignment","done":false},{"text":"Success Metrics","done":false},{"text":"People / Org","done":false},{"text":"Communication","done":false},{"text":"Processes","done":false},{"text":"Pain Points","done":false},{"text":"Automation Opportunities","done":false}]'::jsonb),

    (v_project_id, v_phase_id, 'dept-programs-ministry', 'Programs & Ministry',
     '7-layer discovery analysis for Programs & Ministry. Layers: Mission Alignment, Success Metrics, People / Org, Communication, Processes, Pain Points, Automation Opportunities',
     'not-started',
     '[{"text":"Mission Alignment","done":false},{"text":"Success Metrics","done":false},{"text":"People / Org","done":false},{"text":"Communication","done":false},{"text":"Processes","done":false},{"text":"Pain Points","done":false},{"text":"Automation Opportunities","done":false}]'::jsonb);

  -- ── IMPLEMENTATION ────────────────────────────────────────────────────

  -- Phase 4: Quick Wins & Prioritization
  INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
  VALUES (v_project_id, 'p4-quick-wins-prioritization', 'Quick Wins & Prioritization', 4, 'IMPLEMENTATION', 'not-started', 0)
  RETURNING id INTO v_phase_id;

  INSERT INTO pm_tasks (project_id, phase_id, slug, name, status) VALUES
    (v_project_id, v_phase_id, 'quick-win-identification', 'Quick Win Identification', 'not-started'),
    (v_project_id, v_phase_id, 'impact-vs-effort-scoring', 'Impact vs. Effort Scoring', 'not-started'),
    (v_project_id, v_phase_id, 'sample-project-1', 'Sample Project 1', 'not-started'),
    (v_project_id, v_phase_id, 'sample-project-2', 'Sample Project 2', 'not-started'),
    (v_project_id, v_phase_id, 'sample-project-3', 'Sample Project 3', 'not-started'),
    (v_project_id, v_phase_id, 'mission-alignment-check', 'Mission Alignment Check', 'not-started');

  -- Phase 5: Roadmap & Implementation
  INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
  VALUES (v_project_id, 'p5-roadmap-implementation', 'Roadmap & Implementation', 5, 'IMPLEMENTATION', 'not-started', 0)
  RETURNING id INTO v_phase_id;

  INSERT INTO pm_tasks (project_id, phase_id, slug, name, status) VALUES
    (v_project_id, v_phase_id, 'q1-foundation-quick-wins', 'Q1: Foundation & Quick Wins', 'not-started'),
    (v_project_id, v_phase_id, 'q2-core-systems', 'Q2: Core Systems', 'not-started'),
    (v_project_id, v_phase_id, 'q3-expansion', 'Q3: Expansion', 'not-started'),
    (v_project_id, v_phase_id, 'q4-maturity-handoff', 'Q4: Maturity & Handoff', 'not-started'),
    (v_project_id, v_phase_id, 'timeline-milestones', 'Timeline & Milestones', 'not-started'),
    (v_project_id, v_phase_id, 'budget-resources', 'Budget & Resources', 'not-started');

  -- Phase 6: Equip, Empower, Release
  INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
  VALUES (v_project_id, 'p6-equip-empower-release', 'Equip, Empower, Release', 6, 'IMPLEMENTATION', 'not-started', 0)
  RETURNING id INTO v_phase_id;

  INSERT INTO pm_tasks (project_id, phase_id, slug, name, status) VALUES
    (v_project_id, v_phase_id, 'champion-identification', 'Champion Identification', 'not-started'),
    (v_project_id, v_phase_id, 'training-plans', 'Training Plans', 'not-started'),
    (v_project_id, v_phase_id, 'knowledge-transfer', 'Knowledge Transfer', 'not-started'),
    (v_project_id, v_phase_id, 'sustainability-playbook', 'Sustainability Playbook', 'not-started'),
    (v_project_id, v_phase_id, 'ongoing-review-cadence', 'Ongoing Review Cadence', 'not-started'),
    (v_project_id, v_phase_id, 'independence-readiness', 'Independence Readiness', 'not-started');

  -- ── CROSS-CUTTING SUPPORT SECTIONS ────────────────────────────────────

  -- Support 1: MinistryOS Components
  INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
  VALUES (v_project_id, 's1-ministryos-components', 'MinistryOS Components', 7, 'SUPPORT', 'not-started', 0)
  RETURNING id INTO v_phase_id;

  INSERT INTO pm_tasks (project_id, phase_id, slug, name, status) VALUES
    (v_project_id, v_phase_id, 'mos-vision', 'Vision (Mission, Values, Goals)', 'not-started'),
    (v_project_id, v_phase_id, 'mos-people', 'People (Org, Job Descriptions)', 'not-started'),
    (v_project_id, v_phase_id, 'mos-data', 'Data (KPIs, Scorecard)', 'not-started'),
    (v_project_id, v_phase_id, 'mos-process', 'Process (Playbooks, Triggers)', 'not-started'),
    (v_project_id, v_phase_id, 'mos-meetings', 'Meetings (Rhythms, Channels)', 'not-started'),
    (v_project_id, v_phase_id, 'mos-issues', 'Issues (Tracking, Root Cause)', 'not-started');

  -- Support 2: Tool Stack Audit
  INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
  VALUES (v_project_id, 's2-tool-stack-audit', 'Tool Stack Audit', 8, 'SUPPORT', 'not-started', 0)
  RETURNING id INTO v_phase_id;

  INSERT INTO pm_tasks (project_id, phase_id, slug, name, status) VALUES
    (v_project_id, v_phase_id, 'tsa-current-tools-inventory', 'Current Tools Inventory', 'not-started'),
    (v_project_id, v_phase_id, 'tsa-integration-map', 'Integration Map', 'not-started'),
    (v_project_id, v_phase_id, 'tsa-redundancy-analysis', 'Redundancy Analysis', 'not-started'),
    (v_project_id, v_phase_id, 'tsa-recommended-stack', 'Recommended Stack', 'not-started'),
    (v_project_id, v_phase_id, 'tsa-migration-plans', 'Migration Plans', 'not-started'),
    (v_project_id, v_phase_id, 'tsa-vendor-evaluation', 'Vendor Evaluation', 'not-started');

  -- Support 3: Change Management
  INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
  VALUES (v_project_id, 's3-change-management', 'Change Management', 9, 'SUPPORT', 'not-started', 0)
  RETURNING id INTO v_phase_id;

  INSERT INTO pm_tasks (project_id, phase_id, slug, name, status) VALUES
    (v_project_id, v_phase_id, 'cm-communication-plan', 'Communication Plan', 'not-started'),
    (v_project_id, v_phase_id, 'cm-resistance-mapping', 'Resistance Mapping', 'not-started'),
    (v_project_id, v_phase_id, 'cm-transition-support', 'Transition Support', 'not-started'),
    (v_project_id, v_phase_id, 'cm-staff-training-schedule', 'Staff Training Schedule', 'not-started'),
    (v_project_id, v_phase_id, 'cm-celebration-milestones', 'Celebration Milestones', 'not-started');

  -- Support 4: ROI & Impact Tracking
  INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
  VALUES (v_project_id, 's4-roi-impact-tracking', 'ROI & Impact Tracking', 10, 'SUPPORT', 'not-started', 0)
  RETURNING id INTO v_phase_id;

  INSERT INTO pm_tasks (project_id, phase_id, slug, name, status) VALUES
    (v_project_id, v_phase_id, 'roi-hours-saved', 'Hours Saved Tracking', 'not-started'),
    (v_project_id, v_phase_id, 'roi-cost-reduction', 'Cost Reduction Analysis', 'not-started'),
    (v_project_id, v_phase_id, 'roi-mission-impact', 'Mission Impact Metrics', 'not-started'),
    (v_project_id, v_phase_id, 'roi-board-reporting', 'Board Reporting', 'not-started'),
    (v_project_id, v_phase_id, 'roi-before-after', 'Before & After Comparisons', 'not-started');

END $$;

COMMIT;

-- ============================================================================
-- Verify: count what was created
-- ============================================================================
SELECT 'Phases' AS entity, count(*) AS total
FROM pm_phases WHERE project_id = (
  SELECT id FROM pm_projects WHERE slug = 'reverb-church'
    AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')
)
UNION ALL
SELECT 'Tasks', count(*)
FROM pm_tasks WHERE project_id = (
  SELECT id FROM pm_projects WHERE slug = 'reverb-church'
    AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')
);
