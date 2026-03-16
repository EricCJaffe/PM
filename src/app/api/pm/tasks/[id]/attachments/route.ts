import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_task_attachments")
    .select("*")
    .eq("task_id", id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const uploadedBy = formData.get("uploaded_by") as string | null;

  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  const supabase = createServiceClient();

  // Upload to Supabase Storage
  const storagePath = `task-attachments/${id}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from("vault")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  // Create DB record
  const { data, error } = await supabase
    .from("pm_task_attachments")
    .insert({
      task_id: id,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type || null,
      storage_path: storagePath,
      uploaded_by: uploadedBy || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { attachment_id } = await request.json();
  if (!attachment_id) return NextResponse.json({ error: "attachment_id required" }, { status: 400 });

  const supabase = createServiceClient();

  // Get the storage path before deleting
  const { data: att } = await supabase
    .from("pm_task_attachments")
    .select("storage_path")
    .eq("id", attachment_id)
    .single();

  if (att?.storage_path) {
    await supabase.storage.from("vault").remove([att.storage_path]);
  }

  const { error } = await supabase.from("pm_task_attachments").delete().eq("id", attachment_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
