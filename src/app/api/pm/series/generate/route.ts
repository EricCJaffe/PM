import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateOccurrences, computeNextOccurrence } from "@/lib/recurrence";
import type { TaskSeries, SeriesException } from "@/types/pm";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

/**
 * POST /api/pm/series/generate — generate task instances for due series
 *
 * Body (all optional):
 *   series_id  — generate for a specific series only
 *   horizon    — how far ahead to generate (default: 14 days)
 *   dry_run    — if true, return what would be generated without creating
 *
 * This endpoint is idempotent: the unique index on (series_id, series_occurrence_date)
 * prevents duplicate instances. It can be called from:
 *   - Vercel Cron (recommended: daily)
 *   - Manual trigger from admin UI
 *   - On-demand when viewing a series
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const seriesId = body.series_id;
  const horizonDays = body.horizon ?? 14;
  const dryRun = body.dry_run ?? false;

  const supabase = createServiceClient();

  // Compute horizon date
  const horizonDate = new Date();
  horizonDate.setUTCDate(horizonDate.getUTCDate() + horizonDays);
  const horizon = horizonDate.toISOString().slice(0, 10);

  // Fetch active series that need generation
  let q = supabase.from("pm_task_series").select("*").eq("is_paused", false);
  if (seriesId) {
    q = q.eq("id", seriesId);
  } else {
    // Only fetch series where next_occurrence is within the horizon
    q = q.lte("next_occurrence", horizon);
  }
  const { data: seriesList, error: seriesErr } = await q;
  if (seriesErr) return NextResponse.json({ error: seriesErr.message }, { status: 500 });
  if (!seriesList || seriesList.length === 0) {
    return NextResponse.json({ generated: 0, details: [] });
  }

  const results: { series_id: string; series_name: string; instances: string[] }[] = [];
  let totalGenerated = 0;

  for (const series of seriesList as TaskSeries[]) {
    // Fetch exceptions for this series
    const { data: exceptions } = await supabase
      .from("pm_series_exceptions")
      .select("*")
      .eq("series_id", series.id);

    // Generate occurrence dates
    const dates = generateOccurrences(series, {
      horizon,
      limit: 30, // cap per series per run
      after: series.last_generated_date ?? undefined,
      exceptions: (exceptions as SeriesException[]) ?? [],
    });

    if (dates.length === 0) continue;

    if (dryRun) {
      results.push({ series_id: series.id, series_name: series.name, instances: dates });
      totalGenerated += dates.length;
      continue;
    }

    // Create task instances
    const baseSlug = slugify(series.name);
    const instanceInserts = dates.map((date) => ({
      project_id: series.project_id,
      phase_id: series.phase_id,
      slug: `${baseSlug}-${date}`,
      name: series.name,
      description: series.description,
      owner: series.owner,
      assigned_to: series.assigned_to,
      status: series.status_template,
      subtasks: series.subtasks_template ?? [],
      due_date: date,
      series_id: series.id,
      series_occurrence_date: date,
      is_exception: false,
    }));

    // Insert instances, skipping duplicates via ON CONFLICT
    const created: string[] = [];
    for (const inst of instanceInserts) {
      const { data: inserted, error: insertErr } = await supabase
        .from("pm_tasks")
        .insert(inst)
        .select("id, series_occurrence_date")
        .single();

      if (insertErr) {
        // Duplicate — already generated, skip
        if (insertErr.message.includes("duplicate") || insertErr.message.includes("unique")) {
          continue;
        }
        // If column doesn't exist yet, retry without it
        if (insertErr.message.includes("assigned_to") || insertErr.message.includes("is_exception") || insertErr.message.includes("series_id")) {
          const fallback = { ...inst };
          delete (fallback as any).assigned_to;
          delete (fallback as any).series_id;
          delete (fallback as any).series_occurrence_date;
          delete (fallback as any).is_exception;
          const { error: retryErr } = await supabase.from("pm_tasks").insert(fallback);
          if (!retryErr) created.push(inst.series_occurrence_date!);
          continue;
        }
        console.error(`[Series Generate] Error creating instance for ${series.name} on ${inst.due_date}:`, insertErr.message);
        continue;
      }
      created.push(inserted.series_occurrence_date);
    }

    if (created.length > 0) {
      // Update series tracking fields
      const lastDate = created[created.length - 1];
      const newCount = series.generated_count + created.length;
      const updatedSeries = {
        ...series,
        last_generated_date: lastDate,
        generated_count: newCount,
      };

      const nextOcc = computeNextOccurrence(
        updatedSeries as TaskSeries,
        (exceptions as SeriesException[]) ?? []
      );

      await supabase.from("pm_task_series").update({
        last_generated_date: lastDate,
        generated_count: newCount,
        next_occurrence: nextOcc,
      }).eq("id", series.id);

      results.push({ series_id: series.id, series_name: series.name, instances: created });
      totalGenerated += created.length;
    }
  }

  return NextResponse.json({ generated: totalGenerated, details: results });
}
