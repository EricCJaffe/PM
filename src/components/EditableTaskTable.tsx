"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Task, PhaseWithTasks } from "@/types/pm";
import { StatusBadge } from "./StatusBadge";
import { Modal, Field, Input, Select, Textarea, ModalActions } from "./Modal";
import { OwnerPicker } from "./OwnerPicker";

const STATUSES = ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"] as const;

function TaskModal({
  projectId,
  orgId,
  phases,
  task,
  onClose,
}: {
  projectId: string;
  orgId: string;
  phases: PhaseWithTasks[];
  task?: Task;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: task?.name ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "not-started",
    owner: task?.owner ?? "",
    due_date: task?.due_date ?? "",
    phase_id: task?.phase_id ?? "",
  });

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, due_date: form.due_date || null, phase_id: form.phase_id || null };
    const url = task ? `/api/pm/tasks/${task.id}` : "/api/pm/tasks";
    const method = task ? "PATCH" : "POST";
    const body = task ? payload : { project_id: projectId, ...payload };
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
      alert(`Failed to save task: ${error}`);
      return;
    }
    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm(`Delete task "${task.name}"?`)) return;
    await fetch(`/api/pm/tasks/${task.id}`, { method: "DELETE" });
    onClose();
    router.refresh();
  }

  return (
    <Modal title={task ? "Edit Task" : "Add Task"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Task Name">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional details…" />
        </Field>
        <Field label="Phase">
          <Select value={form.phase_id} onChange={(e) => set("phase_id", e.target.value)}>
            <option value="">— No phase —</option>
            {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Due Date">
            <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </Field>
        </div>
        <Field label="Owner">
          <OwnerPicker orgId={orgId} value={form.owner} onChange={(v) => set("owner", v)} />
        </Field>
        <div className="flex items-center justify-between pt-2">
          {task ? (
            <button type="button" onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300">Delete task</button>
          ) : <span />}
          <ModalActions onClose={onClose} saving={saving} label={task ? "Save Changes" : "Add Task"} />
        </div>
      </form>
    </Modal>
  );
}

export function EditableTaskTable({
  tasks,
  phases,
  projectId,
  orgId,
}: {
  tasks: Task[];
  phases: PhaseWithTasks[];
  projectId: string;
  orgId: string;
}) {
  const [modal, setModal] = useState<Task | "new" | null>(null);
  const phaseMap = new Map(phases.map((p) => [p.id, p.name]));

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-pm-muted">{tasks.length} tasks</span>
        <button
          onClick={() => setModal("new")}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium"
        >
          + Add Task
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-pm-muted text-center py-8">No tasks yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pm-border text-pm-muted text-left">
                <th className="py-2 pr-4">Task</th>
                <th className="py-2 pr-4">Phase</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  className="border-b border-pm-border/50 hover:bg-pm-card/50 cursor-pointer"
                  onClick={() => setModal(task)}
                >
                  <td className="py-2 pr-4">
                    <div className="font-medium text-pm-text">{task.name}</div>
                    {task.description && (
                      <div className="text-xs text-pm-muted truncate max-w-xs">{task.description}</div>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-pm-muted text-xs">
                    {task.phase_id ? phaseMap.get(task.phase_id) ?? "—" : "—"}
                  </td>
                  <td className="py-2 pr-4"><StatusBadge status={task.status} /></td>
                  <td className="py-2 pr-4 text-pm-muted">{task.owner || "—"}</td>
                  <td className="py-2 pr-4 text-pm-muted">{task.due_date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === "new" && (
        <TaskModal projectId={projectId} orgId={orgId} phases={phases} onClose={() => setModal(null)} />
      )}
      {modal && modal !== "new" && (
        <TaskModal projectId={projectId} orgId={orgId} phases={phases} task={modal} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
