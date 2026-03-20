import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateApiKey, hasPermission, hasOrgAccess } from "@/lib/api-auth";

// GET /api/pm/ext/notes?org_id=...&note_type=...&limit=...
export async function GET(request: NextRequest) {
  const key = await validateApiKey(request.headers.get("authorization"));
  if (!key) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  if (!hasPermission(key, "read", "notes")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const orgId = searchParams.get("org_id");
  const noteType = searchParams.get("note_type");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  if (!orgId) return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  if (!hasOrgAccess(key, orgId)) return NextResponse.json({ error: "No access to this organization" }, { status: 403 });

  const supabase = createServiceClient();
  let query = supabase
    .from("pm_client_notes")
    .select("id, org_id, title, body, note_type, author, is_pinned, created_at, updated_at")
    .eq("org_id", orgId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (noteType) query = query.eq("note_type", noteType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notes: data ?? [], count: data?.length ?? 0 });
}

// POST /api/pm/ext/notes — create a client note
export async function POST(request: NextRequest) {
  const key = await validateApiKey(request.headers.get("authorization"));
  if (!key) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  if (!hasPermission(key, "write", "notes")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

  const body = await request.json();
  const { org_id, title, body: noteBody, note_type, author } = body;

  if (!org_id || !title) {
    return NextResponse.json({ error: "org_id and title are required" }, { status: 400 });
  }
  if (!hasOrgAccess(key, org_id)) {
    return NextResponse.json({ error: "No access to this organization" }, { status: 403 });
  }

  const validTypes = ["general", "meeting", "phone-call", "follow-up"];
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("pm_client_notes")
    .insert({
      org_id,
      title,
      body: noteBody || null,
      note_type: validTypes.includes(note_type) ? note_type : "general",
      author: author || key.name, // default to API key name as author
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ note: data }, { status: 201 });
}
