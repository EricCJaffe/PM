import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTaskAssignmentEmail } from "@/lib/email";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const allowed = ["name", "status", "owner", "assigned_to", "due_date", "description", "phase_id", "sort_order", "subtasks", "notify_assignee", "is_exception", "series_id", "series_occurrence_date", "original_date", "org_id", "project_id", "estimated_cost", "actual_cost"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  const supabase = createServiceClient();

  // Task mobility: moving between personal / client / project
  if ("project_id" in body) {
    if (body.project_id) {
      // Moving to a project — derive org_id from the project
      const { data: proj } = await supabase.from("pm_projects").select("org_id").eq("id", body.project_id).single();
      if (proj) {
        updates.org_id = proj.org_id;
        updates.project_id = body.project_id;
      }
    } else {
      // Moving to client-level (org_id set) or personal (org_id null)
      updates.project_id = null;
      updates.phase_id = null;
      if (!body.org_id && !("org_id" in body)) {
        updates.org_id = null; // personal task
      }
    }
  }
  if ("org_id" in body && !body.project_id) {
    updates.org_id = body.org_id || null;
    if (!body.org_id) {
      updates.project_id = null;
      updates.phase_id = null;
    }
  }

  let { data, error } = await supabase.from("pm_tasks").update(updates).eq("id", id).select().single();

  // If update failed due to missing columns (migrations not applied), retry without them
  if (error && (error.message.includes("assigned_to") || error.message.includes("notify_assignee") || error.message.includes("subtasks"))) {
    delete updates.assigned_to;
    delete updates.notify_assignee;
    delete updates.subtasks;
    const retry = await supabase.from("pm_tasks").update(updates).eq("id", id).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If a series instance was marked complete, check for completion-based recurrence
  if (body.status === "complete" && data?.series_id) {
    try {
      const { data: series } = await supabase
        .from("pm_task_series")
        .select("recurrence_mode, is_paused")
        .eq("id", data.series_id)
        .single();
      if (series && series.recurrence_mode === "completion" && !series.is_paused) {
        // Update last_generated_date to today and trigger generation
        const today = new Date().toISOString().slice(0, 10);
        await supabase.from("pm_task_series").update({ last_generated_date: today }).eq("id", data.series_id);
        // Fire and forget — generate next instance
        const baseUrl = request.nextUrl.origin;
        fetch(`${baseUrl}/api/pm/series/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ series_id: data.series_id, horizon: 365 }),
        }).catch(() => {});
      }
    } catch {}
  }

  // Send email notification on save if notify_assignee is checked
  if (body.notify_assignee && data?.owner) {
    const { data: member } = await supabase
      .from("pm_members")
      .select("email, display_name")
      .eq("slug", data.owner)
      .limit(1)
      .single();

    if (member?.email) {
      let projectName: string | null = null;
      if (data.project_id) {
        const { data: proj } = await supabase.from("pm_projects").select("name").eq("id", data.project_id).single();
        projectName = proj?.name || null;
      }
      sendTaskAssignmentEmail({
        to: member.email,
        taskName: data.name,
        projectName,
        dueDate: data.due_date,
        description: data.description,
      }).catch((err) => console.error("[Email] Error:", err));
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const deleteSeries = searchParams.get("series") === "true";

  const supabase = createServiceClient();

  if (deleteSeries) {
    // Get the task's series_id first
    const { data: task } = await supabase.from("pm_tasks").select("series_id").eq("id", id).single();
    if (task?.series_id) {
      // Delete the entire series (cascades to exceptions, unlinks instances)
      await supabase.from("pm_tasks").delete().eq("series_id", task.series_id).neq("status", "complete");
      await supabase.from("pm_tasks").update({ series_id: null }).eq("series_id", task.series_id);
      await supabase.from("pm_task_series").delete().eq("id", task.series_id);
      return NextResponse.json({ success: true });
    }
  }

  const { error } = await supabase.from("pm_tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
