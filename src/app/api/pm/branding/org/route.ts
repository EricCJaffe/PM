import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** GET: Get org branding overrides */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org_id");
  if (!orgId) {
    return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_org_branding")
    .select("*")
    .eq("org_id", orgId)
    .single();

  if (!data) {
    return NextResponse.json({
      org_id: orgId,
      client_logo_url: null,
      client_logo_icon_url: null,
      client_company_name: null,
      primary_color_override: null,
      secondary_color_override: null,
      accent_color_override: null,
      co_brand_mode: "agency-only",
      cover_bg_override: null,
      content_bg_override: null,
      footer_text_override: null,
      email_from_name_override: null,
      notes: null,
    });
  }

  return NextResponse.json(data);
}

/** POST: Create or update org branding (upsert) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, ...settings } = body;

    if (!org_id) {
      return NextResponse.json({ error: "org_id is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from("pm_org_branding")
      .select("id")
      .eq("org_id", org_id)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from("pm_org_branding")
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq("org_id", org_id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    } else {
      const { data, error } = await supabase
        .from("pm_org_branding")
        .insert({ org_id, ...settings })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
