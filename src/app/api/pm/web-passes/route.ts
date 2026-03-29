import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

// GET /api/pm/web-passes?project_id=... — list passes for a project
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("project_id");
  const orgId = request.nextUrl.searchParams.get("org_id");
  if (!projectId && !orgId) {
    return NextResponse.json({ error: "project_id or org_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("pm_web_passes")
    .select("*")
    .order("pass_number", { ascending: true });

  if (projectId) query = query.eq("project_id", projectId);
  else if (orgId) query = query.eq("org_id", orgId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/pm/web-passes — create a new pass (or full project pass set)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { project_id, org_id, pass_number, pass_type, form_data, site_audit_id } = body;

  if (!project_id || !org_id || pass_number === undefined || !pass_type) {
    return NextResponse.json(
      { error: "project_id, org_id, pass_number, pass_type required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Generate share token for client-facing review
  const share_token = randomBytes(20).toString("hex");

  const { data, error } = await supabase
    .from("pm_web_passes")
    .insert({
      project_id,
      org_id,
      pass_number,
      pass_type,
      status: pass_number === 0 ? "active" : "locked",
      form_data: form_data ?? {},
      site_audit_id: site_audit_id ?? null,
      share_token,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
