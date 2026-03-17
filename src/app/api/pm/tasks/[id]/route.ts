import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTaskAssignmentEmail } from "@/lib/email";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const allowed = ["name", "status", "owner", "assigned_to", "due_date", "description", "phase_id", "sort_order", "subtasks", "notify_assignee"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  const supabase = createServiceClient();
  let { data, error } = await supabase.from("pm_tasks").update(updates).eq("id", id).select().single();

  // If update failed due to missing columns (migrations not applied), retry without them
  if (error && (error.message.includes("assigned_to") || error.message.includes("notify_assignee") || error.message.includes("subtasks"))) {
    delete updates.assigned_to;
    delete updates.notify_assignee;
    delete updates.subtasks;
    const retry = await supabase.from("pm_tasks").update(updates).eq("id", id).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send email notification on save if notify_assignee is checked
  if (body.notify_assignee && data?.owner) {
    const { data: member } = await supabase
      .from("pm_members")
      .select("email, display_name")
      .eq("slug", data.owner)
      .limit(1)
      .single();

    if (member?.email) {
      let projectName: string | null = null;
      if (data.project_id) {
        const { data: proj } = await supabase.from("pm_projects").select("name").eq("id", data.project_id).single();
        projectName = proj?.name || null;
      }
      sendTaskAssignmentEmail({
        to: member.email,
        taskName: data.name,
        projectName,
        dueDate: data.due_date,
        description: data.description,
      }).catch((err) => console.error("[Email] Error:", err));
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase.from("pm_tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
