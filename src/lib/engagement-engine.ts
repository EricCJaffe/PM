import { createServiceClient } from "@/lib/supabase/server";
import type { EngagementTaskTemplate } from "@/types/pm";

/**
 * Spawn tasks from engagement task templates when a deal enters a new stage.
 * Called when an engagement's deal_stage changes.
 */
export async function spawnEngagementTasks(
  engagementId: string,
  newStage: string,
  engagementType: string,
  assignedTo: string | null
) {
  const supabase = createServiceClient();

  // Get the engagement to know org_id
  const { data: engagement } = await supabase
    .from("pm_engagements")
    .select("org_id")
    .eq("id", engagementId)
    .single();

  if (!engagement) return;

  // Fetch active templates for this stage that match the engagement type
  const { data: templates } = await supabase
    .from("pm_engagement_task_templates")
    .select("*")
    .eq("trigger_stage", newStage)
    .eq("is_active", true)
    .or(`engagement_type.eq.both,engagement_type.eq.${engagementType}`)
    .order("sort_order");

  if (!templates?.length) return;

  // Build task records
  const now = new Date();
  const tasks = templates.map((tmpl: EngagementTaskTemplate) => {
    const dueDate = addBusinessDays(now, tmpl.due_offset_days);
    return {
      name: tmpl.title,
      description: tmpl.description,
      slug: slugify(tmpl.title),
      status: "not-started" as const,
      org_id: engagement.org_id,
      engagement_id: engagementId,
      assigned_to: assignedTo,
      owner: assignedTo,
      due_date: dueDate.toISOString().split("T")[0],
      nudge_after_days: tmpl.nudge_after_days,
      sort_order: tmpl.sort_order,
    };
  });

  // Insert all tasks
  await supabase.from("pm_tasks").insert(tasks);
}

/** Add business days (skip Saturday/Sunday) */
function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

/** Generate a URL-safe slug from text */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
