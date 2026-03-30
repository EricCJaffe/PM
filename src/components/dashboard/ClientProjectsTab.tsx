"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import type { Organization, ProjectWithStats, PhaseWithTasks } from "@/types/pm";
import type { PMStatus, Subtask } from "@/types/pm";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressBar } from "@/components/ProgressBar";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { useRealtimeTable } from "@/lib/useRealtimeTable";

interface ClientTask {
  id: string;
  name: string;
  description: string | null;
  status: PMStatus;
  owner: string | null;
  assigned_to: string | null;
  due_date: string | null;
  project_id: string | null;
  project_name: string | null;
  org_id: string | null;
  org_name: string | null;
  created_at: string;
  subtasks: Subtask[];
  phase_id: string | null;
  series_id: string | null;
  series_occurrence_date: string | null;
  is_exception: boolean;
}

interface AssignableMember {
  slug: string;
  display_name: string;
}

const STATUS_OPTIONS: PMStatus[] = ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"];

type SortOption = "past-due" | "due-date-asc" | "due-date-desc" | "status" | "project" | "created";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "past-due", label: "Past Due First" },
  { value: "due-date-asc", label: "Due Date (Earliest)" },
  { value: "due-date-desc", label: "Due Date (Latest)" },
  { value: "status", label: "Status" },
  { value: "project", label: "Project" },
  { value: "created", label: "Date Created" },
];

const STATUS_SORT_ORDER: Record<string, number> = {
  blocked: 0,
  "in-progress": 1,
  "not-started": 2,
  pending: 3,
  "on-hold": 4,
  complete: 5,
};

