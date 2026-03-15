import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function POST(request: NextRequest) {
  const { project_id, phase_id, name, status, owner, due_date, description } = await request.json();
  if (!project_id || !name) return NextResponse.json({ error: "project_id and name required" }, { status: 400 });

  const supabase = createServiceClient();

  // Look up org_id from the project (required by pm_tasks)
  const { data: project, error: projErr } = await supabase
    .from("pm_projects")
    .select("org_id")
    .eq("id", project_id)
    .single();
  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const baseSlug = slugify(name);
  // Ensure unique slug within project
  const { data: existing } = await supabase.from("pm_tasks").select("slug").eq("project_id", project_id).like("slug", `${baseSlug}%`);
  const slug = existing && existing.length > 0 ? `${baseSlug}-${existing.length + 1}` : baseSlug;

  const { data, error } = await supabase.from("pm_tasks").insert({
    project_id, org_id: project.org_id, phase_id: phase_id ?? null, slug, name,
    status: status ?? "not-started",
    owner: owner ?? null, due_date: due_date ?? null, description: description ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
