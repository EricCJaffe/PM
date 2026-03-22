import { createServiceClient } from "@/lib/supabase/server";
import type { EngagementTaskTemplate } from "@/types/pm";

/**
 * Spawn tasks from engagement task templates when a deal enters a new stage.
 * Called when an engagement's deal_stage changes.
 */
export async function spawnEngagementTasks(
  engagementId: string,
  newStage: string,
  engagementType: string,
  assignedTo: string | null
) {
  const supabase = createServiceClient();

  // Get the engagement to know org_id
  const { data: engagement } = await supabase
    .from("pm_engagements")
    .select("org_id")
    .eq("id", engagementId)
    .single();

  if (!engagement) return;

  // Fetch active templates for this stage that match the engagement type
  const { data: templates } = await supabase
    .from("pm_engagement_task_templates")
    .select("*")
    .eq("trigger_stage", newStage)
    .eq("is_active", true)
    .or(`engagement_type.eq.both,engagement_type.eq.${engagementType}`)
    .order("sort_order");

  if (!templates?.length) return;

  // Build task records
  const now = new Date();
  const tasks = templates.map((tmpl: EngagementTaskTemplate) => {
    const dueDate = addBusinessDays(now, tmpl.due_offset_days);
    return {
      name: tmpl.title,
      description: tmpl.description,
      slug: slugify(tmpl.title),
      status: "not-started" as const,
      org_id: engagement.org_id,
      engagement_id: engagementId,
      assigned_to: assignedTo,
      owner: assignedTo,
      due_date: dueDate.toISOString().split("T")[0],
      nudge_after_days: tmpl.nudge_after_days,
      sort_order: tmpl.sort_order,
    };
  });

  // Insert all tasks
  await supabase.from("pm_tasks").insert(tasks);
}

/** Add business days (skip Saturday/Sunday) */
function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

/**
 * Check if an onboarding project should be created for this engagement.
 * Called when deal_stage transitions to 'qualified' (start of discovery process).
 * Returns the project ID if created, null otherwise.
 */
export async function maybeCreateOnboardingProject(
  engagementId: string,
  orgId: string,
  assignedTo: string | null,
  engagementType: string
): Promise<string | null> {
  const supabase = createServiceClient();

  // Check if an onboarding project already exists for this engagement
  const { data: existing } = await supabase
    .from("pm_projects")
    .select("id")
    .eq("org_id", orgId)
    .eq("project_type", "onboarding")
    .eq("engagement_id", engagementId)
    .limit(1);

  if (existing?.length) return existing[0].id;

  // Get org info for naming
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("name, slug")
    .eq("id", orgId)
    .single();

  if (!org) return null;

  const projectSlug = slugify(`${org.slug}-onboarding-${Date.now()}`);

  // Create onboarding project
  const { data: project, error } = await supabase
    .from("pm_projects")
    .insert({
      org_id: orgId,
      slug: projectSlug,
      name: `${org.name} — Onboarding`,
      description: `Discovery and onboarding project for ${org.name}`,
      owner: assignedTo ?? "unassigned",
      template_slug: "ministry-discovery",
      start_date: new Date().toISOString().split("T")[0],
      status: "active",
      project_type: "onboarding",
      onboarding_status: "discovery",
      engagement_id: engagementId,
    })
    .select()
    .single();

  if (error || !project) return null;

  // Create discovery phase
  const { data: phase } = await supabase
    .from("pm_phases")
    .insert({
      project_id: project.id,
      slug: "discovery",
      name: "Discovery",
      phase_order: 0,
      status: "in-progress",
      progress: 0,
    })
    .select()
    .single();

  if (!phase) return project.id;

  // Generate discovery tasks based on engagement type
  const tasks = generateDiscoveryTasks(engagementType);
  const taskInserts = tasks.map((t, idx) => ({
    project_id: project.id,
    phase_id: phase.id,
    org_id: orgId,
    slug: t.slug,
    name: t.name,
    description: t.description,
    status: "not-started" as const,
    sort_order: idx,
    owner: assignedTo,
    engagement_id: engagementId,
  }));

  if (taskInserts.length > 0) {
    await supabase.from("pm_tasks").insert(taskInserts);
  }

  return project.id;
}

/** Generate discovery tasks tailored to engagement type */
function generateDiscoveryTasks(engagementType: string) {
  const base = [
    { slug: "schedule-discovery-kickoff", name: "Schedule discovery kickoff meeting", description: "Set up initial discovery session with client stakeholders" },
    { slug: "gather-org-background", name: "Gather organizational background", description: "Collect org history, structure, mission, and current state" },
    { slug: "identify-departments", name: "Identify departments and key contacts", description: "Map out all departments and their primary contacts" },
    { slug: "review-existing-docs", name: "Review existing documentation", description: "Collect and review any existing SOPs, org charts, process docs" },
    { slug: "conduct-leadership-interviews", name: "Conduct leadership interviews", description: "Interview senior leadership about vision, goals, and pain points" },
  ];

  if (engagementType === "new_prospect") {
    base.push(
      { slug: "assess-current-systems", name: "Assess current systems and tools", description: "Inventory all software, tools, and platforms currently in use" },
      { slug: "map-current-processes", name: "Map current processes per department", description: "Document how each department currently operates" },
      { slug: "identify-pain-points", name: "Identify pain points and bottlenecks", description: "Document frustrations, inefficiencies, and blockers" },
      { slug: "vision-alignment-workshop", name: "Conduct vision alignment workshop", description: "Facilitate workshop to align on organizational vision and goals" },
      { slug: "prepare-gap-analysis", name: "Prepare gap analysis report", description: "Compile findings into structured gap analysis" },
    );
  } else {
    base.push(
      { slug: "review-previous-engagement", name: "Review previous engagement outcomes", description: "Analyze results from prior work together" },
      { slug: "assess-changes-since-last", name: "Assess changes since last engagement", description: "Document what has changed organizationally" },
      { slug: "identify-new-needs", name: "Identify new needs and opportunities", description: "Discover new areas where support is needed" },
    );
  }

  return base;
}

/** Generate a URL-safe slug from text */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
