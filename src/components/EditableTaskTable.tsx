"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Task, PhaseWithTasks } from "@/types/pm";
import { StatusBadge } from "./StatusBadge";
import { Modal, Field, Input, Select, Textarea, ModalActions } from "./Modal";
import { OwnerPicker } from "./OwnerPicker";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const STATUSES = ["not-started", "in-progress", "complete", "blocked", "pending", "on-hold"] as const;

// ─── Task Modal ──────────────────────────────────────────────────────────────

function TaskModal({
  projectId,
  orgId,
  phases,
  task,
  defaultPhaseId,
  onClose,
}: {
  projectId: string;
  orgId: string;
  phases: PhaseWithTasks[];
  task?: Task;
  defaultPhaseId?: string;
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
    phase_id: task?.phase_id ?? defaultPhaseId ?? "",
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

// ─── Sortable Task Row ───────────────────────────────────────────────────────

function SortableTaskRow({
  task,
  onEdit,
}: {
  task: Task;
  onEdit: (task: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-pm-bg/50 group border border-transparent hover:border-pm-border/50 transition-colors"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-pm-muted/40 hover:text-pm-muted cursor-grab active:cursor-grabbing shrink-0 touch-none"
        title="Drag to reorder"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>

      {/* Task content (clickable to edit) */}
      <button
        onClick={() => onEdit(task)}
        className="flex-1 flex items-center gap-3 text-left min-w-0"
      >
        <StatusBadge status={task.status} />
        <span className="text-sm text-pm-text truncate flex-1">{task.name}</span>
        {task.owner && <span className="text-xs text-pm-muted shrink-0">{task.owner}</span>}
        {task.due_date && <span className="text-xs text-pm-muted shrink-0">{task.due_date}</span>}
      </button>
    </div>
  );
}

// ─── Drag Overlay (ghost while dragging) ─────────────────────────────────────

function TaskDragOverlay({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-pm-card border border-pm-accent/50 shadow-lg shadow-black/20">
      <span className="text-pm-muted/40 shrink-0">
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
        </svg>
      </span>
      <StatusBadge status={task.status} />
      <span className="text-sm text-pm-text truncate flex-1">{task.name}</span>
    </div>
  );
}

// ─── Phase Section ───────────────────────────────────────────────────────────

function PhaseSection({
  phase,
  tasks,
  onEditTask,
  onAddTask,
}: {
  phase: { id: string; name: string; group: string | null; phase_order: number };
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onAddTask: (phaseId: string) => void;
}) {
  const complete = tasks.filter((t) => t.status === "complete").length;
  const total = tasks.length;
  const progress = total > 0 ? Math.round((complete / total) * 100) : 0;

  return (
    <div className="mb-6">
      {/* Phase header */}
      <div className="flex items-center gap-3 mb-2 px-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {phase.group && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-pm-accent bg-pm-accent/10 px-1.5 py-0.5 rounded shrink-0">
              {phase.group}
            </span>
          )}
          <span className="text-xs text-pm-muted font-mono shrink-0">
            P{String(phase.phase_order).padStart(2, "0")}
          </span>
          <h3 className="font-semibold text-pm-text truncate">{phase.name}</h3>
        </div>
        <span className="text-xs text-pm-muted shrink-0">{complete}/{total} done</span>
        <div className="w-20 shrink-0">
          <div className="h-1.5 bg-pm-border rounded-full overflow-hidden">
            <div className="h-full bg-pm-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <button
          onClick={() => onAddTask(phase.id)}
          className="text-xs text-pm-muted hover:text-pm-accent shrink-0 transition-colors"
          title="Add task to this phase"
        >
          + Add
        </button>
      </div>

      {/* Tasks in this phase */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="ml-2 border-l-2 border-pm-border/50 pl-2">
          {tasks.length === 0 ? (
            <div className="px-3 py-2 text-xs text-pm-muted italic">No tasks</div>
          ) : (
            tasks.map((task) => (
              <SortableTaskRow key={task.id} task={task} onEdit={onEditTask} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function EditableTaskTable({
  tasks: initialTasks,
  phases,
  projectId,
  orgId,
}: {
  tasks: Task[];
  phases: PhaseWithTasks[];
  projectId: string;
  orgId: string;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{ task?: Task; phaseId?: string } | null>(null);
  const [tasks, setTasks] = useState(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Build phase → tasks map
  const tasksByPhase = new Map<string, Task[]>();
  const unassigned: Task[] = [];
  for (const phase of phases) {
    tasksByPhase.set(phase.id, []);
  }
  for (const task of tasks) {
    if (task.phase_id && tasksByPhase.has(task.phase_id)) {
      tasksByPhase.get(task.phase_id)!.push(task);
    } else {
      unassigned.push(task);
    }
  }

  // Find which phase a task belongs to
  const findPhaseForTask = useCallback((taskId: string): string | null => {
    for (const [phaseId, phaseTasks] of tasksByPhase) {
      if (phaseTasks.some((t) => t.id === taskId)) return phaseId;
    }
    if (unassigned.some((t) => t.id === taskId)) return "__unassigned__";
    return null;
  }, [tasksByPhase, unassigned]);

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activePhase = findPhaseForTask(active.id as string);
    const overPhase = findPhaseForTask(over.id as string);

    // If dragging between phases, move the task
    if (activePhase && overPhase && activePhase !== overPhase) {
      setTasks((prev) => {
        const task = prev.find((t) => t.id === active.id);
        if (!task) return prev;
        const newPhaseId = overPhase === "__unassigned__" ? null : overPhase;
        return prev.map((t) => t.id === active.id ? { ...t, phase_id: newPhaseId } : t);
      });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which phase the task is now in
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    const phaseId = task.phase_id;
    const phaseTasks = phaseId
      ? tasks.filter((t) => t.phase_id === phaseId)
      : tasks.filter((t) => !t.phase_id);

    // Reorder within the phase
    const oldIndex = phaseTasks.findIndex((t) => t.id === activeId);
    const newIndex = phaseTasks.findIndex((t) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      // Might be a cross-phase move with no reorder needed
      if (activeId !== overId) {
        // Save the phase change
        await fetch(`/api/pm/tasks/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phase_id: phaseId }),
        });
        router.refresh();
      }
      return;
    }

    // Reorder
    const reordered = [...phaseTasks];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Update local state
    const newTasks = tasks.map((t) => {
      const idx = reordered.findIndex((r) => r.id === t.id);
      if (idx !== -1) return { ...t, sort_order: idx };
      return t;
    });
    setTasks(newTasks);

    // Persist
    const reorderPayload = reordered.map((t, i) => ({
      id: t.id,
      sort_order: i,
      phase_id: phaseId,
    }));

    await fetch("/api/pm/tasks/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks: reorderPayload }),
    });
    router.refresh();
  }

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-pm-muted">{tasks.length} tasks across {phases.length} phases</span>
        <div className="flex gap-2">
          <button
            onClick={() => setModal({ phaseId: "" })}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium"
          >
            + Add Task
          </button>
        </div>
      </div>

      {tasks.length === 0 && phases.length === 0 ? (
        <p className="text-pm-muted text-center py-8">No phases or tasks yet. Add a phase from the Board tab, then add tasks here.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Phases with their tasks */}
          {phases.map((phase) => (
            <PhaseSection
              key={phase.id}
              phase={phase}
              tasks={tasksByPhase.get(phase.id) ?? []}
              onEditTask={(task) => setModal({ task })}
              onAddTask={(phaseId) => setModal({ phaseId })}
            />
          ))}

          {/* Unassigned tasks */}
          {unassigned.length > 0 && (
            <PhaseSection
              phase={{ id: "__unassigned__", name: "Unassigned Tasks", group: null, phase_order: 999 }}
              tasks={unassigned}
              onEditTask={(task) => setModal({ task })}
              onAddTask={() => setModal({ phaseId: "" })}
            />
          )}

          <DragOverlay>
            {activeTask ? <TaskDragOverlay task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal */}
      {modal && !modal.task && (
        <TaskModal
          projectId={projectId}
          orgId={orgId}
          phases={phases}
          defaultPhaseId={modal.phaseId}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.task && (
        <TaskModal
          projectId={projectId}
          orgId={orgId}
          phases={phases}
          task={modal.task}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
