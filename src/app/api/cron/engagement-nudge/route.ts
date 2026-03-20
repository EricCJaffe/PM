import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// POST /api/cron/engagement-nudge
// Called by Vercel Cron daily to check for overdue engagement tasks and send nudges.
// Cron config: vercel.json { "crons": [{ "path": "/api/cron/engagement-nudge", "schedule": "0 9 * * 1-5" }] }
export async function POST(request: NextRequest) {
  // Verify cron secret (Vercel sets CRON_SECRET automatically)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Find engagement tasks that are overdue and need nudging
  const { data: overdueTasks, error } = await supabase
    .from("pm_tasks")
    .select("id, name, due_date, nudge_after_days, last_nudge_sent_at, assigned_to, org_id, engagement_id")
    .not("engagement_id", "is", null)
    .in("status", ["not-started", "in-progress"])
    .lt("due_date", today);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let nudgeCount = 0;

  for (const task of overdueTasks || []) {
    if (!task.nudge_after_days || task.nudge_after_days <= 0) continue;

    const dueDate = new Date(task.due_date);
    const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue < task.nudge_after_days) continue;

    // Check if we already nudged recently (within last 24 hours)
    if (task.last_nudge_sent_at) {
      const lastNudge = new Date(task.last_nudge_sent_at);
      const hoursSinceNudge = (Date.now() - lastNudge.getTime()) / (1000 * 60 * 60);
      if (hoursSinceNudge < 24) continue;
    }

    // Send nudge notification
    // For now, we log and update the timestamp. Email integration can be added later.
    // If sendEmail is available, uncomment:
    // await sendEmail({ to: assignee_email, subject: `Overdue: ${task.name}`, ... });

    await supabase
      .from("pm_tasks")
      .update({ last_nudge_sent_at: new Date().toISOString() })
      .eq("id", task.id);

    nudgeCount++;
  }

  return NextResponse.json({
    success: true,
    overdue_tasks: overdueTasks?.length || 0,
    nudges_sent: nudgeCount,
    checked_at: new Date().toISOString(),
  });
}
