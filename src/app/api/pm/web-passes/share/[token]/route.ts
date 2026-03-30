import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/web-passes/share/[token] — public: load pass by share token
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: pass, error } = await supabase
    .from("pm_web_passes")
    .select("id, pass_number, pass_type, status, form_data, deliverable_html, deliverable_html_b, selected_option, org_id, project_id")
    .eq("share_token", token)
    .single();

  if (error || !pass) {
    return NextResponse.json({ error: "Review link not found or expired" }, { status: 404 });
  }

  // Load org name for display
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("name, slug")
    .eq("id", pass.org_id)
    .single();

  // Load existing comments
  const { data: comments } = await supabase
    .from("pm_web_pass_comments")
    .select("*")
    .eq("pass_id", pass.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ pass, org, comments: comments ?? [] });
}

// POST /api/pm/web-passes/share/[token] — public: submit section comments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { section_id, section_label, feedback_type, comment, commenter_name, commenter_email, selected_option } = body;

  const supabase = createServiceClient();

  // Resolve pass by token
  const { data: pass, error: passError } = await supabase
    .from("pm_web_passes")
    .select("id, status")
    .eq("share_token", token)
    .single();

  if (passError || !pass) {
    return NextResponse.json({ error: "Review link not found" }, { status: 404 });
  }

  // If client is selecting a mockup option (Pass 1)
  if (selected_option) {
    await supabase
      .from("pm_web_passes")
      .update({ selected_option })
      .eq("id", pass.id);
    return NextResponse.json({ success: true, action: "option_selected" });
  }

  // Otherwise add a section comment
  if (!section_id || !feedback_type) {
    return NextResponse.json({ error: "section_id and feedback_type required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pm_web_pass_comments")
    .insert({
      pass_id: pass.id,
      section_id,
      section_label: section_label ?? null,
      feedback_type,
      comment: comment ?? null,
      commenter_name: commenter_name ?? null,
      commenter_email: commenter_email ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
