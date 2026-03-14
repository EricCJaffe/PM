"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/types/pm";
import { StatusBadge } from "./StatusBadge";
import { Modal, Field, Input, Select, Textarea, ModalActions } from "./Modal";

const STATUS_OPTIONS = ["active", "on-hold", "paused", "complete", "archived"];

export function EditProjectHeader({ project }: { project: Project }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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
            {project.owner && <span>Owner: {project.owner}</span>}
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
              <Input value={form.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Owner name" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date">
                <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
              </Field>
              <Field label="Target Date">
                <Input type="date" value={form.target_date} onChange={(e) => set("target_date", e.target.value)} />
              </Field>
            </div>
            <ModalActions onClose={() => setOpen(false)} saving={saving} />
          </form>
        </Modal>
      )}
    </>
  );
}
