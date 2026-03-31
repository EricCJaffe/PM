import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/docgen?org_id=...&status=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    const status = searchParams.get("status");

    const supabase = createServiceClient();
    let query = supabase
      .from("generated_documents")
      .select("*, document_types(name, slug)")
      .order("updated_at", { ascending: false });

    if (orgId) query = query.eq("org_id", orgId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result = (data ?? []).map((d: Record<string, unknown>) => {
      const dt = d.document_types as { name: string; slug: string } | null;
      return {
        ...d,
        document_type_name: dt?.name ?? "",
        document_type_slug: dt?.slug ?? "",
        document_types: undefined,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// POST /api/pm/docgen — create a new generated document
export async function POST(request: NextRequest) {
  try {
    const { document_type_id, org_id, project_id, title, intake_data } = await request.json();

    if (!document_type_id || !title) {
      return NextResponse.json({ error: "document_type_id and title are required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .insert({
        document_type_id,
        org_id: org_id || null,
        project_id: project_id || null,
        title,
        status: "draft",
        intake_data: intake_data || {},
      })
      .select()
      .single();

    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });

    // Create default sections from document type variables
    const { data: docType } = await supabase
      .from("document_types")
      .select("variables")
      .eq("id", document_type_id)
      .single();

    if (docType?.variables) {
      const vars = docType.variables as { sections?: Array<{ section_key: string; title: string; sort_order: number; default_content?: string }> };
      if (vars.sections?.length) {
        const sections = vars.sections.map((s) => ({
          document_id: doc.id,
          section_key: s.section_key,
          title: s.title,
          sort_order: s.sort_order,
          content_html: s.default_content || "",
        }));
        await supabase.from("document_sections").insert(sections);
      }
    }

    await supabase.from("document_activity").insert({
      document_id: doc.id,
      action: "created",
      details: { title },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
