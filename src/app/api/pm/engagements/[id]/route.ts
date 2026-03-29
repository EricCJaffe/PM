import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { onEngagementStageChange } from "@/lib/engagement-engine";

// GET /api/pm/engagements/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_engagements")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/pm/engagements/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const allowed = [
    "title", "type", "engagement_type", "deal_stage",
    "projected_mrr", "projected_one_time", "owner",
    "website_url", "notes", "assigned_to", "estimated_value",
    "probability_override", "expected_close_date", "closed_reason",
    "discovery_notes", "referral_source",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const supabase = createServiceClient();

  // Load current state before update (to detect stage change)
  const { data: current } = await supabase
    .from("pm_engagements")
    .select("deal_stage")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("pm_engagements")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire stage-change automation for any stage transition (non-blocking)
  if (current && body.deal_stage && current.deal_stage !== body.deal_stage) {
    onEngagementStageChange(supabase, id, current.deal_stage as string, body.deal_stage as string).catch(
      (err) => console.error("[engagement-engine]", err)
    );
  }

  return NextResponse.json(data);
}

// DELETE /api/pm/engagements/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from("pm_engagements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
