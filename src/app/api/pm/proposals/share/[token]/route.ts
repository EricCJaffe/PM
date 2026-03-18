import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/proposals/share/[token] — public shareable view (no auth)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = createServiceClient();

    const { data: proposal, error } = await supabase
      .from("pm_proposals")
      .select("*")
      .eq("share_token", token)
      .single();

    if (error || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    // Get org name for display
    const { data: org } = await supabase
      .from("pm_organizations")
      .select("name")
      .eq("id", proposal.org_id)
      .single();

    // Mark as viewed if not already
    if (!proposal.viewed_at) {
      await supabase
        .from("pm_proposals")
        .update({ viewed_at: new Date().toISOString(), status: "viewed" })
        .eq("id", proposal.id);
    }

    return NextResponse.json({
      id: proposal.id,
      title: proposal.title,
      status: proposal.status,
      generated_content: proposal.generated_content,
      org_name: org?.name || "Unknown",
      sent_at: proposal.sent_at,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// POST /api/pm/proposals/share/[token] — accept/decline proposal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { action } = await request.json();

    if (!["accepted", "rejected"].includes(action)) {
      return NextResponse.json({ error: "action must be 'accepted' or 'rejected'" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_proposals")
      .update({
        status: action,
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("share_token", token)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, status: data.status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
