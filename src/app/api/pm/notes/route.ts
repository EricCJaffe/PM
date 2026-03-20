import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/notes?org_id=...&type=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    const noteType = searchParams.get("type");

    if (!orgId) {
      return NextResponse.json({ error: "org_id is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    let query = supabase
      .from("pm_client_notes")
      .select("*")
      .eq("org_id", orgId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (noteType) query = query.eq("note_type", noteType);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// POST /api/pm/notes — create a note
export async function POST(request: NextRequest) {
  try {
    const { org_id, title, body, note_type, author, pinned, visibility } = await request.json();

    if (!org_id || !title) {
      return NextResponse.json({ error: "org_id and title are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_client_notes")
      .insert({
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
