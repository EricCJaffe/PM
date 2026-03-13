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
      { order: 1, slug: "idea-validation", name: "Idea Validation & Problem Definition", group: "BUILD" },
      { order: 2, slug: "market-research", name: "Market Research & Competitor Analysis", group: "BUILD" },
      { order: 3, slug: "business-model", name: "Business Model & Monetization", group: "BUILD" },
      { order: 4, slug: "product-design", name: "Product Design & UX", group: "BUILD" },
      { order: 5, slug: "tech-architecture", name: "Technical Architecture & Stack", group: "BUILD" },
      { order: 6, slug: "mvp-development", name: "MVP Development", group: "BUILD" },
      { order: 7, slug: "testing-qa", name: "Testing & QA", group: "BUILD" },
      // GO-TO-MARKET
      { order: 8, slug: "launch-planning", name: "Launch Planning", group: "GO-TO-MARKET" },
      { order: 9, slug: "marketing-content", name: "Marketing & Content Strategy", group: "GO-TO-MARKET" },
      { order: 10, slug: "sales-enablement", name: "Sales Enablement", group: "GO-TO-MARKET" },
      { order: 11, slug: "conversion-optimization", name: "Conversion Optimization", group: "GO-TO-MARKET" },
      // GROW
      { order: 12, slug: "revenue-tracking", name: "Revenue & Metrics Tracking", group: "GROW" },
      { order: 13, slug: "customer-success", name: "Customer Success & Support", group: "GROW" },
      { order: 14, slug: "product-iteration", name: "Product Iteration & Roadmap", group: "GROW" },
      { order: 15, slug: "partnerships", name: "Partnerships & Integrations", group: "GROW" },
      { order: 16, slug: "scaling", name: "Scaling Infrastructure & Team", group: "GROW" },
      // FOUNDATION
      { order: 17, slug: "legal-compliance", name: "Legal & Compliance", group: "FOUNDATION" },
      { order: 18, slug: "finance-accounting", name: "Finance & Accounting", group: "FOUNDATION" },
      { order: 19, slug: "hr-culture", name: "HR & Culture", group: "FOUNDATION" },
      { order: 20, slug: "security-privacy", name: "Security & Privacy", group: "FOUNDATION" },
      { order: 21, slug: "devops-infra", name: "DevOps & Infrastructure", group: "FOUNDATION" },
      { order: 22, slug: "analytics-bi", name: "Analytics & BI", group: "FOUNDATION" },
      { order: 23, slug: "documentation", name: "Documentation & Knowledge Base", group: "FOUNDATION" },
      { order: 24, slug: "community", name: "Community & Developer Relations", group: "FOUNDATION" },
      { order: 25, slug: "vendor-management", name: "Vendor Management", group: "FOUNDATION" },
      { order: 26, slug: "staffing", name: "Staffing & Contractors", group: "FOUNDATION" },
    ],
  },
  {
    slug: "ministry-discovery",
    name: "Ministry / Org Discovery",
    description: "7-phase discovery process for ministry and organizational transformation.",
    phases: [
      { order: 0, slug: "prayer-commitment", name: "Prayer & Commitment" },
      { order: 1, slug: "vision-alignment", name: "Vision Alignment" },
      { order: 2, slug: "leadership-assessment", name: "Leadership Assessment" },
      { order: 3, slug: "department-discovery", name: "Department Discovery", sublayers: [
        "prayer", "vision", "people", "data", "process", "meetings", "issues"
      ]},
      { order: 4, slug: "gap-analysis", name: "Gap Analysis & Prioritization" },
      { order: 5, slug: "roadmap-creation", name: "Roadmap Creation" },
      { order: 6, slug: "equip-empower-release", name: "Equip, Empower, Release" },
    ],
  },
  {
    slug: "tech-stack-modernization",
    name: "Tech Stack Modernization (PMBOK)",
    description: "PMBOK-aligned tech modernization with 12 management sections and parallel workstreams.",
    phases: [
      { order: 1, slug: "integration-mgmt", name: "Integration Management" },
      { order: 2, slug: "scope-mgmt", name: "Scope Management" },
      { order: 3, slug: "schedule-mgmt", name: "Schedule Management" },
      { order: 4, slug: "cost-mgmt", name: "Cost Management" },
      { order: 5, slug: "quality-mgmt", name: "Quality Management" },
      { order: 6, slug: "resource-mgmt", name: "Resource Management" },
      { order: 7, slug: "communications-mgmt", name: "Communications Management" },
      { order: 8, slug: "risk-mgmt", name: "Risk Management" },
      { order: 9, slug: "procurement-mgmt", name: "Procurement Management" },
      { order: 10, slug: "stakeholder-mgmt", name: "Stakeholder Management" },
      { order: 11, slug: "change-mgmt", name: "Change Management" },
      { order: 12, slug: "governance", name: "Governance & Reporting" },
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
      console.log(`  ✓ ${template.name}`);
    }
  }

  console.log("\nSeeding complete.");
}

seed().catch(console.error);
