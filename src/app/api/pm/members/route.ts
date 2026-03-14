import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkTablesExist } from "@/lib/db-check";

const REQUIRED_TABLES = ["pm_members", "pm_organizations"];

// GET /api/pm/members?org_id=xxx — list members for an org
export async function GET(request: NextRequest) {
  const tableCheck = await checkTablesExist(REQUIRED_TABLES);
  if (tableCheck) {
    return NextResponse.json(tableCheck, { status: 503 });
  }

  const orgId = request.nextUrl.searchParams.get("org_id");

  if (!orgId) {
    return NextResponse.json({ error: "org_id query param is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_members")
    .select("*")
    .eq("org_id", orgId)
    .order("display_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/pm/members — add a member to an org
export async function POST(request: NextRequest) {
  try {
    const tableCheck = await checkTablesExist(REQUIRED_TABLES);
    if (tableCheck) {
      return NextResponse.json(tableCheck, { status: 503 });
    }

    const { org_id, slug, display_name, email, role } = await request.json();

    if (!org_id || !slug || !display_name) {
      return NextResponse.json(
        { error: "org_id, slug, and display_name are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_members")
      .insert({
        org_id,
        slug,
        display_name,
        email: email || null,
        role: role || "member",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `User '${slug}' already exists in this client` },
          { status: 409 }
        );
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

// PUT /api/pm/members — update a member
export async function PUT(request: NextRequest) {
  try {
    const tableCheck = await checkTablesExist(REQUIRED_TABLES);
    if (tableCheck) {
      return NextResponse.json(tableCheck, { status: 503 });
    }

    const { id, display_name, slug, email, role } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const updates: Record<string, unknown> = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (slug !== undefined) updates.slug = slug;
    if (email !== undefined) updates.email = email || null;
    if (role !== undefined) updates.role = role;

    const { data, error } = await supabase
      .from("pm_members")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `User slug '${slug}' already exists in this client` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

// DELETE /api/pm/members — remove a member
export async function DELETE(request: NextRequest) {
  try {
    const tableCheck = await checkTablesExist(REQUIRED_TABLES);
    if (tableCheck) {
      return NextResponse.json(tableCheck, { status: 503 });
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("pm_members")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
