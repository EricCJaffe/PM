import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { enqueueAgentJob } from "@/lib/agent-jobs";
import type { AgentJobType } from "@/types/pm";

// POST /api/cron/agent-scheduler — Vercel Cron, nightly at 2am UTC
// Seeds recurring agent jobs for all active orgs.
//   Every night: engagement_risk_scan
//   Mondays only: weekly_rollup
//
// Deduplication: skips orgs that already have a pending/running job
// of the same type created in the last 20 hours.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get all orgs with at least one active project
  const { data: activeOrgRows } = await supabase
    .from("pm_projects")
    .select("org_id")
    .eq("status", "active");

  const orgIds = [...new Set((activeOrgRows ?? []).map((r) => r.org_id as string))];

  if (orgIds.length === 0) {
    return NextResponse.json({ message: "No active orgs", enqueued: 0 });
  }

  // Find jobs already queued in the last 20h (dedup window)
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { data: recentJobs } = await supabase
    .from("pm_agent_jobs")
    .select("org_id, job_type")
    .in("status", ["pending", "running"])
    .gte("created_at", since);

  const alreadyQueued = new Set(
    (recentJobs ?? []).map((j) => `${j.org_id}:${j.job_type}`)
  );

  const isMonday = new Date().getUTCDay() === 1;
  const enqueued: { org_id: string; job_type: AgentJobType }[] = [];

  for (const orgId of orgIds) {
    // Nightly: risk scan
    if (!alreadyQueued.has(`${orgId}:engagement_risk_scan`)) {
      await enqueueAgentJob({ org_id: orgId, job_type: "engagement_risk_scan" });
      enqueued.push({ org_id: orgId, job_type: "engagement_risk_scan" });
    }

    // Mondays only: weekly rollup
    if (isMonday && !alreadyQueued.has(`${orgId}:weekly_rollup`)) {
      await enqueueAgentJob({ org_id: orgId, job_type: "weekly_rollup" });
      enqueued.push({ org_id: orgId, job_type: "weekly_rollup" });
    }
  }

  return NextResponse.json({
    enqueued: enqueued.length,
    orgs_processed: orgIds.length,
    is_monday: isMonday,
    jobs: enqueued,
  });
}
