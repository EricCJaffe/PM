import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateApiKey, hasPermission, hasOrgAccess } from "@/lib/api-auth";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

// GET /api/pm/ext/tasks?org_id=...&assigned_to=...&status=...&project_id=...
export async function GET(request: NextRequest) {
  const key = await validateApiKey(request.headers.get("authorization"));
  if (!key) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  if (!hasPermission(key, "read", "tasks")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const orgId = searchParams.get("org_id");
  const assignedTo = searchParams.get("assigned_to");
  const status = searchParams.get("status");
  const projectId = searchParams.get("project_id");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

  if (orgId && !hasOrgAccess(key, orgId)) {
    return NextResponse.json({ error: "No access to this organization" }, { status: 403 });
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("pm_tasks")
    .select("id, name, slug, description, status, owner, assigned_to, due_date, org_id, project_id, phase_id, created_at, updated_at")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (orgId) query = query.eq("org_id", orgId);
  if (assignedTo) query = query.or(`assigned_to.eq.${assignedTo},owner.eq.${assignedTo}`);
  if (status) query = query.eq("status", status);
  if (projectId) query = query.eq("project_id", projectId);

  // Apply org scope from API key
  if (key.org_scope) {
    query = query.in("org_id", key.org_scope);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tasks: data ?? [], count: data?.length ?? 0 });
}

// POST /api/pm/ext/tasks — create a task
export async function POST(request: NextRequest) {
  const key = await validateApiKey(request.headers.get("authorization"));
  if (!key) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  if (!hasPermission(key, "write", "tasks")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

  const body = await request.json();
  const { name, description, status, owner, assigned_to, due_date, org_id, project_id } = body;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  if (org_id && !hasOrgAccess(key, org_id)) {
    return NextResponse.json({ error: "No access to this organization" }, { status: 403 });
  }

  const supabase = createServiceClient();
  let orgId = org_id || null;

  if (project_id) {
    const { data: proj } = await supabase.from("pm_projects").select("org_id").eq("id", project_id).single();
    if (!proj) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    orgId = proj.org_id;
    if (!hasOrgAccess(key, orgId)) {
      return NextResponse.json({ error: "No access to this project's organization" }, { status: 403 });
    }
  }

  const baseSlug = slugify(name);
  // Ensure unique slug
  const { data: existing } = await supabase
    .from("pm_tasks")
    .select("slug")
    .eq(project_id ? "project_id" : "org_id", project_id || orgId || "none")
    .like("slug", `${baseSlug}%`);
  const slug = existing && existing.length > 0 ? `${baseSlug}-${existing.length + 1}` : baseSlug;

  const insert: Record<string, unknown> = {
    name,
    slug,
    description: description || null,
    status: status || "not-started",
    owner: owner || assigned_to || null,
    assigned_to: assigned_to || owner || null,
    due_date: due_date || null,
    project_id: project_id || null,
    org_id: orgId,
  };

  const { data, error } = await supabase.from("pm_tasks").insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ task: data }, { status: 201 });
}

// PATCH /api/pm/ext/tasks — update a task by ID (pass { id, ...fields })
export async function PATCH(request: NextRequest) {
  const key = await validateApiKey(request.headers.get("authorization"));
  if (!key) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  if (!hasPermission(key, "write", "tasks")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const allowed = ["name", "status", "owner", "assigned_to", "due_date", "description", "org_id", "project_id"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in fields) updates[k] = fields[k];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.from("pm_tasks").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ task: data });
}
