import { createServiceClient } from "./supabase/server";
import type { Project, ProjectWithStats, Phase, PhaseWithTasks, Task, Risk, PMFile, ProjectTemplate, Organization, Member, AssignableMember, ProcessMap, Opportunity, KPI, PMDocument, ShareToken, Proposal, ProposalTemplate as ProposalTemplateType, ClientNote, ClientNoteAttachment, PipelineStatus, DocumentType, DocumentIntakeField, GeneratedDocument, DocumentSection, KBArticle, Department, DepartmentVocab, PortalSettings, PortalInvite, GapAnalysis, DiscoveryInterview, OnboardingChecklist, PlatformBranding, OrgBranding } from "@/types/pm";

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

/** Build a slug → display_name lookup map for all assignable members of an org */
export async function getMemberNameMap(orgId: string): Promise<Record<string, string>> {
  const members = await getAssignableMembers(orgId);
  const map: Record<string, string> = {};
  for (const m of members) {
    map[m.slug] = m.display_name;
  }
  return map;
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

export async function getProjects(orgId?: string, includePersonal = false): Promise<ProjectWithStats[]> {
  const supabase = createServiceClient();
  let query = supabase.from("pm_projects").select("*").order("created_at", { ascending: false });
  if (orgId) query = query.eq("org_id", orgId);

  const { data: projects } = await query;
  if (!projects?.length) return [];

  // Filter out personal projects in JS (safe even if column doesn't exist yet)
  const filtered = includePersonal
    ? projects
    : projects.filter((p: Record<string, unknown>) => !p.is_personal);

  // Build org name lookup
  const orgIds = [...new Set(filtered.map((p: { org_id: string }) => p.org_id))];
  const { data: orgs } = await supabase
    .from("pm_organizations")
    .select("id, name")
    .in("id", orgIds);
  const orgNameMap = new Map((orgs ?? []).map((o: { id: string; name: string }) => [o.id, o.name]));

  const stats: ProjectWithStats[] = [];
  for (const p of filtered) {
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
      .order("sort_order")
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
    .order("sort_order")
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

// ─── CRM / Pipeline ────────────────────────────────────────────────

export async function getOrganizationsByPipeline(): Promise<Record<PipelineStatus, Organization[]>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_organizations")
    .select("*")
    .order("name");
  const orgs = (data ?? []) as Organization[];
  const grouped: Record<PipelineStatus, Organization[]> = {
    lead: [], qualified: [], discovery_complete: [], proposal_sent: [], negotiation: [], closed_won: [], closed_lost: [],
  };
  for (const org of orgs) {
    const status = org.pipeline_status || "lead";
    if (grouped[status]) grouped[status].push(org);
  }
  return grouped;
}

// ─── Proposals ──────────────────────────────────────────────────────

export async function getProposals(orgId: string): Promise<Proposal[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_proposals")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Proposal[];
}

export async function getProposalById(id: string): Promise<Proposal | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_proposals")
    .select("*")
    .eq("id", id)
    .single();
  return data as Proposal | null;
}

export async function getProposalByShareToken(token: string): Promise<Proposal | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_proposals")
    .select("*")
    .eq("share_token", token)
    .single();
  return data as Proposal | null;
}

export async function getProposalTemplates(): Promise<ProposalTemplateType[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_proposal_templates")
    .select("*")
    .order("name");
  return (data ?? []) as ProposalTemplateType[];
}

export async function getProposalTemplateBySlug(slug: string): Promise<ProposalTemplateType | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_proposal_templates")
    .select("*")
    .eq("slug", slug)
    .single();
  return data as ProposalTemplateType | null;
}

// ─── Client Notes ───────────────────────────────────────────────────

export async function getClientNotes(orgId: string): Promise<ClientNote[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_client_notes")
    .select("*")
    .eq("org_id", orgId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as ClientNote[];
}

export async function getClientNoteById(id: string): Promise<ClientNote | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_client_notes")
    .select("*")
    .eq("id", id)
    .single();
  return data as ClientNote | null;
}

export async function getClientNoteAttachments(noteId: string): Promise<ClientNoteAttachment[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_client_note_attachments")
    .select("*")
    .eq("note_id", noteId)
    .order("created_at");
  return (data ?? []) as ClientNoteAttachment[];
}

// ─── Document Generation ────────────────────────────────────────────

export async function getDocumentTypes(): Promise<DocumentType[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("document_types")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return (data ?? []) as DocumentType[];
}

export async function getDocumentTypeBySlug(slug: string): Promise<DocumentType | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("document_types")
    .select("*")
    .eq("slug", slug)
    .single();
  return data as DocumentType | null;
}

export async function getDocumentIntakeFields(documentTypeId: string): Promise<DocumentIntakeField[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("document_intake_fields")
    .select("*")
    .eq("document_type_id", documentTypeId)
    .order("sort_order");
  return (data ?? []) as DocumentIntakeField[];
}

export async function getGeneratedDocuments(orgId?: string): Promise<GeneratedDocument[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from("generated_documents")
    .select("*, document_types(name, slug)")
    .order("updated_at", { ascending: false });
  if (orgId) query = query.eq("org_id", orgId);
  const { data } = await query;
  // Flatten joined fields
  return ((data ?? []) as Record<string, unknown>[]).map((d) => {
    const dt = d.document_types as { name: string; slug: string } | null;
    return {
      ...d,
      document_type_name: dt?.name ?? "",
      document_type_slug: dt?.slug ?? "",
      document_types: undefined,
    } as unknown as GeneratedDocument;
  });
}

