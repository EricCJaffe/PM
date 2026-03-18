import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get("org_id");
    const projectId = request.nextUrl.searchParams.get("project_id");
    const scope = request.nextUrl.searchParams.get("scope"); // "global", "org", "all"

    const supabase = createServiceClient();
    let query = supabase.from("pm_kb_articles").select("*");

    if (scope === "global") {
      query = query.is("org_id", null);
    } else if (scope === "org" && orgId) {
      query = query.eq("org_id", orgId).is("project_id", null);
    } else if (projectId) {
      query = query.eq("project_id", projectId);
    } else if (orgId) {
      // Default: org articles + global
      query = query.or(`and(org_id.eq.${orgId},project_id.is.null),org_id.is.null`);
    } else {
      query = query.is("org_id", null);
    }

    const { data, error } = await query
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("KB GET error:", error);
      // Table might not exist yet — return empty array
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json([]);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("KB GET exception:", err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { org_id, project_id, title, category, content, tags, is_pinned, updated_by } = body;

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const supabase = createServiceClient();

  // Generate unique slug
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let attempt = 0;
  while (attempt < 20) {
    const { data: conflict } = await supabase
      .from("pm_kb_articles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!conflict) break;
    attempt++;
    slug = `${baseSlug}-${attempt + 1}`;
  }

  const { data, error } = await supabase.from("pm_kb_articles").insert({
    org_id: org_id || null,
    project_id: project_id || null,
    slug,
    title,
    category: category || "general",
    content: content || "",
    tags: tags || [],
    is_pinned: is_pinned || false,
    updated_by: updated_by || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
