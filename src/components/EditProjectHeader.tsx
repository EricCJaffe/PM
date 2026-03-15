"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/types/pm";
import { StatusBadge } from "./StatusBadge";
import { Modal, Field, Input, Select, Textarea, ModalActions } from "./Modal";
import { OwnerPicker } from "./OwnerPicker";

const STATUS_OPTIONS = ["active", "on-hold", "paused", "complete", "archived"];

interface DepCounts { phases: number; tasks: number; risks: number }

export function EditProjectHeader({ project, orgId, memberMap }: { project: Project; orgId: string; memberMap: Record<string, string> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deps, setDeps] = useState<DepCounts | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    status: project.status,
    owner: project.owner ?? "",
    start_date: project.start_date ?? "",
    target_date: project.target_date ?? "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/pm/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  async function initiateDelete() {
    // Fetch dependency counts
    try {
      const res = await fetch(`/api/pm/projects/${project.id}`);
      const data = await res.json();
      setDeps(data);
      setShowDeleteConfirm(true);
    } catch {
      setShowDeleteConfirm(true);
      setDeps(null);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/pm/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error);
      }
      router.push("/projects");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete project");
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-pm-text truncate">{project.name}</h1>
            <button
              onClick={() => setOpen(true)}
              className="text-pm-muted hover:text-pm-text shrink-0 mt-1"
              title="Edit project"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-1.414A2 2 0 019 13z" />
              </svg>
            </button>
          </div>
          {project.description && <p className="text-pm-muted mt-1">{project.description}</p>}
          <div className="flex items-center gap-4 mt-2 text-xs text-pm-muted">
            {project.owner && <span>Owner: {memberMap[project.owner] || project.owner}</span>}
            {project.start_date && <span>Start: {project.start_date}</span>}
            {project.target_date && <span>Target: {project.target_date}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <StatusBadge status={project.status} />
        </div>
      </div>

      {open && (
        <Modal title="Edit Project" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit}>
            <Field label="Project Name">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </Field>
            <Field label="Description">
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Owner">
              <OwnerPicker orgId={orgId} value={form.owner} onChange={(v) => set("owner", v)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date">
                <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
              </Field>
              <Field label="Target Date">
                <Input type="date" value={form.target_date} onChange={(e) => set("target_date", e.target.value)} />
              </Field>
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={initiateDelete}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Delete project
              </button>
              <ModalActions onClose={() => setOpen(false)} saving={saving} />
            </div>
          </form>
        </Modal>
      )}

      {showDeleteConfirm && (
        <Modal title="Delete Project" onClose={() => setShowDeleteConfirm(false)}>
          <div className="space-y-4">
            <p className="text-pm-text">
              Are you sure you want to delete <strong>{project.name}</strong>?
            </p>
            {deps && (deps.phases > 0 || deps.tasks > 0 || deps.risks > 0) && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm">
                <p className="text-red-400 font-medium mb-2">This will permanently delete:</p>
                <ul className="text-pm-muted space-y-1">
                  {deps.phases > 0 && <li>{deps.phases} phase{deps.phases !== 1 ? "s" : ""}</li>}
                  {deps.tasks > 0 && <li>{deps.tasks} task{deps.tasks !== 1 ? "s" : ""}</li>}
                  {deps.risks > 0 && <li>{deps.risks} risk{deps.risks !== 1 ? "s" : ""}</li>}
                </ul>
              </div>
            )}
            <p className="text-sm text-pm-muted">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-pm-muted hover:text-pm-text rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {deleting ? "Deleting..." : "Delete Project"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
