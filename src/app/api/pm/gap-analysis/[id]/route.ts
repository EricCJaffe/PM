import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_gap_analysis")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Gap item not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createServiceClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowed = [
    "category", "title", "current_state", "desired_state", "gap_description",
    "severity", "priority", "status", "resolution_notes", "resolved_at",
    "task_id", "department_id",
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  // Auto-set resolved_at when status changes to resolved
  if (body.status === "resolved" && !body.resolved_at) {
    updates.resolved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("pm_gap_analysis")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("pm_gap_analysis")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
