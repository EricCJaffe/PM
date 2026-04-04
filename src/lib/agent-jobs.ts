/**
 * Agent Jobs — autonomous background AI task queue
 *
 * Pattern: Paperclip-style heartbeat/job model, implemented natively.
 * - Enqueue a job (from any API route, cron, or event trigger)
 * - The /api/cron/agent-runner picks up pending jobs and dispatches them
 * - Each job_type has its own handler in src/lib/agent-job-handlers/
 */

import { createServiceClient } from "@/lib/supabase/server";
import type { AgentJob, AgentJobType, EnqueueJobOptions } from "@/types/pm";

// ─── Enqueue ─────────────────────────────────────────────────────────────────

export async function enqueueAgentJob(opts: EnqueueJobOptions): Promise<AgentJob> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pm_agent_jobs")
    .insert({
      org_id: opts.org_id ?? null,
      job_type: opts.job_type,
      payload: opts.payload ?? {},
      scheduled_at: opts.scheduled_at ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to enqueue job");
  return data as AgentJob;
}

// ─── Claim pending jobs (atomic: prevents double-pickup) ─────────────────────

export async function claimPendingJobs(limit = 10): Promise<AgentJob[]> {
  const supabase = createServiceClient();

  // Select pending jobs due now, then immediately mark as running
  const { data: pending } = await supabase
    .from("pm_agent_jobs")
    .select("id")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (!pending || pending.length === 0) return [];

  const ids = pending.map((j) => j.id);

  const { data: claimed } = await supabase
    .from("pm_agent_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "pending") // guard: only claim if still pending
    .select();

  return (claimed ?? []) as AgentJob[];
}

// ─── Mark complete / failed ───────────────────────────────────────────────────

export async function markJobComplete(
  id: string,
  result: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("pm_agent_jobs")
    .update({ status: "complete", completed_at: new Date().toISOString(), result })
    .eq("id", id);
}

export async function markJobFailed(id: string, error: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("pm_agent_jobs")
    .update({ status: "failed", completed_at: new Date().toISOString(), error })
    .eq("id", id);
}

export async function markJobSkipped(id: string, reason: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("pm_agent_jobs")
    .update({
      status: "skipped",
      completed_at: new Date().toISOString(),
      result: { reason },
    })
    .eq("id", id);
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

import { runEngagementRiskScan } from "@/lib/agent-job-handlers/engagement-risk-scan";
import { runWeeklyRollup } from "@/lib/agent-job-handlers/weekly-rollup";
import { runAuditFollowUp } from "@/lib/agent-job-handlers/audit-follow-up";

export async function dispatchJob(job: AgentJob): Promise<void> {
  const handlers: Partial<Record<AgentJobType, (job: AgentJob) => Promise<Record<string, unknown>>>> = {
    engagement_risk_scan: runEngagementRiskScan,
    weekly_rollup: runWeeklyRollup,
    audit_follow_up: runAuditFollowUp,
  };

  const handler = handlers[job.job_type];
  if (!handler) {
    await markJobSkipped(job.id, `No handler registered for job_type: ${job.job_type}`);
    return;
  }

  try {
    const result = await handler(job);
    await markJobComplete(job.id, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markJobFailed(job.id, msg);
  }
}

// ─── Schedule helpers (called from event triggers) ────────────────────────────

/** Enqueue a risk scan for a specific org — call after stage changes, etc. */
export async function scheduleRiskScan(orgId: string): Promise<void> {
  await enqueueAgentJob({ org_id: orgId, job_type: "engagement_risk_scan" });
}

/** Enqueue audit follow-up — call from audit completion webhook */
export async function scheduleAuditFollowUp(
  orgId: string,
  auditId: string
): Promise<void> {
  await enqueueAgentJob({
    org_id: orgId,
    job_type: "audit_follow_up",
    payload: { audit_id: auditId },
  });
}
