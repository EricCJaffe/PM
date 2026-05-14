import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

type TriggerType = "pass_approval" | "go_live" | "onboarding_completion" | "support_escalation";

type TrendRow = {
  week_start: string;
  total: number;
  pass_approval: number;
  go_live: number;
  onboarding_completion: number;
  support_escalation: number;
};

function parseWeeks(raw: string | null): number {
  const parsed = Number(raw ?? "8");
  if (!Number.isFinite(parsed)) return 8;
  return Math.min(Math.max(Math.trunc(parsed), 1), 26);
}

function startOfUtcWeek(date: Date): Date {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  const offsetToMonday = (day + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - offsetToMonday);
  utc.setUTCHours(0, 0, 0, 0);
  return utc;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildTrend(events: { trigger_type: TriggerType; occurred_at: string }[]): TrendRow[] {
  const trend = new Map<string, TrendRow>();

  for (const event of events) {
    const occurred = new Date(event.occurred_at);
    const key = toDateKey(startOfUtcWeek(occurred));
    const existing = trend.get(key) ?? {
      week_start: key,
      total: 0,
      pass_approval: 0,
      go_live: 0,
      onboarding_completion: 0,
      support_escalation: 0,
    };

    existing.total += 1;
    existing[event.trigger_type] += 1;
    trend.set(key, existing);
  }

  return Array.from(trend.values()).sort((a, b) => a.week_start.localeCompare(b.week_start));
}

function buildExceptions(trend: TrendRow[]): Array<{ week_start: string; severity: "info" | "warning"; reason: string }> {
  if (trend.length === 0) return [];

  const avgWeeklyVolume = trend.reduce((sum, row) => sum + row.total, 0) / trend.length;
  const spikeThreshold = Math.max(3, Math.ceil(avgWeeklyVolume * 1.5));

  const exceptions: Array<{ week_start: string; severity: "info" | "warning"; reason: string }> = [];

  for (const week of trend) {
    if (week.total >= spikeThreshold) {
      exceptions.push({
        week_start: week.week_start,
        severity: "warning",
        reason: `Weekly documentation trigger volume spike: ${week.total} events (threshold ${spikeThreshold}).`,
      });
    }

    if (week.support_escalation >= 2) {
      exceptions.push({
        week_start: week.week_start,
        severity: "warning",
        reason: `Support escalation concentration: ${week.support_escalation} follow-up requests in one week.`,
      });
    }

    if (week.go_live > 0 && week.onboarding_completion === 0) {
      exceptions.push({
        week_start: week.week_start,
        severity: "info",
        reason: "Go-live activity recorded without onboarding completion signal in the same week.",
      });
    }
  }

  return exceptions;
}

async function runReport(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("org_id");
  const projectId = searchParams.get("project_id");
  const weeks = parseWeeks(searchParams.get("weeks"));

  const now = new Date();
  const windowStart = startOfUtcWeek(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - (weeks - 1) * 7);

  const supabase = createServiceClient();
  let query = supabase
    .from("pm_documentation_workload_events")
    .select("trigger_type,occurred_at")
    .gte("occurred_at", windowStart.toISOString())
    .order("occurred_at", { ascending: true });

  if (orgId) query = query.eq("org_id", orgId);
  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []) as { trigger_type: TriggerType; occurred_at: string }[];
  const weeklyTrend = buildTrend(events);
  const exceptions = buildExceptions(weeklyTrend);

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    window_weeks: weeks,
    filters: {
      org_id: orgId,
      project_id: projectId,
      since: windowStart.toISOString(),
    },
    totals: {
      events: events.length,
      pass_approval: events.filter((e) => e.trigger_type === "pass_approval").length,
      go_live: events.filter((e) => e.trigger_type === "go_live").length,
      onboarding_completion: events.filter((e) => e.trigger_type === "onboarding_completion").length,
      support_escalation: events.filter((e) => e.trigger_type === "support_escalation").length,
    },
    weekly_trend: weeklyTrend,
    exceptions,
  });
}

export async function GET(request: NextRequest) {
  return runReport(request);
}

export async function POST(request: NextRequest) {
  return runReport(request);
}
