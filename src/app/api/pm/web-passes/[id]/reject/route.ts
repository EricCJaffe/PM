import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// POST /api/pm/web-passes/[id]/reject — reject pass, send back to active for rework
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { rejection_reason, rejected_by } = body as {
    rejection_reason?: string;
    rejected_by?: string;
  };

  const supabase = createServiceClient();

  const { data: pass, error: passError } = await supabase
    .from("pm_web_passes")
    .select("id, status, pass_type")
    .eq("id", id)
    .single();

  if (passError || !pass) {
    return NextResponse.json({ error: "Pass not found" }, { status: 404 });
  }

  if (pass.status === "approved") {
    return NextResponse.json({ error: "Cannot reject an already-approved pass" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pm_web_passes")
    .update({
      status: "rejected",
      rejection_reason: rejection_reason ?? null,
      // Store rejected_by in notes field (approved_by is reserved for approvals)
      notes: rejected_by ? `Rejected by: ${rejected_by}` : null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
