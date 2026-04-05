import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/pm/process-discovery/[id]/approve-opportunity
 *
 * Approves an automation opportunity and optionally creates a project for it.
 * Also supports declining opportunities.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // workflow id
    const { opportunity_id, action, create_project } = await request.json() as {
      opportunity_id: string;
      action: "approve" | "decline" | "defer";
      create_project?: boolean;
    };

    if (!opportunity_id || !action) {
      return NextResponse.json({ error: "opportunity_id and action required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify workflow exists
    const { data: workflow } = await supabase
      .from("pm_audit_workflows")
      .select("org_id, project_id")
      .eq("id", id)
      .single();

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Fetch opportunity
    const { data: opp } = await supabase
      .from("pm_opportunities")
      .select("*")
      .eq("id", opportunity_id)
      .single();

    if (!opp) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    if (action === "decline") {
      await supabase
        .from("pm_opportunities")
        .update({ status: "declined" })
        .eq("id", opportunity_id);

      return NextResponse.json({ success: true, action: "declined" });
    }

    if (action === "defer") {
      await supabase
        .from("pm_opportunities")
        .update({ status: "proposed" })
        .eq("id", opportunity_id);

      return NextResponse.json({ success: true, action: "deferred" });
    }

    // Approve
    const updates: Record<string, unknown> = { status: "approved" };

    // Optionally create a project for this opportunity
    if (create_project) {
      const { data: org } = await supabase
        .from("pm_organizations")
        .select("name, slug")
        .eq("id", workflow.org_id)
        .single();

      const projectName = `${org?.name || "Client"} — ${opp.title}`;
      const projectSlug = `opp-${opportunity_id.slice(0, 8)}-${Date.now()}`;

      const { data: project, error: projErr } = await supabase
        .from("pm_projects")
        .insert({
          name: projectName,
          slug: projectSlug,
          org_id: workflow.org_id,
          status: "active",
          description: `Automation project from opportunity: ${opp.title}\n\n${opp.description || ""}`,
        })
        .select()
        .single();

      if (projErr) {
        return NextResponse.json({ error: `Failed to create project: ${projErr.message}` }, { status: 500 });
      }

      updates.project_id = project.id;

      // Create initial phases for the implementation project
      const implPhases = [
        { name: "Requirements & Planning", slug: "requirements", order: 1 },
        { name: "Development & Build", slug: "development", order: 2 },
        { name: "Testing & QA", slug: "testing", order: 3 },
        { name: "Deployment & Training", slug: "deployment", order: 4 },
      ];

      for (const phase of implPhases) {
        const { data: p } = await supabase
          .from("pm_phases")
          .insert({
            project_id: project.id,
            name: phase.name,
            slug: phase.slug,
            status: "not-started",
            phase_order: phase.order,
            progress: 0,
          })
          .select()
          .single();

        if (p && phase.slug === "requirements") {
          // Add initial tasks
          await supabase.from("pm_tasks").insert([
            { project_id: project.id, phase_id: p.id, org_id: workflow.org_id, name: "Define detailed requirements", slug: "define-requirements", status: "not-started", sort_order: 1, description: opp.description },
            { project_id: project.id, phase_id: p.id, org_id: workflow.org_id, name: "Identify stakeholders and approvers", slug: "identify-stakeholders", status: "not-started", sort_order: 2 },
            { project_id: project.id, phase_id: p.id, org_id: workflow.org_id, name: "Estimate timeline and resources", slug: "estimate-timeline", status: "not-started", sort_order: 3 },
          ]);
        }
      }

      await supabase
        .from("pm_opportunities")
        .update({ ...updates, status: "in-progress" })
        .eq("id", opportunity_id);

      return NextResponse.json({
        success: true,
        action: "approved",
        project_id: project.id,
        project_name: projectName,
      });
    }

    // Approve without creating project
    await supabase
      .from("pm_opportunities")
      .update(updates)
      .eq("id", opportunity_id);

    return NextResponse.json({ success: true, action: "approved" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
