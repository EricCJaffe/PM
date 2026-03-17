import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateRecurrenceRule, computeNextOccurrence } from "@/lib/recurrence";

/** GET /api/pm/series/[id] — get a single series with its exceptions */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const [seriesRes, exceptionsRes, instancesRes] = await Promise.all([
    supabase.from("pm_task_series").select("*").eq("id", id).single(),
    supabase.from("pm_series_exceptions").select("*").eq("series_id", id).order("exception_date"),
    supabase.from("pm_tasks").select("id, name, status, due_date, series_occurrence_date, is_exception")
      .eq("series_id", id).order("series_occurrence_date"),
  ]);

  if (seriesRes.error) return NextResponse.json({ error: seriesRes.error.message }, { status: 404 });

  return NextResponse.json({
    ...seriesRes.data,
    exceptions: exceptionsRes.data ?? [],
    instances: instancesRes.data ?? [],
  });
}

/**
 * PATCH /api/pm/series/[id] — update series
 *
 * Query params:
 *   ?scope=all      — update series + all future instances (default)
 *   ?scope=future   — update series + regenerate from next_occurrence forward
 *   ?scope=series   — update series template only, don't touch existing instances
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "series";
  const body = await request.json();

  const supabase = createServiceClient();

  // Get current series
  const { data: current, error: fetchErr } = await supabase
    .from("pm_task_series").select("*").eq("id", id).single();
  if (fetchErr) return NextResponse.json({ error: "Series not found" }, { status: 404 });

  // Build update payload
  const allowed = [
    "name", "description", "owner", "assigned_to", "status_template", "subtasks_template",
    "recurrence_mode", "freq", "interval", "by_weekday", "by_monthday", "by_setpos",
    "dtstart", "until_date", "max_count", "time_of_day", "timezone",
    "completion_delay_days", "is_paused", "phase_id",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Handle pause/resume
  if ("is_paused" in body) {
    updates.paused_at = body.is_paused ? new Date().toISOString() : null;
  }

  // Validate if recurrence fields changed
  const merged = { ...current, ...updates };
  const validation = validateRecurrenceRule(merged);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join("; ") }, { status: 400 });
  }

  // Recompute next_occurrence if recurrence fields changed
  const recurrenceFields = ["freq", "interval", "by_weekday", "by_monthday", "by_setpos", "dtstart", "until_date", "max_count", "is_paused"];
  const recurrenceChanged = recurrenceFields.some((f) => f in updates);
  if (recurrenceChanged) {
    const tempSeries = { ...current, ...updates } as any;
    updates.next_occurrence = computeNextOccurrence(tempSeries);
  }

  const { data, error } = await supabase
    .from("pm_task_series").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If scope includes future instances, update them
  if (scope === "all" || scope === "future") {
    const instanceUpdates: Record<string, unknown> = {};
    if ("name" in updates) instanceUpdates.name = updates.name;
    if ("description" in updates) instanceUpdates.description = updates.description;
    if ("owner" in updates) instanceUpdates.owner = updates.owner;
    if ("assigned_to" in updates) instanceUpdates.assigned_to = updates.assigned_to;

    if (Object.keys(instanceUpdates).length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      let q = supabase.from("pm_tasks").update(instanceUpdates)
        .eq("series_id", id)
        .eq("is_exception", false)  // Don't overwrite manually edited instances
        .neq("status", "complete"); // Don't touch completed instances

      if (scope === "future") {
        q = q.gte("series_occurrence_date", today);
      }

      await q;
    }
  }

  return NextResponse.json(data);
}

/** DELETE /api/pm/series/[id] — delete series and optionally all instances */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const deleteInstances = searchParams.get("instances") !== "keep";

  const supabase = createServiceClient();

  if (deleteInstances) {
    // Delete all non-completed instances first
    await supabase.from("pm_tasks").delete()
      .eq("series_id", id)
      .neq("status", "complete");

    // Unlink completed instances (preserve history)
    await supabase.from("pm_tasks").update({ series_id: null })
      .eq("series_id", id);
  } else {
    // Just unlink all instances
    await supabase.from("pm_tasks").update({ series_id: null })
      .eq("series_id", id);
  }

  // Delete the series (cascades to exceptions)
  const { error } = await supabase.from("pm_task_series").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
