import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const allowed = ["name", "description", "status", "owner", "target_date", "start_date", "budget"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("pm_projects").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const [phases, tasks, risks] = await Promise.all([
    supabase.from("pm_phases").select("*", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("pm_tasks").select("*", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("pm_risks").select("*", { count: "exact", head: true }).eq("project_id", id),
  ]);

  return NextResponse.json({
    phases: phases.count ?? 0,
    tasks: tasks.count ?? 0,
    risks: risks.count ?? 0,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from("pm_projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
