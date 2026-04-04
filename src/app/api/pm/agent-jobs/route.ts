import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { enqueueAgentJob } from "@/lib/agent-jobs";
import type { AgentJobType } from "@/types/pm";

const VALID_JOB_TYPES: AgentJobType[] = [
  "engagement_risk_scan",
  "weekly_rollup",
  "audit_follow_up",
  "document_draft",
];

// GET /api/pm/agent-jobs?org_id=&limit=&status=
// List recent jobs for an org
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("org_id");
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const supabase = createServiceClient();
  let query = supabase
    .from("pm_agent_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (orgId) query = query.eq("org_id", orgId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ jobs: data ?? [] });
}

// POST /api/pm/agent-jobs — manually enqueue a job
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { org_id, job_type, payload, scheduled_at } = body;

  if (!job_type || !VALID_JOB_TYPES.includes(job_type)) {
    return NextResponse.json(
      { error: `Invalid job_type. Must be one of: ${VALID_JOB_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const job = await enqueueAgentJob({ org_id, job_type, payload, scheduled_at });
    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to enqueue job" },
      { status: 500 }
    );
  }
}