export async function getGeneratedDocumentById(id: string): Promise<GeneratedDocument | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("generated_documents")
    .select("*, document_types(name, slug)")
    .eq("id", id)
    .single();
  if (!data) return null;
  const dt = (data as Record<string, unknown>).document_types as { name: string; slug: string } | null;
  return {
    ...data,
    document_type_name: dt?.name ?? "",
    document_type_slug: dt?.slug ?? "",
    document_types: undefined,
  } as unknown as GeneratedDocument;
}

export async function getDocumentSections(documentId: string): Promise<DocumentSection[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("document_sections")
    .select("*")
    .eq("document_id", documentId)
    .order("sort_order");
  return (data ?? []) as DocumentSection[];
}

// ─── Knowledge Base ─────────────────────────────────────────────────

/** Get KB articles scoped to an org (includes global articles) */
export async function getKBArticles(orgId?: string | null, projectId?: string | null): Promise<KBArticle[]> {
  const supabase = createServiceClient();
  let query = supabase.from("pm_kb_articles").select("*");

  if (projectId) {
    // Project scope: project articles + org articles + global
    query = query.or(`project_id.eq.${projectId},and(project_id.is.null,org_id.eq.${orgId}),org_id.is.null`);
  } else if (orgId) {
    // Org scope: org articles + global (no project-specific)
    query = query.or(`and(org_id.eq.${orgId},project_id.is.null),org_id.is.null`);
  } else {
    // Global only
    query = query.is("org_id", null);
  }

  const { data } = await query
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  return (data ?? []) as KBArticle[];
}

/** Get global KB articles only */
export async function getGlobalKBArticles(): Promise<KBArticle[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_kb_articles")
    .select("*")
    .is("org_id", null)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  return (data ?? []) as KBArticle[];
}

/** Get org-scoped KB articles (excludes global) */
export async function getOrgKBArticles(orgId: string): Promise<KBArticle[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_kb_articles")
    .select("*")
    .eq("org_id", orgId)
    .is("project_id", null)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  return (data ?? []) as KBArticle[];
}

// ─── Departments ────────────────────────────────────────────────────

export async function getDepartments(orgId: string): Promise<Department[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_departments")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  return (data ?? []) as Department[];
}

export async function getDepartmentById(id: string): Promise<Department | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_departments")
    .select("*")
    .eq("id", id)
    .single();
  return data as Department | null;
}

/** Get vocabulary overrides for an org (optionally filtered by department) */
export async function getDepartmentVocab(orgId: string, departmentId?: string): Promise<DepartmentVocab[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from("pm_department_vocab")
    .select("*")
    .eq("org_id", orgId)
    .order("sort_order");
  if (departmentId) {
    query = query.eq("department_id", departmentId);
  }
  const { data } = await query;
  return (data ?? []) as DepartmentVocab[];
}

/** Get resolved vocab labels for an org — merges base terms with any overrides */
export async function getResolvedVocab(
  orgId: string,
  departmentId?: string
): Promise<Record<string, string>> {
  const { BASE_VOCAB_TERMS } = await import("@/types/pm");
  const defaults: Record<string, string> = {};
  for (const term of BASE_VOCAB_TERMS) {
    defaults[term] = term.charAt(0).toUpperCase() + term.slice(1);
  }

  const overrides = await getDepartmentVocab(orgId, departmentId);
  for (const v of overrides) {
    defaults[v.base_term] = v.display_label;
  }
  return defaults;
}

// ─── Portal Settings ────────────────────────────────────────────────

export async function getPortalSettings(orgId: string): Promise<PortalSettings | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_portal_settings")
    .select("*")
    .eq("org_id", orgId)
    .single();
  return data as PortalSettings | null;
}

export async function getPortalInvites(orgId: string): Promise<PortalInvite[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_portal_invites")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  return (data ?? []) as PortalInvite[];
}

export async function getPortalInviteByToken(token: string): Promise<PortalInvite | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_portal_invites")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .single();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data as PortalInvite;
}

// ─── Gap Analysis ───────────────────────────────────────────────────

export async function getGapAnalysis(orgId: string, projectId?: string): Promise<GapAnalysis[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from("pm_gap_analysis")
    .select("*")
    .eq("org_id", orgId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const { data } = await query;
  return (data ?? []) as GapAnalysis[];
}

export async function getGapAnalysisById(id: string): Promise<GapAnalysis | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_gap_analysis")
    .select("*")
    .eq("id", id)
    .single();
  return data as GapAnalysis | null;
}

// ─── Discovery Interviews ───────────────────────────────────────────

export async function getDiscoveryInterviews(orgId: string, projectId?: string): Promise<DiscoveryInterview[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from("pm_discovery_interviews")
    .select("*")
    .eq("org_id", orgId)
    .order("interview_date", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const { data } = await query;
  return (data ?? []) as DiscoveryInterview[];
}

// ─── Onboarding Checklists ──────────────────────────────────────────

export async function getOnboardingChecklist(projectId: string): Promise<OnboardingChecklist[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_onboarding_checklists")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  return (data ?? []) as OnboardingChecklist[];
}

// ─── Branding ────────────────────────────────────────────────────────

export async function getPlatformBranding(): Promise<PlatformBranding | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_platform_branding")
    .select("*")
    .limit(1)
    .single();
  return data as PlatformBranding | null;
}

export async function getOrgBranding(orgId: string): Promise<OrgBranding | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pm_org_branding")
    .select("*")
    .eq("org_id", orgId)
    .single();
  return data as OrgBranding | null;
}
