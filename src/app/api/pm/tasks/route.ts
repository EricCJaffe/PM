import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTaskAssignmentEmail } from "@/lib/email";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function POST(request: NextRequest) {
  const { project_id, phase_id, name, status, owner, assigned_to, due_date, description, notify_assignee } = await request.json();
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
    due_date: due_date ?? null,
    description: description ?? null,
  };
  if (orgId) insert.org_id = orgId;
  // These columns may not exist until migration 010/011 are applied
  if (assigned_to) insert.assigned_to = assigned_to;
  if (notify_assignee) insert.notify_assignee = true;

  let { data, error } = await supabase.from("pm_tasks").insert(insert).select().single();

  // If insert failed due to missing columns, retry without them
  if (error && (error.message.includes("assigned_to") || error.message.includes("notify_assignee"))) {
    delete insert.assigned_to;
    delete insert.notify_assignee;
    const retry = await supabase.from("pm_tasks").insert(insert).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send email notification to owner/assignee
  if (notify_assignee && (owner || assigned_to)) {
    const targetSlug = owner || assigned_to;
    // Look up member email by slug
    const { data: member } = await supabase
      .from("pm_members")
      .select("email, display_name")
      .eq("slug", targetSlug)
      .limit(1)
      .single();

    if (member?.email) {
      // Get project name for the email
      let projectName: string | null = null;
      if (project_id) {
        const { data: proj } = await supabase.from("pm_projects").select("name").eq("id", project_id).single();
        projectName = proj?.name || null;
      }

      // Fire and forget — don't block the response
      sendTaskAssignmentEmail({
        to: member.email,
        taskName: name,
        projectName,
        dueDate: due_date,
        description,
      }).catch((err) => console.error("[Email] Error:", err));
    }
  }

  return NextResponse.json(data);
}
