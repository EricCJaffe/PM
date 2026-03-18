import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateApiKey, hasPermission, hasOrgAccess } from "@/lib/api-auth";

// GET /api/pm/ext/context?org_id=... — Read-only context dump for AI agents
// Returns orgs, projects, members, phases, and recent tasks
export async function GET(request: NextRequest) {
  const key = await validateApiKey(request.headers.get("authorization"));
  if (!key) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get("org_id");

  const supabase = createServiceClient();

  // 1. Organizations
  let orgsQuery = supabase
    .from("pm_organizations")
    .select("id, slug, name, pipeline_status, contact_name, contact_email, city, state")
    .order("name");
  if (key.org_scope) {
    orgsQuery = orgsQuery.in("id", key.org_scope);
  }
  const { data: orgs } = await orgsQuery;

  // If org_id specified, get deeper context for that org
  if (orgId) {
    if (!hasOrgAccess(key, orgId)) {
      return NextResponse.json({ error: "No access to this organization" }, { status: 403 });
    }

    const [
      { data: projects },
      { data: members },
      { data: tasks },
      { data: notes },
    ] = await Promise.all([
      // Projects for this org
      hasPermission(key, "read", "projects")
        ? supabase
            .from("pm_projects")
            .select("id, slug, name, status, template_slug, created_at")
            .eq("org_id", orgId)
            .order("name")
        : Promise.resolve({ data: null }),
      // Members for this org
      hasPermission(key, "read", "members")
        ? supabase
            .from("pm_members")
            .select("slug, display_name, email, role")
            .eq("org_id", orgId)
            .order("display_name")
        : Promise.resolve({ data: null }),
      // Recent tasks for this org (last 50)
      hasPermission(key, "read", "tasks")
        ? supabase
            .from("pm_tasks")
            .select("id, slug, name, status, owner, assigned_to, due_date, project_id, org_id, created_at")
            .eq("org_id", orgId)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: null }),
      // Recent notes for this org
      hasPermission(key, "read", "notes")
        ? supabase
            .from("pm_client_notes")
            .select("id, title, note_type, author, created_at")
            .eq("org_id", orgId)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: null }),
    ]);

    // Get phases for projects if readable
    let phases = null;
    if (hasPermission(key, "read", "phases") && projects?.length) {
      const projectIds = projects.map((p: { id: string }) => p.id);
      const { data: phaseData } = await supabase
        .from("pm_phases")
        .select("id, slug, name, phase_order, group, status, progress, project_id")
        .in("project_id", projectIds)
        .order("phase_order");
      phases = phaseData;
    }

    return NextResponse.json({
      organization: orgs?.find((o: { id: string }) => o.id === orgId) || null,
      projects: projects ?? [],
      members: members ?? [],
      phases: phases ?? [],
      recent_tasks: tasks ?? [],
      recent_notes: notes ?? [],
      all_organizations: orgs ?? [],
    });
  }

  // No org_id — return high-level context
  // Also get site-level members (assignable across all orgs)
  let siteMembers = null;
  if (hasPermission(key, "read", "members")) {
    const { data } = await supabase
      .from("pm_members")
      .select("slug, display_name, email, role, org_id")
      .order("display_name");
    siteMembers = data;
  }

  return NextResponse.json({
    organizations: orgs ?? [],
    members: siteMembers ?? [],
  });
}
