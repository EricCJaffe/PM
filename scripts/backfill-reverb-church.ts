/**
 * Backfill script: Reverb Church — MinistryOS Discovery & Transformation
 *
 * Run: npx tsx scripts/backfill-reverb-church.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *
 * Mapping decisions:
 * - Phases 0-6 → pm_phases with group = DISCOVERY | DEEP-DIVE | IMPLEMENTATION
 * - Phase 3 departments → pm_tasks under Phase 3, 7 discovery layers as subtasks JSONB
 * - Support Sections 1-4 → pm_phases (order 7-10) with group = SUPPORT
 * - Support items → pm_tasks under their respective support phase
 * - Template reference → "ministry-discovery" (existing template)
 * - All statuses → "not-started"
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Data Definitions ──────────────────────────────────────────────────

const ORG = {
  name: "Reverb Church",
  slug: "reverb-church",
};

const OWNER = {
  display_name: "Eric Jaffe",
  slug: "eric-jaffe",
  email: "ejaffejax@gmail.com",
  role: "owner" as const,
};

const PROJECT = {
  name: "Reverb Church",
  slug: "reverb-church",
  description: "MinistryOS Discovery & Transformation — 7-phase discovery and implementation framework for Reverb Church.",
  template_slug: "ministry-discovery",
  status: "active" as const,
};

// Phase group assignments based on the framework sections
type PhaseGroup = "DISCOVERY" | "DEEP-DIVE" | "IMPLEMENTATION" | "SUPPORT";

interface PhaseDef {
  order: number;
  slug: string;
  name: string;
  group: PhaseGroup;
  tasks: TaskDef[];
}

interface TaskDef {
  slug: string;
  name: string;
  description?: string;
  subtasks?: { text: string; done: boolean }[];
}

// The 7 discovery layers used for each department in Phase 3
const DISCOVERY_LAYERS = [
  "Mission Alignment",
  "Success Metrics",
  "People / Org",
  "Communication",
  "Processes",
  "Pain Points",
  "Automation Opportunities",
];

const DEPARTMENTS = [
  "Operations",
  "Communications & Marketing",
  "Finance & Stewardship",
  "Volunteer Management",
  "Donor Relations",
  "Programs & Ministry",
];

// ─── Phase Definitions ─────────────────────────────────────────────────

const phases: PhaseDef[] = [
  // --- DISCOVERY (Phases 0-2) ---
  {
    order: 0,
    slug: "p0-prayer-commitment",
    name: "Prayer & Commitment",
    group: "DISCOVERY",
    tasks: [
      { slug: "leadership-prayer-guide", name: "Leadership Prayer Guide" },
      { slug: "spiritual-alignment", name: "Spiritual Alignment" },
      { slug: "commitment-letters", name: "Commitment Letters" },
      { slug: "stakeholder-buy-in", name: "Stakeholder Buy-In" },
    ],
  },
  {
    order: 1,
    slug: "p1-organizational-understanding",
    name: "Organizational Understanding",
    group: "DISCOVERY",
    tasks: [
      { slug: "org-chart-structure", name: "Org Chart & Structure" },
      { slug: "department-inventory", name: "Department Inventory" },
      { slug: "staff-volunteer-mapping", name: "Staff & Volunteer Mapping" },
      { slug: "decision-making-structures", name: "Decision Making Structures" },
      { slug: "communication-flows", name: "Communication Flows" },
      { slug: "culture-assessment", name: "Culture Assessment" },
    ],
  },
  {
    order: 2,
    slug: "p2-current-state-assessment",
    name: "Current State Assessment",
    group: "DISCOVERY",
    tasks: [
      { slug: "process-maturity-scoring", name: "Process Maturity Scoring" },
      { slug: "tool-stack-audit", name: "Tool Stack Audit" },
      { slug: "existing-automations", name: "Existing Automations" },
      { slug: "pain-point-inventory", name: "Pain Point Inventory" },
      { slug: "data-flow-mapping", name: "Data Flow Mapping" },
      { slug: "gap-analysis", name: "Gap Analysis" },
    ],
  },
  // --- DEEP DIVE (Phase 3) ---
  // Department tasks are generated below with 7-layer subtasks
  {
    order: 3,
    slug: "p3-department-discovery",
    name: "Department Discovery (7-Layer Analysis)",
    group: "DEEP-DIVE",
    tasks: DEPARTMENTS.map((dept) => {
      const deptSlug = dept
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return {
        slug: `dept-${deptSlug}`,
        name: dept,
        description: `7-layer discovery analysis for ${dept}. Layers: ${DISCOVERY_LAYERS.join(", ")}`,
        subtasks: DISCOVERY_LAYERS.map((layer) => ({
          text: layer,
          done: false,
        })),
      };
    }),
  },
  // --- IMPLEMENTATION (Phases 4-6) ---
  {
    order: 4,
    slug: "p4-quick-wins-prioritization",
    name: "Quick Wins & Prioritization",
    group: "IMPLEMENTATION",
    tasks: [
      { slug: "quick-win-identification", name: "Quick Win Identification" },
      { slug: "impact-vs-effort-scoring", name: "Impact vs. Effort Scoring" },
      { slug: "sample-project-1", name: "Sample Project 1" },
      { slug: "sample-project-2", name: "Sample Project 2" },
      { slug: "sample-project-3", name: "Sample Project 3" },
      { slug: "mission-alignment-check", name: "Mission Alignment Check" },
    ],
  },
  {
    order: 5,
    slug: "p5-roadmap-implementation",
    name: "Roadmap & Implementation",
    group: "IMPLEMENTATION",
    tasks: [
      { slug: "q1-foundation-quick-wins", name: "Q1: Foundation & Quick Wins" },
      { slug: "q2-core-systems", name: "Q2: Core Systems" },
      { slug: "q3-expansion", name: "Q3: Expansion" },
      { slug: "q4-maturity-handoff", name: "Q4: Maturity & Handoff" },
      { slug: "timeline-milestones", name: "Timeline & Milestones" },
      { slug: "budget-resources", name: "Budget & Resources" },
    ],
  },
  {
    order: 6,
    slug: "p6-equip-empower-release",
    name: "Equip, Empower, Release",
    group: "IMPLEMENTATION",
    tasks: [
      { slug: "champion-identification", name: "Champion Identification" },
      { slug: "training-plans", name: "Training Plans" },
      { slug: "knowledge-transfer", name: "Knowledge Transfer" },
      { slug: "sustainability-playbook", name: "Sustainability Playbook" },
      { slug: "ongoing-review-cadence", name: "Ongoing Review Cadence" },
      { slug: "independence-readiness", name: "Independence Readiness" },
    ],
  },
  // --- CROSS-CUTTING SUPPORT SECTIONS (parallel, phases 7-10) ---
  {
    order: 7,
    slug: "s1-ministryos-components",
    name: "MinistryOS Components",
    group: "SUPPORT",
    tasks: [
      { slug: "mos-vision", name: "Vision (Mission, Values, Goals)" },
      { slug: "mos-people", name: "People (Org, Job Descriptions)" },
      { slug: "mos-data", name: "Data (KPIs, Scorecard)" },
      { slug: "mos-process", name: "Process (Playbooks, Triggers)" },
      { slug: "mos-meetings", name: "Meetings (Rhythms, Channels)" },
      { slug: "mos-issues", name: "Issues (Tracking, Root Cause)" },
    ],
  },
  {
    order: 8,
    slug: "s2-tool-stack-audit",
    name: "Tool Stack Audit",
    group: "SUPPORT",
    tasks: [
      { slug: "tsa-current-tools-inventory", name: "Current Tools Inventory" },
      { slug: "tsa-integration-map", name: "Integration Map" },
      { slug: "tsa-redundancy-analysis", name: "Redundancy Analysis" },
      { slug: "tsa-recommended-stack", name: "Recommended Stack" },
      { slug: "tsa-migration-plans", name: "Migration Plans" },
      { slug: "tsa-vendor-evaluation", name: "Vendor Evaluation" },
    ],
  },
  {
    order: 9,
    slug: "s3-change-management",
    name: "Change Management",
    group: "SUPPORT",
    tasks: [
      { slug: "cm-communication-plan", name: "Communication Plan" },
      { slug: "cm-resistance-mapping", name: "Resistance Mapping" },
      { slug: "cm-transition-support", name: "Transition Support" },
      { slug: "cm-staff-training-schedule", name: "Staff Training Schedule" },
      { slug: "cm-celebration-milestones", name: "Celebration Milestones" },
    ],
  },
  {
    order: 10,
    slug: "s4-roi-impact-tracking",
    name: "ROI & Impact Tracking",
    group: "SUPPORT",
    tasks: [
      { slug: "roi-hours-saved", name: "Hours Saved Tracking" },
      { slug: "roi-cost-reduction", name: "Cost Reduction Analysis" },
      { slug: "roi-mission-impact", name: "Mission Impact Metrics" },
      { slug: "roi-board-reporting", name: "Board Reporting" },
      { slug: "roi-before-after", name: "Before & After Comparisons" },
    ],
  },
];

// ─── Backfill Function ─────────────────────────────────────────────────

async function backfill() {
  console.log("=== Backfill: Reverb Church — MinistryOS Discovery ===\n");

  // 1. Upsert organization (client)
  console.log("1. Ensuring client record exists...");
  const { data: org, error: orgErr } = await supabase
    .from("pm_organizations")
    .upsert({ slug: ORG.slug, name: ORG.name }, { onConflict: "slug" })
    .select()
    .single();

  if (orgErr || !org) {
    console.error("Failed to create/find organization:", orgErr?.message);
    process.exit(1);
  }
  console.log(`   Client: ${org.name} (${org.id})`);

  // 2. Upsert owner member
  console.log("2. Ensuring owner member exists...");
  const { data: member, error: memberErr } = await supabase
    .from("pm_members")
    .upsert(
      { org_id: org.id, slug: OWNER.slug, display_name: OWNER.display_name, email: OWNER.email, role: OWNER.role },
      { onConflict: "org_id,slug" }
    )
    .select()
    .single();

  if (memberErr || !member) {
    console.error("Failed to create/find member:", memberErr?.message);
    process.exit(1);
  }
  console.log(`   Owner: ${member.display_name} (${member.slug})`);

  // 3. Check for existing project (avoid duplicates)
  console.log("3. Checking for existing project...");
  const { data: existingProject } = await supabase
    .from("pm_projects")
    .select("id")
    .eq("org_id", org.id)
    .eq("slug", PROJECT.slug)
    .single();

  if (existingProject) {
    console.log(`   Project already exists (${existingProject.id}). Deleting and re-creating...`);
    // CASCADE will remove phases, tasks, risks, etc.
    const { error: delErr } = await supabase
      .from("pm_projects")
      .delete()
      .eq("id", existingProject.id);
    if (delErr) {
      console.error("Failed to delete existing project:", delErr.message);
      process.exit(1);
    }
    console.log("   Deleted existing project.");
  }

  // 4. Create project
  console.log("4. Creating project...");

  // Check if template exists
  const { data: templateCheck } = await supabase
    .from("pm_project_templates")
    .select("slug")
    .eq("slug", PROJECT.template_slug)
    .single();

  const { data: project, error: projErr } = await supabase
    .from("pm_projects")
    .insert({
      org_id: org.id,
      slug: PROJECT.slug,
      name: PROJECT.name,
      description: PROJECT.description,
      owner: OWNER.slug,
      template_slug: templateCheck ? PROJECT.template_slug : null,
      start_date: new Date().toISOString().split("T")[0],
      status: PROJECT.status,
    })
    .select()
    .single();

  if (projErr || !project) {
    console.error("Failed to create project:", projErr?.message);
    process.exit(1);
  }
  console.log(`   Project: ${project.name} (${project.id})`);

  // 5. Insert phases
  console.log("5. Inserting phases...");
  const phaseRows = phases.map((p) => ({
    project_id: project.id,
    slug: p.slug,
    name: p.name,
    phase_order: p.order,
    group: p.group,
    status: "not-started",
    progress: 0,
  }));

  const { data: insertedPhases, error: phaseErr } = await supabase
    .from("pm_phases")
    .insert(phaseRows)
    .select("id, slug");

  if (phaseErr || !insertedPhases) {
    console.error("Failed to insert phases:", phaseErr?.message);
    process.exit(1);
  }
  console.log(`   Phases inserted: ${insertedPhases.length}`);

  // Build slug → id map
  const phaseMap = new Map(insertedPhases.map((p) => [p.slug, p.id]));

  // 6. Insert tasks
  console.log("6. Inserting tasks...");
  const taskRows: {
    project_id: string;
    phase_id: string | null;
    slug: string;
    name: string;
    description: string | null;
    status: string;
    subtasks: { text: string; done: boolean }[];
  }[] = [];

  for (const phase of phases) {
    const phaseId = phaseMap.get(phase.slug) ?? null;
    for (const task of phase.tasks) {
      taskRows.push({
        project_id: project.id,
        phase_id: phaseId,
        slug: task.slug,
        name: task.name,
        description: task.description ?? null,
        status: "not-started",
        subtasks: task.subtasks ?? [],
      });
    }
  }

  const { error: taskErr } = await supabase.from("pm_tasks").insert(taskRows);

  if (taskErr) {
    console.error("Failed to insert tasks:", taskErr.message);
    process.exit(1);
  }
  console.log(`   Tasks inserted: ${taskRows.length}`);

  // ─── Summary ──────────────────────────────────────────────────────────
  const mainPhases = phases.filter((p) => p.group !== "SUPPORT");
  const supportPhases = phases.filter((p) => p.group === "SUPPORT");
  const deptTasks = phases
    .find((p) => p.slug === "p3-department-discovery")
    ?.tasks.length ?? 0;
  const supportTasks = supportPhases.reduce((s, p) => s + p.tasks.length, 0);

  console.log("\n=== BACKFILL SUMMARY ===");
  console.log(`Client:               ${org.name} (${org.slug})`);
  console.log(`Project:              ${project.name} (${project.slug})`);
  console.log(`Template:             ${PROJECT.template_slug}`);
  console.log(`Total phases:         ${insertedPhases.length} (${mainPhases.length} main + ${supportPhases.length} support)`);
  console.log(`Total tasks:          ${taskRows.length}`);
  console.log(`  Departments (P3):   ${deptTasks} (each with 7-layer subtasks)`);
  console.log(`  Support items:      ${supportTasks}`);
  console.log(`All statuses:         not-started`);
  console.log("");
  console.log("Field mapping notes:");
  console.log("  - Phase groups: DISCOVERY (P0-P2), DEEP-DIVE (P3), IMPLEMENTATION (P4-P6), SUPPORT (S1-S4)");
  console.log("  - Phase 3 departments: Each department is a task with 7 discovery layers as subtasks JSONB");
  console.log("  - Support sections: Mapped as phases with group='SUPPORT' (order 7-10)");
  console.log("  - No fields had missing matches — all data fits existing schema cleanly");
  console.log("\n=== Done ===");
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
