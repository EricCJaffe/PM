import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** GET: List gap analysis items for an org (optionally filtered by project/department) */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org_id");
  const projectId = request.nextUrl.searchParams.get("project_id");
  const departmentId = request.nextUrl.searchParams.get("department_id");
  const status = request.nextUrl.searchParams.get("status");

  if (!orgId) {
    return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("pm_gap_analysis")
    .select("*")
    .eq("org_id", orgId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (projectId) query = query.eq("project_id", projectId);
  if (departmentId) query = query.eq("department_id", departmentId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST: Create a gap analysis item */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      org_id, project_id, engagement_id, department_id,
      category, title, current_state, desired_state, gap_description,
      severity, priority, discovered_by, source,
    } = body;

    if (!org_id || !category || !title) {
      return NextResponse.json(
        { error: "org_id, category, and title are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_gap_analysis")
      .insert({
        org_id,
        project_id: project_id ?? null,
        engagement_id: engagement_id ?? null,
        department_id: department_id ?? null,
        category,
        title,
        current_state: current_state ?? null,
        desired_state: desired_state ?? null,
        gap_description: gap_description ?? null,
        severity: severity ?? "medium",
        priority: priority ?? 0,
        discovered_by: discovered_by ?? null,
        source: source ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
