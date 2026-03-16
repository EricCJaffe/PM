import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function POST(request: NextRequest) {
  const { project_id, phase_id, name, status, owner, assigned_to, due_date, description } = await request.json();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const supabase = createServiceClient();
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let orgId: string | null = null;

  if (project_id) {
    // Project-linked task
    const { data: project, error: projErr } = await supabase
      .from("pm_projects")
      .select("org_id")
      .eq("id", project_id)
      .single();
    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    orgId = project.org_id;

    // Ensure unique slug within project
    const { data: existing } = await supabase.from("pm_tasks").select("slug").eq("project_id", project_id).like("slug", `${baseSlug}%`);
    slug = existing && existing.length > 0 ? `${baseSlug}-${existing.length + 1}` : baseSlug;
  } else {
    // Standalone task — ensure globally unique slug
    const { data: existing } = await supabase.from("pm_tasks").select("slug").is("project_id", null).like("slug", `${baseSlug}%`);
    slug = existing && existing.length > 0 ? `${baseSlug}-${existing.length + 1}` : baseSlug;
  }

  const insert: Record<string, unknown> = {
    project_id: project_id ?? null,
    phase_id: phase_id ?? null,
    slug,
    name,
    status: status ?? "not-started",
    owner: owner ?? null,
    assigned_to: assigned_to ?? null,
    due_date: due_date ?? null,
    description: description ?? null,
  };
  if (orgId) insert.org_id = orgId;

  const { data, error } = await supabase.from("pm_tasks").insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
