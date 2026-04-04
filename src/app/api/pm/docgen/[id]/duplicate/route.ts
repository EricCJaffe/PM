import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/pm/docgen/[id]/duplicate
 *
 * Clone a document (intake + sections) as a new draft.
 * Useful for starting a new SOW/NDA/MSA from a previous deal's finalized version.
 *
 * Body (optional): { title } — override the title of the new doc
 * Returns: { id, title } of the new document
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const supabase = createServiceClient();

    // Load source document
    const { data: source, error: sourceErr } = await supabase
      .from("generated_documents")
      .select("*")
      .eq("id", id)
      .single();

    if (sourceErr || !source) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Load source sections
    const { data: sourceSections } = await supabase
      .from("document_sections")
      .select("*")
      .eq("document_id", id)
      .order("sort_order");

    const newTitle = body.title || `${source.title} (Copy)`;

    // Create new document
    const { data: newDoc, error: insertErr } = await supabase
      .from("generated_documents")
      .insert({
        document_type_id: source.document_type_id,
        org_id: source.org_id,
        project_id: source.project_id,
        title: newTitle,
        status: "draft",
        intake_data: source.intake_data,
        version: 1,
      })
      .select()
      .single();

    if (insertErr || !newDoc) {
      return NextResponse.json({ error: insertErr?.message ?? "Failed to create document" }, { status: 500 });
    }

    // Clone sections
    if (sourceSections?.length) {
      const newSections = sourceSections.map((s: Record<string, unknown>) => ({
        document_id: newDoc.id,
        section_key: s.section_key,
        title: s.title,
        content_html: s.content_html,
        sort_order: s.sort_order,
        is_locked: false, // reset locks on clone — all editable
        ai_generated: s.ai_generated,
      }));
      await supabase.from("document_sections").insert(newSections);
    }

    // Log activity on new doc
    await supabase.from("document_activity").insert({
      document_id: newDoc.id,
      action: "created",
      details: { cloned_from: id, source_title: source.title },
    });

    return NextResponse.json({ id: newDoc.id, title: newDoc.title });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
