import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/pm/tasks/import
 *
 * Bulk-insert tasks from an external source (e.g., Asana CSV import).
 * Body: { tasks: Array<{ name, description, phase_id, project_id, org_id, due_date, status, source }> }
 * Returns: { tasks_created, skipped }
 */
export async function POST(request: NextRequest) {
  try {
    const { tasks } = await request.json();

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: "tasks array is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    let tasks_created = 0;
    let skipped = 0;

    const validStatuses = new Set(["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"]);

    for (const task of tasks) {
      const name = (task.name ?? "").trim();
      if (!name || !task.project_id) { skipped++; continue; }

      const { error } = await supabase.from("pm_tasks").insert({
        name,
        description: task.description || null,
        phase_id: task.phase_id || null,
        project_id: task.project_id,
        org_id: task.org_id || null,
        due_date: task.due_date || null,
        status: validStatuses.has(task.status) ? task.status : "not-started",
        sort_order: tasks_created,
      });

      if (error) { skipped++; continue; }
      tasks_created++;
    }

    return NextResponse.json({ tasks_created, skipped });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
