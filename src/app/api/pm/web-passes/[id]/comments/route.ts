import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/web-passes/[id]/comments
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_web_pass_comments")
    .select("*")
    .eq("pass_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/pm/web-passes/[id]/comments — add a section comment (internal or public)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { section_id, section_label, feedback_type, comment, commenter_name, commenter_email } = body;

  if (!section_id || !feedback_type) {
    return NextResponse.json({ error: "section_id and feedback_type required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_web_pass_comments")
    .insert({
      pass_id: id,
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

// PATCH /api/pm/web-passes/[id]/comments — resolve a comment by comment id
export async function PATCH(
  request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  const body = await request.json();
  const { comment_id, is_resolved, resolved_by } = body;
  if (!comment_id) return NextResponse.json({ error: "comment_id required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_web_pass_comments")
    .update({
      is_resolved: is_resolved ?? true,
      resolved_by: resolved_by ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", comment_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
