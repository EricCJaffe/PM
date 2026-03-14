import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function POST(request: NextRequest) {
  const { project_id, title, description, probability, impact, mitigation, owner } = await request.json();
  if (!project_id || !title) return NextResponse.json({ error: "project_id and title required" }, { status: 400 });

  const supabase = createServiceClient();
  const baseSlug = slugify(title);
  const { data: existing } = await supabase.from("pm_risks").select("slug").eq("project_id", project_id).like("slug", `${baseSlug}%`);
  const slug = existing && existing.length > 0 ? `${baseSlug}-${existing.length + 1}` : baseSlug;

  const { data, error } = await supabase.from("pm_risks").insert({
    project_id, slug, title,
    description: description ?? null, probability: probability ?? "medium",
    impact: impact ?? "medium", mitigation: mitigation ?? null,
    owner: owner ?? null, status: "open",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
