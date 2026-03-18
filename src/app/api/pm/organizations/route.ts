import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkTablesExist } from "@/lib/db-check";
import { getUserOrgFilter } from "@/lib/auth";

const REQUIRED_TABLES = ["pm_organizations"];

// GET /api/pm/organizations — list orgs (filtered by user access)
export async function GET() {
  const tableCheck = await checkTablesExist(REQUIRED_TABLES);
  if (tableCheck) {
    return NextResponse.json(tableCheck, { status: 503 });
  }

  const supabase = createServiceClient();

  // Filter orgs based on user access
  // Internal users (admin/user): null = no filter, see all orgs
  // External users: array of org IDs they can access
  const orgFilter = await getUserOrgFilter();

  let query = supabase.from("pm_organizations").select("*");

  if (orgFilter !== null) {
    if (orgFilter.length === 0) {
      // No access at all — return empty
      return NextResponse.json([]);
    }
    query = query.in("id", orgFilter);
  }

  const { data, error } = await query.order("name");

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

    const { name, slug, address, phone, website, notes, pipeline_status, contact_name, contact_email, contact_phone } = await request.json();

    if (!name || !slug) {
      return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_organizations")
      .insert({
        name, slug,
        address: address || null, phone: phone || null, website: website || null, notes: notes || null,
        pipeline_status: pipeline_status || "lead",
        contact_name: contact_name || null, contact_email: contact_email || null, contact_phone: contact_phone || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: `Client slug '${slug}' already exists` }, { status: 409 });
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

// PUT /api/pm/organizations — update an org
export async function PUT(request: NextRequest) {
  try {
    const tableCheck = await checkTablesExist(REQUIRED_TABLES);
    if (tableCheck) {
      return NextResponse.json(tableCheck, { status: 503 });
    }

    const { id, name, slug, address, phone, website, notes, pipeline_status, contact_name, contact_email, contact_phone } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (address !== undefined) updates.address = address || null;
    if (phone !== undefined) updates.phone = phone || null;
    if (website !== undefined) updates.website = website || null;
    if (notes !== undefined) updates.notes = notes || null;
    if (pipeline_status !== undefined) updates.pipeline_status = pipeline_status;
    if (contact_name !== undefined) updates.contact_name = contact_name || null;
    if (contact_email !== undefined) updates.contact_email = contact_email || null;
    if (contact_phone !== undefined) updates.contact_phone = contact_phone || null;

    const { data, error } = await supabase
      .from("pm_organizations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: `Client slug '${slug}' already exists` }, { status: 409 });
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

// DELETE /api/pm/organizations — delete an org
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
      .from("pm_organizations")
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
