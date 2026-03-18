import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get("org_id");
    if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_documents").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
    if (error) {
      console.error("Documents GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("Documents GET exception:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const orgId = formData.get("org_id") as string;
    const title = formData.get("title") as string;
    const file = formData.get("file") as File;
    if (!orgId || !title || !file) return NextResponse.json({ error: "org_id, title, and file required" }, { status: 400 });

    const supabase = createServiceClient();

    const baseSlug = slugify(title);
    let slug = baseSlug;
    let attempt = 0;
    while (attempt < 20) {
      const { data: conflict } = await supabase
        .from("pm_documents").select("id").eq("org_id", orgId).eq("slug", slug).maybeSingle();
      if (!conflict) break;
      attempt++;
      slug = `${baseSlug}-${attempt + 1}`;
    }

    // Upload file to Supabase Storage
    const storagePath = `documents/${orgId}/${slug}-${file.name}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("vault")
      .upload(storagePath, bytes, { contentType: file.type, upsert: true });
    if (uploadError) {
      console.error("Document upload error:", uploadError);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data, error } = await supabase.from("pm_documents").insert({
      org_id: orgId,
      slug,
      title,
      category: (formData.get("category") as string) || "document",
      department: (formData.get("department") as string) || null,
      description: (formData.get("description") as string) || null,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      uploaded_by: (formData.get("uploaded_by") as string) || null,
      project_id: (formData.get("project_id") as string) || null,
    }).select().single();

    if (error) {
      console.error("Document DB insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("Document POST exception:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
