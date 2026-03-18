import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/proposals?org_id=...&status=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    const status = searchParams.get("status");

    const supabase = createServiceClient();
    let query = supabase.from("pm_proposals").select("*").order("created_at", { ascending: false });

    if (orgId) query = query.eq("org_id", orgId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// POST /api/pm/proposals — create a draft proposal
export async function POST(request: NextRequest) {
  try {
    const { org_id, template_slug, title, form_data } = await request.json();

    if (!org_id || !title) {
      return NextResponse.json({ error: "org_id and title are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_proposals")
      .insert({
        org_id,
        template_slug: template_slug || null,
        title,
        status: "draft",
        form_data: form_data || {},
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
