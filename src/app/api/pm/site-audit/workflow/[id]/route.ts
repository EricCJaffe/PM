import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/pm/site-audit/workflow/[id] — Get workflow detail with project data.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("pm_audit_workflows")
      .select(`
        *,
        pm_projects(id, name, slug, status),
        pm_site_audits!pm_audit_workflows_audit_id_fkey(id, url, overall, scores, gaps, recommendations, quick_wins, pages_to_build, created_at)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Also fetch project phases + task completion stats
    if (data.project_id) {
      const { data: phases } = await supabase
        .from("pm_phases")
        .select("id, name, slug, status, phase_order, progress")
        .eq("project_id", data.project_id)
        .order("phase_order");

      const { count: totalTasks } = await supabase
        .from("pm_tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", data.project_id);

      const { count: completeTasks } = await supabase
        .from("pm_tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", data.project_id)
        .eq("status", "complete");

      return NextResponse.json({
        ...data,
        phases: phases || [],
        task_stats: {
          total: totalTasks || 0,
          complete: completeTasks || 0,
          progress: totalTasks ? Math.round(((completeTasks || 0) / totalTasks) * 100) : 0,
        },
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pm/site-audit/workflow/[id] — Update workflow (status, target_scores, config).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = createServiceClient();

    const allowed = ["status", "target_scores", "config", "current_score", "latest_audit_id"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const { data, error } = await supabase
      .from("pm_audit_workflows")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pm/site-audit/workflow/[id] — Delete a workflow.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("pm_audit_workflows")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
