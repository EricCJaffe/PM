import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// PATCH /api/pm/projects/[id]/notes/[noteId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { noteId } = await params;
    const body = await request.json();

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_client_notes")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", noteId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// DELETE /api/pm/projects/[id]/notes/[noteId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { noteId } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("pm_client_notes")
      .delete()
      .eq("id", noteId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
