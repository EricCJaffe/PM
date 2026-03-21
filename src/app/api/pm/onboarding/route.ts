import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST: Create an onboarding project for a client org.
 *
 * This creates a project with project_type = 'onboarding' and populates
 * the discovery phase with tasks based on the engagement type.
 * The onboarding project lives under the client tab and feeds into
 * the main process project.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      org_id,
      engagement_id,
      name,
      owner,
      template_slug,
      engagement_type,
    } = body;

    if (!org_id || !owner) {
      return NextResponse.json(
        { error: "org_id and owner are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get org for slug
    const { data: org } = await supabase
      .from("pm_organizations")
      .select("slug, name")
      .eq("id", org_id)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const projectName = name ?? `${org.name} — Onboarding`;
    const projectSlug = projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);

    // Create the onboarding project
    const { data: project, error: projectError } = await supabase
      .from("pm_projects")
      .insert({
        org_id,
        slug: projectSlug,
        name: projectName,
        description: `Onboarding project for ${org.name}`,
        owner,
        template_slug: template_slug ?? "ministry-discovery",
        start_date: new Date().toISOString().split("T")[0],
        status: "active",
        project_type: "onboarding",
        onboarding_status: "discovery",
        engagement_id: engagement_id ?? null,
      })
      .select()
      .single();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    // Create the discovery phase
    const { data: discoveryPhase } = await supabase
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

    // Populate discovery tasks based on engagement type
    // Cross-reference engagement task templates for the 'qualified' and 'discovery_complete' stages
    const discoveryTasks = getDiscoveryTasksForType(engagement_type ?? "new_prospect");

    if (discoveryPhase) {
      const taskInserts = discoveryTasks.map((task, idx) => ({
        project_id: project.id,
        phase_id: discoveryPhase.id,
        org_id,
        slug: task.slug,
        name: task.name,
        description: task.description,
        status: "not-started" as const,
        sort_order: idx,
        owner,
        engagement_id: engagement_id ?? null,
      }));

      if (taskInserts.length > 0) {
        await supabase.from("pm_tasks").insert(taskInserts);
      }
    }

    // Create default onboarding checklist
    const checklistItems = getDefaultOnboardingChecklist();
    const checklistInserts = checklistItems.map((item, idx) => ({
      org_id,
      project_id: project.id,
      engagement_id: engagement_id ?? null,
      category: item.category,
      title: item.title,
      description: item.description,
      sort_order: idx,
      is_required: item.is_required,
    }));

    if (checklistInserts.length > 0) {
      await supabase.from("pm_onboarding_checklists").insert(checklistInserts);
    }

    return NextResponse.json({
      project,
      discovery_phase: discoveryPhase,
      tasks_created: discoveryTasks.length,
      checklist_items: checklistInserts.length,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/** Generate discovery tasks based on engagement type */
function getDiscoveryTasksForType(engagementType: string) {
  const baseTasks = [
    { slug: "schedule-discovery-kickoff", name: "Schedule discovery kickoff meeting", description: "Set up initial discovery session with client stakeholders" },
    { slug: "gather-org-background", name: "Gather organizational background", description: "Collect org history, structure, mission, and current state" },
    { slug: "identify-departments", name: "Identify departments and key contacts", description: "Map out all departments and their primary contacts" },
    { slug: "review-existing-docs", name: "Review existing documentation", description: "Collect and review any existing SOPs, org charts, process docs" },
    { slug: "conduct-leadership-interviews", name: "Conduct leadership interviews", description: "Interview senior leadership about vision, goals, and pain points" },
  ];

  // Add type-specific tasks
  if (engagementType === "new_prospect") {
    baseTasks.push(
      { slug: "assess-current-systems", name: "Assess current systems and tools", description: "Inventory all software, tools, and platforms currently in use" },
      { slug: "map-current-processes", name: "Map current processes per department", description: "Document how each department currently operates" },
      { slug: "identify-pain-points", name: "Identify pain points and bottlenecks", description: "Document frustrations, inefficiencies, and blockers" },
      { slug: "vision-alignment-workshop", name: "Conduct vision alignment workshop", description: "Facilitate workshop to align on organizational vision and goals" },
      { slug: "prepare-gap-analysis", name: "Prepare gap analysis report", description: "Compile findings into structured gap analysis" },
    );
  } else {
    // existing_client
    baseTasks.push(
      { slug: "review-previous-engagement", name: "Review previous engagement outcomes", description: "Analyze results from prior work together" },
      { slug: "assess-changes-since-last", name: "Assess changes since last engagement", description: "Document what has changed organizationally" },
      { slug: "identify-new-needs", name: "Identify new needs and opportunities", description: "Discover new areas where support is needed" },
    );
  }

  return baseTasks;
}

/** Default onboarding checklist items */
function getDefaultOnboardingChecklist() {
  return [
    { category: "discovery", title: "Complete discovery kickoff meeting", description: "Initial meeting with key stakeholders", is_required: true },
    { category: "discovery", title: "Department interviews scheduled", description: "All department discovery interviews on calendar", is_required: true },
    { category: "discovery", title: "Current state documented", description: "Existing processes, systems, and tools inventoried", is_required: true },
    { category: "discovery", title: "Gap analysis completed", description: "Gaps identified and prioritized", is_required: true },
    { category: "setup", title: "Client portal access configured", description: "External user accounts created and portal settings configured", is_required: true },
    { category: "setup", title: "Project workspace created", description: "Vault structure and project boards set up", is_required: true },
    { category: "kickoff", title: "SOW/proposal signed", description: "Engagement terms agreed and documented", is_required: true },
    { category: "kickoff", title: "Project kickoff meeting held", description: "Formal kickoff with full team", is_required: true },
    { category: "documentation", title: "Client contact list finalized", description: "All key contacts with roles documented", is_required: false },
    { category: "documentation", title: "Communication plan established", description: "Meeting cadence, channels, and escalation path defined", is_required: false },
    { category: "handoff", title: "Onboarding summary delivered", description: "Summary of discovery findings and project plan delivered to client", is_required: true },
    { category: "handoff", title: "Process project created", description: "Main process project created from onboarding findings", is_required: true },
  ];
}
