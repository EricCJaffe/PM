import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// POST /api/pm/web-passes/[id]/approve — approve pass and unlock next
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { approved_by } = body;

  const supabase = createServiceClient();

  // Get the current pass
  const { data: pass, error: passError } = await supabase
    .from("pm_web_passes")
    .select("*")
    .eq("id", id)
    .single();

  if (passError || !pass) {
    return NextResponse.json({ error: "Pass not found" }, { status: 404 });
  }

  // Approve this pass
  await supabase
    .from("pm_web_passes")
    .update({
      status: "approved",
      approved_by: approved_by ?? null,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Unlock the next pass (pass_number + 1) if it exists
  const { data: nextPass } = await supabase
    .from("pm_web_passes")
    .select("id")
    .eq("project_id", pass.project_id)
    .eq("pass_number", pass.pass_number + 1)
    .single();

  if (nextPass) {
    await supabase
      .from("pm_web_passes")
      .update({ status: "active" })
      .eq("id", nextPass.id);
  }

  return NextResponse.json({ success: true, next_pass_unlocked: !!nextPass });
}
