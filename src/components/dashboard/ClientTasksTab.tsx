"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Organization } from "@/types/pm";
import { StatusBadge } from "@/components/StatusBadge";
import { useRealtimeTable } from "@/lib/useRealtimeTable";

type TaskStatus = "not-started" | "in-progress" | "complete" | "blocked" | "pending" | "on-hold";

interface ClientTask {
  id: string;
  name: string;
  description: string | null;
  status: TaskStatus;
  owner: string | null;
  assigned_to: string | null;
  due_date: string | null;
  project_id: string | null;
  project_name: string | null;
  org_id: string | null;
  org_name: string | null;
  created_at: string;
  subtasks: { text: string; done: boolean }[] | null;
}

interface AssignableMember {
  slug: string;
  display_name: string;
}

const STATUS_OPTIONS: TaskStatus[] = ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"];

export function ClientTasksTab({ org }: { org: Organization }) {
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "not-started" as TaskStatus,
    assigned_to: "",
    due_date: "",
  });

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

  // Realtime: refetch when any task for this org changes
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
  }, [org.id]);

  const filtered = useMemo(() => {
    let result = tasks;
    if (statusFilter !== "all") result = result.filter((t) => t.status === statusFilter);
    return result;
  }, [tasks, statusFilter]);

  // Split into client-level (no project) and project tasks
  const clientTasks = useMemo(() => filtered.filter((t) => !t.project_id), [filtered]);
  const projectTasks = useMemo(() => filtered.filter((t) => t.project_id), [filtered]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tasks.length };
    for (const s of STATUS_OPTIONS) counts[s] = tasks.filter((t) => t.status === s).length;
    return counts;
  }, [tasks]);

  const resetForm = () => {
    setForm({ name: "", description: "", status: "not-started", assigned_to: "", due_date: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (task: ClientTask) => {
    setForm({
      name: task.name,
      description: task.description || "",
      status: task.status,
      assigned_to: task.assigned_to || task.owner || "",
      due_date: task.due_date || "",
    });
    setEditingId(task.id);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/pm/tasks/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            description: form.description || null,
            status: form.status,
            assigned_to: form.assigned_to || null,
            owner: form.assigned_to || null,
            due_date: form.due_date || null,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...data } : t)));
      } else {
        const res = await fetch("/api/pm/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            description: form.description || null,
            status: form.status,
            assigned_to: form.assigned_to || null,
            owner: form.assigned_to || null,
            due_date: form.due_date || null,
            org_id: org.id,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setTasks((prev) => [...prev, { ...data, project_name: null, org_name: org.name }]);
      }
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    try {
      await fetch(`/api/pm/tasks/${id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch {}
  };

  const quickStatus = async (id: string, status: TaskStatus) => {
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
      // Remove from this view since it moved away
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
    // Load orgs for the dropdown
    if (orgs.length === 0) {
      fetch("/api/pm/organizations")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setOrgs(data.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name }))); })
        .catch(() => {});
    }
  };

  function TaskRow({ task }: { task: ClientTask }) {
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "complete";
    return (
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-pm-bg/50 group transition-colors">
        {/* Quick complete checkbox */}
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

        {/* Task info */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${task.status === "complete" ? "text-pm-muted line-through" : "text-pm-text"}`}>
            {task.name}
          </div>
          {task.description && (
            <div className="text-xs text-pm-muted truncate mt-0.5">{task.description}</div>
          )}
        </div>

        {/* Assignee */}
        {(task.assigned_to || task.owner) && (
          <span className="text-xs text-pm-muted shrink-0">{task.assigned_to || task.owner}</span>
        )}

        {/* Due date */}
        {task.due_date && (
          <span className={`text-xs shrink-0 ${isOverdue ? "text-red-400 font-medium" : "text-pm-muted"}`}>
            {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}

        {/* Status badge */}
        <StatusBadge status={task.status} />

        {/* Project badge (if project-linked) */}
        {task.project_name && (
          <span className="text-xs bg-pm-accent/10 text-pm-accent px-2 py-0.5 rounded-full shrink-0 max-w-[120px] truncate">
            {task.project_name}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => startEdit(task)} className="p-1 text-pm-muted hover:text-pm-text" title="Edit">
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

  if (loading) return <div className="text-pm-muted py-8">Loading tasks...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-pm-muted">{tasks.length} task{tasks.length !== 1 ? "s" : ""} for this client</div>
        <button
          onClick={() => showForm ? resetForm() : setShowForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? "Cancel" : "+ New Task"}
        </button>
      </div>

      {/* Status filter pills */}
      {tasks.length > 0 && (
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
      )}

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSave} className="card space-y-4">
          <div className="text-sm font-semibold text-pm-text">{editingId ? "Edit Task" : "New Client Task"}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-pm-muted mb-1">Task Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="e.g. Follow up on contract review"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-pm-muted mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
                placeholder="Optional details..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-pm-muted mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace("-", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-pm-muted mb-1">Assigned To</label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.slug} value={m.slug}>{m.display_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-pm-muted mb-1">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !form.name} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Task"}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-pm-muted hover:text-pm-text rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Client-level tasks */}
      {clientTasks.length > 0 && (
        <div className="card">
          <div className="text-xs font-medium text-pm-muted uppercase tracking-wider mb-2">Client Tasks</div>
          <div className="divide-y divide-pm-border">
            {clientTasks.map((t) => <TaskRow key={t.id} task={t} />)}
          </div>
        </div>
      )}

      {/* Project-linked tasks */}
      {projectTasks.length > 0 && (
        <div className="card">
          <div className="text-xs font-medium text-pm-muted uppercase tracking-wider mb-2">Project Tasks</div>
          <div className="divide-y divide-pm-border">
            {projectTasks.map((t) => <TaskRow key={t.id} task={t} />)}
          </div>
        </div>
      )}

      {tasks.length === 0 && !showForm && (
        <div className="text-center py-12 text-pm-muted">
          <p className="text-lg mb-2">No tasks for this client</p>
          <p className="text-sm">Create a task to track follow-ups, action items, and to-dos.</p>
        </div>
      )}

      {filtered.length === 0 && tasks.length > 0 && (
        <div className="text-center py-8 text-pm-muted text-sm">No tasks match the current filter.</div>
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
