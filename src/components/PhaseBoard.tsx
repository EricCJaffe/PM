"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PhaseWithTasks, Task } from "@/types/pm";
import { StatusBadge } from "./StatusBadge";
import { ProgressBar } from "./ProgressBar";
import { Modal, Field, Input, Select, Textarea, ModalActions } from "./Modal";
import { OwnerPicker } from "./OwnerPicker";
import { TaskDetailModal } from "./TaskDetailModal";

const PHASE_STATUSES = ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"] as const;

// ─── Phase Modal ──────────────────────────────────────────────────────────────

function PhaseModal({
  projectId,
  orgId,
  phase,
  onClose,
}: {
  projectId: string;
  orgId: string;
  phase?: PhaseWithTasks;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: phase?.name ?? "",
    group: phase?.group ?? "",
    status: phase?.status ?? "not-started",
    owner: phase?.owner ?? "",
    progress: String(phase?.progress ?? 0),
    start_date: phase?.start_date ?? "",
    due_date: phase?.due_date ?? "",
  });

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      progress: parseInt(form.progress) || 0,
      group: form.group || null,
      owner: form.owner || null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
    };
    if (phase) {
      await fetch(`/api/pm/phases/${phase.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/pm/phases", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, ...payload }),
      });
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!phase) return;
    if (!confirm(`Delete phase "${phase.name}" and all its tasks?`)) return;
    await fetch(`/api/pm/phases/${phase.id}`, { method: "DELETE" });
    onClose();
    router.refresh();
  }

  return (
    <Modal title={phase ? "Edit Phase" : "Add Phase"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Phase Name">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Group Label" hint="e.g. BUILD, GROW, FOUNDATION">
            <Input value={form.group} onChange={(e) => set("group", e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {PHASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner">
            <OwnerPicker orgId={orgId} value={form.owner} onChange={(v) => set("owner", v)} />
          </Field>
          <Field label="Progress %" hint="0–100">
            <Input type="number" min={0} max={100} value={form.progress} onChange={(e) => set("progress", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date">
            <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </Field>
          <Field label="Due Date">
            <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center justify-between pt-2">
          {phase ? (
            <button type="button" onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300">
              Delete phase
            </button>
          ) : <span />}
          <ModalActions onClose={onClose} saving={saving} label={phase ? "Save Changes" : "Add Phase"} />
        </div>
      </form>
    </Modal>
  );
}

// ─── Phase Card ───────────────────────────────────────────────────────────────

function PhaseBoardCard({
  phase,
  projectId,
  orgId,
  memberMap,
}: {
  phase: PhaseWithTasks;
  projectId: string;
  orgId: string;
  memberMap: Record<string, string>;
}) {
  const router = useRouter();
  const [editPhase, setEditPhase] = useState(false);
  const [editTask, setEditTask] = useState<Task | null | "new">(null);

  const complete = phase.tasks.filter((t) => t.status === "complete").length;
  const total = phase.tasks.length;
  const progress = total > 0 ? Math.round((complete / total) * 100) : phase.progress;

  const statusDot: Record<string, string> = {
    "complete": "bg-green-500",
    "in-progress": "bg-blue-500",
    "blocked": "bg-red-500",
    "not-started": "bg-slate-500",
    "pending": "bg-yellow-500",
    "on-hold": "bg-orange-500",
  };

  return (
    <>
      <div className="card flex flex-col">
        {/* Phase header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-xs text-pm-muted font-mono">
                P{String(phase.phase_order).padStart(2, "0")}
              </span>
              {phase.group && (
                <span className="text-xs text-pm-muted uppercase tracking-wider">· {phase.group}</span>
              )}
            </div>
            <h3 className="font-semibold text-pm-text leading-tight">{phase.name}</h3>
            {phase.owner && <p className="text-xs text-pm-muted mt-0.5">Owner: {memberMap[phase.owner] || phase.owner}</p>}
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <StatusBadge status={phase.status} />
            <button
              onClick={() => setEditPhase(true)}
              className="p-1 text-pm-muted hover:text-pm-text rounded"
              title="Edit phase"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-1.414A2 2 0 019 13z" />
              </svg>
            </button>
          </div>
        </div>

        <ProgressBar value={progress} className="mb-2" />
        <div className="text-xs text-pm-muted mb-3">{complete}/{total} tasks · {progress}%</div>

        {/* Task list */}
        <div className="space-y-1 flex-1">
          {phase.tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => setEditTask(task)}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-pm-bg group transition-colors"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[task.status] ?? "bg-slate-500"}`} />
              <span className="text-sm text-pm-text/90 truncate flex-1">{task.name}</span>
              {task.owner && <span className="text-xs text-pm-muted shrink-0">{memberMap[task.owner] || task.owner}</span>}
              {task.due_date && (
                <span className="text-xs text-pm-muted shrink-0">{task.due_date}</span>
              )}
            </button>
          ))}
        </div>

        {/* Add task */}
        <button
          onClick={() => setEditTask("new")}
          className="mt-3 pt-3 border-t border-pm-border w-full text-left text-xs text-pm-muted hover:text-pm-text flex items-center gap-1 transition-colors"
        >
          <span className="text-base leading-none">+</span> Add task
        </button>
      </div>

      {editPhase && <PhaseModal projectId={projectId} orgId={orgId} phase={phase} onClose={() => setEditPhase(false)} />}
      {editTask === "new" && (
        <TaskDetailModal
          task={null}
          memberMap={memberMap}
          orgId={orgId}
          onClose={() => { setEditTask(null); router.refresh(); }}
          createContext={{
            project_id: projectId,
            phase_id: phase.id,
            org_id: orgId,
          }}
        />
      )}
      {editTask && editTask !== "new" && (
        <TaskDetailModal
          task={editTask}
          memberMap={memberMap}
          orgId={orgId}
          onDelete={() => router.refresh()}
          onClose={() => { setEditTask(null); router.refresh(); }}
        />
      )}
    </>
  );
}

// ─── Phase Board ─────────────────────────────────────────────────────────────

export function PhaseBoard({
  phases,
  projectId,
  orgId,
  memberMap,
}: {
  phases: PhaseWithTasks[];
  projectId: string;
  orgId: string;
  memberMap: Record<string, string>;
}) {
  const [addPhase, setAddPhase] = useState(false);

  const groups = new Map<string | null, PhaseWithTasks[]>();
  for (const phase of phases) {
    const g = phase.group ?? null;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(phase);
  }

  return (
    <div className="mt-6 space-y-8">
      {Array.from(groups.entries()).map(([group, groupPhases]) => (
        <div key={group ?? "ungrouped"}>
          {group && (
            <h2 className="text-sm font-semibold text-pm-muted uppercase tracking-wider mb-3">{group}</h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupPhases.map((phase) => (
              <PhaseBoardCard key={phase.id} phase={phase} projectId={projectId} orgId={orgId} memberMap={memberMap} />
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={() => setAddPhase(true)}
        className="flex items-center gap-2 px-4 py-2 border border-dashed border-pm-border rounded-lg text-pm-muted hover:text-pm-text hover:border-pm-muted text-sm transition-colors"
      >
        <span className="text-base">+</span> Add Phase
      </button>

      {phases.length === 0 && (
        <p className="text-pm-muted text-center py-8">No phases yet. Add one below or use the AI Assistant.</p>
      )}

      {addPhase && <PhaseModal projectId={projectId} orgId={orgId} onClose={() => setAddPhase(false)} />}
    </div>
  );
}
