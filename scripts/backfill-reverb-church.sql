-- ============================================================================
-- Backfill: Reverb Church — MinistryOS Discovery & Transformation
-- Paste this entire script into the Supabase SQL Editor and click "Run"
-- No DO $$ blocks — plain SQL only for maximum compatibility
-- ============================================================================

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
-- 5. Insert phases one at a time, then their tasks
-- Using subqueries to look up IDs instead of PL/pgSQL variables
-- ============================================================================

-- Helper: shorthand subqueries used throughout
-- org:     (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')
-- project: (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church'))
-- phase:   (SELECT id FROM pm_phases WHERE slug = '<phase-slug>' AND project_id = (...))

-- ── PHASE 0: Prayer & Commitment ────────────────────────────────────────
INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
VALUES (
  (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
  'p0-prayer-commitment', 'Prayer & Commitment', 0, 'DISCOVERY', 'not-started', 0
);

INSERT INTO pm_tasks (project_id, org_id, phase_id, slug, name, status) VALUES
  ((SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
   (SELECT id FROM pm_organizations WHERE slug = 'reverb-church'),
   (SELECT id FROM pm_phases WHERE slug = 'p0-prayer-commitment' AND project_id = (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church'))),
   'leadership-prayer-guide', 'Leadership Prayer Guide', 'not-started'),
  ((SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
   (SELECT id FROM pm_organizations WHERE slug = 'reverb-church'),
   (SELECT id FROM pm_phases WHERE slug = 'p0-prayer-commitment' AND project_id = (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church'))),
   'spiritual-alignment', 'Spiritual Alignment', 'not-started'),
  ((SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
   (SELECT id FROM pm_organizations WHERE slug = 'reverb-church'),
   (SELECT id FROM pm_phases WHERE slug = 'p0-prayer-commitment' AND project_id = (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church'))),
   'commitment-letters', 'Commitment Letters', 'not-started'),
  ((SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
   (SELECT id FROM pm_organizations WHERE slug = 'reverb-church'),
   (SELECT id FROM pm_phases WHERE slug = 'p0-prayer-commitment' AND project_id = (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church'))),
   'stakeholder-buy-in', 'Stakeholder Buy-In', 'not-started');

-- ── PHASE 1: Organizational Understanding ───────────────────────────────
INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
VALUES (
  (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
  'p1-organizational-understanding', 'Organizational Understanding', 1, 'DISCOVERY', 'not-started', 0
);

INSERT INTO pm_tasks (project_id, org_id, phase_id, slug, name, status)
SELECT p.id, p.org_id, ph.id, t.slug, t.name, 'not-started'
FROM pm_projects p
JOIN pm_phases ph ON ph.project_id = p.id AND ph.slug = 'p1-organizational-understanding'
CROSS JOIN (VALUES
  ('org-chart-structure', 'Org Chart & Structure'),
  ('department-inventory', 'Department Inventory'),
  ('staff-volunteer-mapping', 'Staff & Volunteer Mapping'),
  ('decision-making-structures', 'Decision Making Structures'),
  ('communication-flows', 'Communication Flows'),
  ('culture-assessment', 'Culture Assessment')
) AS t(slug, name)
WHERE p.slug = 'reverb-church' AND p.org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church');

-- ── PHASE 2: Current State Assessment ───────────────────────────────────
INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
VALUES (
  (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
  'p2-current-state-assessment', 'Current State Assessment', 2, 'DISCOVERY', 'not-started', 0
);

INSERT INTO pm_tasks (project_id, org_id, phase_id, slug, name, status)
SELECT p.id, p.org_id, ph.id, t.slug, t.name, 'not-started'
FROM pm_projects p
JOIN pm_phases ph ON ph.project_id = p.id AND ph.slug = 'p2-current-state-assessment'
CROSS JOIN (VALUES
  ('process-maturity-scoring', 'Process Maturity Scoring'),
  ('tool-stack-audit', 'Tool Stack Audit'),
  ('existing-automations', 'Existing Automations'),
  ('pain-point-inventory', 'Pain Point Inventory'),
  ('data-flow-mapping', 'Data Flow Mapping'),
  ('gap-analysis', 'Gap Analysis')
) AS t(slug, name)
WHERE p.slug = 'reverb-church' AND p.org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church');

-- ── PHASE 3: Department Discovery (7-Layer Analysis) ────────────────────
INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
VALUES (
  (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
  'p3-department-discovery', 'Department Discovery (7-Layer Analysis)', 3, 'DEEP-DIVE', 'not-started', 0
);

INSERT INTO pm_tasks (project_id, org_id, phase_id, slug, name, description, status, subtasks)
SELECT p.id, p.org_id, ph.id, t.slug, t.name, t.description, 'not-started',
  '[{"text":"Mission Alignment","done":false},{"text":"Success Metrics","done":false},{"text":"People / Org","done":false},{"text":"Communication","done":false},{"text":"Processes","done":false},{"text":"Pain Points","done":false},{"text":"Automation Opportunities","done":false}]'::jsonb
FROM pm_projects p
JOIN pm_phases ph ON ph.project_id = p.id AND ph.slug = 'p3-department-discovery'
CROSS JOIN (VALUES
  ('dept-operations', 'Operations', '7-layer discovery analysis for Operations'),
  ('dept-communications-marketing', 'Communications & Marketing', '7-layer discovery analysis for Communications & Marketing'),
  ('dept-finance-stewardship', 'Finance & Stewardship', '7-layer discovery analysis for Finance & Stewardship'),
  ('dept-volunteer-management', 'Volunteer Management', '7-layer discovery analysis for Volunteer Management'),
  ('dept-donor-relations', 'Donor Relations', '7-layer discovery analysis for Donor Relations'),
  ('dept-programs-ministry', 'Programs & Ministry', '7-layer discovery analysis for Programs & Ministry')
) AS t(slug, name, description)
WHERE p.slug = 'reverb-church' AND p.org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church');

-- ── PHASE 4: Quick Wins & Prioritization ────────────────────────────────
INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
VALUES (
  (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
  'p4-quick-wins-prioritization', 'Quick Wins & Prioritization', 4, 'IMPLEMENTATION', 'not-started', 0
);

INSERT INTO pm_tasks (project_id, org_id, phase_id, slug, name, status)
SELECT p.id, p.org_id, ph.id, t.slug, t.name, 'not-started'
FROM pm_projects p
JOIN pm_phases ph ON ph.project_id = p.id AND ph.slug = 'p4-quick-wins-prioritization'
CROSS JOIN (VALUES
  ('quick-win-identification', 'Quick Win Identification'),
  ('impact-vs-effort-scoring', 'Impact vs. Effort Scoring'),
  ('sample-project-1', 'Sample Project 1'),
  ('sample-project-2', 'Sample Project 2'),
  ('sample-project-3', 'Sample Project 3'),
  ('mission-alignment-check', 'Mission Alignment Check')
) AS t(slug, name)
WHERE p.slug = 'reverb-church' AND p.org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church');

-- ── PHASE 5: Roadmap & Implementation ───────────────────────────────────
INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
VALUES (
  (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
  'p5-roadmap-implementation', 'Roadmap & Implementation', 5, 'IMPLEMENTATION', 'not-started', 0
);

INSERT INTO pm_tasks (project_id, org_id, phase_id, slug, name, status)
SELECT p.id, p.org_id, ph.id, t.slug, t.name, 'not-started'
FROM pm_projects p
JOIN pm_phases ph ON ph.project_id = p.id AND ph.slug = 'p5-roadmap-implementation'
CROSS JOIN (VALUES
  ('q1-foundation-quick-wins', 'Q1: Foundation & Quick Wins'),
  ('q2-core-systems', 'Q2: Core Systems'),
  ('q3-expansion', 'Q3: Expansion'),
  ('q4-maturity-handoff', 'Q4: Maturity & Handoff'),
  ('timeline-milestones', 'Timeline & Milestones'),
  ('budget-resources', 'Budget & Resources')
) AS t(slug, name)
WHERE p.slug = 'reverb-church' AND p.org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church');

-- ── PHASE 6: Equip, Empower, Release ────────────────────────────────────
INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
VALUES (
  (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
  'p6-equip-empower-release', 'Equip, Empower, Release', 6, 'IMPLEMENTATION', 'not-started', 0
);

INSERT INTO pm_tasks (project_id, org_id, phase_id, slug, name, status)
SELECT p.id, p.org_id, ph.id, t.slug, t.name, 'not-started'
FROM pm_projects p
JOIN pm_phases ph ON ph.project_id = p.id AND ph.slug = 'p6-equip-empower-release'
CROSS JOIN (VALUES
  ('champion-identification', 'Champion Identification'),
  ('training-plans', 'Training Plans'),
  ('knowledge-transfer', 'Knowledge Transfer'),
  ('sustainability-playbook', 'Sustainability Playbook'),
  ('ongoing-review-cadence', 'Ongoing Review Cadence'),
  ('independence-readiness', 'Independence Readiness')
) AS t(slug, name)
WHERE p.slug = 'reverb-church' AND p.org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church');

-- ── SUPPORT 1: MinistryOS Components ────────────────────────────────────
INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
VALUES (
  (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
  's1-ministryos-components', 'MinistryOS Components', 7, 'SUPPORT', 'not-started', 0
);

INSERT INTO pm_tasks (project_id, org_id, phase_id, slug, name, status)
SELECT p.id, p.org_id, ph.id, t.slug, t.name, 'not-started'
FROM pm_projects p
JOIN pm_phases ph ON ph.project_id = p.id AND ph.slug = 's1-ministryos-components'
CROSS JOIN (VALUES
  ('mos-vision', 'Vision (Mission, Values, Goals)'),
  ('mos-people', 'People (Org, Job Descriptions)'),
  ('mos-data', 'Data (KPIs, Scorecard)'),
  ('mos-process', 'Process (Playbooks, Triggers)'),
  ('mos-meetings', 'Meetings (Rhythms, Channels)'),
  ('mos-issues', 'Issues (Tracking, Root Cause)')
) AS t(slug, name)
WHERE p.slug = 'reverb-church' AND p.org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church');

-- ── SUPPORT 2: Tool Stack Audit ─────────────────────────────────────────
INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
VALUES (
  (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
  's2-tool-stack-audit', 'Tool Stack Audit', 8, 'SUPPORT', 'not-started', 0
);

INSERT INTO pm_tasks (project_id, org_id, phase_id, slug, name, status)
SELECT p.id, p.org_id, ph.id, t.slug, t.name, 'not-started'
FROM pm_projects p
JOIN pm_phases ph ON ph.project_id = p.id AND ph.slug = 's2-tool-stack-audit'
CROSS JOIN (VALUES
  ('tsa-current-tools-inventory', 'Current Tools Inventory'),
  ('tsa-integration-map', 'Integration Map'),
  ('tsa-redundancy-analysis', 'Redundancy Analysis'),
  ('tsa-recommended-stack', 'Recommended Stack'),
  ('tsa-migration-plans', 'Migration Plans'),
  ('tsa-vendor-evaluation', 'Vendor Evaluation')
) AS t(slug, name)
WHERE p.slug = 'reverb-church' AND p.org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church');

-- ── SUPPORT 3: Change Management ────────────────────────────────────────
INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
VALUES (
  (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
  's3-change-management', 'Change Management', 9, 'SUPPORT', 'not-started', 0
);

INSERT INTO pm_tasks (project_id, org_id, phase_id, slug, name, status)
SELECT p.id, p.org_id, ph.id, t.slug, t.name, 'not-started'
FROM pm_projects p
JOIN pm_phases ph ON ph.project_id = p.id AND ph.slug = 's3-change-management'
CROSS JOIN (VALUES
  ('cm-communication-plan', 'Communication Plan'),
  ('cm-resistance-mapping', 'Resistance Mapping'),
  ('cm-transition-support', 'Transition Support'),
  ('cm-staff-training-schedule', 'Staff Training Schedule'),
  ('cm-celebration-milestones', 'Celebration Milestones')
) AS t(slug, name)
WHERE p.slug = 'reverb-church' AND p.org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church');

-- ── SUPPORT 4: ROI & Impact Tracking ────────────────────────────────────
INSERT INTO pm_phases (project_id, slug, name, phase_order, "group", status, progress)
VALUES (
  (SELECT id FROM pm_projects WHERE slug = 'reverb-church' AND org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church')),
  's4-roi-impact-tracking', 'ROI & Impact Tracking', 10, 'SUPPORT', 'not-started', 0
);

INSERT INTO pm_tasks (project_id, org_id, phase_id, slug, name, status)
SELECT p.id, p.org_id, ph.id, t.slug, t.name, 'not-started'
FROM pm_projects p
JOIN pm_phases ph ON ph.project_id = p.id AND ph.slug = 's4-roi-impact-tracking'
CROSS JOIN (VALUES
  ('roi-hours-saved', 'Hours Saved Tracking'),
  ('roi-cost-reduction', 'Cost Reduction Analysis'),
  ('roi-mission-impact', 'Mission Impact Metrics'),
  ('roi-board-reporting', 'Board Reporting'),
  ('roi-before-after', 'Before & After Comparisons')
) AS t(slug, name)
WHERE p.slug = 'reverb-church' AND p.org_id = (SELECT id FROM pm_organizations WHERE slug = 'reverb-church');

-- ============================================================================
-- Verify
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
