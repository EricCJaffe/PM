-- Seed: BusinessOS Discovery template
-- Safe to run multiple times (upsert on slug).

INSERT INTO pm_project_templates (slug, name, description, phases)
VALUES (
  'business-os',
  'BusinessOS Discovery',
  '11-phase business discovery and transformation process. Covers leadership alignment, department discovery, quote-to-cash mapping, gap analysis, and enablement.',
  '[
    {
      "order": 0,
      "slug": "bos-executive-commitment",
      "name": "Executive Commitment & Alignment",
      "tasks": [
        {"slug": "bos-identify-executive-sponsor", "name": "Identify executive sponsor"},
        {"slug": "bos-define-engagement-objectives", "name": "Define objectives for the discovery process"},
        {"slug": "bos-align-leadership-expectations", "name": "Align leadership team on goals and expectations"},
        {"slug": "bos-secure-stakeholder-commitment", "name": "Secure commitment from key stakeholders"}
      ]
    },
    {
      "order": 1,
      "slug": "bos-vision-alignment",
      "name": "Vision Alignment",
      "tasks": [
        {"slug": "bos-review-mission-vision", "name": "Review current mission & vision statements"},
        {"slug": "bos-conduct-vision-workshop", "name": "Conduct vision alignment workshop"},
        {"slug": "bos-draft-vision-document", "name": "Draft updated vision document"},
        {"slug": "bos-communicate-vision", "name": "Communicate vision to the organization"}
      ]
    },
    {
      "order": 2,
      "slug": "bos-leadership-assessment",
      "name": "Leadership Assessment",
      "tasks": [
        {"slug": "bos-inventory-leaders-roles", "name": "Inventory current leaders & roles"},
        {"slug": "bos-assess-leadership-strengths", "name": "Assess leadership strengths & competencies"},
        {"slug": "bos-identify-leadership-gaps", "name": "Identify leadership gaps"},
        {"slug": "bos-create-leadership-dev-plan", "name": "Create leadership development plan"}
      ]
    },
    {
      "order": 3,
      "slug": "bos-department-discovery",
      "name": "Department Discovery",
      "sublayers": ["strategy", "vision", "people", "data", "process", "meetings", "issues"],
      "tasks": [
        {"slug": "bos-list-all-departments", "name": "List all departments"},
        {"slug": "bos-assign-dept-leads", "name": "Assign department discovery leads"},
        {"slug": "bos-run-dept-discovery-sessions", "name": "Run discovery sessions per department"},
        {"slug": "bos-document-dept-findings", "name": "Document department findings"},
        {"slug": "bos-identify-cross-dept-issues", "name": "Identify cross-department issues"}
      ]
    },
    {
      "order": 4,
      "slug": "bos-sales-dept",
      "name": "Dept: Sales",
      "tasks": [
        {"slug": "bos-sales-review-pipeline", "name": "Review sales pipeline & CRM usage"},
        {"slug": "bos-sales-assess-team", "name": "Assess sales team structure & capacity"},
        {"slug": "bos-sales-document-process", "name": "Document current sales process"},
        {"slug": "bos-sales-identify-gaps", "name": "Identify gaps and improvement areas"}
      ]
    },
    {
      "order": 5,
      "slug": "bos-ops-dept",
      "name": "Dept: Operations",
      "tasks": [
        {"slug": "bos-ops-map-workflows", "name": "Map core operational workflows"},
        {"slug": "bos-ops-assess-tools", "name": "Assess tools & systems in use"},
        {"slug": "bos-ops-identify-bottlenecks", "name": "Identify operational bottlenecks"},
        {"slug": "bos-ops-document-findings", "name": "Document findings & recommendations"}
      ]
    },
    {
      "order": 6,
      "slug": "bos-support-depts",
      "name": "Dept: Finance, People, Customer Service & Other",
      "tasks": [
        {"slug": "bos-finance-review-processes", "name": "Finance: review AP, AR, budgeting & reporting"},
        {"slug": "bos-people-assess-hr", "name": "People/HR: assess hiring, onboarding, retention"},
        {"slug": "bos-cs-review-support", "name": "Customer Service: review support workflows & SLAs"},
        {"slug": "bos-procurement-assess", "name": "Procurement: assess vendor management & sourcing"},
        {"slug": "bos-other-depts-document", "name": "Document findings for remaining departments (IT, Marketing, Legal, Manufacturing)"}
      ]
    },
    {
      "order": 7,
      "slug": "bos-quote-to-cash",
      "name": "Quote-to-Cash Process Discovery",
      "tasks": [
        {"slug": "bos-map-lead-generation", "name": "Map lead generation process & channels"},
        {"slug": "bos-document-lead-qualification", "name": "Document lead qualification process (BANT, scoring)"},
        {"slug": "bos-review-proposal-quoting", "name": "Review proposal & quoting workflow"},
        {"slug": "bos-assess-negotiation-close", "name": "Assess negotiation, contract, and close process"},
        {"slug": "bos-map-order-fulfillment", "name": "Map order fulfillment & service delivery workflow"},
        {"slug": "bos-review-invoicing", "name": "Review invoicing process & billing accuracy"},
        {"slug": "bos-assess-collections-ar", "name": "Assess collections and accounts receivable"},
        {"slug": "bos-identify-revenue-cycle-gaps", "name": "Identify gaps and bottlenecks in the revenue cycle"}
      ]
    },
    {
      "order": 8,
      "slug": "bos-gap-analysis",
      "name": "Gap Analysis & Prioritization",
      "tasks": [
        {"slug": "bos-compile-discovery-data", "name": "Compile all discovery data"},
        {"slug": "bos-identify-critical-gaps", "name": "Identify critical gaps"},
        {"slug": "bos-prioritize-by-impact", "name": "Prioritize gaps by impact & urgency"},
        {"slug": "bos-present-findings", "name": "Present findings to leadership"}
      ]
    },
    {
      "order": 9,
      "slug": "bos-roadmap-creation",
      "name": "Roadmap Creation",
      "tasks": [
        {"slug": "bos-define-quick-wins", "name": "Define quick wins (30-day actions)"},
        {"slug": "bos-plan-medium-term-goals", "name": "Plan medium-term goals (90 days)"},
        {"slug": "bos-set-long-term-milestones", "name": "Set long-term vision milestones"},
        {"slug": "bos-assign-roadmap-owners", "name": "Assign owners for each roadmap item"}
      ]
    },
    {
      "order": 10,
      "slug": "bos-enable-empower-launch",
      "name": "Enable, Empower, Launch",
      "tasks": [
        {"slug": "bos-develop-training-materials", "name": "Develop training materials"},
        {"slug": "bos-conduct-enablement-sessions", "name": "Conduct enablement sessions"},
        {"slug": "bos-delegate-authority", "name": "Delegate authority & decision rights"},
        {"slug": "bos-schedule-followup-reviews", "name": "Schedule follow-up reviews"}
      ]
    }
  ]'::jsonb
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    phases = EXCLUDED.phases;
