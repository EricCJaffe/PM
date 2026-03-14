import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org_id");
  if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_process_maps").select("*").eq("org_id", orgId).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { org_id, name, department, description, steps, project_id } = body;
  if (!org_id || !name) return NextResponse.json({ error: "org_id and name required" }, { status: 400 });

  const supabase = createServiceClient();
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let attempt = 0;
  while (attempt < 20) {
    const { data: conflict } = await supabase
      .from("pm_process_maps").select("id").eq("org_id", org_id).eq("slug", slug).maybeSingle();
    if (!conflict) break;
    attempt++;
    slug = `${baseSlug}-${attempt + 1}`;
  }

  const { data, error } = await supabase.from("pm_process_maps").insert({
    org_id, slug, name,
    project_id: project_id || null,
    department: department || null,
    description: description || null,
    steps: steps || [],
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
