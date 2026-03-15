import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// POST /api/pm/tasks/reorder
// Body: { tasks: [{ id, phase_id, sort_order }] }
export async function POST(request: NextRequest) {
  const { tasks } = await request.json();
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: "tasks array is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  for (const t of tasks) {
    const updates: Record<string, unknown> = { sort_order: t.sort_order };
    if (t.phase_id !== undefined) updates.phase_id = t.phase_id;
    await supabase.from("pm_tasks").update(updates).eq("id", t.id);
  }

  return NextResponse.json({ success: true, updated: tasks.length });
}
