/** Standardized status values used across all PM entities */
export type PMStatus =
  | "not-started"
  | "in-progress"
  | "complete"
  | "blocked"
  | "pending"
  | "on-hold";

/** Project-level status (subset of PMStatus + extras) */
export type ProjectStatus = "active" | "complete" | "paused" | "archived" | "on-hold";

/** Template slugs */
export type TemplateSlug =
  | "saas-rollout"
  | "ministry-discovery"
  | "tech-stack-modernization"
  | "custom";

/** Phase group for SaaS template */
export type PhaseGroup = "BUILD" | "GO-TO-MARKET" | "GROW" | "FOUNDATION";

// ─── Organization & Member Types ─────────────────────────────────────

export type OrgRole = "owner" | "admin" | "member" | "viewer";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  is_site_org: boolean;
  address: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  pipeline_status: PipelineStatus;
  client_status: ClientStatus;
  referred_by: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  billing_contact_phone: string | null;
  technical_contact_name: string | null;
  technical_contact_email: string | null;
  technical_contact_phone: string | null;
  other_contact_name: string | null;
  other_contact_email: string | null;
  other_contact_phone: string | null;
  converted_at: string | null;
  created_at: string;
}

/** A member available for assignment (includes source org context) */
export interface AssignableMember extends Member {
  /** Whether this member comes from the site-level org */
  is_site_staff: boolean;
  org_name: string;
}

export interface Member {
  id: string;
  org_id: string;
  slug: string;
  display_name: string;
  email: string | null;
  role: OrgRole;
  created_at: string;
}

// ─── Database Row Types ──────────────────────────────────────────────

export interface ProjectTemplate {
  id: string;
  slug: TemplateSlug;
  name: string;
  description: string;
  phases: TemplatePhase[];
  created_at: string;
}

export interface TemplatePhase {
  order: number;
  slug: string;
  name: string;
  group?: PhaseGroup;
  tasks?: TemplateTask[];
  sublayers?: string[];
}

export interface TemplateTask {
  slug: string;
  name: string;
  description?: string;
}

export interface Project {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  description: string;
  owner: string;
  template_slug: TemplateSlug;
  start_date: string;
  target_date: string | null;
  budget: number | null;
  projected_mrr: number | null;
  projected_one_time: number | null;
  status: ProjectStatus;
  is_personal: boolean;
  personal_member_slug: string | null;
  project_type: ProjectCategory;
  parent_project_id: string | null;
  onboarding_status: OnboardingStatus;
  created_at: string;
  updated_at: string;
}

export interface Phase {
  id: string;
  project_id: string;
  slug: string;
  name: string;
  phase_order: number;
  group: PhaseGroup | null;
  status: PMStatus;
  progress: number;
  owner: string | null;
  start_date: string | null;
  due_date: string | null;
  department_id: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  phase_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  owner: string | null;
  assigned_to: string | null;
  status: PMStatus;
  sort_order: number;
  due_date: string | null;
  depends_on: string[];
  risk_id: string | null;
  subtasks: Subtask[];
  department_id: string | null;
  engagement_id: string | null;
  completed_at: string | null;
  nudge_after_days: number | null;
  last_nudge_sent_at: string | null;
  series_id: string | null;
  series_occurrence_date: string | null;
  is_exception: boolean;
  original_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
  updated_at: string;
}

// ─── Recurring Task Types ───────────────────────────────────────────

export type RecurrenceMode = "fixed" | "completion";
export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface TaskSeries {
  id: string;
  project_id: string | null;
  phase_id: string | null;
  org_id: string | null;
  name: string;
  description: string | null;
  owner: string | null;
  assigned_to: string | null;
  status_template: PMStatus;
  subtasks_template: Subtask[];
  recurrence_mode: RecurrenceMode;
  freq: RecurrenceFreq;
  interval: number;
  by_weekday: number[];
  by_monthday: number[];
  by_setpos: number | null;
  dtstart: string;
  until_date: string | null;
  max_count: number | null;
  time_of_day: string | null;
  timezone: string;
  completion_delay_days: number | null;
  is_paused: boolean;
  paused_at: string | null;
  next_occurrence: string | null;
  last_generated_date: string | null;
  generated_count: number;
  created_at: string;
  updated_at: string;
}

