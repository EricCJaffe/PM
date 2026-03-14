import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  // Get the storage path before deleting
  const { data: doc } = await supabase.from("pm_documents").select("storage_path").eq("id", id).single();
  if (doc) {
    await supabase.storage.from("vault").remove([doc.storage_path]);
  }

  const { error } = await supabase.from("pm_documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