export function ClientProjectsTab({
  org,
  projects,
  allPhases,
}: {
  org: Organization;
  projects: ProjectWithStats[];
  allPhases: { project: ProjectWithStats; phases: PhaseWithTasks[] }[];
}) {
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [statusFilter, setStatusFilter] = useState<PMStatus | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("past-due");

  // Modal state
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ClientTask | null>(null);

  // Move modal state
  const [moveTaskId, setMoveTaskId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<"personal" | "client">("personal");
  const [moveOrgId, setMoveOrgId] = useState("");
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);

  const loadTasks = useCallback(() => {
    fetch(`/api/pm/tasks/my?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [org.id]);

  useRealtimeTable({
    table: "pm_tasks",
    filter: `org_id=eq.${org.id}`,
    onPayload: () => { loadTasks(); },
  });

  useEffect(() => {
    loadTasks();
    fetch(`/api/pm/members/assignable?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setMembers(data); })
      .catch(() => {});
  }, [org.id, loadTasks]);

  const memberMap = useMemo(() =>
    Object.fromEntries(members.map((m) => [m.slug, m.display_name])),
    [members]
  );

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const filteredAndSorted = useMemo(() => {
    let result = tasks;

    // Filter by status
    if (statusFilter !== "all") result = result.filter((t) => t.status === statusFilter);

    // Filter by project
    if (projectFilter !== "all") {
      if (projectFilter === "client-level") {
        result = result.filter((t) => !t.project_id);
      } else {
        result = result.filter((t) => t.project_id === projectFilter);
      }
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "past-due": {
          // Past due incomplete tasks first, then by due date ascending
          const aOverdue = a.due_date && a.due_date < today && a.status !== "complete" ? 1 : 0;
          const bOverdue = b.due_date && b.due_date < today && b.status !== "complete" ? 1 : 0;
          if (aOverdue !== bOverdue) return bOverdue - aOverdue;
          // Then by due date (nulls last)
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return 1;
          return a.due_date.localeCompare(b.due_date);
        }
        case "due-date-asc": {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        }
        case "due-date-desc": {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return b.due_date.localeCompare(a.due_date);
        }
        case "status":
          return (STATUS_SORT_ORDER[a.status] ?? 9) - (STATUS_SORT_ORDER[b.status] ?? 9);
        case "project":
          return (a.project_name || "zzz").localeCompare(b.project_name || "zzz");
        case "created":
          return b.created_at.localeCompare(a.created_at);
        default:
          return 0;
      }
    });

    return result;
  }, [tasks, statusFilter, projectFilter, sortBy, today]);

  const statusCounts = useMemo(() => {
    const source = projectFilter !== "all"
      ? tasks.filter((t) => projectFilter === "client-level" ? !t.project_id : t.project_id === projectFilter)
      : tasks;
    const counts: Record<string, number> = { all: source.length };
    for (const s of STATUS_OPTIONS) counts[s] = source.filter((t) => t.status === s).length;
    return counts;
  }, [tasks, projectFilter]);

  const overdueCount = useMemo(() =>
    tasks.filter((t) => t.due_date && t.due_date < today && t.status !== "complete").length,
    [tasks, today]
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    try {
      await fetch(`/api/pm/tasks/${id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch {}
  };

  const quickStatus = async (id: string, status: PMStatus) => {
    try {
      const res = await fetch(`/api/pm/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    } catch {}
  };

  const handleMoveTask = async () => {
    if (!moveTaskId) return;
    try {
      const body: Record<string, unknown> = {};
      if (moveTarget === "personal") {
        body.org_id = null;
        body.project_id = null;
      } else {
        body.org_id = moveOrgId;
        body.project_id = null;
      }
      const res = await fetch(`/api/pm/tasks/${moveTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (moveTarget === "personal" || moveOrgId !== org.id) {
        setTasks((prev) => prev.filter((t) => t.id !== moveTaskId));
      }
      setMoveTaskId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to move task");
    }
  };

  const openMoveModal = (taskId: string) => {
    setMoveTaskId(taskId);
    setMoveTarget("personal");
    setMoveOrgId("");
    if (orgs.length === 0) {
      fetch("/api/pm/organizations")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setOrgs(data.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name }))); })
        .catch(() => {});
    }
  };

  function TaskRow({ task }: { task: ClientTask }) {
    const isOverdue = task.due_date && task.due_date < today && task.status !== "complete";
    return (
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-pm-bg/50 group transition-colors">
        <button
          onClick={() => quickStatus(task.id, task.status === "complete" ? "not-started" : "complete")}
          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
            task.status === "complete" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-pm-border hover:border-pm-accent"
          }`}
        >
          {task.status === "complete" && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          )}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedTask(task)}>
          <div className={`text-sm font-medium ${task.status === "complete" ? "text-pm-muted line-through" : "text-pm-text"}`}>
            {task.name}
          </div>
          {task.description && (
            <div className="text-xs text-pm-muted truncate mt-0.5">{task.description}</div>
          )}
        </div>

        {(task.assigned_to || task.owner) && (
          <span className="text-xs text-pm-muted shrink-0">{memberMap[task.assigned_to || task.owner || ""] || task.assigned_to || task.owner}</span>
        )}

        {task.due_date && (
          <span className={`text-xs shrink-0 ${isOverdue ? "text-red-400 font-medium" : "text-pm-muted"}`}>
            {isOverdue && "⚠ "}
            {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}

        <StatusBadge status={task.status} />

        {task.project_name && (
          <span className="text-xs bg-pm-accent/10 text-pm-accent px-2 py-0.5 rounded-full shrink-0 max-w-[120px] truncate">
            {task.project_name}
          </span>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setSelectedTask(task)} className="p-1 text-pm-muted hover:text-pm-text" title="Edit">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button onClick={() => openMoveModal(task.id)} className="p-1 text-pm-muted hover:text-pm-text" title="Move">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
          </button>
          <button onClick={() => handleDelete(task.id)} className="p-1 text-pm-muted hover:text-red-400" title="Delete">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Project Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-pm-text">Projects</h3>
          <Link
            href={`/projects/new?org=${org.id}`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Project
          </Link>
        </div>

        {allPhases.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-pm-muted mb-3">No projects yet.</p>
            <Link
              href={`/projects/new?org=${org.id}`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors inline-block"
            >
              + New Project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allPhases.map(({ project, phases }) => {
              const pTotalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
              const pCompleteTasks = phases.reduce((sum, p) => sum + p.tasks.filter((t) => t.status === "complete").length, 0);
              const blockedTasks = phases.reduce((sum, p) => sum + p.tasks.filter((t) => t.status === "blocked").length, 0);
              const progress = pTotalTasks > 0 ? Math.round((pCompleteTasks / pTotalTasks) * 100) : 0;
              const statusLabel = progress === 100 ? "Complete" : progress > 0 ? "In Progress" : "Not Started";
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.slug}`}
                  className="card hover:border-pm-accent/50 transition-colors cursor-pointer block"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-pm-text">{project.name}</h4>
                      {project.description && (
                        <p className="text-xs text-pm-muted mt-1 line-clamp-2">{project.description}</p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2 ${
                      statusLabel === "Complete" ? "bg-pm-complete/20 text-pm-complete"
                        : statusLabel === "In Progress" ? "bg-pm-in-progress/20 text-pm-in-progress"
                          : "bg-pm-not-started/20 text-pm-muted"
                    }`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mb-3">
                    <ProgressBar value={progress} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="text-sm font-semibold text-pm-text">{phases.length}</div>
                      <div className="text-xs text-pm-muted">Phases</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-pm-text">{pTotalTasks}</div>
                      <div className="text-xs text-pm-muted">Tasks</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-pm-complete">{pCompleteTasks}</div>
                      <div className="text-xs text-pm-muted">Done</div>
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${blockedTasks > 0 ? "text-pm-blocked" : "text-pm-text"}`}>{blockedTasks}</div>
                      <div className="text-xs text-pm-muted">Blocked</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-pm-border/50 flex items-center justify-between">
                    <span className="text-xs text-pm-muted">{project.owner || "Unassigned"}</span>
                    <span className="text-xs text-pm-accent font-medium">{progress}% complete &rarr;</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── All Tasks ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-pm-text">All Tasks</h3>
            {overdueCount > 0 && (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">
                {overdueCount} overdue
              </span>
            )}
            <span className="text-sm text-pm-muted">{tasks.length} total</span>
          </div>
          <button
            onClick={() => setShowNewTask(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Task
          </button>
        </div>

        {/* Filters & Sort */}
        {tasks.length > 0 && (
          <div className="space-y-3 mb-4">
            {/* Sort + Project filter row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-pm-muted">Sort:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-pm-bg border border-pm-border rounded-lg px-2.5 py-1.5 text-xs text-pm-text"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {projects.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-pm-muted">Project:</label>
                  <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className="bg-pm-bg border border-pm-border rounded-lg px-2.5 py-1.5 text-xs text-pm-text"
                  >
                    <option value="all">All Projects</option>
                    <option value="client-level">Client-Level Only</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Status filter pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === "all" ? "bg-pm-accent text-white" : "bg-pm-card border border-pm-border text-pm-muted hover:text-pm-text"
                }`}
              >
                All ({statusCounts.all})
              </button>
              {STATUS_OPTIONS.filter((s) => statusCounts[s] > 0).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === s ? "bg-pm-accent text-white" : "bg-pm-card border border-pm-border text-pm-muted hover:text-pm-text"
                  }`}
                >
                  {s.replace("-", " ")} ({statusCounts[s]})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Task list */}
        {loading ? (
          <div className="text-pm-muted py-8">Loading tasks...</div>
        ) : filteredAndSorted.length > 0 ? (
          <div className="card">
            <div className="divide-y divide-pm-border">
              {filteredAndSorted.map((t) => <TaskRow key={t.id} task={t} />)}
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-pm-muted">
            <p className="text-sm">No tasks for this client yet. Create a task or add one from a project.</p>
          </div>
        ) : (
          <div className="text-center py-8 text-pm-muted text-sm">No tasks match the current filters.</div>
        )}
      </div>

      {/* New task modal */}
      {showNewTask && (
        <TaskDetailModal
          task={null}
          memberMap={memberMap}
          onClose={() => { setShowNewTask(false); loadTasks(); }}
          orgId={org.id}
          createContext={{ org_id: org.id }}
        />
      )}

      {/* Edit task modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          memberMap={memberMap}
          onDelete={loadTasks}
          onClose={() => { setSelectedTask(null); loadTasks(); }}
          orgId={org.id}
        />
      )}

      {/* Move task modal */}
      {moveTaskId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setMoveTaskId(null)}>
          <div className="bg-pm-card border border-pm-border rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-pm-text">Move Task</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-pm-border hover:border-pm-accent cursor-pointer">
                <input type="radio" name="target" checked={moveTarget === "personal"} onChange={() => setMoveTarget("personal")} className="accent-blue-500" />
                <div>
                  <div className="text-sm font-medium text-pm-text">Personal Task</div>
                  <div className="text-xs text-pm-muted">Remove from this client</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-pm-border hover:border-pm-accent cursor-pointer">
                <input type="radio" name="target" checked={moveTarget === "client"} onChange={() => setMoveTarget("client")} className="accent-blue-500" />
                <div>
                  <div className="text-sm font-medium text-pm-text">Move to Another Client</div>
                  <div className="text-xs text-pm-muted">Reassign to a different client</div>
                </div>
              </label>
              {moveTarget === "client" && (
                <select
                  value={moveOrgId}
                  onChange={(e) => setMoveOrgId(e.target.value)}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select client...</option>
                  {orgs.filter((o) => o.id !== org.id).map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setMoveTaskId(null)} className="px-4 py-2 text-pm-muted hover:text-pm-text text-sm font-medium rounded-lg">Cancel</button>
              <button
                onClick={handleMoveTask}
                disabled={moveTarget === "client" && !moveOrgId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                Move Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
