import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkTablesExist } from "@/lib/db-check";

const REQUIRED_TABLES = ["pm_organizations"];

// GET /api/pm/organizations — list all orgs
export async function GET() {
  const tableCheck = await checkTablesExist(REQUIRED_TABLES);
  if (tableCheck) {
    return NextResponse.json(tableCheck, { status: 503 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_organizations")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/pm/organizations — create a new org
export async function POST(request: NextRequest) {
  try {
    const tableCheck = await checkTablesExist(REQUIRED_TABLES);
    if (tableCheck) {
      return NextResponse.json(tableCheck, { status: 503 });
    }

    const { name, slug } = await request.json();

    if (!name || !slug) {
      return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_organizations")
      .insert({ name, slug })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: `Organization slug '${slug}' already exists` }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
