import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/engagements/[id]/attachments/download?attachment_id=xxx
export async function GET(request: NextRequest) {
  const attachmentId = request.nextUrl.searchParams.get("attachment_id");
  if (!attachmentId) {
    return NextResponse.json({ error: "attachment_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: att } = await supabase
    .from("pm_engagement_attachments")
    .select("storage_path, file_name")
    .eq("id", attachmentId)
    .single();

  if (!att) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const { data: signedUrl } = await supabase.storage
    .from("vault")
    .createSignedUrl(att.storage_path, 3600);

  if (!signedUrl?.signedUrl) {
    return NextResponse.json({ error: "Could not generate download URL" }, { status: 500 });
  }

  return NextResponse.json({ download_url: signedUrl.signedUrl, file_name: att.file_name });
}
