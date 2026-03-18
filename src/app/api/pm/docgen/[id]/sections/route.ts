import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/docgen/[id]/sections
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("document_sections")
      .select("*")
      .eq("document_id", id)
      .order("sort_order");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// PATCH /api/pm/docgen/[id]/sections — bulk update sections
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { sections } = await request.json();

    if (!Array.isArray(sections)) {
      return NextResponse.json({ error: "sections array is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    for (const section of sections) {
      if (section.id) {
        const updates: Record<string, unknown> = {};
        if (section.title !== undefined) updates.title = section.title;
        if (section.content_html !== undefined) updates.content_html = section.content_html;
        if (section.sort_order !== undefined) updates.sort_order = section.sort_order;
        if (section.is_locked !== undefined) updates.is_locked = section.is_locked;
        await supabase.from("document_sections").update(updates).eq("id", section.id);
      } else {
        await supabase.from("document_sections").insert({
          document_id: id,
          section_key: section.section_key,
          title: section.title,
          content_html: section.content_html || "",
          sort_order: section.sort_order || 0,
        });
      }
    }

    const { data } = await supabase
      .from("document_sections")
      .select("*")
      .eq("document_id", id)
      .order("sort_order");

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
