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

    const {
      name,
      slug,
      address,
      address_line2,
      city,
      state,
      zip,
      phone,
      website,
      notes,
      pipeline_status,
      referred_by,
      contact_name,
      contact_email,
      contact_phone,
      billing_contact_name,
      billing_contact_email,
      billing_contact_phone,
      technical_contact_name,
      technical_contact_email,
      technical_contact_phone,
      other_contact_name,
      other_contact_email,
      other_contact_phone,
      converted_at,
    } = await request.json();

    if (!name || !slug) {
      return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pm_organizations")
      .insert({
        name, slug,
        address: address || null, address_line2: address_line2 || null,
        city: city || null, state: state || null, zip: zip || null,
        phone: phone || null, website: website || null, notes: notes || null,
        pipeline_status: pipeline_status || "lead",
        referred_by: referred_by || null,
        contact_name: contact_name || null, contact_email: contact_email || null, contact_phone: contact_phone || null,
        billing_contact_name: billing_contact_name || null,
        billing_contact_email: billing_contact_email || null,
        billing_contact_phone: billing_contact_phone || null,
        technical_contact_name: technical_contact_name || null,
        technical_contact_email: technical_contact_email || null,
        technical_contact_phone: technical_contact_phone || null,
        other_contact_name: other_contact_name || null,
        other_contact_email: other_contact_email || null,
        other_contact_phone: other_contact_phone || null,
        converted_at: converted_at || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: `Client slug '${slug}' already exists` }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-create first engagement for new orgs
    try {
      await supabase.from("pm_engagements").insert({
        org_id: data.id,
        title: "Initial Engagement",
        type: "new_prospect",
        deal_stage: pipeline_status || "lead",
      });
    } catch {
      // Non-critical — engagement table may not exist yet
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

    const {
      id,
      name,
      slug,
      address,
      address_line2,
      city,
      state,
      zip,
      phone,
      website,
      notes,
      pipeline_status,
      referred_by,
      contact_name,
      contact_email,
      contact_phone,
      billing_contact_name,
      billing_contact_email,
      billing_contact_phone,
      technical_contact_name,
      technical_contact_email,
      technical_contact_phone,
      other_contact_name,
      other_contact_email,
      other_contact_phone,
      converted_at,
    } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (address !== undefined) updates.address = address || null;
    if (address_line2 !== undefined) updates.address_line2 = address_line2 || null;
    if (city !== undefined) updates.city = city || null;
    if (state !== undefined) updates.state = state || null;
    if (zip !== undefined) updates.zip = zip || null;
    if (phone !== undefined) updates.phone = phone || null;
    if (website !== undefined) updates.website = website || null;
    if (notes !== undefined) updates.notes = notes || null;
    if (pipeline_status !== undefined) updates.pipeline_status = pipeline_status;
    if (referred_by !== undefined) updates.referred_by = referred_by || null;
    if (contact_name !== undefined) updates.contact_name = contact_name || null;
    if (contact_email !== undefined) updates.contact_email = contact_email || null;
    if (contact_phone !== undefined) updates.contact_phone = contact_phone || null;
    if (billing_contact_name !== undefined) updates.billing_contact_name = billing_contact_name || null;
    if (billing_contact_email !== undefined) updates.billing_contact_email = billing_contact_email || null;
    if (billing_contact_phone !== undefined) updates.billing_contact_phone = billing_contact_phone || null;
    if (technical_contact_name !== undefined) updates.technical_contact_name = technical_contact_name || null;
    if (technical_contact_email !== undefined) updates.technical_contact_email = technical_contact_email || null;
    if (technical_contact_phone !== undefined) updates.technical_contact_phone = technical_contact_phone || null;
    if (other_contact_name !== undefined) updates.other_contact_name = other_contact_name || null;
    if (other_contact_email !== undefined) updates.other_contact_email = other_contact_email || null;
    if (other_contact_phone !== undefined) updates.other_contact_phone = other_contact_phone || null;
    if (converted_at !== undefined) updates.converted_at = converted_at || null;

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
