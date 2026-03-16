import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/tasks/my?assigned_to=slug — all tasks assigned to a user
// Also returns standalone tasks (project_id IS NULL)
export async function GET(request: NextRequest) {
  const assignedTo = request.nextUrl.searchParams.get("assigned_to");

  const supabase = createServiceClient();

  let query = supabase
    .from("pm_tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (assignedTo) {
    // Tasks assigned to this user OR owned by them (across all projects + standalone)
    query = query.or(`assigned_to.eq.${assignedTo},owner.eq.${assignedTo}`);
  } else {
    // All standalone tasks (no project)
    query = query.is("project_id", null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with project names
  type TaskRow = { project_id: string | null; [key: string]: unknown };
  const projectIds = [...new Set((data ?? []).filter((t: TaskRow) => t.project_id).map((t: TaskRow) => t.project_id as string))];
  let projectMap: Record<string, string> = {};
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("pm_projects")
      .select("id, name, slug")
      .in("id", projectIds);
    for (const p of projects ?? []) {
      projectMap[p.id] = p.name;
    }
  }

  const enriched = (data ?? []).map((t: TaskRow) => ({
    ...t,
    project_name: t.project_id ? (projectMap[t.project_id] || null) : null,
  }));

  return NextResponse.json(enriched);
}
