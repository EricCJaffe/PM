import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkTablesExist } from "@/lib/db-check";

const REQUIRED_TABLES = ["pm_project_templates"];

// GET /api/pm/templates — list all templates
export async function GET() {
  const tableCheck = await checkTablesExist(REQUIRED_TABLES);
  if (tableCheck) return NextResponse.json(tableCheck, { status: 503 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_project_templates")
    .select("*")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/pm/templates — create a new template
export async function POST(request: NextRequest) {
  try {
    const tableCheck = await checkTablesExist(REQUIRED_TABLES);
    if (tableCheck) return NextResponse.json(tableCheck, { status: 503 });

    const { slug, name, description, phases } = await request.json();

    if (!slug || !name) {
      return NextResponse.json({ error: "slug and name are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_project_templates")
      .insert({ slug, name, description: description || "", phases: phases || [] })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: `Template slug '${slug}' already exists` }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// PUT /api/pm/templates — update a template
export async function PUT(request: NextRequest) {
  try {
    const tableCheck = await checkTablesExist(REQUIRED_TABLES);
    if (tableCheck) return NextResponse.json(tableCheck, { status: 503 });

    const { id, name, description, phases } = await request.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const supabase = createServiceClient();
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (phases !== undefined) updates.phases = phases;

    const { data, error } = await supabase
      .from("pm_project_templates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

// DELETE /api/pm/templates — delete a template
export async function DELETE(request: NextRequest) {
  try {
    const tableCheck = await checkTablesExist(REQUIRED_TABLES);
    if (tableCheck) return NextResponse.json(tableCheck, { status: 503 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("pm_project_templates")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
