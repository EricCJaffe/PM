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
  phone: string | null;
  website: string | null;
  notes: string | null;
  pipeline_status: PipelineStatus;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
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
  status: ProjectStatus;
  is_personal: boolean;
  personal_member_slug: string | null;
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
  series_id: string | null;
  series_occurrence_date: string | null;
  is_exception: boolean;
  original_date: string | null;
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
  project_id: string;
  date: string;
  content: string;
  generated_by: "ai" | "manual";
  created_at: string;
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

export type PipelineStatus = "lead" | "prospect" | "proposal_sent" | "negotiation" | "client" | "inactive";

export type ProposalStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";

export type NoteType = "meeting" | "general" | "phone-call" | "follow-up";

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
  title: string;
  body: string | null;
  note_type: NoteType;
  author: string | null;
  pinned: boolean;
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
