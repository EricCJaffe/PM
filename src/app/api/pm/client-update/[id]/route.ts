import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/client-update/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authClient = await createServerSupabase();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_client_notes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/pm/client-update/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authClient = await createServerSupabase();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Don't allow editing sent notes
  const { data: existing } = await supabase
    .from("pm_client_notes")
    .select("status")
    .eq("id", id)
    .single();

  if (existing?.status === "sent") {
    return NextResponse.json({ error: "Cannot edit a sent update" }, { status: 400 });
  }

  // Only allow safe fields to be updated
  const updates: Record<string, unknown> = {};
  if (body.body !== undefined) updates.body = body.body;
  if (body.subject !== undefined) updates.subject = body.subject;
  if (body.sent_to_email !== undefined) updates.sent_to_email = body.sent_to_email;
  if (body.sent_to_name !== undefined) updates.sent_to_name = body.sent_to_name;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pm_client_notes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
