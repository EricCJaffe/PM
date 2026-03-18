import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/document-types/[slug]/fields — get intake fields for a document type
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = createServiceClient();

    // Resolve document type id from slug
    const { data: docType, error: typeErr } = await supabase
      .from("document_types")
      .select("id")
      .eq("slug", slug)
      .single();

    if (typeErr || !docType) {
      return NextResponse.json({ error: "Document type not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("document_intake_fields")
      .select("*")
      .eq("document_type_id", docType.id)
      .order("sort_order");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
