import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/notes/[id]/attachments
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_client_note_attachments")
      .select("*")
      .eq("note_id", id)
      .order("created_at");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// POST /api/pm/notes/[id]/attachments — upload file
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const storagePath = `notes/${id}/${Date.now()}-${file.name}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabase.storage
      .from("vault")
      .upload(storagePath, buffer, { contentType: file.type });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("pm_client_note_attachments")
      .insert({
        note_id: id,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// DELETE /api/pm/notes/[id]/attachments?attachment_id=...
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume params
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get("attachment_id");

    if (!attachmentId) {
      return NextResponse.json({ error: "attachment_id is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get storage path first
    const { data: att } = await supabase
      .from("pm_client_note_attachments")
      .select("storage_path")
      .eq("id", attachmentId)
      .single();

    if (att?.storage_path) {
      await supabase.storage.from("vault").remove([att.storage_path]);
    }

    const { error } = await supabase
      .from("pm_client_note_attachments")
      .delete()
      .eq("id", attachmentId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
