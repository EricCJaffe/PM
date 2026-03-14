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
    .from("pm_opportunities").select("*").eq("org_id", orgId).order("priority_score", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { org_id, title } = body;
  if (!org_id || !title) return NextResponse.json({ error: "org_id and title required" }, { status: 400 });

  const supabase = createServiceClient();
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let attempt = 0;
  while (attempt < 20) {
    const { data: conflict } = await supabase
      .from("pm_opportunities").select("id").eq("org_id", org_id).eq("slug", slug).maybeSingle();
    if (!conflict) break;
    attempt++;
    slug = `${baseSlug}-${attempt + 1}`;
  }

  const { data, error } = await supabase.from("pm_opportunities").insert({
    org_id, slug, title,
    description: body.description || null,
    project_id: body.project_id || null,
    process_map_id: body.process_map_id || null,
    estimated_savings: body.estimated_savings || 0,
    savings_unit: body.savings_unit || "year",
    complexity: body.complexity || "medium",
    estimated_timeline: body.estimated_timeline || null,
    priority_score: body.priority_score || 0,
    status: body.status || "identified",
    source: body.source || null,
    owner: body.owner || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
