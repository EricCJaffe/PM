import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { spawnEngagementTasks } from "@/lib/engagement-engine";

// GET /api/pm/engagements/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("pm_engagements")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/pm/engagements/[id] — update engagement (including stage advance)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const supabase = createServiceClient();

  // Get current engagement to detect stage change
  const { data: current, error: fetchErr } = await supabase
    .from("pm_engagements")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !current) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  const allowedFields = [
    "title", "type", "deal_stage", "assigned_to", "estimated_value",
    "probability_override", "expected_close_date", "closed_reason",
    "discovery_notes", "engagement_type", "referral_source",
  ];
  for (const f of allowedFields) {
    if (body[f] !== undefined) updates[f] = body[f];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pm_engagements")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If deal_stage changed, spawn tasks for the new stage
  if (body.deal_stage && body.deal_stage !== current.deal_stage) {
    await spawnEngagementTasks(id, body.deal_stage, data.type, data.assigned_to);

    // Also update the org's pipeline_status to match the most advanced engagement
    await syncOrgPipelineStatus(supabase, current.org_id);

    // If closed_won, update client_status to 'client'
    if (body.deal_stage === "closed_won") {
      await supabase
        .from("pm_organizations")
        .update({ client_status: "client" })
        .eq("id", current.org_id);
    }
  }

  return NextResponse.json(data);
}

// DELETE /api/pm/engagements/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from("pm_engagements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ─── Helpers ────────────────────────────────────────────────────────

const STAGE_ORDER = ["lead", "qualified", "discovery_complete", "proposal_sent", "negotiation", "closed_won", "closed_lost"];

/** Sync org pipeline_status to the most advanced active engagement */
async function syncOrgPipelineStatus(supabase: ReturnType<typeof createServiceClient>, orgId: string) {
  const { data: engagements } = await supabase
    .from("pm_engagements")
    .select("deal_stage")
    .eq("org_id", orgId);

  if (!engagements?.length) return;

  // Find the most advanced stage (excluding closed_lost)
  let bestIdx = -1;
  for (const e of engagements) {
    const idx = STAGE_ORDER.indexOf(e.deal_stage);
    if (idx > bestIdx && e.deal_stage !== "closed_lost") bestIdx = idx;
  }

  if (bestIdx >= 0) {
    await supabase
      .from("pm_organizations")
      .update({ pipeline_status: STAGE_ORDER[bestIdx] })
      .eq("id", orgId);
  }
}
