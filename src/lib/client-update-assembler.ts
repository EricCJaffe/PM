/**
 * Client Update data assembler — gathers project progress data
 * for the AI to generate a client-facing weekly update email.
 */

import { createServiceClient } from "@/lib/supabase/server";

export interface ClientUpdateData {
  project_name: string;
  org_name: string;
  period_start: string;
  period_end: string;
  completed_tasks: TaskSummary[];
  in_progress_tasks: TaskSummary[];
  blocked_tasks: TaskSummary[];
  current_phase: PhaseSummary | null;
  next_phase: PhaseSummary | null;
  overall_progress: number;
  upcoming_milestones: TaskSummary[];
  decisions_needed: string[];
}

interface TaskSummary {
  name: string;
  owner: string | null;
  due_date: string | null;
  status: string;
}

interface PhaseSummary {
  name: string;
  progress: number;
  status: string;
}

export async function assembleClientUpdateData(
  projectId: string,
  periodStart: string,
  periodEnd: string
): Promise<ClientUpdateData> {
  const supabase = createServiceClient();

  // Get project and org
  const { data: project } = (await supabase
    .from("pm_projects")
    .select("name, org_id")
    .eq("id", projectId)
    .single()) as { data: { name: string; org_id: string } | null };

  let orgName = "your organization";
  if (project?.org_id) {
    const { data: org } = (await supabase
      .from("pm_organizations")
      .select("name")
      .eq("id", project.org_id)
      .single()) as { data: { name: string } | null };
    if (org) orgName = org.name;
  }

  // Get tasks
  const { data: tasks } = (await supabase
    .from("pm_tasks")
    .select("name, status, owner, due_date, updated_at, phase_id")
    .eq("project_id", projectId)) as {
    data: { name: string; status: string; owner: string | null; due_date: string | null; updated_at: string; phase_id: string | null }[] | null;
  };

  // Get phases
  const { data: phases } = (await supabase
    .from("pm_phases")
    .select("id, name, progress, status, order")
    .eq("project_id", projectId)
    .order("order", { ascending: true })) as {
    data: { id: string; name: string; progress: number; status: string; order: number }[] | null;
  };

  const toSummary = (t: NonNullable<typeof tasks>[0]): TaskSummary => ({
    name: t.name,
    owner: t.owner,
    due_date: t.due_date,
    status: t.status,
  });

  const allTasks = tasks ?? [];

  // Completed during period
  const completedTasks = allTasks
    .filter(
      (t) =>
        t.status === "complete" &&
        t.updated_at >= `${periodStart}T00:00:00` &&
        t.updated_at <= `${periodEnd}T23:59:59`
    )
    .slice(0, 10)
    .map(toSummary);

  // Currently in progress
  const inProgressTasks = allTasks
    .filter((t) => t.status === "in-progress")
    .slice(0, 6)
    .map(toSummary);

  // Blocked
  const blockedTasks = allTasks
    .filter((t) => t.status === "blocked")
    .map(toSummary);

  // Upcoming milestones — incomplete tasks with due dates in next 14 days
  const twoWeeksOut = new Date();
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
  const twoWeeksStr = twoWeeksOut.toISOString().split("T")[0];

  const upcomingMilestones = allTasks
    .filter(
      (t) =>
        t.due_date &&
        t.due_date >= periodEnd &&
        t.due_date <= twoWeeksStr &&
        t.status !== "complete"
    )
    .slice(0, 5)
    .map(toSummary);

  // Phase analysis
  const allPhases = phases ?? [];
  const currentPhase = allPhases.find((p) => p.status !== "complete") ?? null;
  const currentPhaseIndex = currentPhase ? allPhases.indexOf(currentPhase) : -1;
  const nextPhase =
    currentPhaseIndex >= 0 ? allPhases[currentPhaseIndex + 1] ?? null : null;

  // Overall progress — average of all phase progress
  const overallProgress =
    allPhases.length > 0
      ? Math.round(
          allPhases.reduce((sum, p) => sum + (p.progress ?? 0), 0) / allPhases.length
        )
      : 0;

  // Decisions needed — blocked tasks become decision requests
  const decisionsNeeded = blockedTasks
    .slice(0, 3)
    .map((t) => `Input needed on: ${t.name}`);

  return {
    project_name: project?.name ?? "Project",
    org_name: orgName,
    period_start: periodStart,
    period_end: periodEnd,
    completed_tasks: completedTasks,
    in_progress_tasks: inProgressTasks,
    blocked_tasks: blockedTasks,
    current_phase: currentPhase
      ? { name: currentPhase.name, progress: currentPhase.progress ?? 0, status: currentPhase.status }
      : null,
    next_phase: nextPhase
      ? { name: nextPhase.name, progress: nextPhase.progress ?? 0, status: nextPhase.status }
      : null,
    overall_progress: overallProgress,
    upcoming_milestones: upcomingMilestones,
    decisions_needed: decisionsNeeded,
  };
}
