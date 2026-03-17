import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateRecurrenceRule, computeNextOccurrence } from "@/lib/recurrence";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

/** GET /api/pm/series — list series, optionally filtered by project_id or org_id */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  const orgId = searchParams.get("org_id");
  const assignedTo = searchParams.get("assigned_to");

  const supabase = createServiceClient();
  let q = supabase.from("pm_task_series").select("*").order("created_at", { ascending: false });

  if (projectId) q = q.eq("project_id", projectId);
  if (orgId) q = q.eq("org_id", orgId);
  if (assignedTo) q = q.or(`owner.eq.${assignedTo},assigned_to.eq.${assignedTo}`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST /api/pm/series — create a new recurring task series */
export async function POST(request: NextRequest) {
  const body = await request.json();

  const {
    project_id, phase_id, name, description, owner, assigned_to,
    status_template, subtasks_template,
    recurrence_mode, freq, interval, by_weekday, by_monthday, by_setpos,
    dtstart, until_date, max_count, time_of_day, timezone,
    completion_delay_days,
  } = body;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!freq) return NextResponse.json({ error: "freq is required" }, { status: 400 });

  // Validate recurrence rule
  const validation = validateRecurrenceRule(body);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join("; ") }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Look up org_id from project if provided
  let orgId: string | null = body.org_id ?? null;
  if (!orgId && project_id) {
    const { data: project } = await supabase
      .from("pm_projects")
      .select("org_id")
      .eq("id", project_id)
      .single();
    if (project) orgId = project.org_id;
  }

  const seriesData = {
    project_id: project_id ?? null,
    phase_id: phase_id ?? null,
    org_id: orgId,
    name,
    description: description ?? null,
    owner: owner ?? null,
    assigned_to: assigned_to ?? null,
    status_template: status_template ?? "not-started",
    subtasks_template: subtasks_template ?? [],
    recurrence_mode: recurrence_mode ?? "fixed",
    freq,
    interval: interval ?? 1,
    by_weekday: by_weekday ?? [],
    by_monthday: by_monthday ?? [],
    by_setpos: by_setpos ?? null,
    dtstart: dtstart ?? new Date().toISOString().slice(0, 10),
    until_date: until_date ?? null,
    max_count: max_count ?? null,
    time_of_day: time_of_day ?? null,
    timezone: timezone ?? "America/New_York",
    completion_delay_days: completion_delay_days ?? null,
    is_paused: false,
    generated_count: 0,
  };

  // Compute next_occurrence before insert
  const tempSeries = { ...seriesData, id: "", next_occurrence: null, last_generated_date: null, paused_at: null, created_at: "", updated_at: "" } as any;
  const nextOcc = computeNextOccurrence(tempSeries);

  const { data, error } = await supabase
    .from("pm_task_series")
    .insert({ ...seriesData, next_occurrence: nextOcc })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
