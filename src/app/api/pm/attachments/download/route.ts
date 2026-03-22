import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/pm/attachments/download?type=task|note|document&id=xxx
 *
 * Universal download endpoint — generates a signed URL for any attachment type.
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const id = request.nextUrl.searchParams.get("id");

  if (!type || !id) {
    return NextResponse.json({ error: "type and id are required" }, { status: 400 });
  }

  const tableMap: Record<string, { table: string; pathCol: string; nameCol: string }> = {
    task: { table: "pm_task_attachments", pathCol: "storage_path", nameCol: "file_name" },
    note: { table: "pm_client_note_attachments", pathCol: "storage_path", nameCol: "file_name" },
    document: { table: "pm_documents", pathCol: "storage_path", nameCol: "file_name" },
    engagement: { table: "pm_engagement_attachments", pathCol: "storage_path", nameCol: "file_name" },
  };

  const mapping = tableMap[type];
  if (!mapping) {
    return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: att } = await supabase
    .from(mapping.table)
    .select(`${mapping.pathCol}, ${mapping.nameCol}, content_type, mime_type`)
    .eq("id", id)
    .single();

  if (!att) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const storagePath = att[mapping.pathCol];
  const fileName = att[mapping.nameCol];
  const contentType = att.content_type || att.mime_type || "application/octet-stream";

  const { data: signedUrl } = await supabase.storage
    .from("vault")
    .createSignedUrl(storagePath, 3600);

  if (!signedUrl?.signedUrl) {
    return NextResponse.json({ error: "Could not generate download URL" }, { status: 500 });
  }

  return NextResponse.json({
    download_url: signedUrl.signedUrl,
    file_name: fileName,
    content_type: contentType,
    storage_path: storagePath,
  });
}
