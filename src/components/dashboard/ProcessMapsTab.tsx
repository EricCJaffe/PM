"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Organization, ProcessMap, ProcessMapStep, ProjectWithStats } from "@/types/pm";
import { Modal, Field, Input, Select, Textarea, ModalActions } from "../Modal";

function newStep(name: string): ProcessMapStep {
  return { id: crypto.randomUUID(), name, status: "not-started" };
}

function ProcessMapModal({
  orgId,
  processMap,
  onClose,
  projectId,
}: {
  orgId: string;
  processMap?: ProcessMap;
  onClose: () => void;
  projectId?: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: processMap?.name ?? "",
    department: processMap?.department ?? "",
    description: processMap?.description ?? "",
  });
  const [steps, setSteps] = useState<ProcessMapStep[]>(processMap?.steps ?? []);
  const [newStepName, setNewStepName] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })); }

  function addStep() {
    if (!newStepName.trim()) return;
    setSteps((s) => [...s, newStep(newStepName.trim())]);
    setNewStepName("");
  }

  function removeStep(id: string) { setSteps((s) => s.filter((st) => st.id !== id)); }

  function updateStepStatus(id: string, status: ProcessMapStep["status"]) {
    setSteps((s) => s.map((st) => st.id === id ? { ...st, status } : st));
  }

  function handleDragOver(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === targetIdx) return;
    setSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDragIdx(targetIdx);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      department: form.department || null,
      description: form.description || null,
      steps,
    };
    if (processMap) {
      await fetch(`/api/pm/process-maps/${processMap.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/pm/process-maps", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, project_id: projectId || null, ...payload }),
      });
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!processMap) return;
    if (!confirm(`Delete process map "${processMap.name}"?`)) return;
    await fetch(`/api/pm/process-maps/${processMap.id}`, { method: "DELETE" });
    onClose();
    router.refresh();
  }

  return (
    <Modal title={processMap ? "Edit Process Map" : "New Process Map"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Process Name">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department">
            <Input value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Sales, HR" />
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <Field label="Steps">
          <div className="space-y-1 mb-2">
            {steps.map((step, i) => (
              <div
                key={step.id}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={() => setDragIdx(null)}
                className={`flex items-center gap-2 rounded px-1 py-1 transition-colors ${dragIdx === i ? "bg-pm-accent/10 border border-pm-accent/30" : "hover:bg-pm-bg/50"}`}
              >
                <span className="cursor-grab text-pm-muted hover:text-pm-text select-none" title="Drag to reorder">&#x2630;</span>
                <span className="text-xs text-pm-muted w-5">{i + 1}.</span>
                <span className="text-sm text-pm-text flex-1">{step.name}</span>
                <select
                  value={step.status}
                  onChange={(e) => updateStepStatus(step.id, e.target.value as ProcessMapStep["status"])}
                  className="bg-pm-bg border border-pm-border rounded px-2 py-1 text-xs text-pm-text"
                >
                  <option value="not-started">Not Started</option>
                  <option value="in-progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>
                <button type="button" onClick={() => removeStep(step.id)} className="text-pm-muted hover:text-pm-blocked text-xs">&times;</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newStepName}
              onChange={(e) => setNewStepName(e.target.value)}
              placeholder="Add a step…"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStep(); } }}
            />
            <button type="button" onClick={addStep} className="px-3 py-1 bg-pm-accent text-white text-sm rounded-lg shrink-0">+</button>
          </div>
        </Field>
        <div className="flex items-center justify-between pt-2">
          {processMap ? (
            <button type="button" onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300">Delete</button>
          ) : <span />}
          <ModalActions onClose={onClose} saving={saving} label={processMap ? "Save" : "Create"} />
        </div>
      </form>
    </Modal>
  );
}

export function ProcessMapsTab({ org, processMaps, projects, selectedProjectId }: { org: Organization; processMaps: ProcessMap[]; projects?: ProjectWithStats[]; selectedProjectId?: string | null }) {
  const [modal, setModal] = useState<ProcessMap | "new" | null>(null);

  const statusDot: Record<string, string> = {
    "complete": "bg-pm-complete",
    "in-progress": "bg-pm-in-progress",
    "not-started": "bg-pm-not-started",
  };

  const depts = [...new Set(processMaps.map((pm) => pm.department).filter(Boolean))] as string[];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-pm-muted">{processMaps.length} process maps</span>
          {depts.length > 0 && (
            <div className="flex gap-1">
              {depts.map((d) => (
                <span key={d} className="px-2 py-0.5 bg-pm-surface border border-pm-border rounded text-xs text-pm-muted">{d}</span>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setModal("new")} className="px-3 py-1.5 bg-pm-accent hover:bg-pm-accent-hover text-white text-sm rounded-lg font-medium">
          + New Process Map
        </button>
      </div>

      {processMaps.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-pm-muted">No process maps yet. Create one to visualize workflows.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {processMaps.map((pm) => (
            <div key={pm.id} className="card cursor-pointer hover:border-pm-accent/50 transition-colors" onClick={() => setModal(pm)}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-pm-text">{pm.name}</h3>
                  {pm.department && <span className="text-xs text-pm-muted">{pm.department}</span>}
                </div>
                <span className="text-xs text-pm-muted">{pm.steps.length} steps</span>
              </div>
              {pm.steps.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {pm.steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-pm-surface border border-pm-border rounded-full text-xs">
                        <span className={`w-2 h-2 rounded-full ${statusDot[step.status]}`} />
                        <span className="text-pm-text">{step.name}</span>
                      </div>
                      {i < pm.steps.length - 1 && <span className="text-pm-muted">&rarr;</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal === "new" && <ProcessMapModal orgId={org.id} onClose={() => setModal(null)} projectId={selectedProjectId} />}
      {modal && modal !== "new" && <ProcessMapModal orgId={org.id} processMap={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
