import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Default departments per vertical.
 * These are auto-created when a process discovery workflow starts.
 */
const VERTICAL_DEPARTMENTS: Record<string, string[]> = {
  church: [
    "Operations",
    "Communications & Marketing",
    "Finance & Stewardship",
    "Volunteer Management",
    "Donor Relations",
    "Programs & Ministry",
  ],
  nonprofit: [
    "Operations",
    "Programs & Services",
    "Development & Fundraising",
    "Marketing & Communications",
    "Finance & Accounting",
    "Volunteer Management",
  ],
  business: [
    "Operations",
    "Sales",
    "Marketing",
    "Finance & Accounting",
    "Human Resources",
    "Information Technology",
    "Customer Service",
  ],
  agency: [
    "Operations",
    "Client Services",
    "Creative & Design",
    "Marketing & Growth",
    "Finance",
    "Technology",
  ],
};

/**
 * POST /api/pm/process-discovery — Create a process discovery workflow.
 *
 * Input: { org_id, template_slug, vertical }
 * Creates: workflow, project from template, departments, department intake forms.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, template_slug, vertical } = body as {
      org_id: string;
      template_slug: string;
      vertical: string;
    };

    if (!org_id || !template_slug) {
      return NextResponse.json(
        { error: "org_id and template_slug are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get org info
    const { data: org } = await supabase
      .from("pm_organizations")
      .select("id, name, slug")
      .eq("id", org_id)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get template
    const { data: template } = await supabase
      .from("pm_project_templates")
      .select("*")
      .eq("slug", template_slug)
      .single();

    if (!template) {
      return NextResponse.json(
        { error: `Template "${template_slug}" not found` },
        { status: 404 }
      );
    }

    // Create project from template
    const projectName = `${org.name} — Process Discovery`;
    const projectSlug = `process-discovery-${org.slug}-${Date.now()}`;

    const { data: project, error: projErr } = await supabase
      .from("pm_projects")
      .insert({
        name: projectName,
        slug: projectSlug,
        org_id,
        template_id: template.id,
        project_type: "standard",
        status: "active",
      })
      .select()
      .single();

    if (projErr) {
      return NextResponse.json({ error: `Failed to create project: ${projErr.message}` }, { status: 500 });
    }

    // Create phases and tasks from template
    const phases = (template.phases || []) as Array<{
      order: number;
      slug: string;
      name: string;
      group?: string;
      tasks?: Array<{ slug: string; name: string; description?: string }>;
    }>;

    let totalTasks = 0;
    for (const phaseDef of phases) {
      const { data: phase } = await supabase
        .from("pm_phases")
        .insert({
          project_id: project.id,
          name: phaseDef.name,
          slug: phaseDef.slug,
          status: "not-started",
          phase_order: phaseDef.order,
          phase_group: phaseDef.group || null,
          progress: 0,
        })
        .select()
        .single();

      if (!phase) continue;

      const tasks = phaseDef.tasks || [];
      if (tasks.length > 0) {
        const taskRows = tasks.map((t: { slug: string; name: string; description?: string }, i: number) => ({
          project_id: project.id,
          phase_id: phase.id,
          org_id,
          name: t.name,
          slug: t.slug,
          description: t.description || null,
          status: "not-started",
          sort_order: i + 1,
        }));
        await supabase.from("pm_tasks").insert(taskRows);
        totalTasks += taskRows.length;
      }
    }

    // Create the workflow record
    const resolvedVertical = vertical || "business";
    const { data: workflow, error: wfErr } = await supabase
      .from("pm_audit_workflows")
      .insert({
        audit_id: null,
        org_id,
        project_id: project.id,
        workflow_type: "process_discovery",
        config: {
          vertical: resolvedVertical,
          template_slug,
          template_name: template.name,
        },
      })
      .select()
      .single();

    if (wfErr) {
      return NextResponse.json({ error: `Failed to create workflow: ${wfErr.message}` }, { status: 500 });
    }

    // Auto-create departments based on vertical (skip if they already exist)
    const deptNames = VERTICAL_DEPARTMENTS[resolvedVertical] || VERTICAL_DEPARTMENTS.business;
    const { data: existingDepts } = await supabase
      .from("pm_departments")
      .select("name")
      .eq("org_id", org_id);

    const existingNames = new Set((existingDepts || []).map((d: { name: string }) => d.name));
    const newDepts = deptNames.filter((name: string) => !existingNames.has(name));

    if (newDepts.length > 0) {
      const deptRows = newDepts.map((name: string, i: number) => ({
        org_id,
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""),
        sort_order: (existingDepts?.length || 0) + i + 1,
        is_active: true,
      }));
      await supabase.from("pm_departments").insert(deptRows);
    }

    // Fetch all active departments and create intake forms
    const { data: allDepts } = await supabase
      .from("pm_departments")
      .select("id, name")
      .eq("org_id", org_id)
      .eq("is_active", true);

    let intakeCount = 0;
    if (allDepts && allDepts.length > 0) {
      const intakeRows = allDepts.map((dept: { id: string; name: string }) => ({
        workflow_id: workflow.id,
        org_id,
        department_id: dept.id,
        status: "not-started",
        responses: {},
        pillar_scores: {},
      }));
      const { error: intakeErr } = await supabase.from("pm_department_intake").insert(intakeRows);
      if (!intakeErr) intakeCount = intakeRows.length;
    }

    return NextResponse.json({
      workflow,
      project_id: project.id,
      project_name: projectName,
      template_name: template.name,
      phases_created: phases.length,
      tasks_created: totalTasks,
      departments_created: newDepts.length,
      intake_forms_created: intakeCount,
    }, { status: 201 });
  } catch (err) {
    console.error("Process discovery creation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
