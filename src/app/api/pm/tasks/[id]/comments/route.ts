import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_task_comments")
    .select("*")
    .eq("task_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { author, body } = await request.json();
  if (!author || !body) return NextResponse.json({ error: "author and body required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_task_comments")
    .insert({ task_id: id, author, body })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { comment_id } = await request.json();
  if (!comment_id) return NextResponse.json({ error: "comment_id required" }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from("pm_task_comments").delete().eq("id", comment_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
