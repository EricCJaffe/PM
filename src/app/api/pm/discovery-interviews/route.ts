import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** GET: List discovery interviews for an org */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org_id");
  const projectId = request.nextUrl.searchParams.get("project_id");
  const departmentId = request.nextUrl.searchParams.get("department_id");

  if (!orgId) {
    return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("pm_discovery_interviews")
    .select("*")
    .eq("org_id", orgId)
    .order("interview_date", { ascending: false });

  if (projectId) query = query.eq("project_id", projectId);
  if (departmentId) query = query.eq("department_id", departmentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST: Create a discovery interview */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      org_id, project_id, engagement_id, department_id, note_id,
      title, interviewee_name, interviewee_role, interview_date,
      duration_minutes, focus_areas, key_findings, action_items, summary, status,
    } = body;

    if (!org_id || !title) {
      return NextResponse.json(
        { error: "org_id and title are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_discovery_interviews")
      .insert({
        org_id,
        project_id: project_id ?? null,
        engagement_id: engagement_id ?? null,
        department_id: department_id ?? null,
        note_id: note_id ?? null,
        title,
        interviewee_name: interviewee_name ?? null,
        interviewee_role: interviewee_role ?? null,
        interview_date: interview_date ?? new Date().toISOString().split("T")[0],
        duration_minutes: duration_minutes ?? null,
        focus_areas: focus_areas ?? [],
        key_findings: key_findings ?? [],
        action_items: action_items ?? [],
        summary: summary ?? null,
        status: status ?? "scheduled",
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
