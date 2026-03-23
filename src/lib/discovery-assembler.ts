/**
 * Discovery findings assembler — gathers all discovery-phase data
 * (interviews, gap analysis, client notes, engagement info, site audits)
 * for an org to feed into the AI discovery summary generator.
 */

import { createServiceClient } from "@/lib/supabase/server";

export interface DiscoveryFindingsData {
  org_id: string;
  org_name: string;
  engagement: {
    title: string;
    type: string | null;
    service_line: string | null;
    deal_stage: string;
    estimated_value: number | null;
    discovery_notes: string | null;
  } | null;
  interviews: {
    title: string;
    interviewee: string | null;
    role: string | null;
    date: string;
    focus_areas: string[];
    key_findings: { finding: string; category: string; severity: string }[];
    action_items: { item: string; assigned_to: string | null; due_date: string | null }[];
    summary: string | null;
    status: string;
  }[];
  gaps: {
    title: string;
    category: string;
    severity: string;
    current_state: string | null;
    desired_state: string | null;
    gap_description: string | null;
    status: string;
    source: string | null;
    department_name: string | null;
  }[];
  notes: {
    title: string;
    body: string | null;
    note_type: string;
    author: string | null;
    date: string;
  }[];
  site_audits: {
    url: string;
    overall_score: number | null;
    overall_grade: string | null;
    rebuild_recommended: boolean;
    dimensions: Record<string, { score: number; grade: string }>;
    created_at: string;
  }[];
  stats: {
    total_interviews: number;
    completed_interviews: number;
    total_gaps: number;
    critical_gaps: number;
    high_gaps: number;
    resolved_gaps: number;
    total_notes: number;
    total_action_items: number;
  };
}

export async function assembleDiscoveryFindings(
  orgId: string,
  engagementId?: string
): Promise<DiscoveryFindingsData> {
  const supabase = createServiceClient();

  // Fetch org name
  const { data: org } = await supabase
    .from("pm_organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  // Fetch engagement (latest or specific)
  let engagementData = null;
  if (engagementId) {
    const { data } = await supabase
      .from("pm_engagements")
      .select("title, type, engagement_type, deal_stage, estimated_value, discovery_notes")
      .eq("id", engagementId)
      .single();
    engagementData = data;
  } else {
    const { data } = await supabase
      .from("pm_engagements")
      .select("title, type, engagement_type, deal_stage, estimated_value, discovery_notes")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    engagementData = data;
  }

  // Fetch discovery interviews
  const { data: interviews } = await supabase
    .from("pm_discovery_interviews")
    .select("title, interviewee_name, interviewee_role, interview_date, focus_areas, key_findings, action_items, summary, status")
    .eq("org_id", orgId)
    .order("interview_date", { ascending: false });

  // Fetch gap analysis items
  const { data: rawGaps } = await supabase
    .from("pm_gap_analysis")
    .select("title, category, severity, current_state, desired_state, gap_description, status, source, department_id")
    .eq("org_id", orgId)
    .order("priority", { ascending: false });

  // Fetch department names for gap items
  const departmentIds = [...new Set((rawGaps ?? []).map((g: { department_id: string | null }) => g.department_id).filter(Boolean))];
  let deptMap: Record<string, string> = {};
  if (departmentIds.length > 0) {
    const { data: depts } = await supabase
      .from("pm_departments")
      .select("id, name")
      .in("id", departmentIds);
    deptMap = Object.fromEntries((depts ?? []).map((d: { id: string; name: string }) => [d.id, d.name]));
  }

  // Fetch client notes (meeting, phone-call, follow-up, general — not client-update)
  const { data: notes } = await supabase
    .from("pm_client_notes")
    .select("title, body, note_type, author, created_at")
    .eq("org_id", orgId)
    .neq("note_type", "client-update")
    .eq("visibility", "internal")
    .order("created_at", { ascending: false })
    .limit(30);

  // Fetch site audits (completed)
  const { data: audits } = await supabase
    .from("pm_site_audits")
    .select("url, overall_score, overall_grade, rebuild_recommended, dimensions, created_at")
    .eq("org_id", orgId)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(3);

  // Map interviews
  const interviewList: DiscoveryFindingsData["interviews"] = (interviews ?? []).map((i: {
    title: string;
    interviewee_name: string | null;
    interviewee_role: string | null;
    interview_date: string;
    focus_areas: string[];
    key_findings: { finding: string; category: string; severity: string }[];
    action_items: { item: string; assigned_to: string | null; due_date: string | null }[];
    summary: string | null;
    status: string;
  }) => ({
    title: i.title,
    interviewee: i.interviewee_name,
    role: i.interviewee_role,
    date: i.interview_date,
    focus_areas: i.focus_areas ?? [],
    key_findings: i.key_findings ?? [],
    action_items: i.action_items ?? [],
    summary: i.summary,
    status: i.status,
  }));

  // Map gaps
  const gapList: DiscoveryFindingsData["gaps"] = (rawGaps ?? []).map((g: {
    title: string;
    category: string;
    severity: string;
    current_state: string | null;
    desired_state: string | null;
    gap_description: string | null;
    status: string;
    source: string | null;
    department_id: string | null;
  }) => ({
    title: g.title,
    category: g.category,
    severity: g.severity,
    current_state: g.current_state,
    desired_state: g.desired_state,
    gap_description: g.gap_description,
    status: g.status,
    source: g.source,
    department_name: g.department_id ? deptMap[g.department_id] ?? null : null,
  }));

  // Map notes
  const noteList: DiscoveryFindingsData["notes"] = (notes ?? []).map((n: {
    title: string;
    body: string | null;
    note_type: string;
    author: string | null;
    created_at: string;
  }) => ({
    title: n.title,
    body: n.body,
    note_type: n.note_type,
    author: n.author,
    date: n.created_at,
  }));

  // Map site audits
  const auditList: DiscoveryFindingsData["site_audits"] = (audits ?? []).map((a: {
    url: string;
    overall_score: number | null;
    overall_grade: string | null;
    rebuild_recommended: boolean;
    dimensions: Record<string, { score: number; grade: string }> | null;
    created_at: string;
  }) => ({
    url: a.url,
    overall_score: a.overall_score,
    overall_grade: a.overall_grade,
    rebuild_recommended: a.rebuild_recommended ?? false,
    dimensions: a.dimensions ?? {},
    created_at: a.created_at,
  }));

  // Compute stats
  const allActionItems = interviewList.flatMap((i) => i.action_items);
  const stats = {
    total_interviews: interviewList.length,
    completed_interviews: interviewList.filter((i) => i.status === "completed").length,
    total_gaps: gapList.length,
    critical_gaps: gapList.filter((g) => g.severity === "critical").length,
    high_gaps: gapList.filter((g) => g.severity === "high").length,
    resolved_gaps: gapList.filter((g) => g.status === "resolved").length,
    total_notes: noteList.length,
    total_action_items: allActionItems.length,
  };

  return {
    org_id: orgId,
    org_name: org?.name ?? "Unknown",
    engagement: engagementData
      ? {
          title: engagementData.title,
          type: engagementData.type,
          service_line: engagementData.engagement_type,
          deal_stage: engagementData.deal_stage,
          estimated_value: engagementData.estimated_value,
          discovery_notes: engagementData.discovery_notes,
        }
      : null,
    interviews: interviewList,
    gaps: gapList,
    notes: noteList,
    site_audits: auditList,
    stats,
  };
}
