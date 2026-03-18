import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/document-types — list active document types
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("document_types")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// POST /api/pm/document-types — create/update a document type (admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, name, description, category, html_template, css_styles, header_html, footer_html, variables, is_active } = body;

    if (!slug || !name) {
      return NextResponse.json({ error: "slug and name are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("document_types")
      .upsert(
        {
          slug,
          name,
          description: description || null,
          category: category || "proposal",
          html_template: html_template || "",
          css_styles: css_styles || "",
          header_html: header_html || "",
          footer_html: footer_html || "",
          variables: variables || {},
          is_active: is_active !== false,
        },
        { onConflict: "slug" }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
