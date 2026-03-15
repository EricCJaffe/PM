import { createServiceClient } from "./supabase/server";
import type { Project, ProjectWithStats, Phase, PhaseWithTasks, Task, Risk, PMFile, ProjectTemplate, Organization, Member, AssignableMember, ProcessMap, Opportunity, KPI, PMDocument, ShareToken } from "@/types/pm";

// ─── Organizations ───────────────────────────────────────────────────

export async function getOrganizations(): Promise<Organization[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_organizations")
    .select("*")
    .order("name");
  return (data ?? []) as Organization[];
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_organizations")
    .select("*")
    .eq("slug", slug)
    .single();
  return data as Organization | null;
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_organizations")
    .select("*")
    .eq("id", id)
    .single();
  return data as Organization | null;
}

// ─── Members ─────────────────────────────────────────────────────────

export async function getMembers(orgId: string): Promise<Member[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_members")
    .select("*")
    .eq("org_id", orgId)
    .order("display_name");
  return (data ?? []) as Member[];
}

/** Get the site-level org (Foundation Stone Advisors) */
export async function getSiteOrg(): Promise<Organization | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_organizations")
    .select("*")
    .eq("is_site_org", true)
    .single();
  return data as Organization | null;
}

/**
 * Get members assignable to a given org's projects.
 * Returns: site-org staff (available everywhere) + target org members.
 * De-duplicates if the target org IS the site org.
 */
export async function getAssignableMembers(orgId: string): Promise<AssignableMember[]> {
  const supabase = createServiceClient();

  // Get the target org name
  const { data: targetOrg } = await supabase
    .from("pm_organizations")
    .select("id, name, is_site_org")
    .eq("id", orgId)
    .single();

  if (!targetOrg) return [];

  // Get org members
  const { data: orgMembers } = await supabase
    .from("pm_members")
    .select("*")
    .eq("org_id", orgId)
    .order("display_name");

  const result: AssignableMember[] = ((orgMembers ?? []) as Member[]).map((m) => ({
    ...m,
    is_site_staff: targetOrg.is_site_org === true,
    org_name: targetOrg.name,
  }));

  // If this IS the site org, we're done (no need to add site members twice)
  if (targetOrg.is_site_org) return result;

  // Otherwise, also fetch site-org members
  const siteOrg = await getSiteOrg();
  if (siteOrg) {
    const { data: siteMembers } = await supabase
      .from("pm_members")
      .select("*")
      .eq("org_id", siteOrg.id)
      .order("display_name");

    for (const m of (siteMembers ?? []) as Member[]) {
      result.push({
        ...m,
        is_site_staff: true,
        org_name: siteOrg.name,
      });
    }
  }

  return result;
}

/** Check if a member slug is valid for assignment to a given org */
export async function isValidAssignee(orgId: string, memberSlug: string): Promise<boolean> {
  const supabase = createServiceClient();

  // Check target org
  const { data: orgMember } = await supabase
    .from("pm_members")
    .select("slug")
    .eq("org_id", orgId)
    .eq("slug", memberSlug)
    .single();
  if (orgMember) return true;

  // Check site org
  const siteOrg = await getSiteOrg();
  if (siteOrg) {
    const { data: siteMember } = await supabase
      .from("pm_members")
      .select("slug")
      .eq("org_id", siteOrg.id)
      .eq("slug", memberSlug)
      .single();
    if (siteMember) return true;
  }

  return false;
}

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

  // Build org name lookup
  const orgIds = [...new Set(projects.map((p: { org_id: string }) => p.org_id))];
  const { data: orgs } = await supabase
    .from("pm_organizations")
    .select("id, name")
    .in("id", orgIds);
  const orgNameMap = new Map((orgs ?? []).map((o: { id: string; name: string }) => [o.id, o.name]));

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
      org_name: (orgNameMap.get(p.org_id) as string | undefined) ?? undefined,
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
    .order("phase_order");
  return (data ?? []) as Phase[];
}

export async function getPhasesWithTasks(projectId: string): Promise<PhaseWithTasks[]> {
  const supabase = createServiceClient();
  const { data: phases } = await supabase
    .from("pm_phases")
    .select("*")
    .eq("project_id", projectId)
    .order("phase_order");

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

// ─── Process Maps ─────────────────────────────────────────────────────

export async function getProcessMaps(orgId: string): Promise<ProcessMap[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_process_maps").select("*").eq("org_id", orgId).order("created_at");
  return (data ?? []) as ProcessMap[];
}

// ─── Opportunities ──────────────────────────────────────────────────

export async function getOpportunities(orgId: string): Promise<Opportunity[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_opportunities").select("*").eq("org_id", orgId).order("priority_score", { ascending: false });
  return (data ?? []) as Opportunity[];
}

// ─── KPIs ───────────────────────────────────────────────────────────

export async function getKPIs(orgId: string): Promise<KPI[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_kpis").select("*").eq("org_id", orgId).order("created_at");
  return (data ?? []) as KPI[];
}

// ─── Documents ──────────────────────────────────────────────────────

export async function getDocuments(orgId: string): Promise<PMDocument[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_documents").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  return (data ?? []) as PMDocument[];
}

// ─── Share Tokens ───────────────────────────────────────────────────

export async function getShareTokens(orgId: string): Promise<ShareToken[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_share_tokens").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  return (data ?? []) as ShareToken[];
}

export async function getShareTokenData(token: string) {
  const supabase = createServiceClient();
  const { data: tokenData } = await supabase
    .from("pm_share_tokens").select("*").eq("token", token).eq("is_active", true).single();
  if (!tokenData) return null;
  if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) return null;
  return tokenData as ShareToken;
}
