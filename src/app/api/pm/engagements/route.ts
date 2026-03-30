import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/engagements?org_id=...
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const org_id = searchParams.get("org_id");

  const supabase = createServiceClient();
  let query = supabase
    .from("pm_engagements")
    .select("*")
    .order("created_at", { ascending: false });

  if (org_id) query = query.eq("org_id", org_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/pm/engagements
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    org_id, title, type, engagement_type, deal_stage,
    projected_mrr, projected_one_time, owner,
    website_url, notes,
  } = body;

  if (!org_id || !title) {
    return NextResponse.json({ error: "org_id and title are required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_engagements")
    .insert({
      org_id,
      title,
      type: type ?? "new_prospect",
      engagement_type: engagement_type ?? null,
      deal_stage: deal_stage ?? "lead",
      projected_mrr: projected_mrr ?? null,
      projected_one_time: projected_one_time ?? null,
      owner: owner ?? null,
      website_url: website_url ?? null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
