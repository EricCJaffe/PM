import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/projects/[id]/notes — list notes for a project
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("pm_client_notes")
      .select("*")
      .eq("project_id", id)
      .not("note_type", "eq", "client-update") // client updates live in their own tab
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// POST /api/pm/projects/[id]/notes — create a note linked to this project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { org_id, title, body, note_type, author, pinned, visibility } = await request.json();

    if (!org_id || !title) {
      return NextResponse.json({ error: "org_id and title are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_client_notes")
      .insert({
        project_id: id,
        org_id,
        title,
        body: body || null,
        note_type: note_type || "general",
        visibility: visibility || "internal",
        author: author || null,
        pinned: pinned || false,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
