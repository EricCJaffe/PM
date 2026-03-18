import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/proposal-templates
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_proposal_templates")
      .select("*")
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// POST /api/pm/proposal-templates — create or update template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, name, description, boilerplate, variable_fields, output_format } = body;

    if (!slug || !name) {
      return NextResponse.json({ error: "slug and name are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_proposal_templates")
      .upsert({
        slug,
        name,
        description: description || null,
        boilerplate: boilerplate || null,
        variable_fields: variable_fields || [],
        output_format: output_format || "markdown",
        updated_at: new Date().toISOString(),
      }, { onConflict: "slug" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
