import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** GET: Get portal settings for an org */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org_id");
  if (!orgId) {
    return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_portal_settings")
    .select("*")
    .eq("org_id", orgId)
    .single();

  // Return defaults if none configured
  if (!data) {
    return NextResponse.json({
      org_id: orgId,
      show_projects: true,
      show_phases: true,
      show_tasks: true,
      show_risks: false,
      show_process_maps: true,
      show_kpis: true,
      show_documents: true,
      show_proposals: true,
      show_reports: false,
      show_daily_logs: false,
      show_engagements: false,
      show_kb_articles: true,
      allow_task_comments: true,
      allow_file_uploads: false,
      allow_chat: false,
      portal_title: null,
      welcome_message: null,
      primary_color: null,
    });
  }

  return NextResponse.json(data);
}

/** POST: Create or update portal settings (upsert) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, ...settings } = body;

    if (!org_id) {
      return NextResponse.json({ error: "org_id is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if settings exist
    const { data: existing } = await supabase
      .from("pm_portal_settings")
      .select("id")
      .eq("org_id", org_id)
      .single();

    if (existing) {
      // Update
      const { data, error } = await supabase
        .from("pm_portal_settings")
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq("org_id", org_id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    } else {
      // Insert
      const { data, error } = await supabase
        .from("pm_portal_settings")
        .insert({ org_id, ...settings })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
