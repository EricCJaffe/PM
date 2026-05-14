"use client";

import { useState } from "react";

interface PortalTask {
  id: string;
  name: string;
  description: string | null;
  status: string;
  due_date: string | null;
  owner: string | null;
  assigned_to: string | null;
  phase_id: string | null;
  project_id: string | null;
}

interface PortalTasksClientProps {
  orgId: string;
  orgSlug: string;
  tasks: PortalTask[];
  projectNames: Record<string, string>;
  allowCreate: boolean;
}

const STATUS_OPTIONS = ["not-started", "in-progress", "pending", "blocked", "complete"] as const;
const STATUS_NEXT: Record<string, string> = {
  "not-started": "in-progress",
  "in-progress": "complete",
  "pending": "in-progress",
  "blocked": "in-progress",
  "complete": "not-started",
};

const STATUS_COLORS: Record<string, string> = {
  "complete": "bg-emerald-500/20 text-emerald-400",
  "in-progress": "bg-blue-500/20 text-blue-400",
  "blocked": "bg-red-500/20 text-red-400",
  "pending": "bg-amber-500/20 text-amber-400",
  "not-started": "bg-gray-500/20 text-gray-400",
};

type StatusFilter = "all" | "active" | "complete";

export function PortalTasksClient({ orgId, tasks: initialTasks, projectNames, allowCreate }: PortalTasksClientProps) {
  const [tasks, setTasks] = useState<PortalTask[]>(initialTasks);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({ name: "", description: "", due_date: "" });
  const [saving, setSaving] = useState(false);

  const filtered = tasks.filter((t) => {
    if (filter === "active") return t.status !== "complete";
    if (filter === "complete") return t.status === "complete";
    return true;
  });

  async function updateStatus(task: PortalTask, newStatus: string) {
    setUpdating(task.id);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await fetch(`/api/pm/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // Revert on failure
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: task.status } : t));
    } finally {
      setUpdating(null);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTask.name.trim(),
          description: newTask.description.trim() || null,
          due_date: newTask.due_date || null,
          org_id: orgId,
          status: "not-started",
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setTasks((prev) => [created, ...prev]);
        setNewTask({ name: "", description: "", due_date: "" });
        setShowAddForm(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-pm-text">Tasks</h2>
        <div className="flex items-center gap-2">
          {/* Filter pills */}
          <div className="flex rounded-lg border border-pm-border overflow-hidden text-xs">
            {(["active", "all", "complete"] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 capitalize transition-colors ${
                  filter === f ? "bg-pm-accent text-white" : "text-pm-muted hover:text-pm-text"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {allowCreate && (
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Task
            </button>
          )}
        </div>
      </div>

      {/* Add task form */}
      {showAddForm && (
        <form onSubmit={handleAddTask} className="bg-pm-card border border-blue-500/30 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-pm-text">New Task</h3>
          <input
            type="text"
            placeholder="Task name *"
            value={newTask.name}
            onChange={(e) => setNewTask((f) => ({ ...f, name: e.target.value }))}
            className="w-full text-sm bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text placeholder:text-pm-muted focus:outline-none focus:border-blue-500"
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={newTask.description}
            onChange={(e) => setNewTask((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full text-sm bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text placeholder:text-pm-muted focus:outline-none focus:border-blue-500 resize-none"
          />
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask((f) => ({ ...f, due_date: e.target.value }))}
              className="text-sm bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-pm-border text-pm-muted hover:text-pm-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !newTask.name.trim()}
                className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Add Task"}
              </button>
            </div>
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="bg-pm-card border border-pm-border rounded-lg p-8 text-center">
          <p className="text-pm-muted text-sm">
            {filter === "complete" ? "No completed tasks yet." : "No active tasks."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div
              key={task.id}
              className={`bg-pm-card border border-pm-border rounded-lg p-4 transition-opacity ${
                updating === task.id ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox-style status toggle */}
                <button
                  onClick={() => updateStatus(task, STATUS_NEXT[task.status] ?? "in-progress")}
                  disabled={updating === task.id}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    task.status === "complete"
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-pm-border hover:border-blue-400"
                  }`}
                  title={`Mark as ${STATUS_NEXT[task.status] ?? "in-progress"}`}
                >
                  {task.status === "complete" && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium ${task.status === "complete" ? "line-through text-pm-muted" : "text-pm-text"}`}>
                      {task.name}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Status dropdown */}
                      <select
                        value={task.status}
                        onChange={(e) => updateStatus(task, e.target.value)}
                        disabled={updating === task.id}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[task.status] ?? "bg-gray-500/20 text-gray-400"}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s.replace("-", " ")}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {task.description && (
                    <p className="text-xs text-pm-muted mt-0.5 line-clamp-2">{task.description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-pm-muted">
                    {task.project_id && projectNames[task.project_id] && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        {projectNames[task.project_id]}
                      </span>
                    )}
                    {task.due_date && (
                      <span className={new Date(task.due_date) < new Date() && task.status !== "complete" ? "text-red-400" : ""}>
                        Due {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {task.owner && <span>Owner: {task.owner}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-pm-muted text-center">
        {filtered.length} task{filtered.length !== 1 ? "s" : ""} shown
        {filter !== "all" && ` · `}
        {filter !== "all" && (
          <button onClick={() => setFilter("all")} className="underline hover:text-pm-text">
            show all
          </button>
        )}
      </p>
    </div>
  );
}
