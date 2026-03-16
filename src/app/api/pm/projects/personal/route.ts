import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/pm/projects/personal?member_slug=xxx&org_id=xxx
// Returns the personal project for a member, creating it if it doesn't exist
export async function GET(request: NextRequest) {
  const memberSlug = request.nextUrl.searchParams.get("member_slug");
  const orgId = request.nextUrl.searchParams.get("org_id");

  if (!memberSlug || !orgId) {
    return NextResponse.json({ error: "member_slug and org_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Check if personal project already exists
  const { data: existing } = await supabase
    .from("pm_projects")
    .select("*")
    .eq("is_personal", true)
    .eq("personal_member_slug", memberSlug)
    .single();

  if (existing) {
    return NextResponse.json(existing);
  }

  // Get member display name
  const { data: member } = await supabase
    .from("pm_members")
    .select("display_name")
    .eq("slug", memberSlug)
    .limit(1)
    .single();

  const displayName = member?.display_name || memberSlug;
  const slug = `personal-${memberSlug}`;

  // Create personal project
  const { data: project, error } = await supabase
    .from("pm_projects")
    .insert({
      org_id: orgId,
      slug,
      name: `${displayName} — Personal`,
      description: "Personal task tracking project",
      owner: memberSlug,
      template_slug: "custom",
      start_date: new Date().toISOString().slice(0, 10),
      status: "active",
      is_personal: true,
      personal_member_slug: memberSlug,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(project);
}
