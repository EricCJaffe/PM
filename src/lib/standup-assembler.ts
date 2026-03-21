/**
 * Standup data assembler — gathers cross-project task/phase data
 * for an org to feed into the AI standup generator.
 */

import { createServiceClient } from "@/lib/supabase/server";
import type { StandupData, StandupItem, ProjectStandupSummary } from "@/types/pm";

export async function assembleStandupData(
  orgId: string,
  date: Date = new Date()
): Promise<StandupData> {
  const supabase = createServiceClient();

  const today = date.toISOString().split("T")[0];
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const threeDaysFromNow = new Date(date);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];

  // Get all active projects for this org
  const { data: projects } = await supabase
    .from("pm_projects")
    .select("id, name, slug")
    .eq("org_id", orgId)
    .eq("status", "active") as { data: { id: string; name: string; slug: string }[] | null };

  if (!projects || projects.length === 0) {
    return {
      org_id: orgId,
      date: today,
      completed_yesterday: [],
      in_progress_today: [],
      blocked: [],
      due_soon: [],
      overdue: [],
      project_summaries: [],
    };
  }

  const projectIds = projects.map((p) => p.id);
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  // Pull tasks across all active projects
  const { data: tasks } = await supabase
    .from("pm_tasks")
    .select("id, name, status, owner, due_date, project_id, updated_at")
    .in("project_id", projectIds) as { data: { id: string; name: string; status: string; owner: string | null; due_date: string | null; project_id: string | null; updated_at: string }[] | null };

  if (!tasks) {
    return {
      org_id: orgId,
      date: today,
      completed_yesterday: [],
      in_progress_today: [],
      blocked: [],
      due_soon: [],
      overdue: [],
      project_summaries: [],
    };
  }

  const toItem = (t: (typeof tasks)[0]): StandupItem => ({
    task_name: t.name,
    project_name: projectMap[t.project_id ?? ""] ?? "Unknown",
    owner: t.owner,
    due_date: t.due_date,
    status: t.status,
  });

  // Completed yesterday (updated_at within yesterday, status = complete)
  const completedYesterday = tasks
    .filter(
      (t) =>
        t.status === "complete" &&
        t.updated_at >= `${yesterdayStr}T00:00:00` &&
        t.updated_at < `${today}T00:00:00`
    )
    .slice(0, 10)
    .map(toItem);

  // In progress
  const inProgress = tasks
    .filter((t) => t.status === "in-progress")
    .slice(0, 15)
    .map(toItem);

  // Blocked
  const blocked = tasks
    .filter((t) => t.status === "blocked")
    .map(toItem);

  // Due soon (not complete, due within 3 days)
  const dueSoon = tasks
    .filter(
      (t) =>
        t.due_date &&
        t.due_date >= today &&
        t.due_date <= threeDaysStr &&
        t.status !== "complete"
    )
    .slice(0, 10)
    .map(toItem);

  // Overdue
  const overdue = tasks
    .filter(
      (t) =>
        t.due_date &&
        t.due_date < today &&
        t.status !== "complete"
    )
    .slice(0, 10)
    .map(toItem);

  // Project summaries — pull phase progress
  const { data: phases } = await supabase
    .from("pm_phases")
    .select("project_id, name, progress, status, order")
    .in("project_id", projectIds)
    .order("order", { ascending: true }) as { data: { project_id: string; name: string; progress: number; status: string; order: number }[] | null };

  const weekAgo = new Date(date);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString();

  const projectSummaries: ProjectStandupSummary[] = projects.map((project) => {
    const projectTasks = tasks.filter((t) => t.project_id === project.id);
    const projectPhases = phases?.filter((p) => p.project_id === project.id) ?? [];

    // Current phase = first non-complete phase
    const currentPhase =
      projectPhases.find((p) => p.status !== "complete") ?? projectPhases[0];

    const completedThisWeek = projectTasks.filter(
      (t) => t.status === "complete" && t.updated_at >= weekAgoStr
    ).length;

    return {
      project_id: project.id,
      project_name: project.name,
      current_phase: currentPhase?.name ?? null,
      phase_progress: currentPhase?.progress ?? 0,
      open_tasks: projectTasks.filter((t) => t.status !== "complete").length,
      blocked_tasks: projectTasks.filter((t) => t.status === "blocked").length,
      completed_this_week: completedThisWeek,
      overdue_tasks: projectTasks.filter(
        (t) => t.due_date && t.due_date < today && t.status !== "complete"
      ).length,
    };
  });

  return {
    org_id: orgId,
    date: today,
    completed_yesterday: completedYesterday,
    in_progress_today: inProgress,
    blocked,
    due_soon: dueSoon,
    overdue,
    project_summaries: projectSummaries,
  };
}
