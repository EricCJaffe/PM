"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import type { PMStatus, Subtask, TaskComment, TaskAttachment } from "@/types/pm";
import { TaskDetailModal } from "@/components/TaskDetailModal";

interface MyTask {
  id: string;
  project_id: string | null;
  phase_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  owner: string | null;
  assigned_to: string | null;
  status: PMStatus;
  due_date: string | null;
  subtasks: Subtask[];
  project_name: string | null;
  created_at: string;
}

interface MemberOption {
  slug: string;
  display_name: string;
}

const STATUSES: PMStatus[] = ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"];

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [selectedTask, setSelectedTask] = useState<MyTask | null>(null);

  // Personal project
  const [personalProjectId, setPersonalProjectId] = useState<string | null>(null);

  // New task form
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState<PMStatus>("not-started");
  const [newTaskOwner, setNewTaskOwner] = useState("");
  const [newTaskPersonal, setNewTaskPersonal] = useState(false);
  const [newTaskNotify, setNewTaskNotify] = useState(false);
  const [saving, setSaving] = useState(false);

  const [siteOrgId, setSiteOrgId] = useState<string | null>(null);

  // Load all members for the picker
  useEffect(() => {
    fetch("/api/pm/organizations")
      .then((r) => r.json())
      .then((orgs) => {
        if (!Array.isArray(orgs) || orgs.length === 0) return;
        setSiteOrgId(orgs[0].id);
        // Load members from first org (site org) for picker
        return fetch(`/api/pm/members/assignable?org_id=${orgs[0].id}`)
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) {
              setMembers(data.map((m: { slug: string; display_name: string }) => ({
                slug: m.slug,
                display_name: m.display_name,
              })));
              // Default to first member
              if (data.length > 0) {
                setSelectedMember(data[0].slug);
              }
            }
          });
      })
      .catch(() => {});
  }, []);

  // Fetch or create personal project when member changes
  useEffect(() => {
    if (!selectedMember || !siteOrgId) { setPersonalProjectId(null); return; }
    fetch(`/api/pm/projects/personal?member_slug=${selectedMember}&org_id=${siteOrgId}`)
      .then((r) => r.json())
      .then((data) => { if (data.id) setPersonalProjectId(data.id); })
      .catch(() => {});
  }, [selectedMember, siteOrgId]);

  const loadTasks = useCallback(() => {
    if (!selectedMember) {
      // Load all standalone tasks
      fetch("/api/pm/tasks/my")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setTasks(data); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      fetch(`/api/pm/tasks/my?assigned_to=${selectedMember}`)
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setTasks(data); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [selectedMember]);

  useEffect(() => {
    setLoading(true);
    loadTasks();
  }, [loadTasks]);

  const filteredTasks = tasks.filter((t) => {
    if (filter === "active") return t.status !== "complete";
    if (filter === "completed") return t.status === "complete";
    return true;
  });

  // Group by project — separate personal project tasks from regular project tasks
  const standalone = filteredTasks.filter((t) => !t.project_id);
  const personalProjectTasks = filteredTasks.filter((t) => t.project_id === personalProjectId && personalProjectId);
  const byProject = new Map<string, { name: string; tasks: MyTask[] }>();
  for (const t of filteredTasks) {
    if (!t.project_id) continue;
    if (t.project_id === personalProjectId) continue; // handled separately
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

  const createStandaloneTask = async () => {
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
      if (newTaskPersonal && personalProjectId) {
        body.project_id = personalProjectId;
      }
      const res = await fetch("/api/pm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const projectName = newTaskPersonal ? `${memberName(selectedMember)} — Personal` : null;
      setTasks((prev) => [{ ...data, project_name: projectName }, ...prev]);
      setNewTaskName("");
      setNewTaskDesc("");
      setNewTaskDue("");
      setNewTaskStatus("not-started");
      setNewTaskOwner("");
      setNewTaskPersonal(false);
      setNewTaskNotify(false);
      setShowNewTask(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  const memberName = (slug: string) => members.find((m) => m.slug === slug)?.display_name || slug;

  const isOverdue = (t: MyTask) => t.due_date && t.status !== "complete" && new Date(t.due_date) < new Date();

  const completedSubtasks = (t: MyTask) => (t.subtasks || []).filter((s) => s.done).length;
  const totalSubtasks = (t: MyTask) => (t.subtasks || []).length;

  function TaskRow({ task }: { task: MyTask }) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-pm-bg/50 group border border-transparent hover:border-pm-border/50 transition-colors cursor-pointer"
        onClick={() => setSelectedTask(task)}
      >
        {/* Quick complete toggle */}
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
          {totalSubtasks(task) > 0 && (
            <span className="text-xs text-pm-muted">{completedSubtasks(task)}/{totalSubtasks(task)} subtasks</span>
          )}
        </div>

        {task.due_date && (
          <span className={`text-xs shrink-0 ${isOverdue(task) ? "text-red-400 font-medium" : "text-pm-muted"}`}>
            {task.due_date}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-pm-text">My Tasks</h1>
          <p className="text-pm-muted mt-1">Tasks across all projects and standalone items</p>
        </div>
        <button
          onClick={() => setShowNewTask(!showNewTask)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showNewTask ? "Cancel" : "+ New Task"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <select
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
          className="bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
        >
          <option value="">All standalone tasks</option>
          {members.map((m) => (
            <option key={m.slug} value={m.slug}>{m.display_name}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 border border-pm-border rounded-lg p-0.5">
          {(["active", "all", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === f
                  ? "bg-pm-accent/20 text-pm-accent"
                  : "text-pm-muted hover:text-pm-text"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <span className="text-xs text-pm-muted ml-auto">
          {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* New task form */}
      {showNewTask && (
        <div className="card mb-6 space-y-3">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-pm-muted block mb-1">Task Name *</label>
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Task name..."
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-pm-muted block mb-1">Description</label>
              <textarea
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500 resize-none"
                rows={2}
                placeholder="Optional details..."
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-pm-muted block mb-1">Status</label>
                <select
                  value={newTaskStatus}
                  onChange={(e) => setNewTaskStatus(e.target.value as PMStatus)}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-pm-muted block mb-1">Due Date</label>
                <input
                  type="date"
                  value={newTaskDue}
                  onChange={(e) => setNewTaskDue(e.target.value)}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-pm-muted block mb-1">Owner</label>
                <select
                  value={newTaskOwner}
                  onChange={(e) => setNewTaskOwner(e.target.value)}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
                >
                  <option value="">— Same as selected member —</option>
                  {members.map((m) => <option key={m.slug} value={m.slug}>{m.display_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-xs text-pm-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTaskPersonal}
                  onChange={(e) => setNewTaskPersonal(e.target.checked)}
                  className="rounded border-pm-border"
                />
                Personal project (private)
              </label>
              <label className="flex items-center gap-2 text-xs text-pm-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTaskNotify}
                  onChange={(e) => setNewTaskNotify(e.target.checked)}
                  className="rounded border-pm-border"
                />
                Email notify owner
              </label>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={createStandaloneTask}
                disabled={saving || !newTaskName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? "Adding..." : "Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-pm-muted">Loading...</p>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-16 text-pm-muted">
          <p className="text-lg mb-2">No tasks found</p>
          <p className="text-sm">
            {filter === "active" ? "All caught up! No active tasks." : "No tasks match the current filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Standalone tasks */}
          {standalone.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-pm-muted mb-2 px-3">Standalone Tasks</h2>
              <div className="space-y-0.5">
                {standalone.map((task) => <TaskRow key={task.id} task={task} />)}
              </div>
            </div>
          )}

          {/* Personal project tasks */}
          {personalProjectTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-pm-muted mb-2 px-3 flex items-center gap-2">
                Personal Project
                <span className="text-[10px] bg-pm-accent/10 text-pm-accent px-1.5 py-0.5 rounded">Private</span>
              </h2>
              <div className="space-y-0.5">
                {personalProjectTasks.map((task) => <TaskRow key={task.id} task={task} />)}
              </div>
            </div>
          )}

          {/* Project-grouped tasks */}
          {[...byProject.entries()].map(([projectId, { name, tasks: projectTasks }]) => (
            <div key={projectId}>
              <h2 className="text-sm font-medium text-pm-muted mb-2 px-3">
                <Link href={`/projects/${projectTasks[0]?.slug ? "" : ""}${projectId}`} className="hover:text-pm-accent transition-colors">
                  {name}
                </Link>
              </h2>
              <div className="space-y-0.5">
                {projectTasks.map((task) => <TaskRow key={task.id} task={task} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          memberMap={Object.fromEntries(members.map((m) => [m.slug, m.display_name]))}
          onClose={() => { setSelectedTask(null); loadTasks(); }}
        />
      )}
    </div>
  );
}
