import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/pm/department-intake/[id] — Get a single department intake form.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("pm_department_intake")
    .select("*, pm_departments(id, name, slug, head_name, head_email)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Intake form not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/pm/department-intake/[id] — Update intake form responses and status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = createServiceClient();

    const allowed = ["status", "responses", "pillar_scores", "ai_summary", "reviewed_by", "reviewed_at", "approved_by", "approved_at"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    // Auto-calculate pillar scores from responses if responses are being updated
    if (body.responses && !body.pillar_scores) {
      const responses = body.responses as Record<string, unknown>;
      const pillars = ["vision", "people", "data", "processes", "meetings", "issues"];
      const scores: Record<string, number> = {};

      for (const pillar of pillars) {
        const pillarData = responses[pillar] as Record<string, unknown> | undefined;
        if (pillarData) {
          // Count answered questions vs total
          const answers = Object.values(pillarData).filter((v) => v !== "" && v !== null && v !== undefined);
          const total = Object.keys(pillarData).length;
          // Simple completion-based score (1-5 scale)
          scores[pillar] = total > 0 ? Math.min(5, Math.max(1, Math.round((answers.length / total) * 5))) : 0;
        }
      }

      if (Object.keys(scores).length > 0) {
        updates.pillar_scores = scores;
      }
    }

    // Auto-update status based on response completeness
    if (body.responses && !body.status) {
      const responses = body.responses as Record<string, unknown>;
      const pillars = ["vision", "people", "data", "processes", "meetings", "issues"];
      const answeredPillars = pillars.filter((p) => {
        const data = responses[p] as Record<string, unknown> | undefined;
        return data && Object.values(data).some((v) => v !== "" && v !== null);
      });

      if (answeredPillars.length >= pillars.length) {
        updates.status = "complete";
      } else if (answeredPillars.length > 0) {
        updates.status = "in-progress";
      }
    }

    const { data, error } = await supabase
      .from("pm_department_intake")
      .update(updates)
      .eq("id", id)
      .select("*, pm_departments(id, name, slug, head_name)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
