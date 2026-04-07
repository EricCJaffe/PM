import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/projects/[id]/documents — list documents with signed download URLs
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("pm_project_documents")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Generate signed URLs for each document
    const withUrls = await Promise.all(
      (data || []).map(async (doc: { storage_path: string; [key: string]: unknown }) => {
        const { data: signed } = await supabase.storage
          .from("vault")
          .createSignedUrl(doc.storage_path, 3600);
        return { ...doc, download_url: signed?.signedUrl || null };
      })
    );

    return NextResponse.json(withUrls);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// POST /api/pm/projects/[id]/documents — upload a document (multipart/form-data)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const orgId = formData.get("org_id") as string | null;
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const uploadedBy = formData.get("uploaded_by") as string | null;

    if (!file || !orgId) {
      return NextResponse.json({ error: "file and org_id are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const storagePath = `projects/${id}/documents/${Date.now()}-${file.name}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabase.storage
      .from("vault")
      .upload(storagePath, buffer, { contentType: file.type });

    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

    const { data, error } = await supabase
      .from("pm_project_documents")
      .insert({
        project_id: id,
        org_id: orgId,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type,
        storage_path: storagePath,
        title: title || null,
        description: description || null,
        uploaded_by: uploadedBy || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Return with signed URL
    const { data: signed } = await supabase.storage
      .from("vault")
      .createSignedUrl(storagePath, 3600);

    return NextResponse.json({ ...data, download_url: signed?.signedUrl || null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// DELETE /api/pm/projects/[id]/documents?document_id=...
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("document_id");

    if (!documentId) {
      return NextResponse.json({ error: "document_id is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch storage path before deleting
    const { data: doc } = await supabase
      .from("pm_project_documents")
      .select("storage_path")
      .eq("id", documentId)
      .single();

    if (doc?.storage_path) {
      await supabase.storage.from("vault").remove([doc.storage_path]);
    }

    const { error } = await supabase
      .from("pm_project_documents")
      .delete()
      .eq("id", documentId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