export interface SeriesException {
  id: string;
  series_id: string;
  exception_date: string;
  exception_type: "skip" | "reschedule";
  reschedule_to: string | null;
  reason: string | null;
  created_at: string;
}

export interface Subtask {
  text: string;
  done: boolean;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_size: number;
  content_type: string | null;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface Risk {
  id: string;
  project_id: string;
  slug: string;
  title: string;
  description: string | null;
  probability: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  mitigation: string | null;
  owner: string | null;
  status: "open" | "mitigated" | "closed";
  created_at: string;
}

export interface DailyLog {
  id: string;
  project_id: string | null;
  org_id: string | null;
  log_date: string;
  content: string;
  generated_by: "ai" | "manual" | "standup-agent";
  log_type: DailyLogType;
  created_at: string;
}

export type DailyLogType = "daily" | "standup" | "rollup" | "blocker" | "hub" | "decisions";

export interface StandupData {
  org_id: string;
  date: string;
  completed_yesterday: StandupItem[];
  in_progress_today: StandupItem[];
  blocked: StandupItem[];
  due_soon: StandupItem[];
  overdue: StandupItem[];
  project_summaries: ProjectStandupSummary[];
}

export interface StandupItem {
  task_name: string;
  project_name: string;
  owner: string | null;
  due_date: string | null;
  status: string;
}

export interface ProjectStandupSummary {
  project_id: string;
  project_name: string;
  current_phase: string | null;
  phase_progress: number;
  open_tasks: number;
  blocked_tasks: number;
  completed_this_week: number;
  overdue_tasks: number;
}

export interface PMFile {
  id: string;
  project_id: string;
  storage_path: string;
  file_type: "project" | "phase" | "task" | "risk" | "decision" | "status" | "resource" | "report" | "daily";
  title: string;
  frontmatter: Record<string, unknown>;
  last_synced_at: string;
}

// ─── CRM / Pipeline Types ───────────────────────────────────────────

export type PipelineStatus = "lead" | "qualified" | "discovery_complete" | "proposal_sent" | "negotiation" | "closed_won" | "closed_lost";

export type ClientStatus = "prospect" | "client" | "inactive";

export type DealStage = PipelineStatus;

export type EngagementType = "new_prospect" | "existing_client";

export type EngagementServiceLine = "process_audit" | "ai_automation" | "marketing" | "business_consulting" | "website_dev" | "website_build" | "other";

export interface Engagement {
  id: string;
  org_id: string;
  title: string;
  type: EngagementType;
  deal_stage: DealStage;
  assigned_to: string | null;
  estimated_value: number | null;
  projected_mrr: number | null;
  projected_one_time: number | null;
  probability_override: number | null;
  expected_close_date: string | null;
  closed_reason: string | null;
  discovery_notes: string | null;
  engagement_type: EngagementServiceLine | null;
  referral_source: string | null;
  created_at: string;
  updated_at: string;
}

export interface EngagementTaskTemplate {
  id: string;
  trigger_stage: DealStage;
  title: string;
  description: string | null;
  due_offset_days: number;
  nudge_after_days: number | null;
  engagement_type: "new_prospect" | "existing_client" | "both";
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export type EngagementAttachmentCategory = "general" | "discovery" | "proposal" | "contract" | "intake" | "project-files" | "other";

export interface EngagementAttachment {
  id: string;
  engagement_id: string;
  file_name: string;
  file_size: number;
  content_type: string | null;
  storage_path: string;
  category: EngagementAttachmentCategory;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export type ProposalStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";

export type NoteType = "meeting" | "general" | "phone-call" | "follow-up" | "client-update";
export type ClientNoteStatus = "draft" | "sent" | "archived";
export type NoteVisibility = "internal" | "client";

export interface ProposalTemplateField {
  name: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "select";
  required: boolean;
  placeholder: string;
  options?: string[];
}

export interface ProposalTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  boilerplate: string | null;
  variable_fields: ProposalTemplateField[];
  output_format: "html" | "markdown";
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  org_id: string;
  template_slug: string | null;
  title: string;
  status: ProposalStatus;
  form_data: Record<string, string>;
  generated_content: string | null;
  share_token: string;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalAttachment {
  id: string;
  proposal_id: string;
  file_name: string;
  file_size: number;
  content_type: string | null;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface ClientNote {
  id: string;
  org_id: string;
  project_id: string | null;
  title: string;
  body: string | null;
  note_type: NoteType;
  visibility: NoteVisibility;
  author: string | null;
  pinned: boolean;
  status: ClientNoteStatus;
  sent_at: string | null;
  sent_to_email: string | null;
  sent_to_name: string | null;
  period_start: string | null;
  period_end: string | null;
  subject: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientNoteAttachment {
  id: string;
  note_id: string;
  file_name: string;
  file_size: number;
  content_type: string | null;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

// ─── Client Dashboard Types ─────────────────────────────────────────

export interface ProcessMapStep {
  id: string;
  name: string;
  status: "not-started" | "in-progress" | "complete";
  substeps?: { name: string; done: boolean }[];
}

export interface ProcessMap {
  id: string;
  org_id: string;
  project_id: string | null;
  slug: string;
  name: string;
  department: string | null;
  description: string | null;
  steps: ProcessMapStep[];
  created_at: string;
  updated_at: string;
}

export type OpportunityStatus = "identified" | "proposed" | "approved" | "in-progress" | "complete" | "declined";

export interface Opportunity {
  id: string;
  org_id: string;
  project_id: string | null;
  process_map_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  estimated_savings: number;
  savings_unit: "year" | "month" | "quarter" | "one-time";
  complexity: "low" | "medium" | "high";
  estimated_timeline: string | null;
  priority_score: number;
  status: OpportunityStatus;
  source: string | null;
  owner: string | null;
  created_at: string;
  updated_at: string;
}

export interface KPI {
  id: string;
  org_id: string;
  project_id: string | null;
  slug: string;
  name: string;
  current_value: number;
  target_value: number | null;
  unit: string;
  trend: "up" | "down" | "flat";
  period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  category: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PMDocument {
  id: string;
  org_id: string;
  project_id: string | null;
  slug: string;
  title: string;
  category: "sop" | "document" | "report" | "template" | "policy" | "other";
  department: string | null;
  description: string | null;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

// ─── Project Intake Types ────────────────────────────────────────

export type ProjectType =
  | "personal_app"
  | "client_marketing"
  | "client_web_app"
  | "church_site"
  | "nonprofit"
  | "ecommerce"
  | "saas"
  | "other";

export interface ProjectIntakeData {
  project_type: ProjectType;
  is_greenfield: boolean;
  v1_done: string;
  target_launch: string | null;
  github_repo: string | null;
  vercel_project: string | null;
  supabase_ref: string | null;
  framework: "nextjs" | "remix" | "other";
  stack_deviations: string | null;
  seo_enabled: boolean;
  security_review: boolean;
  multi_tenant: boolean;
  a2a_enabled: boolean;
  payments_enabled: boolean;
  hipaa_scope: boolean;
  integrations: string[];
  integration_notes: string | null;
}

export interface ClientContextData {
  problem_in_their_words: string;
  what_fixed_looks_like: string;
  technical_comfort: "none" | "basic" | "moderate" | "high";
  primary_contact_name: string;
  primary_contact_role: string;
  budget_range: string | null;
  hard_deadline: string | null;
  known_constraints: string | null;
  decisions_needed: string | null;
}

export interface ProjectIntakeFormData {
  name: string;
  slug: string;
  org_id: string;
  template_slug: string;
  owner: string;
  description: string | null;
  target_date: string | null;
  budget: number | null;
  engagement_id: string | null;
  intake_data: ProjectIntakeData;
  client_context: ClientContextData;
}

export interface ShareToken {
  id: string;
  org_id: string;
  project_id: string | null;
  token: string;
  label: string | null;
  permissions: "read" | "read-comment";
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

// ─── UI / Derived Types ──────────────────────────────────────────────

export interface ProjectWithStats extends Project {
  phase_count: number;
  task_count: number;
  complete_tasks: number;
  blocked_tasks: number;
  overall_progress: number;
  org_name?: string;
}

export interface PhaseWithTasks extends Phase {
  tasks: Task[];
}

// ─── Document Generation Types ───────────────────────────────────────

export type DocumentStatus = "draft" | "review" | "approved" | "sent" | "signed" | "archived";

export interface DocumentType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  html_template: string;
  css_styles: string;
  header_html: string;
  footer_html: string;
  variables: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentIntakeField {
  id: string;
  document_type_id: string;
  field_key: string;
  label: string;
  field_type: "text" | "textarea" | "number" | "date" | "select" | "multi-select" | "currency" | "toggle";
  options: string[] | null;
  default_value: string | null;
  placeholder: string | null;
  help_text: string | null;
  validation: Record<string, unknown> | null;
  section: string;
  sort_order: number;
  is_required: boolean;
  ai_hint: string | null;
  created_at: string;
}

export interface GeneratedDocument {
  id: string;
  document_type_id: string;
  org_id: string | null;
  project_id: string | null;
  title: string;
  status: DocumentStatus;
  intake_data: Record<string, string>;
  compiled_html: string | null;
  pdf_storage_path: string | null;
  version: number;
  created_by: string | null;
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  document_type_name?: string;
  document_type_slug?: string;
  org_name?: string;
}

export interface DocumentSection {
  id: string;
  document_id: string;
  section_key: string;
  title: string;
  content_html: string;
  sort_order: number;
  is_locked: boolean;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentActivity {
  id: string;
  document_id: string;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

// ─── Site Audit Types ───────────────────────────────────────────────

export type AuditVertical = "church" | "agency" | "nonprofit" | "general";
export type AuditStatus = "pending" | "running" | "complete" | "failed";
export type AuditGrade = "A" | "B" | "C" | "D" | "D-" | "F";

export interface AuditDimensionScore {
  grade: AuditGrade;
  score: number; // 0–100
  weight: number; // e.g. 0.20
  findings: string[];
}

export interface AuditScores {
  seo: AuditDimensionScore;
  entity: AuditDimensionScore;
  ai_discoverability: AuditDimensionScore;
  conversion: AuditDimensionScore;
  content: AuditDimensionScore;
  a2a_readiness: AuditDimensionScore;
}

export interface AuditOverall {
  grade: AuditGrade;
  score: number; // weighted 0–100
  rebuild_recommended: boolean;
  rebuild_reason: string | null;
}

export interface AuditGapItem {
  item: string;
  current_state: string;
  standard: string;
  gap: string;
}

export interface AuditRecommendation {
  title: string;
  priority: "high" | "medium" | "low";
  effort: "quick" | "moderate" | "significant";
  impact: "high" | "medium" | "low";
  description: string;
}

export interface AuditQuickWin {
  action: string;
  time_estimate: string;
  impact: string;
}

export interface AuditPageToBuild {
  slug: string;
  title: string;
  priority: "P0" | "P1" | "P2";
  notes: string;
}

export interface AuditRebuildTimeline {
  phase: string;
  focus: string;
  deliverables: string;
}

export interface AuditPlatformComparison {
  current: string;
  recommended: string;
}

export interface SiteAudit {
  id: string;
  org_id: string | null;
  prospect_name: string | null;
  engagement_id: string | null;
  url: string;
  vertical: AuditVertical;
  status: AuditStatus;
  scores: AuditScores | null;
  overall: AuditOverall | null;
  gaps: Record<string, AuditGapItem[]> | null;
  recommendations: AuditRecommendation[] | null;
  quick_wins: AuditQuickWin[] | null;
  pages_found: string[] | null;
  pages_missing: string[] | null;
  pages_to_build: AuditPageToBuild[] | null;
  rebuild_timeline: AuditRebuildTimeline[] | null;
  platform_comparison: AuditPlatformComparison | null;
  extra_context: string | null;
  audit_summary: string | null;
  document_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkflowType = "remediation" | "rebuild" | "guided_rebuild";
export type WorkflowStatus = "active" | "paused" | "complete";

export interface AuditWorkflow {
  id: string;
  audit_id: string;
  org_id: string | null;
  project_id: string | null;
  workflow_type: WorkflowType;
  status: WorkflowStatus;
  target_scores: Record<string, number>;
  current_score: number | null;
  latest_audit_id: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AuditSnapshot {
  id: string;
  audit_id: string;
  org_id: string | null;
  prospect_name: string | null;
  html_storage_path: string | null;
  md_storage_path: string | null;
  overall_grade: string | null;
  overall_score: number | null;
  dimension_scores: Record<string, number> | null;
  url: string;
  vertical: string;
  audit_date: string;
  created_at: string;
}

// ─── Knowledge Base Types ────────────────────────────────────────────

export type KBCategory =
  | "company-profile"
  | "client-profile"
  | "strategy"
  | "playbook"
  | "lessons-learned"
  | "industry"
  | "relationship"
  | "general";

export interface KBArticle {
  id: string;
  org_id: string | null;
  project_id: string | null;
  slug: string;
  title: string;
  category: KBCategory;
  content: string;
  tags: string[];
  is_pinned: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Department Types ────────────────────────────────────────────────

export interface Department {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  description: string | null;
  head_name: string | null;
  head_email: string | null;
  member_count: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Base vocabulary terms that can be renamed per org/department */
export type BaseVocabTerm = "vision" | "people" | "data" | "processes" | "meetings" | "issues";

export const BASE_VOCAB_TERMS: BaseVocabTerm[] = [
  "vision", "people", "data", "processes", "meetings", "issues",
];

export interface DepartmentVocab {
  id: string;
  org_id: string;
  department_id: string | null;
  base_term: BaseVocabTerm;
  display_label: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

// ─── Client Portal Types ────────────────────────────────────────────

export interface PortalSettings {
  id: string;
  org_id: string;
  show_projects: boolean;
  show_phases: boolean;
  show_tasks: boolean;
  show_risks: boolean;
  show_process_maps: boolean;
  show_kpis: boolean;
  show_documents: boolean;
  show_proposals: boolean;
  show_reports: boolean;
  show_daily_logs: boolean;
  show_engagements: boolean;
  show_kb_articles: boolean;
  allow_task_comments: boolean;
  allow_file_uploads: boolean;
  allow_chat: boolean;
  portal_title: string | null;
  welcome_message: string | null;
  primary_color: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortalInvite {
  id: string;
  org_id: string;
  email: string;
  name: string | null;
  role: string;
  invited_by: string | null;
  token: string;
  accepted_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

// ─── Discovery / Onboarding Types ───────────────────────────────────

export type ProjectCategory = "standard" | "onboarding" | "personal" | "remediation" | "rebuild";
export type OnboardingStatus = "not-started" | "discovery" | "gap-analysis" | "planning" | "active" | "complete";
export type GapSeverity = "low" | "medium" | "high" | "critical";
export type GapStatus = "identified" | "acknowledged" | "planned" | "in-progress" | "resolved";
export type GapSource = "interview" | "observation" | "document-review" | "audit" | "other";

export interface GapAnalysis {
  id: string;
  org_id: string;
  project_id: string | null;
  engagement_id: string | null;
  department_id: string | null;
  category: string;
  title: string;
  current_state: string | null;
  desired_state: string | null;
  gap_description: string | null;
  severity: GapSeverity;
  priority: number;
  status: GapStatus;
  resolution_notes: string | null;
  resolved_at: string | null;
  task_id: string | null;
  discovered_by: string | null;
  discovered_at: string;
  source: GapSource | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryInterview {
  id: string;
  org_id: string;
  project_id: string | null;
  engagement_id: string | null;
  department_id: string | null;
  note_id: string | null;
  title: string;
  interviewee_name: string | null;
  interviewee_role: string | null;
  interview_date: string;
  duration_minutes: number | null;
  focus_areas: string[];
  key_findings: { finding: string; category: string; severity: string }[];
  action_items: { item: string; assigned_to: string | null; due_date: string | null }[];
  follow_up_needed: boolean;
  status: "scheduled" | "completed" | "cancelled" | "follow-up";
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export type OnboardingChecklistCategory = "discovery" | "setup" | "kickoff" | "documentation" | "handoff";

export interface OnboardingChecklist {
  id: string;
  org_id: string;
  project_id: string;
  engagement_id: string | null;
  category: OnboardingChecklistCategory;
  title: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
  status: "pending" | "in-progress" | "complete" | "skipped";
  completed_by: string | null;
  completed_at: string | null;
  task_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Branding Types ─────────────────────────────────────────────────

export type CoBrandMode = "agency-only" | "co-branded" | "client-only" | "white-label";

export interface PlatformBranding {
  id: string;
  company_name: string;
  company_short_name: string;
  tagline: string | null;
  logo_url: string | null;
  logo_icon_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  text_on_primary: string;
  text_on_light: string;
  bg_dark: string;
  bg_light: string;
  font_heading: string;
  font_body: string;
  email_from_name: string;
  email_from_address: string;
  website_url: string | null;
  support_email: string | null;
  footer_text: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgBranding {
  id: string;
  org_id: string;
  client_logo_url: string | null;
  client_logo_icon_url: string | null;
  client_company_name: string | null;
  primary_color_override: string | null;
  secondary_color_override: string | null;
  accent_color_override: string | null;
  co_brand_mode: CoBrandMode;
  cover_bg_override: string | null;
  content_bg_override: string | null;
  footer_text_override: string | null;
  email_from_name_override: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Resolved branding — platform defaults merged with org overrides */
export interface ResolvedBranding {
  // Identity
  agency_name: string;
  agency_short_name: string;
  agency_tagline: string | null;
  agency_logo_url: string | null;
  agency_logo_icon_url: string | null;
  client_name: string | null;
  client_logo_url: string | null;
  client_logo_icon_url: string | null;
  co_brand_mode: CoBrandMode;
  // Colors (resolved — org override wins if set)
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  text_on_primary: string;
  text_on_light: string;
  bg_dark: string;
  bg_light: string;
  // Typography
  font_heading: string;
  font_body: string;
  // Email
  email_from_name: string;
  email_from_address: string;
  // Footer & links
  website_url: string | null;
  footer_text: string;
  location: string | null;
}

// ─── Chat / AI Types ─────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: {
    action?: string;
    affected_entities?: string[];
  };
}

// ─── Web Design Pass System ──────────────────────────────────────────

export type WebPassType = "discovery" | "foundation" | "content" | "polish" | "go-live";
export type WebPassStatus = "locked" | "active" | "in-review" | "approved" | "rejected";
export type WebPassFeedbackType = "approve" | "comment" | "request-change";

export interface WebPass {
  id: string;
  project_id: string;
  org_id: string;
  pass_number: number;
  pass_type: WebPassType;
  status: WebPassStatus;
  form_data: Record<string, unknown>;
  deliverable_html: string | null;
  deliverable_html_b: string | null;
  selected_option: "a" | "b" | null;
  share_token: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  scoring_results: Record<string, unknown> | null;
  site_audit_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebPassComment {
  id: string;
  pass_id: string;
  section_id: string;
  section_label: string | null;
  feedback_type: WebPassFeedbackType;
  comment: string | null;
  commenter_name: string | null;
  commenter_email: string | null;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  ai_applied: boolean;
  created_at: string;
}

export interface Pass1FormData {
  vertical: string;
  business_name: string;
  tagline: string;
  brand_colors: { primary: string; secondary: string; accent: string };
  logo_url: string | null;
  pages: string[];
  service_times?: string;
  target_audience: string;
  tone: string;
  reference_sites?: string[];
}

export interface Pass2PageContent {
  page_slug: string;
  page_title: string;
  hero_headline: string;
  hero_subtext: string;
  body_content: string;
  cta_label: string;
  cta_url: string;
  photo_preference: "uploaded" | "stock" | "none";
  extra_notes: string;
}

export interface Pass2FormData {
  pages: Record<string, Pass2PageContent>;
}

// ─── Agent Job Types ──────────────────────────────────────────────────────────

export type AgentJobType =
  | "engagement_risk_scan"
  | "weekly_rollup"
  | "audit_follow_up"
  | "document_draft";

export type AgentJobStatus = "pending" | "running" | "complete" | "failed" | "skipped";

export interface AgentJob {
  id: string;
  org_id: string | null;
  job_type: AgentJobType;
  payload: Record<string, unknown>;
  status: AgentJobStatus;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

export interface EnqueueJobOptions {
  org_id?: string;
  job_type: AgentJobType;
  payload?: Record<string, unknown>;
  /** ISO string — defaults to now */
  scheduled_at?: string;
}
