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
  created_at: string;
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
  created_at: string;
  updated_at: string;
}

export interface Phase {
  id: string;
  project_id: string;
  slug: string;
  name: string;
  order: number;
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
  project_id: string;
  phase_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  owner: string | null;
  status: PMStatus;
  due_date: string | null;
  depends_on: string[];
  risk_id: string | null;
  subtasks: Subtask[];
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  text: string;
  done: boolean;
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

// ─── UI / Derived Types ──────────────────────────────────────────────

export interface ProjectWithStats extends Project {
  phase_count: number;
  task_count: number;
  complete_tasks: number;
  blocked_tasks: number;
  overall_progress: number;
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
