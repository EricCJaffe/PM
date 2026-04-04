import { NextRequest, NextResponse } from "next/server";
import { claimPendingJobs, dispatchJob } from "@/lib/agent-jobs";

// POST /api/cron/agent-runner — Vercel Cron, every hour
// Claims pending agent jobs and dispatches them one by one.
// Each job runs its handler, which writes results back to pm_agent_jobs.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await claimPendingJobs(10);

  if (jobs.length === 0) {
    return NextResponse.json({ message: "No pending jobs", dispatched: 0 });
  }

  const results: { id: string; job_type: string; status: string; error?: string }[] = [];

  for (const job of jobs) {
    try {
      await dispatchJob(job);
      results.push({ id: job.id, job_type: job.job_type, status: "dispatched" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ id: job.id, job_type: job.job_type, status: "error", error: msg });
    }
  }

  return NextResponse.json({ dispatched: results.length, results });
}
