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
  phase_order INT NOT NULL DEFAULT 0,
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

ALTER TABLE pm_project_templates ADD COLUMN IF NOT EXISTS phases JSONB NOT NULL DEFAULT '[]';
ALTER TABLE pm_project_templates ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS owner TEXT DEFAULT '';
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS template_slug TEXT;
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

ALTER TABLE pm_files ADD COLUMN IF NOT EXISTS file_type TEXT NOT NULL DEFAULT 'project';
ALTER TABLE pm_files ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE pm_files ADD COLUMN IF NOT EXISTS frontmatter JSONB DEFAULT '{}';
ALTER TABLE pm_files ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT now();
DO $$ BEGIN
  ALTER TABLE pm_files ADD CONSTRAINT pm_files_file_type_check
    CHECK (file_type IN ('project','phase','task','risk','decision','status','resource','report','daily'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
-- Drop any stale FK (may point to old "orgs" table) and recreate correctly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pm_projects_org_id_fkey'
      AND table_name = 'pm_projects'
  ) THEN
    ALTER TABLE pm_projects DROP CONSTRAINT pm_projects_org_id_fkey;
  END IF;

  ALTER TABLE pm_projects
    ADD CONSTRAINT pm_projects_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES pm_organizations(id);
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
    {"order":1,"slug":"idea-validation","name":"Idea Validation & Problem Definition","group":"BUILD","tasks":[{"slug":"define-problem-statement","name":"Define problem statement"},{"slug":"identify-target-audience","name":"Identify target audience"},{"slug":"conduct-user-interviews","name":"Conduct 5+ user interviews"},{"slug":"validate-pain-points","name":"Validate top pain points"}]},
    {"order":2,"slug":"market-research","name":"Market Research & Competitor Analysis","group":"BUILD","tasks":[{"slug":"identify-competitors","name":"Identify top 5 competitors"},{"slug":"analyze-competitor-features","name":"Analyze competitor features & pricing"},{"slug":"estimate-tam-sam-som","name":"Estimate TAM / SAM / SOM"},{"slug":"identify-market-gaps","name":"Identify market gaps & opportunities"}]},
    {"order":3,"slug":"business-model","name":"Business Model & Monetization","group":"BUILD","tasks":[{"slug":"define-pricing-tiers","name":"Define pricing tiers"},{"slug":"model-unit-economics","name":"Model unit economics (LTV, CAC)"},{"slug":"choose-billing-platform","name":"Choose billing platform"},{"slug":"draft-financial-projections","name":"Draft 12-month financial projections"}]},
    {"order":4,"slug":"product-design","name":"Product Design & UX","group":"BUILD","tasks":[{"slug":"create-user-personas","name":"Create user personas"},{"slug":"map-user-journeys","name":"Map core user journeys"},{"slug":"design-wireframes","name":"Design wireframes for key screens"},{"slug":"build-interactive-prototype","name":"Build interactive prototype"}]},
    {"order":5,"slug":"tech-architecture","name":"Technical Architecture & Stack","group":"BUILD","tasks":[{"slug":"choose-tech-stack","name":"Choose frontend & backend tech stack"},{"slug":"design-db-schema","name":"Design database schema"},{"slug":"plan-api-contracts","name":"Plan API contracts"},{"slug":"setup-ci-cd","name":"Set up CI/CD pipeline"}]},
    {"order":6,"slug":"mvp-development","name":"MVP Development","group":"BUILD","tasks":[{"slug":"implement-auth","name":"Implement authentication"},{"slug":"build-core-feature-1","name":"Build core feature #1"},{"slug":"build-core-feature-2","name":"Build core feature #2"},{"slug":"integrate-payments","name":"Integrate payment processing"}]},
    {"order":7,"slug":"testing-qa","name":"Testing & QA","group":"BUILD","tasks":[{"slug":"write-unit-tests","name":"Write unit tests for core logic"},{"slug":"run-e2e-tests","name":"Run end-to-end test suite"},{"slug":"perform-security-audit","name":"Perform security audit"},{"slug":"beta-user-testing","name":"Conduct beta user testing"}]},
    {"order":8,"slug":"launch-planning","name":"Launch Planning","group":"GO-TO-MARKET","tasks":[{"slug":"set-launch-date","name":"Set launch date & milestones"},{"slug":"prepare-launch-checklist","name":"Prepare launch checklist"},{"slug":"coordinate-launch-team","name":"Coordinate launch team roles"},{"slug":"plan-rollback-strategy","name":"Plan rollback strategy"}]},
    {"order":9,"slug":"marketing-content","name":"Marketing & Content Strategy","group":"GO-TO-MARKET","tasks":[{"slug":"write-landing-page-copy","name":"Write landing page copy"},{"slug":"create-demo-video","name":"Create product demo video"},{"slug":"draft-blog-launch-post","name":"Draft launch blog post"},{"slug":"setup-email-sequences","name":"Set up email drip sequences"}]},
    {"order":10,"slug":"sales-enablement","name":"Sales Enablement","group":"GO-TO-MARKET","tasks":[{"slug":"create-pitch-deck","name":"Create sales pitch deck"},{"slug":"build-demo-script","name":"Build demo script"},{"slug":"define-sales-process","name":"Define sales process & CRM setup"},{"slug":"prepare-objection-handling","name":"Prepare objection handling guide"}]},
    {"order":11,"slug":"conversion-optimization","name":"Conversion Optimization","group":"GO-TO-MARKET","tasks":[{"slug":"setup-analytics-tracking","name":"Set up analytics & conversion tracking"},{"slug":"design-onboarding-flow","name":"Design onboarding flow"},{"slug":"ab-test-pricing-page","name":"A/B test pricing page"},{"slug":"optimize-signup-funnel","name":"Optimize signup funnel"}]},
    {"order":12,"slug":"revenue-tracking","name":"Revenue & Metrics Tracking","group":"GROW","tasks":[{"slug":"setup-mrr-dashboard","name":"Set up MRR dashboard"},{"slug":"track-churn-metrics","name":"Track churn & retention metrics"},{"slug":"define-north-star-metric","name":"Define north star metric"}]},
    {"order":13,"slug":"customer-success","name":"Customer Success & Support","group":"GROW","tasks":[{"slug":"setup-help-desk","name":"Set up help desk / ticketing"},{"slug":"create-knowledge-base","name":"Create knowledge base"},{"slug":"define-sla-targets","name":"Define SLA response targets"}]},
    {"order":14,"slug":"product-iteration","name":"Product Iteration & Roadmap","group":"GROW","tasks":[{"slug":"collect-user-feedback","name":"Collect & prioritize user feedback"},{"slug":"plan-v2-features","name":"Plan v2 feature roadmap"},{"slug":"schedule-sprint-cadence","name":"Establish sprint cadence"}]},
    {"order":15,"slug":"partnerships","name":"Partnerships & Integrations","group":"GROW","tasks":[{"slug":"identify-integration-partners","name":"Identify integration partners"},{"slug":"build-api-docs","name":"Build public API documentation"},{"slug":"launch-partner-program","name":"Launch partner program"}]},
    {"order":16,"slug":"scaling","name":"Scaling Infrastructure & Team","group":"GROW","tasks":[{"slug":"load-test-infrastructure","name":"Load test infrastructure"},{"slug":"plan-horizontal-scaling","name":"Plan horizontal scaling strategy"},{"slug":"hire-key-roles","name":"Hire key engineering roles"}]},
    {"order":17,"slug":"legal-compliance","name":"Legal & Compliance","group":"FOUNDATION","tasks":[{"slug":"draft-tos-privacy","name":"Draft Terms of Service & Privacy Policy"},{"slug":"check-regulatory-compliance","name":"Check regulatory compliance (GDPR, SOC2)"}]},
    {"order":18,"slug":"finance-accounting","name":"Finance & Accounting","group":"FOUNDATION","tasks":[{"slug":"setup-accounting-system","name":"Set up accounting system"},{"slug":"configure-tax-reporting","name":"Configure tax & revenue reporting"}]},
    {"order":19,"slug":"hr-culture","name":"HR & Culture","group":"FOUNDATION","tasks":[{"slug":"define-company-values","name":"Define company values"},{"slug":"create-hiring-playbook","name":"Create hiring playbook"}]},
    {"order":20,"slug":"security-privacy","name":"Security & Privacy","group":"FOUNDATION","tasks":[{"slug":"implement-rbac","name":"Implement role-based access control"},{"slug":"setup-vulnerability-scanning","name":"Set up vulnerability scanning"},{"slug":"create-incident-response-plan","name":"Create incident response plan"}]},
    {"order":21,"slug":"devops-infra","name":"DevOps & Infrastructure","group":"FOUNDATION","tasks":[{"slug":"setup-monitoring-alerts","name":"Set up monitoring & alerting"},{"slug":"configure-auto-scaling","name":"Configure auto-scaling"},{"slug":"document-runbooks","name":"Document operational runbooks"}]},
    {"order":22,"slug":"analytics-bi","name":"Analytics & BI","group":"FOUNDATION","tasks":[{"slug":"setup-data-warehouse","name":"Set up data warehouse"},{"slug":"build-exec-dashboard","name":"Build executive dashboard"}]},
    {"order":23,"slug":"documentation","name":"Documentation & Knowledge Base","group":"FOUNDATION","tasks":[{"slug":"write-api-docs","name":"Write API documentation"},{"slug":"create-dev-onboarding-guide","name":"Create developer onboarding guide"}]},
    {"order":24,"slug":"community","name":"Community & Developer Relations","group":"FOUNDATION","tasks":[{"slug":"launch-community-forum","name":"Launch community forum or Discord"},{"slug":"plan-content-calendar","name":"Plan developer content calendar"}]},
    {"order":25,"slug":"vendor-management","name":"Vendor Management","group":"FOUNDATION","tasks":[{"slug":"audit-vendor-contracts","name":"Audit vendor contracts"},{"slug":"evaluate-vendor-alternatives","name":"Evaluate vendor alternatives"}]},
    {"order":26,"slug":"staffing","name":"Staffing & Contractors","group":"FOUNDATION","tasks":[{"slug":"plan-org-chart","name":"Plan org chart"},{"slug":"identify-contractor-needs","name":"Identify contractor needs"}]}
  ]'::jsonb
),
(
  'ministry-discovery',
  'Ministry / Org Discovery',
  '7-phase discovery process for ministry and organizational transformation.',
  '[
    {"order":0,"slug":"prayer-commitment","name":"Prayer & Commitment","tasks":[{"slug":"establish-prayer-team","name":"Establish prayer team"},{"slug":"set-prayer-schedule","name":"Set prayer schedule & rhythm"},{"slug":"define-spiritual-goals","name":"Define spiritual goals for the process"},{"slug":"commit-leadership-buy-in","name":"Secure leadership buy-in & commitment"}]},
    {"order":1,"slug":"vision-alignment","name":"Vision Alignment","tasks":[{"slug":"review-mission-statement","name":"Review current mission statement"},{"slug":"conduct-vision-workshop","name":"Conduct vision alignment workshop"},{"slug":"draft-vision-document","name":"Draft updated vision document"},{"slug":"communicate-vision-to-org","name":"Communicate vision to the organization"}]},
    {"order":2,"slug":"leadership-assessment","name":"Leadership Assessment","tasks":[{"slug":"inventory-current-leaders","name":"Inventory current leaders & roles"},{"slug":"assess-leadership-gifts","name":"Assess leadership gifts & strengths"},{"slug":"identify-leadership-gaps","name":"Identify leadership gaps"},{"slug":"create-leadership-dev-plan","name":"Create leadership development plan"}]},
    {"order":3,"slug":"department-discovery","name":"Department Discovery","sublayers":["prayer","vision","people","data","process","meetings","issues"],"tasks":[{"slug":"list-all-departments","name":"List all departments / ministries"},{"slug":"assign-dept-leads","name":"Assign department discovery leads"},{"slug":"run-dept-discovery-sessions","name":"Run discovery sessions per department"},{"slug":"document-dept-findings","name":"Document department findings"},{"slug":"identify-cross-dept-issues","name":"Identify cross-department issues"}]},
    {"order":4,"slug":"gap-analysis","name":"Gap Analysis & Prioritization","tasks":[{"slug":"compile-discovery-data","name":"Compile all discovery data"},{"slug":"identify-critical-gaps","name":"Identify critical gaps"},{"slug":"prioritize-by-impact","name":"Prioritize gaps by impact & urgency"},{"slug":"present-findings-to-leaders","name":"Present findings to leadership"}]},
    {"order":5,"slug":"roadmap-creation","name":"Roadmap Creation","tasks":[{"slug":"define-quick-wins","name":"Define quick wins (30-day actions)"},{"slug":"plan-medium-term-goals","name":"Plan medium-term goals (90 days)"},{"slug":"set-long-term-vision-milestones","name":"Set long-term vision milestones"},{"slug":"assign-roadmap-owners","name":"Assign owners for each roadmap item"}]},
    {"order":6,"slug":"equip-empower-release","name":"Equip, Empower, Release","tasks":[{"slug":"develop-training-materials","name":"Develop training materials"},{"slug":"conduct-equipping-sessions","name":"Conduct equipping sessions"},{"slug":"delegate-authority","name":"Delegate authority & decision rights"},{"slug":"schedule-followup-reviews","name":"Schedule follow-up reviews"}]}
  ]'::jsonb
),
(
  'tech-stack-modernization',
  'Tech Stack Modernization (PMBOK)',
  'PMBOK-aligned tech modernization with 12 management sections and parallel workstreams.',
  '[
    {"order":1,"slug":"integration-mgmt","name":"Integration Management","tasks":[{"slug":"develop-project-charter","name":"Develop project charter"},{"slug":"create-project-management-plan","name":"Create project management plan"},{"slug":"define-change-control-process","name":"Define change control process"}]},
    {"order":2,"slug":"scope-mgmt","name":"Scope Management","tasks":[{"slug":"collect-requirements","name":"Collect & document requirements"},{"slug":"define-scope-statement","name":"Define scope statement"},{"slug":"create-wbs","name":"Create work breakdown structure (WBS)"},{"slug":"validate-scope-with-stakeholders","name":"Validate scope with stakeholders"}]},
    {"order":3,"slug":"schedule-mgmt","name":"Schedule Management","tasks":[{"slug":"define-milestones","name":"Define milestones & deliverables"},{"slug":"estimate-activity-durations","name":"Estimate activity durations"},{"slug":"build-project-schedule","name":"Build project schedule"},{"slug":"identify-critical-path","name":"Identify critical path"}]},
    {"order":4,"slug":"cost-mgmt","name":"Cost Management","tasks":[{"slug":"estimate-costs","name":"Estimate costs for each work package"},{"slug":"set-budget-baseline","name":"Set budget baseline"},{"slug":"plan-cost-tracking","name":"Plan cost tracking & EVM"}]},
    {"order":5,"slug":"quality-mgmt","name":"Quality Management","tasks":[{"slug":"define-quality-standards","name":"Define quality standards & metrics"},{"slug":"plan-qa-activities","name":"Plan QA activities"},{"slug":"setup-testing-framework","name":"Set up testing framework"}]},
    {"order":6,"slug":"resource-mgmt","name":"Resource Management","tasks":[{"slug":"identify-team-needs","name":"Identify team resource needs"},{"slug":"assign-roles-responsibilities","name":"Assign roles & responsibilities (RACI)"},{"slug":"plan-training-needs","name":"Plan training & skill development"}]},
    {"order":7,"slug":"communications-mgmt","name":"Communications Management","tasks":[{"slug":"create-comms-plan","name":"Create communications plan"},{"slug":"setup-status-reporting","name":"Set up status reporting cadence"},{"slug":"define-escalation-paths","name":"Define escalation paths"}]},
    {"order":8,"slug":"risk-mgmt","name":"Risk Management","tasks":[{"slug":"identify-risks","name":"Identify project risks"},{"slug":"assess-risk-probability-impact","name":"Assess risk probability & impact"},{"slug":"plan-risk-responses","name":"Plan risk responses"},{"slug":"setup-risk-monitoring","name":"Set up risk monitoring"}]},
    {"order":9,"slug":"procurement-mgmt","name":"Procurement Management","tasks":[{"slug":"identify-vendor-needs","name":"Identify vendor / tool needs"},{"slug":"evaluate-vendor-options","name":"Evaluate vendor options"},{"slug":"negotiate-contracts","name":"Negotiate & finalize contracts"}]},
    {"order":10,"slug":"stakeholder-mgmt","name":"Stakeholder Management","tasks":[{"slug":"identify-stakeholders","name":"Identify all stakeholders"},{"slug":"assess-stakeholder-influence","name":"Assess stakeholder influence & interest"},{"slug":"plan-stakeholder-engagement","name":"Plan stakeholder engagement strategy"}]},
    {"order":11,"slug":"change-mgmt","name":"Change Management","tasks":[{"slug":"assess-change-readiness","name":"Assess organizational change readiness"},{"slug":"develop-change-strategy","name":"Develop change management strategy"},{"slug":"plan-training-rollout","name":"Plan training & rollout"},{"slug":"define-adoption-metrics","name":"Define adoption success metrics"}]},
    {"order":12,"slug":"governance","name":"Governance & Reporting","tasks":[{"slug":"setup-governance-structure","name":"Set up governance structure"},{"slug":"define-decision-authority","name":"Define decision-making authority"},{"slug":"schedule-steering-reviews","name":"Schedule steering committee reviews"}]}
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
