import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateRemediationPhases } from "@/lib/workflow-generator";
import type { SiteAudit } from "@/types/pm";

/**
 * POST /api/pm/site-audit/workflow/[id]/refresh-tasks
 * Diffs the latest audit against existing tasks and adds net-new tasks
 * for gaps that weren't in the original audit.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Fetch workflow
    const { data: workflow, error: wfErr } = await supabase
      .from("pm_audit_workflows")
      .select("*")
      .eq("id", id)
      .single();

    if (wfErr || !workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    if (workflow.workflow_type !== "remediation") {
      return NextResponse.json(
        { error: "Task refresh is only supported for remediation workflows" },
        { status: 400 }
      );
    }

    const latestAuditId = workflow.latest_audit_id;
    if (!latestAuditId) {
      return NextResponse.json(
        { error: "No re-audit found. Run a re-audit first." },
        { status: 400 }
      );
    }

    // Fetch latest audit
    const { data: latestAudit } = await supabase
      .from("pm_site_audits")
      .select("*")
      .eq("id", latestAuditId)
      .single();

    if (!latestAudit || latestAudit.status !== "complete") {
      return NextResponse.json(
        { error: "Latest audit is not complete yet" },
        { status: 400 }
      );
    }

    // Fetch existing task names for this project (to diff against)
    const { data: existingTasks } = await supabase
      .from("pm_tasks")
      .select("name")
      .eq("project_id", workflow.project_id);

    const existingNames = new Set((existingTasks || []).map((t: { name: string }) => t.name));

    // Generate new phases from latest audit
    const newPhases = generateRemediationPhases(latestAudit as unknown as SiteAudit);

    // Find tasks that don't exist yet
    let newTaskCount = 0;
    for (const phaseDef of newPhases) {
      const newTasks = phaseDef.tasks.filter((t) => !existingNames.has(t.name));
      if (newTasks.length === 0) continue;

      // Find the matching phase in the project
      const { data: phase } = await supabase
        .from("pm_phases")
        .select("id")
        .eq("project_id", workflow.project_id)
        .eq("slug", phaseDef.slug)
        .single();

      if (!phase) continue;

      // Get current max sort_order
      const { data: lastTask } = await supabase
        .from("pm_tasks")
        .select("sort_order")
        .eq("phase_id", phase.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      let nextOrder = (lastTask?.sort_order || 0) + 1;

      const taskRows = newTasks.map((t) => ({
        project_id: workflow.project_id,
        phase_id: phase.id,
        org_id: workflow.org_id,
        name: t.name,
        description: t.description,
        slug: t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
        status: "not-started",
        sort_order: nextOrder++,
      }));

      await supabase.from("pm_tasks").insert(taskRows);
      newTaskCount += taskRows.length;

      // Reactivate phase if it was marked complete
      if (phaseDef.tasks.length > 0) {
        await supabase
          .from("pm_phases")
          .update({ status: "in-progress" })
          .eq("id", phase.id)
          .eq("status", "complete");
      }
    }

    // Update workflow score
    const overall = latestAudit.overall as { score?: number } | null;
    if (overall?.score != null) {
      await supabase
        .from("pm_audit_workflows")
        .update({
          current_score: Math.round(overall.score),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    return NextResponse.json({
      success: true,
      new_tasks_added: newTaskCount,
      current_score: overall?.score ? Math.round(overall.score) : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
