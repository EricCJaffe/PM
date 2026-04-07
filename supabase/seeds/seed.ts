/**
 * Seed script for PM module.
 * Run: npm run seed (requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars)
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Template Definitions ────────────────────────────────────────────

const templates = [
  {
    slug: "saas-rollout",
    name: "SaaS App Rollout",
    description: "26-phase rollout for SaaS products, grouped into Build, Go-to-Market, Grow, and Foundation stages.",
    phases: [
      // BUILD
      { order: 1, slug: "idea-validation", name: "Idea Validation & Problem Definition", group: "BUILD", tasks: [
        { slug: "define-problem-statement", name: "Define problem statement" },
        { slug: "identify-target-audience", name: "Identify target audience" },
        { slug: "conduct-user-interviews", name: "Conduct 5+ user interviews" },
        { slug: "validate-pain-points", name: "Validate top pain points" },
      ]},
      { order: 2, slug: "market-research", name: "Market Research & Competitor Analysis", group: "BUILD", tasks: [
        { slug: "identify-competitors", name: "Identify top 5 competitors" },
        { slug: "analyze-competitor-features", name: "Analyze competitor features & pricing" },
        { slug: "estimate-tam-sam-som", name: "Estimate TAM / SAM / SOM" },
        { slug: "identify-market-gaps", name: "Identify market gaps & opportunities" },
      ]},
      { order: 3, slug: "business-model", name: "Business Model & Monetization", group: "BUILD", tasks: [
        { slug: "define-pricing-tiers", name: "Define pricing tiers" },
        { slug: "model-unit-economics", name: "Model unit economics (LTV, CAC)" },
        { slug: "choose-billing-platform", name: "Choose billing platform" },
        { slug: "draft-financial-projections", name: "Draft 12-month financial projections" },
      ]},
      { order: 4, slug: "product-design", name: "Product Design & UX", group: "BUILD", tasks: [
        { slug: "create-user-personas", name: "Create user personas" },
        { slug: "map-user-journeys", name: "Map core user journeys" },
        { slug: "design-wireframes", name: "Design wireframes for key screens" },
        { slug: "build-interactive-prototype", name: "Build interactive prototype" },
      ]},
      { order: 5, slug: "tech-architecture", name: "Technical Architecture & Stack", group: "BUILD", tasks: [
        { slug: "choose-tech-stack", name: "Choose frontend & backend tech stack" },
        { slug: "design-db-schema", name: "Design database schema" },
        { slug: "plan-api-contracts", name: "Plan API contracts" },
        { slug: "setup-ci-cd", name: "Set up CI/CD pipeline" },
      ]},
      { order: 6, slug: "mvp-development", name: "MVP Development", group: "BUILD", tasks: [
        { slug: "implement-auth", name: "Implement authentication" },
        { slug: "build-core-feature-1", name: "Build core feature #1" },
        { slug: "build-core-feature-2", name: "Build core feature #2" },
        { slug: "integrate-payments", name: "Integrate payment processing" },
      ]},
      { order: 7, slug: "testing-qa", name: "Testing & QA", group: "BUILD", tasks: [
        { slug: "write-unit-tests", name: "Write unit tests for core logic" },
        { slug: "run-e2e-tests", name: "Run end-to-end test suite" },
        { slug: "perform-security-audit", name: "Perform security audit" },
        { slug: "beta-user-testing", name: "Conduct beta user testing" },
      ]},
      // GO-TO-MARKET
      { order: 8, slug: "launch-planning", name: "Launch Planning", group: "GO-TO-MARKET", tasks: [
        { slug: "set-launch-date", name: "Set launch date & milestones" },
        { slug: "prepare-launch-checklist", name: "Prepare launch checklist" },
        { slug: "coordinate-launch-team", name: "Coordinate launch team roles" },
        { slug: "plan-rollback-strategy", name: "Plan rollback strategy" },
      ]},
      { order: 9, slug: "marketing-content", name: "Marketing & Content Strategy", group: "GO-TO-MARKET", tasks: [
        { slug: "write-landing-page-copy", name: "Write landing page copy" },
        { slug: "create-demo-video", name: "Create product demo video" },
        { slug: "draft-blog-launch-post", name: "Draft launch blog post" },
        { slug: "setup-email-sequences", name: "Set up email drip sequences" },
      ]},
      { order: 10, slug: "sales-enablement", name: "Sales Enablement", group: "GO-TO-MARKET", tasks: [
        { slug: "create-pitch-deck", name: "Create sales pitch deck" },
        { slug: "build-demo-script", name: "Build demo script" },
        { slug: "define-sales-process", name: "Define sales process & CRM setup" },
        { slug: "prepare-objection-handling", name: "Prepare objection handling guide" },
      ]},
      { order: 11, slug: "conversion-optimization", name: "Conversion Optimization", group: "GO-TO-MARKET", tasks: [
        { slug: "setup-analytics-tracking", name: "Set up analytics & conversion tracking" },
        { slug: "design-onboarding-flow", name: "Design onboarding flow" },
        { slug: "ab-test-pricing-page", name: "A/B test pricing page" },
        { slug: "optimize-signup-funnel", name: "Optimize signup funnel" },
      ]},
      // GROW
      { order: 12, slug: "revenue-tracking", name: "Revenue & Metrics Tracking", group: "GROW", tasks: [
        { slug: "setup-mrr-dashboard", name: "Set up MRR dashboard" },
        { slug: "track-churn-metrics", name: "Track churn & retention metrics" },
        { slug: "define-north-star-metric", name: "Define north star metric" },
      ]},
      { order: 13, slug: "customer-success", name: "Customer Success & Support", group: "GROW", tasks: [
        { slug: "setup-help-desk", name: "Set up help desk / ticketing" },
        { slug: "create-knowledge-base", name: "Create knowledge base" },
        { slug: "define-sla-targets", name: "Define SLA response targets" },
      ]},
      { order: 14, slug: "product-iteration", name: "Product Iteration & Roadmap", group: "GROW", tasks: [
        { slug: "collect-user-feedback", name: "Collect & prioritize user feedback" },
        { slug: "plan-v2-features", name: "Plan v2 feature roadmap" },
        { slug: "schedule-sprint-cadence", name: "Establish sprint cadence" },
      ]},
      { order: 15, slug: "partnerships", name: "Partnerships & Integrations", group: "GROW", tasks: [
        { slug: "identify-integration-partners", name: "Identify integration partners" },
        { slug: "build-api-docs", name: "Build public API documentation" },
        { slug: "launch-partner-program", name: "Launch partner program" },
      ]},
      { order: 16, slug: "scaling", name: "Scaling Infrastructure & Team", group: "GROW", tasks: [
        { slug: "load-test-infrastructure", name: "Load test infrastructure" },
        { slug: "plan-horizontal-scaling", name: "Plan horizontal scaling strategy" },
        { slug: "hire-key-roles", name: "Hire key engineering roles" },
      ]},
      // FOUNDATION
      { order: 17, slug: "legal-compliance", name: "Legal & Compliance", group: "FOUNDATION", tasks: [
        { slug: "draft-tos-privacy", name: "Draft Terms of Service & Privacy Policy" },
        { slug: "check-regulatory-compliance", name: "Check regulatory compliance (GDPR, SOC2)" },
      ]},
      { order: 18, slug: "finance-accounting", name: "Finance & Accounting", group: "FOUNDATION", tasks: [
        { slug: "setup-accounting-system", name: "Set up accounting system" },
        { slug: "configure-tax-reporting", name: "Configure tax & revenue reporting" },
      ]},
      { order: 19, slug: "hr-culture", name: "HR & Culture", group: "FOUNDATION", tasks: [
        { slug: "define-company-values", name: "Define company values" },
        { slug: "create-hiring-playbook", name: "Create hiring playbook" },
      ]},
      { order: 20, slug: "security-privacy", name: "Security & Privacy", group: "FOUNDATION", tasks: [
        { slug: "implement-rbac", name: "Implement role-based access control" },
        { slug: "setup-vulnerability-scanning", name: "Set up vulnerability scanning" },
        { slug: "create-incident-response-plan", name: "Create incident response plan" },
      ]},
      { order: 21, slug: "devops-infra", name: "DevOps & Infrastructure", group: "FOUNDATION", tasks: [
        { slug: "setup-monitoring-alerts", name: "Set up monitoring & alerting" },
        { slug: "configure-auto-scaling", name: "Configure auto-scaling" },
        { slug: "document-runbooks", name: "Document operational runbooks" },
      ]},
      { order: 22, slug: "analytics-bi", name: "Analytics & BI", group: "FOUNDATION", tasks: [
        { slug: "setup-data-warehouse", name: "Set up data warehouse" },
        { slug: "build-exec-dashboard", name: "Build executive dashboard" },
      ]},
      { order: 23, slug: "documentation", name: "Documentation & Knowledge Base", group: "FOUNDATION", tasks: [
        { slug: "write-api-docs", name: "Write API documentation" },
        { slug: "create-dev-onboarding-guide", name: "Create developer onboarding guide" },
      ]},
      { order: 24, slug: "community", name: "Community & Developer Relations", group: "FOUNDATION", tasks: [
        { slug: "launch-community-forum", name: "Launch community forum or Discord" },
        { slug: "plan-content-calendar", name: "Plan developer content calendar" },
      ]},
      { order: 25, slug: "vendor-management", name: "Vendor Management", group: "FOUNDATION", tasks: [
        { slug: "audit-vendor-contracts", name: "Audit vendor contracts" },
        { slug: "evaluate-vendor-alternatives", name: "Evaluate vendor alternatives" },
      ]},
      { order: 26, slug: "staffing", name: "Staffing & Contractors", group: "FOUNDATION", tasks: [
        { slug: "plan-org-chart", name: "Plan org chart" },
        { slug: "identify-contractor-needs", name: "Identify contractor needs" },
      ]},
    ],
  },
  {
    slug: "ministry-discovery",
    name: "Ministry / Org Discovery",
    description: "7-phase discovery process for ministry and organizational transformation.",
    phases: [
      { order: 0, slug: "prayer-commitment", name: "Prayer & Commitment", tasks: [
        { slug: "establish-prayer-team", name: "Establish prayer team" },
        { slug: "set-prayer-schedule", name: "Set prayer schedule & rhythm" },
        { slug: "define-spiritual-goals", name: "Define spiritual goals for the process" },
        { slug: "commit-leadership-buy-in", name: "Secure leadership buy-in & commitment" },
      ]},
      { order: 1, slug: "vision-alignment", name: "Vision Alignment", tasks: [
        { slug: "review-mission-statement", name: "Review current mission statement" },
        { slug: "conduct-vision-workshop", name: "Conduct vision alignment workshop" },
        { slug: "draft-vision-document", name: "Draft updated vision document" },
        { slug: "communicate-vision-to-org", name: "Communicate vision to the organization" },
      ]},
      { order: 2, slug: "leadership-assessment", name: "Leadership Assessment", tasks: [
        { slug: "inventory-current-leaders", name: "Inventory current leaders & roles" },
        { slug: "assess-leadership-gifts", name: "Assess leadership gifts & strengths" },
        { slug: "identify-leadership-gaps", name: "Identify leadership gaps" },
        { slug: "create-leadership-dev-plan", name: "Create leadership development plan" },
      ]},
      { order: 3, slug: "department-discovery", name: "Department Discovery", sublayers: [
        "prayer", "vision", "people", "data", "process", "meetings", "issues"
      ], tasks: [
        { slug: "list-all-departments", name: "List all departments / ministries" },
        { slug: "assign-dept-leads", name: "Assign department discovery leads" },
        { slug: "run-dept-discovery-sessions", name: "Run discovery sessions per department" },
        { slug: "document-dept-findings", name: "Document department findings" },
        { slug: "identify-cross-dept-issues", name: "Identify cross-department issues" },
      ]},
      { order: 4, slug: "gap-analysis", name: "Gap Analysis & Prioritization", tasks: [
        { slug: "compile-discovery-data", name: "Compile all discovery data" },
        { slug: "identify-critical-gaps", name: "Identify critical gaps" },
        { slug: "prioritize-by-impact", name: "Prioritize gaps by impact & urgency" },
        { slug: "present-findings-to-leaders", name: "Present findings to leadership" },
      ]},
      { order: 5, slug: "roadmap-creation", name: "Roadmap Creation", tasks: [
        { slug: "define-quick-wins", name: "Define quick wins (30-day actions)" },
        { slug: "plan-medium-term-goals", name: "Plan medium-term goals (90 days)" },
        { slug: "set-long-term-vision-milestones", name: "Set long-term vision milestones" },
        { slug: "assign-roadmap-owners", name: "Assign owners for each roadmap item" },
      ]},
      { order: 6, slug: "equip-empower-release", name: "Equip, Empower, Release", tasks: [
        { slug: "develop-training-materials", name: "Develop training materials" },
        { slug: "conduct-equipping-sessions", name: "Conduct equipping sessions" },
        { slug: "delegate-authority", name: "Delegate authority & decision rights" },
        { slug: "schedule-followup-reviews", name: "Schedule follow-up reviews" },
      ]},
    ],
  },
  {
    slug: "tech-stack-modernization",
    name: "Tech Stack Modernization (PMBOK)",
    description: "PMBOK-aligned tech modernization with 12 management sections and parallel workstreams.",
    phases: [
      { order: 1, slug: "integration-mgmt", name: "Integration Management", tasks: [
        { slug: "develop-project-charter", name: "Develop project charter" },
        { slug: "create-project-management-plan", name: "Create project management plan" },
        { slug: "define-change-control-process", name: "Define change control process" },
      ]},
      { order: 2, slug: "scope-mgmt", name: "Scope Management", tasks: [
        { slug: "collect-requirements", name: "Collect & document requirements" },
        { slug: "define-scope-statement", name: "Define scope statement" },
        { slug: "create-wbs", name: "Create work breakdown structure (WBS)" },
        { slug: "validate-scope-with-stakeholders", name: "Validate scope with stakeholders" },
      ]},
      { order: 3, slug: "schedule-mgmt", name: "Schedule Management", tasks: [
        { slug: "define-milestones", name: "Define milestones & deliverables" },
        { slug: "estimate-activity-durations", name: "Estimate activity durations" },
        { slug: "build-project-schedule", name: "Build project schedule" },
        { slug: "identify-critical-path", name: "Identify critical path" },
      ]},
      { order: 4, slug: "cost-mgmt", name: "Cost Management", tasks: [
        { slug: "estimate-costs", name: "Estimate costs for each work package" },
        { slug: "set-budget-baseline", name: "Set budget baseline" },
        { slug: "plan-cost-tracking", name: "Plan cost tracking & EVM" },
      ]},
      { order: 5, slug: "quality-mgmt", name: "Quality Management", tasks: [
        { slug: "define-quality-standards", name: "Define quality standards & metrics" },
        { slug: "plan-qa-activities", name: "Plan QA activities" },
        { slug: "setup-testing-framework", name: "Set up testing framework" },
      ]},
      { order: 6, slug: "resource-mgmt", name: "Resource Management", tasks: [
        { slug: "identify-team-needs", name: "Identify team resource needs" },
        { slug: "assign-roles-responsibilities", name: "Assign roles & responsibilities (RACI)" },
        { slug: "plan-training-needs", name: "Plan training & skill development" },
      ]},
      { order: 7, slug: "communications-mgmt", name: "Communications Management", tasks: [
        { slug: "create-comms-plan", name: "Create communications plan" },
        { slug: "setup-status-reporting", name: "Set up status reporting cadence" },
        { slug: "define-escalation-paths", name: "Define escalation paths" },
      ]},
      { order: 8, slug: "risk-mgmt", name: "Risk Management", tasks: [
        { slug: "identify-risks", name: "Identify project risks" },
        { slug: "assess-risk-probability-impact", name: "Assess risk probability & impact" },
        { slug: "plan-risk-responses", name: "Plan risk responses" },
        { slug: "setup-risk-monitoring", name: "Set up risk monitoring" },
      ]},
      { order: 9, slug: "procurement-mgmt", name: "Procurement Management", tasks: [
        { slug: "identify-vendor-needs", name: "Identify vendor / tool needs" },
        { slug: "evaluate-vendor-options", name: "Evaluate vendor options" },
        { slug: "negotiate-contracts", name: "Negotiate & finalize contracts" },
      ]},
      { order: 10, slug: "stakeholder-mgmt", name: "Stakeholder Management", tasks: [
        { slug: "identify-stakeholders", name: "Identify all stakeholders" },
        { slug: "assess-stakeholder-influence", name: "Assess stakeholder influence & interest" },
        { slug: "plan-stakeholder-engagement", name: "Plan stakeholder engagement strategy" },
      ]},
      { order: 11, slug: "change-mgmt", name: "Change Management", tasks: [
        { slug: "assess-change-readiness", name: "Assess organizational change readiness" },
        { slug: "develop-change-strategy", name: "Develop change management strategy" },
        { slug: "plan-training-rollout", name: "Plan training & rollout" },
        { slug: "define-adoption-metrics", name: "Define adoption success metrics" },
      ]},
      { order: 12, slug: "governance", name: "Governance & Reporting", tasks: [
        { slug: "setup-governance-structure", name: "Set up governance structure" },
        { slug: "define-decision-authority", name: "Define decision-making authority" },
        { slug: "schedule-steering-reviews", name: "Schedule steering committee reviews" },
      ]},
    ],
  },
  {
    slug: "website-build",
    name: "Website Build (5-Pass)",
    description: "Guided 5-pass website build: Discovery → Foundation & Look → Content → Polish & QA → Go-Live. Includes structured client review gates at each pass.",
    phases: [
      { order: 1, slug: "wb-discovery", name: "Discovery", group: "WEBSITE", tasks: [
        { slug: "wb-run-site-audit", name: "Run site audit on existing site" },
        { slug: "wb-review-audit-results", name: "Review audit results with team" },
        { slug: "wb-discuss-findings-client", name: "Present findings to client" },
        { slug: "wb-fill-pass1-form", name: "Fill out Pass 1 brand form with client" },
      ]},
      { order: 2, slug: "wb-foundation", name: "Pass 1 — Foundation & Look", group: "WEBSITE", tasks: [
        { slug: "wb-generate-mockups", name: "Generate two mockup options (AI)" },
        { slug: "wb-send-mockup-review", name: "Send client review link" },
        { slug: "wb-collect-mockup-feedback", name: "Collect client mockup selection & feedback" },
        { slug: "wb-approve-pass1", name: "Team review & approve Pass 1" },
      ]},
      { order: 3, slug: "wb-content", name: "Pass 2 — Content Population", group: "WEBSITE", tasks: [
        { slug: "wb-send-content-form", name: "Send content form to client" },
        { slug: "wb-collect-content", name: "Collect and review client content" },
        { slug: "wb-generate-ai-content", name: "Generate AI copy for missing sections" },
        { slug: "wb-render-content-preview", name: "Render content preview for review" },
        { slug: "wb-client-content-review", name: "Client reviews content pass" },
        { slug: "wb-approve-pass2", name: "Team approve Pass 2" },
      ]},
      { order: 4, slug: "wb-polish", name: "Pass 3 — Polish & QA", group: "WEBSITE", tasks: [
        { slug: "wb-ai-apply-comments", name: "AI-apply client feedback comments" },
        { slug: "wb-human-review-ai-changes", name: "Human review of AI-applied changes" },
        { slug: "wb-wire-seo-schema", name: "Wire SEO meta tags, schema.org, llms.txt" },
        { slug: "wb-mobile-qa", name: "Mobile & cross-browser QA" },
        { slug: "wb-run-scoring-rubric", name: "Run scoring rubric (SEO ≥ 70, Conversion ≥ 70)" },
        { slug: "wb-client-final-review", name: "Client final review & approval" },
      ]},
      { order: 5, slug: "wb-go-live", name: "Go-Live", group: "WEBSITE", tasks: [
        { slug: "wb-configure-domain-dns", name: "Configure domain & DNS" },
        { slug: "wb-deploy-to-production", name: "Deploy to production" },
        { slug: "wb-verify-analytics", name: "Verify analytics & tracking" },
        { slug: "wb-test-contact-forms", name: "Test all contact forms" },
        { slug: "wb-run-final-audit", name: "Run post-launch site audit" },
        { slug: "wb-generate-before-after-pdf", name: "Generate before/after comparison PDF" },
        { slug: "wb-mark-complete", name: "Mark project complete & notify client" },
      ]},
    ],
  },
  {
    slug: "business-os",
    name: "BusinessOS Discovery",
    description: "11-phase business discovery and transformation process. Covers leadership alignment, department discovery, quote-to-cash mapping, gap analysis, and enablement.",
    phases: [
      { order: 0, slug: "bos-executive-commitment", name: "Executive Commitment & Alignment", tasks: [
        { slug: "bos-identify-executive-sponsor", name: "Identify executive sponsor" },
        { slug: "bos-define-engagement-objectives", name: "Define objectives for the discovery process" },
        { slug: "bos-align-leadership-expectations", name: "Align leadership team on goals and expectations" },
        { slug: "bos-secure-stakeholder-commitment", name: "Secure commitment from key stakeholders" },
      ]},
      { order: 1, slug: "bos-vision-alignment", name: "Vision Alignment", tasks: [
        { slug: "bos-review-mission-vision", name: "Review current mission & vision statements" },
        { slug: "bos-conduct-vision-workshop", name: "Conduct vision alignment workshop" },
        { slug: "bos-draft-vision-document", name: "Draft updated vision document" },
        { slug: "bos-communicate-vision", name: "Communicate vision to the organization" },
      ]},
      { order: 2, slug: "bos-leadership-assessment", name: "Leadership Assessment", tasks: [
        { slug: "bos-inventory-leaders-roles", name: "Inventory current leaders & roles" },
        { slug: "bos-assess-leadership-strengths", name: "Assess leadership strengths & competencies" },
        { slug: "bos-identify-leadership-gaps", name: "Identify leadership gaps" },
        { slug: "bos-create-leadership-dev-plan", name: "Create leadership development plan" },
      ]},
      { order: 3, slug: "bos-quote-to-cash", name: "Quote-to-Cash Process Discovery", tasks: [
        { slug: "bos-map-lead-generation", name: "Map lead generation process & channels" },
        { slug: "bos-document-lead-qualification", name: "Document lead qualification process (BANT, scoring)" },
        { slug: "bos-review-proposal-quoting", name: "Review proposal & quoting workflow" },
        { slug: "bos-assess-negotiation-close", name: "Assess negotiation, contract, and close process" },
        { slug: "bos-map-order-fulfillment", name: "Map order fulfillment & service delivery workflow" },
        { slug: "bos-review-invoicing", name: "Review invoicing process & billing accuracy" },
        { slug: "bos-assess-collections-ar", name: "Assess collections and accounts receivable" },
        { slug: "bos-identify-revenue-cycle-gaps", name: "Identify gaps and bottlenecks in the revenue cycle" },
      ]},
      { order: 4, slug: "bos-department-discovery", name: "Department Discovery", sublayers: [
        "strategy", "vision", "people", "data", "process", "meetings", "issues"
      ], tasks: [
        { slug: "bos-list-all-departments", name: "List all departments" },
        { slug: "bos-assign-dept-leads", name: "Assign department discovery leads" },
        { slug: "bos-run-dept-discovery-sessions", name: "Run discovery sessions per department" },
        { slug: "bos-document-dept-findings", name: "Document department findings" },
        { slug: "bos-identify-cross-dept-issues", name: "Identify cross-department issues" },
      ]},
      { order: 5, slug: "bos-sales-dept", name: "Dept: Sales", tasks: [
        { slug: "bos-sales-review-pipeline", name: "Review sales pipeline & CRM usage" },
        { slug: "bos-sales-assess-team", name: "Assess sales team structure & capacity" },
        { slug: "bos-sales-document-process", name: "Document current sales process" },
        { slug: "bos-sales-identify-gaps", name: "Identify gaps and improvement areas" },
      ]},
      { order: 6, slug: "bos-ops-dept", name: "Dept: Operations", tasks: [
        { slug: "bos-ops-map-workflows", name: "Map core operational workflows" },
        { slug: "bos-ops-assess-tools", name: "Assess tools & systems in use" },
        { slug: "bos-ops-identify-bottlenecks", name: "Identify operational bottlenecks" },
        { slug: "bos-ops-document-findings", name: "Document findings & recommendations" },
      ]},
      { order: 7, slug: "bos-support-depts", name: "Dept: Finance, People, Customer Service & Other", tasks: [
        { slug: "bos-finance-review-processes", name: "Finance: review AP, AR, budgeting & reporting" },
        { slug: "bos-people-assess-hr", name: "People/HR: assess hiring, onboarding, retention" },
        { slug: "bos-cs-review-support", name: "Customer Service: review support workflows & SLAs" },
        { slug: "bos-procurement-assess", name: "Procurement: assess vendor management & sourcing" },
        { slug: "bos-other-depts-document", name: "Document findings for remaining departments (IT, Marketing, Legal, Manufacturing)" },
      ]},
      { order: 8, slug: "bos-gap-analysis", name: "Gap Analysis & Prioritization", tasks: [
        { slug: "bos-compile-discovery-data", name: "Compile all discovery data" },
        { slug: "bos-identify-critical-gaps", name: "Identify critical gaps" },
        { slug: "bos-prioritize-by-impact", name: "Prioritize gaps by impact & urgency" },
        { slug: "bos-present-findings", name: "Present findings to leadership" },
      ]},
      { order: 9, slug: "bos-roadmap-creation", name: "Roadmap Creation", tasks: [
        { slug: "bos-define-quick-wins", name: "Define quick wins (30-day actions)" },
        { slug: "bos-plan-medium-term-goals", name: "Plan medium-term goals (90 days)" },
        { slug: "bos-set-long-term-milestones", name: "Set long-term vision milestones" },
        { slug: "bos-assign-roadmap-owners", name: "Assign owners for each roadmap item" },
      ]},
      { order: 10, slug: "bos-enable-empower-launch", name: "Enable, Empower, Launch", tasks: [
        { slug: "bos-develop-training-materials", name: "Develop training materials" },
        { slug: "bos-conduct-enablement-sessions", name: "Conduct enablement sessions" },
        { slug: "bos-delegate-authority", name: "Delegate authority & decision rights" },
        { slug: "bos-schedule-followup-reviews", name: "Schedule follow-up reviews" },
      ]},
    ],
  },
  {
    slug: "business-discovery",
    name: "Business Discovery",
    description: "8-phase discovery and assessment process for small-to-mid-size businesses. Covers executive alignment, vision, leadership, department discovery, gap analysis, roadmap, and enablement.",
    phases: [
      { order: 0, slug: "bd-executive-commitment", name: "Executive Commitment & Alignment", tasks: [
        { slug: "bd-identify-executive-sponsor", name: "Identify executive sponsor" },
        { slug: "bd-define-engagement-objectives", name: "Define objectives for the discovery process" },
        { slug: "bd-align-leadership-expectations", name: "Align leadership team on goals and expectations" },
        { slug: "bd-secure-stakeholder-commitment", name: "Secure commitment from key stakeholders" },
      ]},
      { order: 1, slug: "bd-vision-alignment", name: "Vision & Strategy Alignment", tasks: [
        { slug: "bd-review-mission-vision", name: "Review current mission & vision statements" },
        { slug: "bd-assess-strategic-direction", name: "Assess current strategic direction & priorities" },
        { slug: "bd-conduct-vision-workshop", name: "Conduct vision alignment workshop" },
        { slug: "bd-document-strategic-goals", name: "Document agreed strategic goals" },
      ]},
      { order: 2, slug: "bd-leadership-assessment", name: "Leadership Assessment", tasks: [
        { slug: "bd-inventory-leaders-roles", name: "Inventory current leaders & roles" },
        { slug: "bd-assess-leadership-strengths", name: "Assess leadership strengths & competencies" },
        { slug: "bd-identify-leadership-gaps", name: "Identify leadership gaps" },
        { slug: "bd-create-leadership-dev-plan", name: "Create leadership development plan" },
      ]},
      { order: 3, slug: "bd-department-discovery", name: "Department Discovery", sublayers: [
        "strategy", "vision", "people", "data", "process", "meetings", "issues"
      ], tasks: [
        { slug: "bd-list-all-departments", name: "List all departments & functions" },
        { slug: "bd-assign-dept-leads", name: "Assign department discovery leads" },
        { slug: "bd-schedule-discovery-sessions", name: "Schedule discovery sessions per department" },
        { slug: "bd-run-dept-discovery-sessions", name: "Run discovery sessions per department" },
        { slug: "bd-document-dept-findings", name: "Document department findings" },
        { slug: "bd-identify-cross-dept-issues", name: "Identify cross-department issues" },
      ]},
      { order: 4, slug: "bd-revenue-cycle", name: "Revenue Cycle Assessment", tasks: [
        { slug: "bd-map-lead-to-close", name: "Map lead generation to close process" },
        { slug: "bd-review-proposal-quoting", name: "Review proposal & quoting workflow" },
        { slug: "bd-review-invoicing-collections", name: "Review invoicing and collections process" },
        { slug: "bd-identify-revenue-gaps", name: "Identify gaps in the revenue cycle" },
      ]},
      { order: 5, slug: "bd-operations-assessment", name: "Operations Assessment", tasks: [
        { slug: "bd-map-core-workflows", name: "Map core operational workflows" },
        { slug: "bd-assess-tools-systems", name: "Assess tools & systems in use" },
        { slug: "bd-identify-bottlenecks", name: "Identify operational bottlenecks" },
        { slug: "bd-assess-finance-hr", name: "Assess finance, HR, and admin functions" },
      ]},
      { order: 6, slug: "bd-gap-analysis", name: "Gap Analysis & Prioritization", tasks: [
        { slug: "bd-compile-discovery-data", name: "Compile all discovery data" },
        { slug: "bd-identify-critical-gaps", name: "Identify critical gaps" },
        { slug: "bd-score-pillars", name: "Score each pillar (1–5 scale)" },
        { slug: "bd-prioritize-by-impact", name: "Prioritize gaps by impact & urgency" },
        { slug: "bd-present-findings", name: "Present findings to leadership" },
      ]},
      { order: 7, slug: "bd-roadmap-enablement", name: "Roadmap & Enablement", tasks: [
        { slug: "bd-define-quick-wins", name: "Define quick wins (30-day actions)" },
        { slug: "bd-plan-medium-term-goals", name: "Plan medium-term goals (90 days)" },
        { slug: "bd-set-long-term-milestones", name: "Set long-term vision milestones" },
        { slug: "bd-assign-roadmap-owners", name: "Assign owners for each roadmap item" },
        { slug: "bd-conduct-enablement-sessions", name: "Conduct enablement sessions" },
        { slug: "bd-schedule-followup-reviews", name: "Schedule follow-up reviews" },
      ]},
    ],
  },
  {
    slug: "nonprofit-discovery",
    name: "Nonprofit / Ministry Discovery",
    description: "8-phase discovery process for nonprofits and mission-driven organizations. Covers mission alignment, board governance, program assessment, volunteer & donor mapping, operations, gap analysis, roadmap, and launch.",
    phases: [
      { order: 0, slug: "np-mission-commitment", name: "Mission Commitment & Alignment", tasks: [
        { slug: "np-clarify-mission-statement", name: "Clarify and affirm mission statement" },
        { slug: "np-identify-executive-sponsor", name: "Identify executive director / board sponsor" },
        { slug: "np-align-leadership-on-goals", name: "Align leadership on discovery goals" },
        { slug: "np-secure-staff-commitment", name: "Secure staff & board commitment to the process" },
      ]},
      { order: 1, slug: "np-vision-strategy", name: "Vision & Strategic Direction", tasks: [
        { slug: "np-review-strategic-plan", name: "Review existing strategic plan (if any)" },
        { slug: "np-conduct-vision-workshop", name: "Conduct vision alignment workshop" },
        { slug: "np-define-theory-of-change", name: "Define or refine theory of change" },
        { slug: "np-document-strategic-priorities", name: "Document strategic priorities" },
      ]},
      { order: 2, slug: "np-board-governance", name: "Board & Governance Assessment", tasks: [
        { slug: "np-review-board-structure", name: "Review board structure & composition" },
        { slug: "np-assess-governance-practices", name: "Assess governance practices & bylaws" },
        { slug: "np-identify-board-gaps", name: "Identify board skill & engagement gaps" },
        { slug: "np-review-compliance-reporting", name: "Review compliance & financial reporting practices" },
      ]},
      { order: 3, slug: "np-department-discovery", name: "Department & Function Discovery", sublayers: [
        "mission", "vision", "people", "data", "process", "meetings", "issues"
      ], tasks: [
        { slug: "np-list-all-functions", name: "List all departments / program functions" },
        { slug: "np-assign-function-leads", name: "Assign discovery leads per function" },
        { slug: "np-run-discovery-sessions", name: "Run discovery sessions per function" },
        { slug: "np-document-function-findings", name: "Document findings per function" },
        { slug: "np-identify-cross-function-issues", name: "Identify cross-functional issues" },
      ]},
      { order: 4, slug: "np-programs-impact", name: "Programs & Impact Assessment", tasks: [
        { slug: "np-inventory-programs", name: "Inventory all active programs & services" },
        { slug: "np-assess-program-effectiveness", name: "Assess program effectiveness & outcomes" },
        { slug: "np-review-impact-metrics", name: "Review impact metrics & reporting" },
        { slug: "np-identify-program-gaps", name: "Identify gaps in program delivery" },
      ]},
      { order: 5, slug: "np-volunteers-donors", name: "Volunteers, Donors & Community", tasks: [
        { slug: "np-review-volunteer-management", name: "Review volunteer recruitment & management process" },
        { slug: "np-assess-donor-relations", name: "Assess donor relations & stewardship practices" },
        { slug: "np-review-fundraising-process", name: "Review fundraising & development process" },
        { slug: "np-assess-community-partnerships", name: "Assess community partnerships & outreach" },
      ]},
      { order: 6, slug: "np-gap-analysis", name: "Gap Analysis & Prioritization", tasks: [
        { slug: "np-compile-discovery-data", name: "Compile all discovery data" },
        { slug: "np-identify-critical-gaps", name: "Identify critical gaps" },
        { slug: "np-score-pillars", name: "Score each pillar (1–5 scale)" },
        { slug: "np-prioritize-by-mission-impact", name: "Prioritize gaps by mission impact & urgency" },
        { slug: "np-present-findings", name: "Present findings to leadership & board" },
      ]},
      { order: 7, slug: "np-roadmap-launch", name: "Roadmap & Launch", tasks: [
        { slug: "np-define-quick-wins", name: "Define quick wins (30-day actions)" },
        { slug: "np-plan-medium-term-goals", name: "Plan medium-term goals (90 days)" },
        { slug: "np-set-long-term-milestones", name: "Set long-term vision milestones" },
        { slug: "np-assign-roadmap-owners", name: "Assign owners for each roadmap item" },
        { slug: "np-conduct-enablement-sessions", name: "Conduct enablement sessions" },
        { slug: "np-schedule-followup-reviews", name: "Schedule follow-up reviews" },
      ]},
    ],
  },
  {
    slug: "custom",
    name: "Custom",
    description: "Blank slate project. Define your own phases, tasks, and structure.",
    phases: [],
  },
];

// ─── Seed Function ───────────────────────────────────────────────────

async function seed() {
  console.log("Seeding PM templates...");

  for (const template of templates) {
    const { error } = await supabase
      .from("pm_project_templates")
      .upsert(
        {
          slug: template.slug,
          name: template.name,
          description: template.description,
          phases: template.phases,
        },
        { onConflict: "slug" }
      );

    if (error) {
      console.error(`Error seeding template ${template.slug}:`, error.message);
    } else {
      const taskCount = template.phases.reduce((sum, p) => sum + (p.tasks?.length ?? 0), 0);
      console.log(`  ✓ ${template.name} (${template.phases.length} phases, ${taskCount} tasks)`);
    }
  }

  console.log("\nSeeding complete.");
}

seed().catch(console.error);
