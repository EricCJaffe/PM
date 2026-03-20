import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/tasks/my?assigned_to=slug&org_id=uuid — all tasks assigned to a user
// Returns standalone tasks (project_id IS NULL), including client-level tasks
export async function GET(request: NextRequest) {
  const assignedTo = request.nextUrl.searchParams.get("assigned_to");
  const orgId = request.nextUrl.searchParams.get("org_id");

  const supabase = createServiceClient();

  let query = supabase
    .from("pm_tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (orgId) {
    // Filter by specific org
    query = query.eq("org_id", orgId);
    if (assignedTo) {
      query = query.or(`assigned_to.eq.${assignedTo},owner.eq.${assignedTo}`);
    }
  } else if (assignedTo) {
    // All tasks for this user (across all orgs + personal)
    query = query.or(`assigned_to.eq.${assignedTo},owner.eq.${assignedTo}`);
  } else {
    // All standalone tasks (no project)
    query = query.is("project_id", null);
  }

  let { data, error } = await query;

  // If the query failed (likely missing assigned_to column), retry with owner-only filter
  if (error && assignedTo) {
    const fallback = supabase
      .from("pm_tasks")
      .select("*")
      .eq("owner", assignedTo)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    const result = await fallback;
    data = result.data;
    error = result.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with project names and org names
  type TaskRow = { project_id: string | null; org_id: string | null; [key: string]: unknown };
  const tasks = (data ?? []) as TaskRow[];
  const projectIds = [...new Set(tasks.filter((t) => t.project_id).map((t) => t.project_id as string))];
  const orgIds = [...new Set(tasks.filter((t) => t.org_id).map((t) => t.org_id as string))];

  let projectMap: Record<string, { name: string; slug: string }> = {};
  let orgMap: Record<string, { name: string; slug: string }> = {};

  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("pm_projects")
      .select("id, name, slug")
      .in("id", projectIds);
    for (const p of projects ?? []) {
      projectMap[p.id] = { name: p.name, slug: p.slug };
    }
  }

  if (orgIds.length > 0) {
    const { data: orgs } = await supabase
      .from("pm_organizations")
      .select("id, name, slug")
      .in("id", orgIds);
    for (const o of orgs ?? []) {
      orgMap[o.id] = { name: o.name, slug: o.slug };
    }
  }

  const enriched = tasks.map((t) => ({
    ...t,
    project_name: t.project_id ? (projectMap[t.project_id]?.name || null) : null,
    project_slug: t.project_id ? (projectMap[t.project_id]?.slug || null) : null,
    org_name: t.org_id ? (orgMap[t.org_id]?.name || null) : null,
    org_slug: t.org_id ? (orgMap[t.org_id]?.slug || null) : null,
  }));

  return NextResponse.json(enriched);
}
