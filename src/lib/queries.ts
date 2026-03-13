import { createServiceClient } from "./supabase/server";
import type { Project, ProjectWithStats, Phase, PhaseWithTasks, Task, Risk, PMFile, ProjectTemplate } from "@/types/pm";

// ─── Templates ───────────────────────────────────────────────────────

export async function getTemplates(): Promise<ProjectTemplate[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_project_templates")
    .select("*")
    .order("slug");
  return (data ?? []) as ProjectTemplate[];
}

export async function getTemplate(slug: string): Promise<ProjectTemplate | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_project_templates")
    .select("*")
    .eq("slug", slug)
    .single();
  return data as ProjectTemplate | null;
}

// ─── Projects ────────────────────────────────────────────────────────

export async function getProjects(orgId?: string): Promise<ProjectWithStats[]> {
  const supabase = createServiceClient();
  let query = supabase.from("pm_projects").select("*").order("created_at", { ascending: false });
  if (orgId) query = query.eq("org_id", orgId);

  const { data: projects } = await query;
  if (!projects?.length) return [];

  const stats: ProjectWithStats[] = [];
  for (const p of projects) {
    const { count: phaseCount } = await supabase
      .from("pm_phases")
      .select("*", { count: "exact", head: true })
      .eq("project_id", p.id);
    const { data: tasks } = await supabase
      .from("pm_tasks")
      .select("status")
      .eq("project_id", p.id);

    const taskList = tasks ?? [];
    const complete = taskList.filter((t: { status: string }) => t.status === "complete").length;
    const blocked = taskList.filter((t: { status: string }) => t.status === "blocked").length;
    const progress = taskList.length > 0 ? Math.round((complete / taskList.length) * 100) : 0;

    stats.push({
      ...(p as Project),
      phase_count: phaseCount ?? 0,
      task_count: taskList.length,
      complete_tasks: complete,
      blocked_tasks: blocked,
      overall_progress: progress,
    });
  }
  return stats;
}

export async function getProject(slug: string): Promise<Project | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_projects")
    .select("*")
    .eq("slug", slug)
    .single();
  return data as Project | null;
}

export async function getProjectById(id: string): Promise<Project | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_projects")
    .select("*")
    .eq("id", id)
    .single();
  return data as Project | null;
}

// ─── Phases ──────────────────────────────────────────────────────────

export async function getPhases(projectId: string): Promise<Phase[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_phases")
    .select("*")
    .eq("project_id", projectId)
    .order("order");
  return (data ?? []) as Phase[];
}

export async function getPhasesWithTasks(projectId: string): Promise<PhaseWithTasks[]> {
  const supabase = createServiceClient();
  const { data: phases } = await supabase
    .from("pm_phases")
    .select("*")
    .eq("project_id", projectId)
    .order("order");

  if (!phases?.length) return [];

  const result: PhaseWithTasks[] = [];
  for (const phase of phases) {
    const { data: tasks } = await supabase
      .from("pm_tasks")
      .select("*")
      .eq("phase_id", phase.id)
      .order("created_at");
    result.push({ ...(phase as Phase), tasks: (tasks ?? []) as Task[] });
  }
  return result;
}

// ─── Tasks ───────────────────────────────────────────────────────────

export async function getTasks(projectId: string): Promise<Task[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at");
  return (data ?? []) as Task[];
}

export async function getBlockedTasks(projectId?: string): Promise<Task[]> {
  const supabase = createServiceClient();
  let query = supabase.from("pm_tasks").select("*").eq("status", "blocked");
  if (projectId) query = query.eq("project_id", projectId);
  const { data } = await query;
  return (data ?? []) as Task[];
}

// ─── Risks ───────────────────────────────────────────────────────────

export async function getRisks(projectId: string): Promise<Risk[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_risks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at");
  return (data ?? []) as Risk[];
}
