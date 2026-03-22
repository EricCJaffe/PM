import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** GET: Get platform branding (singleton) */
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_platform_branding")
    .select("*")
    .limit(1)
    .single();

  if (error || !data) {
    // Return defaults if not seeded yet
    return NextResponse.json({
      company_name: "Foundation Stone Advisors",
      company_short_name: "FSA",
      tagline: "Pouring the Foundation for Your Success",
      logo_url: null,
      logo_icon_url: null,
      favicon_url: null,
      primary_color: "#1B2A4A",
      secondary_color: "#5B9BD5",
      accent_color: "#c4793a",
      text_on_primary: "#ffffff",
      text_on_light: "#1a1a1a",
      bg_dark: "#1c2b1e",
      bg_light: "#f5f0e8",
      font_heading: "Helvetica",
      font_body: "Helvetica",
      email_from_name: "BusinessOS PM",
      email_from_address: "admin@foundationstoneadvisors.com",
      website_url: "https://pm.foundationstoneadvisors.com",
      support_email: null,
      footer_text: "Foundation Stone Advisors — Project Management",
      location: "Orange Park, FL",
    });
  }

  return NextResponse.json(data);
}

/** POST: Update platform branding (upsert singleton) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();

    // Check if row exists
    const { data: existing } = await supabase
      .from("pm_platform_branding")
      .select("id")
      .limit(1)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from("pm_platform_branding")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    } else {
      const { data, error } = await supabase
        .from("pm_platform_branding")
        .insert(body)
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
