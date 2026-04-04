/**
 * Handler: weekly_rollup
 *
 * Generates the weekly rollup report for an org autonomously.
 * Delegates to the existing /api/pm/reports/rollup endpoint — keeps
 * logic in one place, avoids duplication.
 */

import type { AgentJob } from "@/types/pm";

export async function runWeeklyRollup(
  job: AgentJob
): Promise<Record<string, unknown>> {
  const orgId = job.org_id;
  if (!orgId) return { skipped: true, reason: "No org_id" };

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${appUrl}/api/pm/reports/rollup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-cron": process.env.CRON_SECRET ?? "",
    },
    body: JSON.stringify({ org_id: orgId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Rollup failed with status ${res.status}`);
  }

  const data = await res.json();
  return { org_id: orgId, report_id: data.id ?? null, status: "generated" };
}
