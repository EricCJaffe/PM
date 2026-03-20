import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { spawnEngagementTasks } from "@/lib/engagement-engine";

// GET /api/pm/engagements?org_id=...
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org_id");
  if (!orgId) return NextResponse.json({ error: "org_id is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_engagements")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/pm/engagements — create a new engagement
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, title, type, deal_stage, assigned_to, estimated_value, expected_close_date, engagement_type, referral_source, discovery_notes } = body;

    if (!org_id) return NextResponse.json({ error: "org_id is required" }, { status: 400 });

    const supabase = createServiceClient();

    // Determine starting stage based on engagement type
    const startStage = (type === "existing_client") ? "discovery_complete" : (deal_stage || "lead");

    const { data, error } = await supabase
      .from("pm_engagements")
      .insert({
        org_id,
        title: title || "Initial Engagement",
        type: type || "new_prospect",
        deal_stage: startStage,
        assigned_to: assigned_to || null,
        estimated_value: estimated_value || null,
        expected_close_date: expected_close_date || null,
        engagement_type: engagement_type || null,
        referral_source: referral_source || null,
        discovery_notes: discovery_notes || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-spawn tasks for the starting stage
    await spawnEngagementTasks(data.id, startStage, data.type, data.assigned_to);

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
