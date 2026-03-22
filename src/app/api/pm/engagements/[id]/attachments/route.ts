import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/engagements/[id]/attachments
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_engagement_attachments")
    .select("*")
    .eq("engagement_id", id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/pm/engagements/[id]/attachments — upload a file
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const category = (formData.get("category") as string) || "general";
  const description = formData.get("description") as string | null;
  const uploadedBy = formData.get("uploaded_by") as string | null;

  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  const supabase = createServiceClient();

  // Get engagement to determine org for storage path
  const { data: engagement } = await supabase
    .from("pm_engagements")
    .select("org_id")
    .eq("id", id)
    .single();

  if (!engagement) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }

  // Get org slug for storage path
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("slug")
    .eq("id", engagement.org_id)
    .single();

  const orgSlug = org?.slug ?? "unknown";
  const storagePath = `${orgSlug}/engagements/${id}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from("vault")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data, error } = await supabase
    .from("pm_engagement_attachments")
    .insert({
      engagement_id: id,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type || null,
      storage_path: storagePath,
      category,
      description: description || null,
      uploaded_by: uploadedBy || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/pm/engagements/[id]/attachments
export async function DELETE(
  request: NextRequest,
) {
  const { attachment_id } = await request.json();
  if (!attachment_id) return NextResponse.json({ error: "attachment_id required" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: att } = await supabase
    .from("pm_engagement_attachments")
    .select("storage_path")
    .eq("id", attachment_id)
    .single();

  if (att?.storage_path) {
    await supabase.storage.from("vault").remove([att.storage_path]);
  }

  const { error } = await supabase.from("pm_engagement_attachments").delete().eq("id", attachment_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
