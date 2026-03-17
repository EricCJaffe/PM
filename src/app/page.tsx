"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { Modal, Field, Input, Select, Textarea } from "@/components/Modal";
import type { PMStatus, Subtask } from "@/types/pm";

interface DashTask {
  id: string;
  name: string;
  description: string | null;
  status: PMStatus;
  owner: string | null;
  assigned_to: string | null;
  due_date: string | null;
  subtasks: Subtask[];
  project_id: string | null;
  phase_id: string | null;
  project_name: string | null;
  created_at: string;
}

interface MemberOption {
  slug: string;
  display_name: string;
}

const STATUSES: PMStatus[] = ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"];
const BOARD_COLUMNS: { status: PMStatus; label: string; color: string }[] = [
  { status: "not-started", label: "To Do", color: "border-pm-muted/30" },
  { status: "in-progress", label: "In Progress", color: "border-yellow-500/40" },
  { status: "blocked", label: "Blocked", color: "border-red-500/40" },
  { status: "complete", label: "Done", color: "border-green-500/40" },
];

export default function HomePage() {
  const [tasks, setTasks] = useState<DashTask[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [view, setView] = useState<"timeline" | "list" | "board">("timeline");
  const [selectedTask, setSelectedTask] = useState<DashTask | null>(null);
  const [siteOrgId, setSiteOrgId] = useState<string | null>(null);

  // New task form
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState<PMStatus>("not-started");
  const [newTaskOwner, setNewTaskOwner] = useState("");
  const [newTaskNotify, setNewTaskNotify] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load members
  useEffect(() => {
    fetch("/api/pm/organizations")
      .then((r) => r.json())
      .then((orgs) => {
        if (!Array.isArray(orgs) || orgs.length === 0) { setLoading(false); return; }
        setSiteOrgId(orgs[0].id);
        return fetch(`/api/pm/members/assignable?org_id=${orgs[0].id}`)
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) {
              const m = data.map((d: { slug: string; display_name: string }) => ({
                slug: d.slug,
                display_name: d.display_name,
              }));
              setMembers(m);
              if (m.length > 0) setSelectedMember(m[0].slug);
            }
          });
      })
      .catch(() => {})
      .finally(() => {});
  }, []);

  const loadTasks = useCallback(() => {
    if (!selectedMember) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/pm/tasks/my?assigned_to=${selectedMember}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTasks(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedMember]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const filteredTasks = tasks.filter((t) => {
    if (filter === "active") return t.status !== "complete";
    if (filter === "completed") return t.status === "complete";
    return true;
  });

  const today = new Date().toISOString().slice(0, 10);
  const memberMap = Object.fromEntries(members.map((m) => [m.slug, m.display_name]));
  const memberName = (slug: string) => memberMap[slug] || slug;
  const isOverdue = (t: DashTask) => t.due_date && t.status !== "complete" && t.due_date < today;
  const completedSubtasks = (t: DashTask) => (t.subtasks || []).filter((s) => s.done).length;
  const totalSubtasks = (t: DashTask) => (t.subtasks || []).length;

  // Timeline grouping (overdue / upcoming / completed)
  const activeTasks = filteredTasks.filter((t) => t.status !== "complete");
  const completedTasks = filteredTasks.filter((t) => t.status === "complete");
  const overdueTasks = activeTasks.filter((t) => t.due_date && t.due_date < today);
  const upcomingTasks = activeTasks.filter((t) => !t.due_date || t.due_date >= today);
  const sortByDue = (a: DashTask, b: DashTask) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  };
  overdueTasks.sort(sortByDue);
  upcomingTasks.sort(sortByDue);

  // List-by-project grouping
  const personalTasks = filteredTasks.filter((t) => !t.project_id || (t.project_name && t.project_name.includes("Personal")));
  const byProject = new Map<string, { name: string; tasks: DashTask[] }>();
  for (const t of filteredTasks) {
    if (!t.project_id) continue;
    if (t.project_name && t.project_name.includes("Personal")) continue;
    if (!byProject.has(t.project_id)) {
      byProject.set(t.project_id, { name: t.project_name || "Unknown Project", tasks: [] });
    }
    byProject.get(t.project_id)!.tasks.push(t);
  }

  const quickStatusChange = async (taskId: string, newStatus: PMStatus) => {
    await fetch(`/api/pm/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const createTask = async () => {
    if (!newTaskName.trim()) return;
    setSaving(true);
    try {
      const taskOwner = newTaskOwner || selectedMember || null;
      const body: Record<string, unknown> = {
        name: newTaskName,
        description: newTaskDesc || null,
        status: newTaskStatus,
        assigned_to: taskOwner,
        owner: taskOwner,
        due_date: newTaskDue || null,
        notify_assignee: newTaskNotify,
      };
      const res = await fetch("/api/pm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTasks((prev) => [{ ...data, project_name: null }, ...prev]);
      setNewTaskName("");
      setNewTaskDesc("");
      setNewTaskDue("");
      setNewTaskStatus("not-started");
      setNewTaskOwner("");
      setNewTaskNotify(false);
      setShowNewTask(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  // ─── Task Row (list / timeline views) ────────────────────────────────

  function TaskRow({ task, showProject }: { task: DashTask; showProject?: boolean }) {
    const overdue = isOverdue(task);
    return (
      <div
        onClick={() => setSelectedTask(task)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
          overdue
            ? "bg-red-500/5 border border-red-500/20 hover:bg-red-500/10"
            : "hover:bg-pm-bg/50 border border-transparent hover:border-pm-border/50"
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            quickStatusChange(task.id, task.status === "complete" ? "not-started" : "complete");
          }}
          className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
            task.status === "complete"
              ? "border-pm-complete bg-pm-complete text-white"
              : "border-pm-border hover:border-pm-accent"
          }`}
        >
          {task.status === "complete" && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${task.status === "complete" ? "text-pm-muted line-through" : "text-pm-text"}`}>
              {task.name}
            </span>
            {task.status !== "complete" && task.status !== "not-started" && (
              <StatusBadge status={task.status} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {showProject && task.project_name && <span className="text-xs text-pm-muted">{task.project_name}</span>}
            {showProject && !task.project_id && <span className="text-xs text-pm-muted italic">Personal</span>}
            {totalSubtasks(task) > 0 && (
              <span className="text-xs text-pm-muted">{completedSubtasks(task)}/{totalSubtasks(task)} subtasks</span>
            )}
          </div>
        </div>
        {task.due_date && (
          <span className={`text-xs shrink-0 font-medium ${overdue ? "text-red-400" : "text-pm-muted"}`}>
            {overdue ? `Overdue: ${task.due_date}` : task.due_date}
          </span>
        )}
        {!task.due_date && <span className="text-xs text-pm-muted/50 shrink-0">No due date</span>}
      </div>
    );
  }

  // ─── Board Card ──────────────────────────────────────────────────────

  function BoardCard({ task }: { task: DashTask }) {
    return (
      <div
        onClick={() => setSelectedTask(task)}
        className={`card cursor-pointer hover:border-pm-muted/50 transition-colors p-3 ${
          isOverdue(task) ? "border-red-500/30" : ""
        }`}
      >
        <div className="text-sm text-pm-text mb-1">{task.name}</div>
        <div className="flex items-center gap-2 flex-wrap">
          {task.project_name && (
            <span className="text-[10px] bg-pm-accent/10 text-pm-accent px-1.5 py-0.5 rounded">{task.project_name}</span>
          )}
          {!task.project_id && (
            <span className="text-[10px] bg-pm-muted/10 text-pm-muted px-1.5 py-0.5 rounded">Personal</span>
          )}
          {task.due_date && (
            <span className={`text-[10px] ${isOverdue(task) ? "text-red-400 font-medium" : "text-pm-muted"}`}>
              {task.due_date}
            </span>
          )}
          {task.owner && <span className="text-[10px] text-pm-muted">{memberName(task.owner)}</span>}
        </div>
        {totalSubtasks(task) > 0 && (
          <div className="mt-1.5 flex items-center gap-1">
            <div className="flex-1 h-1 bg-pm-border rounded-full overflow-hidden">
              <div className="h-full bg-pm-accent rounded-full" style={{ width: `${(completedSubtasks(task) / totalSubtasks(task)) * 100}%` }} />
            </div>
            <span className="text-[10px] text-pm-muted">{completedSubtasks(task)}/{totalSubtasks(task)}</span>
          </div>
        )}
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-pm-text">Dashboard</h1>
          <p className="text-pm-muted mt-1">
            {selectedMember ? `Welcome back, ${memberName(selectedMember)}` : "Your task overview"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            className="bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
          >
            {members.map((m) => (
              <option key={m.slug} value={m.slug}>{m.display_name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowNewTask(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Task
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card text-center py-4">
          <div className="text-2xl font-bold text-red-400">{tasks.filter((t) => t.due_date && t.due_date < today && t.status !== "complete").length}</div>
          <div className="text-xs text-pm-muted mt-1">Overdue</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-2xl font-bold text-pm-in-progress">{tasks.filter((t) => t.status === "in-progress").length}</div>
          <div className="text-xs text-pm-muted mt-1">In Progress</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-2xl font-bold text-pm-text">{tasks.filter((t) => t.status !== "complete" && (!t.due_date || t.due_date >= today)).length}</div>
          <div className="text-xs text-pm-muted mt-1">Upcoming</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-2xl font-bold text-pm-complete">{tasks.filter((t) => t.status === "complete").length}</div>
          <div className="text-xs text-pm-muted mt-1">Done</div>
        </div>
      </div>

      {/* Filters + View toggle */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-1 border border-pm-border rounded-lg p-0.5">
          {(["active", "all", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === f ? "bg-pm-accent/20 text-pm-accent" : "text-pm-muted hover:text-pm-text"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 border border-pm-border rounded-lg p-0.5 ml-auto">
          {([
            { id: "timeline" as const, label: "Timeline" },
            { id: "list" as const, label: "By Project" },
            { id: "board" as const, label: "Board" },
          ]).map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                view === v.id ? "bg-pm-accent/20 text-pm-accent" : "text-pm-muted hover:text-pm-text"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-pm-muted">
          {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* New task modal */}
      {showNewTask && (
        <Modal title="New Task" onClose={() => setShowNewTask(false)}>
          <div className="space-y-4">
            <Field label="Task Name">
              <Input
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                placeholder="Optional details..."
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <Select value={newTaskStatus} onChange={(e) => setNewTaskStatus(e.target.value as PMStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Due Date">
                <Input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)} />
              </Field>
            </div>
            <Field label="Owner / Assigned To">
              <Select value={newTaskOwner} onChange={(e) => setNewTaskOwner(e.target.value)}>
                <option value="">— Same as selected member —</option>
                {members.map((m) => <option key={m.slug} value={m.slug}>{m.display_name}</option>)}
              </Select>
            </Field>
            {newTaskOwner && newTaskOwner !== selectedMember && (
              <label className="flex items-center gap-2 text-xs text-pm-muted cursor-pointer">
                <input type="checkbox" checked={newTaskNotify} onChange={(e) => setNewTaskNotify(e.target.checked)} className="rounded border-pm-border" />
                Email notify owner when creating this task
              </label>
            )}
            <div className="flex items-center justify-between pt-2">
              <span />
              <button
                onClick={createTask}
                disabled={saving || !newTaskName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? "Adding..." : "Add Task"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Main content */}
      {loading ? (
        <p className="text-pm-muted">Loading tasks...</p>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-16 text-pm-muted">
          <p className="text-lg mb-2">No tasks found</p>
          <p className="text-sm">{filter === "active" ? "All caught up! No active tasks." : "No tasks match the current filter."}</p>
        </div>
      ) : view === "board" ? (
        /* ─── Board View ─── */
        <div className="grid grid-cols-4 gap-4">
          {BOARD_COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => {
              if (col.status === "not-started") return t.status === "not-started" || t.status === "pending" || t.status === "on-hold";
              return t.status === col.status;
            });
            return (
              <div key={col.status} className={`rounded-lg border-t-2 ${col.color}`}>
                <div className="flex items-center justify-between px-3 py-2">
                  <h3 className="text-xs font-semibold text-pm-muted uppercase tracking-wider">{col.label}</h3>
                  <span className="text-xs text-pm-muted">{colTasks.length}</span>
                </div>
                <div className="space-y-2 px-1 pb-2 min-h-[100px]">
                  {colTasks.map((t) => <BoardCard key={t.id} task={t} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === "list" ? (
        /* ─── List by Project ─── */
        <div className="space-y-6">
          {personalTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-pm-text mb-2 px-3 flex items-center gap-2">
                Personal
                <span className="text-[10px] bg-pm-accent/10 text-pm-accent px-1.5 py-0.5 rounded font-normal">Private</span>
              </h2>
              <div className="space-y-0.5">
                {personalTasks.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            </div>
          )}
          {[...byProject.entries()].map(([projectId, { name, tasks: projectTasks }]) => (
            <div key={projectId}>
              <h2 className="text-sm font-semibold text-pm-text mb-2 px-3">
                <Link href={`/projects/${projectId}`} className="hover:text-pm-accent transition-colors">{name}</Link>
              </h2>
              <div className="space-y-0.5">
                {projectTasks.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ─── Timeline View (default) ─── */
        <div className="space-y-6">
          {overdueTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                Overdue ({overdueTasks.length})
              </h2>
              <div className="space-y-1">
                {overdueTasks.map((t) => <TaskRow key={t.id} task={t} showProject />)}
              </div>
            </div>
          )}
          {upcomingTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-pm-muted mb-2">Upcoming ({upcomingTasks.length})</h2>
              <div className="space-y-1">
                {upcomingTasks.map((t) => <TaskRow key={t.id} task={t} showProject />)}
              </div>
            </div>
          )}
          {completedTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-pm-muted mb-2">Completed ({completedTasks.length})</h2>
              <div className="space-y-1 opacity-60">
                {completedTasks.map((t) => <TaskRow key={t.id} task={t} showProject />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick links */}
      <div className="mt-10 grid grid-cols-2 gap-4">
        <Link href="/projects" className="card text-center py-4 hover:border-pm-muted/50 transition-colors">
          <div className="text-sm font-medium text-pm-text">Projects</div>
          <div className="text-xs text-pm-muted mt-1">View all projects</div>
        </Link>
        <Link href="/clients" className="card text-center py-4 hover:border-pm-muted/50 transition-colors">
          <div className="text-sm font-medium text-pm-text">Clients</div>
          <div className="text-xs text-pm-muted mt-1">Manage clients</div>
        </Link>
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          memberMap={memberMap}
          onDelete={loadTasks}
          onClose={() => { setSelectedTask(null); loadTasks(); }}
        />
      )}
    </div>
  );
}
