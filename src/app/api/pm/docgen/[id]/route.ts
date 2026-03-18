import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/docgen/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("generated_documents")
      .select("*, document_types(name, slug, html_template, css_styles, header_html, footer_html)")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const dt = (data as Record<string, unknown>).document_types as Record<string, string> | null;
    return NextResponse.json({
      ...data,
      document_type_name: dt?.name ?? "",
      document_type_slug: dt?.slug ?? "",
      html_template: dt?.html_template ?? "",
      css_styles: dt?.css_styles ?? "",
      header_html: dt?.header_html ?? "",
      footer_html: dt?.footer_html ?? "",
      document_types: undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// PATCH /api/pm/docgen/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = createServiceClient();

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.status !== undefined) updates.status = body.status;
    if (body.intake_data !== undefined) updates.intake_data = body.intake_data;
    if (body.compiled_html !== undefined) updates.compiled_html = body.compiled_html;
    if (body.pdf_storage_path !== undefined) updates.pdf_storage_path = body.pdf_storage_path;
    if (body.org_id !== undefined) updates.org_id = body.org_id;
    if (body.project_id !== undefined) updates.project_id = body.project_id;

    const { data, error } = await supabase
      .from("generated_documents")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("document_activity").insert({
      document_id: id,
      action: "edited",
      details: { updated_fields: Object.keys(updates) },
    });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// DELETE /api/pm/docgen/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("generated_documents")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
